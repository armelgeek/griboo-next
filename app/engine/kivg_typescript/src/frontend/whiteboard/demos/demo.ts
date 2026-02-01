
import { Whiteboard } from "../whiteboard";
import { Scene } from "../scene";
import { ShapeLayer } from "../layers/shape-layer";

// ==================== WHITEBOARD SETUP ====================
const whiteboard = new Whiteboard({
  containerId: "app",
  width: 1280,
  height: 720,
  debug: true,
  perfMonitor: true,
  background: "#ffffff",
});

// ==================== SCENE: COMPLEX CAMERA DEMO ====================
const scene = new Scene({
  id: "complex_scene",
  background: "#ffffff",
  camera: {
    virtualSize: { width: 8000, height: 5000 },
    followMode: 'manual', // Use keyframes instead of automatic hand following
    initial: {
      // Frontend CameraController expects zoom and position.
      // Backend initial: size: { width: 800, height: 450 }, position: { x: 500, y: 500 }
      // Zoom = Frame Width / Virtual Width? No, Frame Width / Viewport Width.
      // 1280 / 800 = 1.6
      zoom: 1.6,
      position: { x: 500, y: 500 }
    },
    keyframes: [
      {
        startTime: 1.5,
        targetLayerId: 'top_left',
        zoom: 1.5,
        padding: 100,
        transitionDuration: 1.5,
        easing: 'ease_in_out'
      },
      {
        startTime: 6.0,
        targetLayerId: 'center_box',
        zoom: 1.0, // Zoom in closer
        padding: 50,
        transitionDuration: 1.5,
        easing: 'out_bounce'
      },
      {
        startTime: 9.0,
        targetLayerId: 'bottom_right',
        zoom: 1.2,
        padding: 150,
        transitionDuration: 1.5,
        easing: 'ease_in_out'
      },
      // Manual Viewport Example (Camera 3 style)
      {
        startTime: 12.0,
        position: { x: 2000, y: 1500 }, // Center of virtual canvas

        // Frontend CameraController doesn't take size in keyframe directly for calculation in the same way as backend might,
        // but we can calculate zoom. 
        // Target size 1000x1000. Frame 1280x720.
        // Zoom X = 1280 / 1000 = 1.28
        // Zoom Y = 720 / 1000 = 0.72
        // Fit means min zoom? Or max? Usually fit contains. So min(1.28, 0.72) = 0.72.
        zoom: 0.72,
        transitionDuration: 2.0,
        easing: 'in_out_cubic'
      }
    ]
  }
});

scene
  .addLayer(
    new ShapeLayer({
      id: 'top_left',
      shape: 'circle',
      position: { x: 500, y: 500 },
      radius: 150,
      fillColor: '#4285F4',
      entrance_animation: { type: 'draw', duration: 1.5, delay: 0 },
      handOverlay: {
        enabled: true,
        scale: 0.8
      }
    })
  )
  .addLayer(
    new ShapeLayer({
      id: 'center_box',
      shape: 'rectangle',
      position: { x: 2000, y: 1500 },
      width: 400,
      height: 300,
      fillColor: '#EA4335',
      entrance_animation: { type: 'draw', duration: 1.5, delay: 0 },
      handOverlay: {
        enabled: true,
        scale: 0.8
      }
    })
  )
  .addLayer(
    new ShapeLayer({
      id: 'bottom_right',
      shape: 'star',
      position: { x: 3500, y: 2500 },
      radius: 200,
      fillColor: '#FBBC05',
      entrance_animation: { type: 'draw', duration: 1.5, delay: 0 },
      handOverlay: {
        enabled: true,
        scale: 0.8
      }
    })
  );

whiteboard.addScene(scene);

whiteboard.play();

export default whiteboard;