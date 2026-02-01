import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

export const SHARED_CONFIG: WhiteboardConfig = {
    width: 800,
    height: 450,
    debug: true,
    background: "#ffffff",
    hands: {
        draw: {
            imageUrl: 'static/hand/drawing-hand.png',
            scale: 0.8,
            offset: [-18, -20]
        },
        erase: {
            imageUrl: 'static/hand/eraser.png',
            scale: 0.4,
            offset: [-150, -40]
        },
        push: {
            imageUrl: 'static/hand/push_hand_real.png',
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
                keyframes: [
                    {
                        position: { x: 400, y: 100 },
                        zoom: 2,
                        pauseTime: 2,
                        transitionDuration: 1.5,
                        easing: 'ease_in_out',
                    },
                    {
                        position: { x: 200, y: 200 },
                        zoom: 2.5,
                        pauseTime: 2,
                        transitionDuration: 1.5,
                        easing: 'ease_in_out',
                    },
                    {
                        position: { x: 600, y: 200 },
                        zoom: 2.5,
                        pauseTime: 2,
                        transitionDuration: 1.5,
                        easing: 'ease_in_out',
                    },
                    {
                        position: { x: 400, y: 350 },
                        zoom: 2.5,
                        pauseTime: 2,
                        transitionDuration: 1.5,
                        easing: 'ease_in_out',
                    },
                    {
                        position: { x: 400, y: 200 },
                        zoom: 1,
                        pauseTime: 2,
                        transitionDuration: 1.5,
                        easing: 'ease_in_out'
                    },
                ]
            },
            layers: [
                {
                    id: "reveal-title",
                    type: "text",
                    position: { x: 400, y: 100 },
                    textConfig: {
                        text: "Reveal Scene",
                        fontFamily: "sans-serif",
                        fontSize: 36,
                        color: "#0f172a",
                        strokeAnimation: {
                            duration: 1.5,
                            mode: 'typewriter',
                        }
                    },
                    entrance_animation: {
                        type: "draw",
                        duration: 1.5,
                        delay: 0
                    }
                },
                {
                    id: 'push_box',
                    type: 'push',
                    position: { x: 200, y: 200 },
                    entrance_animation: {
                        type: 'push',
                        duration: 3,
                        delay: 0
                    },
                    pushConfig: {
                        imageUrl: 'static/demo/icons/facebook2.svg',
                        width: 150,
                        height: 150,
                        from: 'bottom',
                        pushEasing: 'out_cubic'
                    }
                },
                {
                    id: "star-shape",
                    type: "shape",
                    shape: 'star',
                    radius: 60,
                    fillColor: '#eab308',
                    strokeColor: 'none',
                    strokeWidth: 3,
                    position: { x: 600, y: 200 },
                    zIndex: 2,
                    entrance_animation: {
                        type: "draw",
                        duration: 1.5,
                        delay: 0
                    }
                },
                {
                    id: "hybrid-image",
                    type: "hybrid",
                    position: { x: 200, y: 100 },
                    width: 200,
                    height: 200,
                    zIndex: 5,
                    imageUrl: 'static/demo/icons/facebook2.svg',
                    entrance_animation: {
                        type: "reveal_diagonal",
                        duration: 2,
                        delay: 1
                    },
                    hybridConfig: {
                        strokeDurationRatio: 0.5,
                        colorTolerance: 10,
                        minRegionSize: 50,
                        fillDirection: 'diagonal'
                    }
                }
            ]
        }
    ]
};

