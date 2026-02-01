/**
 * Test pour démontrer la pause de 20% sur les transitions de keyframes
 * 
 * Ce test crée une animation de caméra avec plusieurs keyframes
 * et montre visuellement l'effet de la pause de 20% au début de chaque transition.
 */

import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

async function runCameraPauseDemo() {
    console.log('🎬 Test de la pause de 20% sur les transitions de keyframes\n');
    
    const config: WhiteboardConfig = {
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [
            {
                id: 'demo_scene',
                duration: 10, // 10 secondes
                camera: {
                    initial: { zoom: 1.0, position: { x: 0.5, y: 0.5 } },
                    keyframes: [
                        // Premier keyframe à t=2s avec transition de 2s
                        {
                            zoom: 2.0,
                            position: { x: 0.3, y: 0.3 },
                            startTime: 2,
                            transitionDuration: 2, // 2 secondes de transition
                            easing: 'linear'
                        },
                        // Deuxième keyframe à t=6s avec transition de 2s
                        {
                            zoom: 1.5,
                            position: { x: 0.7, y: 0.7 },
                            startTime: 6,
                            transitionDuration: 2, // 2 secondes de transition
                            easing: 'linear'
                        },
                        // Troisième keyframe à t=9s avec transition de 1s
                        {
                            zoom: 1.0,
                            position: { x: 0.5, y: 0.5 },
                            startTime: 9,
                            transitionDuration: 1, // 1 seconde de transition
                            easing: 'linear'
                        }
                    ]
                },
                layers: [
                    {
                        id: 'bg',
                        type: 'shape',
                        shape: 'rectangle',
                        width: 1920,
                        height: 1080,
                        position: { x: 960, y: 540 },
                        fillColor: '#2c3e50',
                        entranceAnimation: 'none'
                    },
                    {
                        id: 'title',
                        type: 'text',
                        textConfig: {
                            text: 'Test de la pause de 20%',
                            fontSize: 80,
                            color: '#ffffff',
                            fontFamily: 'Arial'
                        },
                        position: { x: 960, y: 200 },
                        entranceAnimation: 'fade_in',
                        entranceDelay: 0,
                        animationDuration: 1
                    },
                    {
                        id: 'box1',
                        type: 'shape',
                        shape: 'rectangle',
                        width: 300,
                        height: 300,
                        position: { x: 400, y: 400 },
                        fillColor: '#e74c3c',
                        entranceAnimation: 'fade_in',
                        entranceDelay: 0.5,
                        animationDuration: 1
                    },
                    {
                        id: 'box2',
                        type: 'shape',
                        shape: 'rectangle',
                        width: 300,
                        height: 300,
                        position: { x: 1520, y: 400 },
                        fillColor: '#3498db',
                        entranceAnimation: 'fade_in',
                        entranceDelay: 0.5,
                        animationDuration: 1
                    },
                    {
                        id: 'box3',
                        type: 'shape',
                        shape: 'rectangle',
                        width: 300,
                        height: 300,
                        position: { x: 960, y: 750 },
                        fillColor: '#2ecc71',
                        entranceAnimation: 'fade_in',
                        entranceDelay: 0.5,
                        animationDuration: 1
                    },
                    {
                        id: 'info',
                        type: 'text',
                        textConfig: {
                            text: 'Observez les transitions:\n' +
                                  '• t=2s : Pause de 0.4s puis transition vers zoom 2.0\n' +
                                  '• t=6s : Pause de 0.4s puis transition vers zoom 1.5\n' +
                                  '• t=9s : Pause de 0.2s puis transition vers zoom 1.0',
                            fontSize: 30,
                            color: '#ecf0f1',
                            fontFamily: 'Arial'
                        },
                        position: { x: 960, y: 950 },
                        entranceAnimation: 'fade_in',
                        entranceDelay: 1,
                        animationDuration: 1
                    }
                ]
            }
        ]
    };

    console.log('Configuration de la scène:');
    console.log('- Durée totale: 10 secondes');
    console.log('- 3 keyframes avec transitions\n');
    
    console.log('Détails des transitions:');
    console.log('1. t=2s, transitionDuration=2s:');
    console.log('   → Pause de 0.0s à 0.4s (20% de 2s)');
    console.log('   → Transition de 0.4s à 2.0s (80% de 2s)\n');
    
    console.log('2. t=6s, transitionDuration=2s:');
    console.log('   → Pause de 0.0s à 0.4s (20% de 2s)');
    console.log('   → Transition de 0.4s à 2.0s (80% de 2s)\n');
    
    console.log('3. t=9s, transitionDuration=1s:');
    console.log('   → Pause de 0.0s à 0.2s (20% de 1s)');
    console.log('   → Transition de 0.2s à 1.0s (80% de 1s)\n');

    const outputPath = path.join(__dirname, '../output/camera_pause_demo.mp4');
    
    console.log('🎥 Génération de la vidéo de démonstration...');
    console.log(`Fichier de sortie: ${outputPath}\n`);

    try {
        const whiteboard = new ServerWhiteboard(config);
        await whiteboard.exportVideo(outputPath);
        
        console.log('✅ Vidéo générée avec succès!');
        console.log(`📹 Regardez ${outputPath} pour voir l'effet de la pause de 20%\n`);
        console.log('Points à observer:');
        console.log('- Au début de chaque transition, la caméra reste statique pendant 20% du temps');
        console.log('- Puis elle se déplace progressivement pendant les 80% restants');
        console.log('- Le temps total de transition reste inchangé\n');
    } catch (error) {
        console.error('❌ Erreur lors de la génération:', error);
    }
}

// Exécuter le test
runCameraPauseDemo().catch(console.error);
