import { Animation } from '../src/frontend/core/animations/animation';

async function testPauseResume() {
    console.log('Testing Animation Pause/Resume...');

    const widget = { opacity: 0 };
    const anim = new Animation({
        duration: 2.0,
        opacity: 1.0,
        transition: 'linear'
    });

    console.log('Starting animation (duration 2s)...');
    anim.start(widget);
    anim.update(0, widget); // Initialize startTime

    // Initial check
    await new Promise(resolve => setTimeout(resolve, 500));
    anim.update(0, widget);
    console.log(`After 0.5s: opacity = ${widget.opacity.toFixed(2)} (expected ~0.25)`);

    console.log('Pausing animation...');
    anim.pause(widget);
    const pausedOpacity = widget.opacity;

    await new Promise(resolve => setTimeout(resolve, 1000));
    anim.update(0, widget);
    console.log(`After 1s pause: opacity = ${widget.opacity.toFixed(2)} (expected ${pausedOpacity.toFixed(2)})`);

    if (Math.abs(widget.opacity - pausedOpacity) > 0.001) {
        throw new Error('Animation should NOT have progressed while paused!');
    }

    console.log('Resuming animation...');
    anim.resume(widget);

    await new Promise(resolve => setTimeout(resolve, 500));
    anim.update(0, widget);
    console.log(`After 0.5s resume: opacity = ${widget.opacity.toFixed(2)} (expected ~0.50)`);

    await new Promise(resolve => setTimeout(resolve, 1500));
    const running = anim.update(0, widget);
    console.log(`After completion: opacity = ${widget.opacity.toFixed(2)} (expected 1.00), running = ${running}`);

    if (Math.abs(widget.opacity - 1.0) > 0.05) {
        throw new Error('Animation should have completed correctly after resume!');
    }

    console.log('Pause/Resume test PASSED!');
}

testPauseResume().catch(err => {
    console.error('Test FAILED:', err);
    process.exit(1);
});
