/**
 * Example: Camera Keyframe Pause Time
 * 
 * This example demonstrates how to use the pauseTime property
 * to control camera movements and create deliberate pauses
 * in your whiteboard animations.
 */

import { Whiteboard } from "./src/frontend/whiteboard/whiteboard";
import { Scene } from "./src/frontend/whiteboard/scene";
import { ShapeLayer } from "./src/frontend/whiteboard/shape-layer";

// Create whiteboard
const whiteboard = new Whiteboard({
  containerId: "app",
  width: 800,
  height: 450,
  debug: true,
  background: "#f5f5f5",
});

// Create scene with camera keyframes using pauseTime
const scene = new Scene({
  id: "pause_time_demo",
  background: "#ffffff",
  camera: {
    virtualSize: { width: 3200, height: 2400 },
    followMode: 'manual',
    initial: {
      size: { width: 800, height: 450 },
      position: { x: 400, y: 400 }
    },
    keyframes: [
      // Keyframe 1: Focus on top-left circle
      {
        startTime: 0,
        targetLayerId: 'circle_1',
        padding: 100,
        transitionDuration: 1.5,
        pauseTime: 2.0,  // Pause for 2 seconds to let viewers see the circle
        easing: 'ease_in_out'
      },
      // Keyframe 2: Pan to center square
      {
        startTime: 3.5,  // Start transition after first keyframe's pause ends
        targetLayerId: 'square_1',
        padding: 80,
        transitionDuration: 2.0,
        pauseTime: 3.0,  // Pause for 3 seconds at the square
        easing: 'ease_in_out'
      },
      // Keyframe 3: Move to bottom-right triangle
      {
        startTime: 8.5,  // 3.5 + 2.0 (transition) + 3.0 (pause) = 8.5
        targetLayerId: 'triangle_1',
        padding: 100,
        transitionDuration: 1.5,
        pauseTime: 2.5,  // Final pause at the triangle
        easing: 'ease_in_out'
      },
      // Keyframe 4: Zoom out to see all shapes
      {
        startTime: 12.5,  // 8.5 + 1.5 (transition) + 2.5 (pause) = 12.5
        position: { x: 1600, y: 1200 },  // Center of virtual canvas
        size: { width: 3200, height: 2400 },  // Show entire canvas
        transitionDuration: 2.5,
        pauseTime: 3.0,  // Hold the final view
        easing: 'ease_out'
      }
    ]
  }
});

// Add shapes at different positions
scene
  .addLayer(
    new ShapeLayer({
      id: 'circle_1',
      shape: 'circle',
      position: { x: 400, y: 400 },
      radius: 150,
      fillColor: '#4285F4',
      strokeColor: '#1967D2',
      strokeWidth: 4,
      entrance_animation: {
        type: 'draw',
        duration: 2.0,
        delay: 0
      }
    })
  )
  .addLayer(
    new ShapeLayer({
      id: 'square_1',
      shape: 'rectangle',
      position: { x: 1600, y: 1200 },
      width: 300,
      height: 300,
      fillColor: '#EA4335',
      strokeColor: '#C5221F',
      strokeWidth: 4,
      entrance_animation: {
        type: 'draw',
        duration: 2.0,
        delay: 0
      }
    })
  )
  .addLayer(
    new ShapeLayer({
      id: 'triangle_1',
      shape: 'triangle',
      position: { x: 2800, y: 2000 },
      radius: 200,
      fillColor: '#FBBC05',
      strokeColor: '#F9AB00',
      strokeWidth: 4,
      entrance_animation: {
        type: 'draw',
        duration: 2.0,
        delay: 0
      }
    })
  );

// Add the scene to whiteboard
whiteboard.addScene(scene);

// Prepare and play
whiteboard.prepare().then(() => {
  console.log('Whiteboard ready!');
  console.log('Camera Timeline:');
  console.log('- 0.0s - 1.5s: Transition to circle');
  console.log('- 1.5s - 3.5s: Pause at circle (pauseTime = 2.0s)');
  console.log('- 3.5s - 5.5s: Transition to square');
  console.log('- 5.5s - 8.5s: Pause at square (pauseTime = 3.0s)');
  console.log('- 8.5s - 10.0s: Transition to triangle');
  console.log('- 10.0s - 12.5s: Pause at triangle (pauseTime = 2.5s)');
  console.log('- 12.5s - 15.0s: Zoom out transition');
  console.log('- 15.0s - 18.0s: Hold final view (pauseTime = 3.0s)');

  whiteboard.play();
});
