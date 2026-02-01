import { Whiteboard } from "../whiteboard";
import { WhiteboardConfig } from "../../../shared/types";

const SHARED_CONFIG: WhiteboardConfig = {
    width: 800,
    height: 450,
    debug: true,
    background: "#ffffff",
    hands: {
        draw: {
            imageUrl: '/assets/hand/drawing-hand.png',
            scale: 0.8,
            offset: [-18, -20]
        },
        erase: {
            imageUrl: '/assets/hand/eraser.png',
            scale: 0.4,
            offset: [-150, -40]
        },
        push: {
            imageUrl: '/assets/hand/push_hand_real.png',
            scale: 0.35,
            offset: [-100, -80]
        }
    },
    scenes: [
        {
            id: "reveal_scene",
            background: "#ffffff",
            transition: { type: "eraser", duration: 0.5 },
            duration: 10,
            camera: {
                virtualSize: { width: 1000, height: 1000 },
                followMode: 'manual',
                initial: {
                    size: { width: 1000, height: 1000 },
                    zoom: 1,
                    position: { x: 400, y: 200 }
                },
                keyframes: []
            },
            layers: []
        }
    ]
};


async function runFrontendPositionLog() {
    // Resolve paths for frontend (Parcel maps static/ to /)
    const resolvedConfig = JSON.parse(JSON.stringify(SHARED_CONFIG));

    const fixPath = (p: string) => {
        if (p.startsWith('static/')) return '/' + p.substring(7);
        return p;
    };

    if (resolvedConfig.hands) {
        if (resolvedConfig.hands.draw) resolvedConfig.hands.draw.imageUrl = fixPath(resolvedConfig.hands.draw.imageUrl);
        if (resolvedConfig.hands.erase) resolvedConfig.hands.erase.imageUrl = fixPath(resolvedConfig.hands.erase.imageUrl);
        if (resolvedConfig.hands.push) resolvedConfig.hands.push.imageUrl = fixPath(resolvedConfig.hands.push.imageUrl);
    }

    resolvedConfig.scenes.forEach((scene: any) => {
        scene.layers.forEach((layer: any) => {
            if (layer.pushConfig && layer.pushConfig.imageUrl) {
                layer.pushConfig.imageUrl = fixPath(layer.pushConfig.imageUrl);
            }
            if (layer.imageUrl) {
                layer.imageUrl = fixPath(layer.imageUrl);
            }
        });
    });

    const whiteboard = new Whiteboard({
        ...resolvedConfig,
        containerId: "app"
    });

    const scene = whiteboard.getScene("reveal_scene");
    if (!scene) {
        console.error("Scene not found");
        return;
    }

    const logs: any[] = [];
    const fps = 30;
    const duration = scene.getDuration();
    const totalFrames = Math.ceil(duration * fps);

    console.log(`🚀 Starting Frontend-side Position Logging for ${totalFrames} frames`);

    for (let f = 0; f <= totalFrames; f++) {
        const time = f / fps;
        const layers = scene.getLayers();

        for (const layer of layers) {
            const pos = (layer as any).getCurrentPosition ? (layer as any).getCurrentPosition(time) : (layer.getConfig().position || { x: 0, y: 0 });
            const handPos = (layer as any).getHandPosition ? (layer as any).getHandPosition(time) : null;
            let screenHandPos = null;

            if (handPos && scene.getCameraController()) {
                const camera = scene.getCameraController()!;
                screenHandPos = camera.transformPoint(handPos, time, layers);
            }

            logs.push({
                time: parseFloat(time.toFixed(3)),
                layerId: layer.getConfig().id,
                x: parseFloat(pos.x.toFixed(2)),
                y: parseFloat(pos.y.toFixed(2)),
                hand: handPos ? {
                    x: parseFloat(handPos.x.toFixed(2)),
                    y: parseFloat(handPos.y.toFixed(2)),
                    screenX: screenHandPos ? parseFloat(screenHandPos.x.toFixed(2)) : null,
                    screenY: screenHandPos ? parseFloat(screenHandPos.y.toFixed(2)) : null
                } : null
            });
        }
    }

    (window as any).frontendPositions = logs;
    console.log('✅ Frontend positions generated in window.frontendPositions');

    // Also visual feedback
    whiteboard.play();
}

runFrontendPositionLog().catch(console.error);
