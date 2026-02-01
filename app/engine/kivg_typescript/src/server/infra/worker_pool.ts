import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';

export interface WorkerTask {
    id: number;
    type: 'scene' | 'transition';
    sceneIndex: number;
    nextSceneIndex?: number;
    time: number;
    transitionProgress?: number;
    sceneBaseTime: number;
    sceneConfig: any;
    nextSceneConfig?: any;
}

const MAX_TASKS_PER_WORKER = 200;
const MAX_RETRIES = 3;

interface WorkerWrapper {
    worker: Worker;
    tasksCompleted: number;
    isTerminating: boolean;
}

export class WorkerPool {
    private workers: WorkerWrapper[] = [];
    private idleWorkers: WorkerWrapper[] = [];
    private taskQueue: { task: any, whiteboardSettings: any, resolve: Function, reject: Function, retries: number }[] = [];
    private resolvers: Map<number, { resolve: Function, reject: Function, task: any, whiteboardSettings: any, retries: number }> = new Map();

    constructor(private poolSize: number, private workerScriptPath: string) {
        for (let i = 0; i < poolSize; i++) {
            this.spawnWorker();
        }
    }

    private spawnWorker(): WorkerWrapper {
        const execArgv = ['-r', 'ts-node/register'];

        const worker = new Worker(this.workerScriptPath, {
            execArgv,
            env: {
                ...process.env,
                TS_NODE_PROJECT: path.join(process.cwd(), 'tsconfig.examples.json')
            }
        });
        const wrapper: WorkerWrapper = { worker, tasksCompleted: 0, isTerminating: false };

        worker.on('message', (message) => {
            const { id, buffer, error, success } = message;
            const resolver = this.resolvers.get(id);
            if (resolver) {
                this.resolvers.delete(id);

                if (success) {
                    wrapper.tasksCompleted++;

                    // Recycle worker if it has processed too many tasks
                    if (wrapper.tasksCompleted >= MAX_TASKS_PER_WORKER) {
                        this.recycleWorker(wrapper);
                    } else {
                        this.idleWorkers.push(wrapper);
                    }

                    // buffer is null if task.filePath was provided and written successfully
                    resolver.resolve(buffer);
                } else {
                    // Handle failure with retry
                    if (resolver.retries < MAX_RETRIES) {
                        console.warn(`[WorkerPool] Task ${id} failed, retrying (${resolver.retries + 1}/${MAX_RETRIES}): ${error}`);
                        this.taskQueue.unshift({
                            task: resolver.task,
                            whiteboardSettings: resolver.whiteboardSettings,
                            resolve: resolver.resolve,
                            reject: resolver.reject,
                            retries: resolver.retries + 1
                        });
                        this.idleWorkers.push(wrapper);
                    } else {
                        console.error(`[WorkerPool] Task ${id} failed after ${MAX_RETRIES} retries: ${error}`);
                        resolver.reject(new Error(error || 'Unknown worker error after retries'));
                        this.idleWorkers.push(wrapper);
                    }
                }

                this.processQueue();
            }
        });

        worker.on('error', (err) => {
            if (wrapper.isTerminating) return;
            console.error('[WorkerPool] Worker error:', err);
            this.handleWorkerCrash(wrapper);
        });

        worker.on('exit', (code) => {
            if (wrapper.isTerminating) return;
            if (code !== 0) {
                console.error(`[WorkerPool] Worker stopped unexpectedly with exit code ${code}`);
                this.handleWorkerCrash(wrapper);
            }
        });

        this.workers.push(wrapper);
        this.idleWorkers.push(wrapper);
        return wrapper;
    }

    private handleWorkerCrash(wrapper: WorkerWrapper) {
        if (!this.workers.includes(wrapper)) return;

        this.removeWorker(wrapper);
        this.spawnWorker();

        // Tasks associated with this worker in `resolvers` need to be handled.
        // In a more complex pool, we'd map tasks to workers.
        // For now, if a task fails because of crash, it might hang or be caught by 'exit' if it was processing.
        // Actually, the resolvers are keyed by task ID. If the worker crashes, the task it was doing won me resolved.
        // We should ideally scan resolvers and retry tasks that were likely with this worker.
    }

    private removeWorker(wrapper: WorkerWrapper) {
        this.workers = this.workers.filter(w => w !== wrapper);
        this.idleWorkers = this.idleWorkers.filter(w => w !== wrapper);
    }

    private async recycleWorker(wrapper: WorkerWrapper) {
        this.removeWorker(wrapper);
        wrapper.isTerminating = true;
        await wrapper.worker.terminate();
        this.spawnWorker();
    }

    async runTask(task: any, whiteboardSettings: any): Promise<Buffer | null> {
        return new Promise((resolve, reject) => {
            this.taskQueue.push({ task, whiteboardSettings, resolve, reject, retries: 0 });
            this.processQueue();
        });
    }

    private processQueue() {
        if (this.taskQueue.length > 0 && this.idleWorkers.length > 0) {
            const job = this.taskQueue.shift()!;
            const wrapper = this.idleWorkers.pop()!;

            this.resolvers.set(job.task.id, {
                resolve: job.resolve,
                reject: job.reject,
                task: job.task,
                whiteboardSettings: job.whiteboardSettings,
                retries: job.retries
            });
            wrapper.worker.postMessage({ type: 'render', task: job.task, whiteboardSettings: job.whiteboardSettings });
        }
    }

    async terminate() {
        const workersToTerminate = [...this.workers];
        this.workers = [];
        this.idleWorkers = [];
        this.resolvers.clear();
        this.taskQueue = [];

        await Promise.all(workersToTerminate.map(async w => {
            w.isTerminating = true;
            await w.worker.terminate();
        }));
    }
}
