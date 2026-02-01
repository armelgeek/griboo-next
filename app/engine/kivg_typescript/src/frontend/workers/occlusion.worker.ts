import RBush from 'rbush';

interface LayerBBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    id: string;
    index: number;
}

let tree: RBush<LayerBBox> | null = null;
let currentLayerOrder: string[] = [];

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;
    const { jobId } = payload || {};

    switch (type) {
        case 'BUILD_INDEX': {
            const { layers, layerOrder } = payload;
            tree = new RBush<LayerBBox>(9);

            const items: LayerBBox[] = layers.map((l: any, idx: number) => ({
                minX: l.bbox.left,
                minY: l.bbox.top,
                maxX: l.bbox.right,
                maxY: l.bbox.bottom,
                id: l.id,
                index: l.index !== undefined ? l.index : idx
            }));

            tree.load(items);
            currentLayerOrder = layerOrder;
            self.postMessage({ type: 'INDEX_BUILT', payload: { jobId } });
            break;
        }

        case 'FIND_OVERLAPS': {
            if (!tree) {
                self.postMessage({ type: 'ERROR', payload: { jobId, message: 'Index not built' } });
                return;
            }

            const { bbox, maxIndex, onlyUpper, layerId } = payload;
            const candidates = tree.search({
                minX: bbox.left,
                minY: bbox.top,
                maxX: bbox.right,
                maxY: bbox.bottom
            });

            const overlappingIds = candidates
                .filter(c => {
                    if (onlyUpper) {
                        // If onlyUpper is true, we only want layers with index > current layer's index
                        return c.index > maxIndex;
                    } else {
                        // Otherwise we want all except the target itself
                        return c.id !== layerId;
                    }
                })
                .map(c => c.id);

            self.postMessage({
                type: 'OVERLAPS_FOUND',
                payload: { jobId, layerId, overlappingIds }
            });
            break;
        }

        case 'CLEAR':
            tree = null;
            currentLayerOrder = [];
            self.postMessage({ type: 'CLEARED', payload: { jobId } });
            break;

        case 'PING':
            self.postMessage({ type: 'PONG', payload: { jobId } });
            break;
    }
};
