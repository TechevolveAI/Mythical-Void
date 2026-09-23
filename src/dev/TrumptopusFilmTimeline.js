export const FILM_DURATIONS = Object.freeze({ arrival: 8, victory: 16 });
const ramp = (time, start, end) => {
    const p = Math.max(0, Math.min(1, (time - start) / (end - start)));
    return p * p * (3 - 2 * p);
};

// Absolute-time poses make offline frame export reproducible, independent of FPS.
export function sampleTrumptopusFilm(film, time) {
    if (!(film in FILM_DURATIONS) || !Number.isFinite(time)) throw new Error('Invalid authored film time');
    const t = Math.max(0, Math.min(FILM_DURATIONS[film], time));
    if (film === 'arrival') {
        const grasp = ramp(t, 2.5, 5.5);
        return { t, beat: t < 2.5 ? 'approach' : t < 5.5 ? 'grasp' : 'held',
            grasp, leftRelease: 0, rightRelease: 0, pull: 0, tear: 0,
            recovery: 0, gap: 38 + 32 * grasp, bossVisible: true,
            cameraZoom: 1 + .07 * ramp(t, 0, 7), cameraX: 0, cameraY: 0 };
    }
    const leftRelease = ramp(t, 1.3, 2.7), rightRelease = ramp(t, 2.8, 4.2);
    const pull = ramp(t, 4.2, 7.1), recovery = ramp(t, 8, 12);
    return { t, beat: t < 1.3 ? 'strain' : t < 4.2 ? 'release' : t < 7.4 ? 'banishment' : t < 12 ? 'recovery' : 'restored',
        grasp: 1, leftRelease, rightRelease, pull,
        tear: ramp(t, .5, 2) * (1 - ramp(t, 7.2, 8.2)), recovery,
        gap: 70 * (1 - recovery), bossVisible: t < 7.1,
        cameraZoom: 1.07 + .045 * ramp(t, 12, 16), cameraX: 0,
        cameraY: -12 * ramp(t, 12, 16) };
}
