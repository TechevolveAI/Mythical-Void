import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleTrumptopusFilm as sample, FILM_DURATIONS } from '../../src/dev/TrumptopusFilmTimeline.js';

test('shared films last 8 and 16 seconds with no viewer identity', () => {
    assert.deepEqual(FILM_DURATIONS, {arrival:8, victory:16});
    assert.deepEqual(sample('arrival', 99), sample('arrival', 8));
    assert.throws(() => sample('unknown', 0));
    assert.throws(() => sample('arrival', NaN));
});
test('arrival ends on the held gap used at the start of victory', () => {
    const end = sample('arrival', 8), start = sample('victory', 0);
    for (const key of ['gap', 'grasp', 'cameraZoom', 'bossVisible']) assert.equal(end[key], start[key]);
    assert(sample('arrival', 0).gap < end.gap);
});
test('hands release sequentially before banishment, then matter reconnects', () => {
    assert(sample('victory', 2).leftRelease > 0);
    assert.equal(sample('victory', 2).rightRelease, 0);
    assert.equal(sample('victory', 4.2).rightRelease, 1);
    assert.equal(sample('victory', 4.2).pull, 0);
    assert.equal(sample('victory', 7.1).bossVisible, false);
    assert.equal(sample('victory', 7.9).recovery, 0);
    assert.equal(sample('victory', 16).gap, 0);
    assert.equal(sample('victory', 16).tear, 0);
});
test('absolute-time sampling is repeatable and bounded throughout both films', () => {
    for (const film of Object.keys(FILM_DURATIONS)) {
        let previousRecovery = 0;
        for (let frame = 0; frame <= FILM_DURATIONS[film] * 24; frame++) {
            const pose = sample(film, frame / 24);
            assert.deepEqual(pose, sample(film, frame / 24));
            for (const key of ['grasp','pull','tear','recovery','leftRelease','rightRelease']) assert(pose[key] >= 0 && pose[key] <= 1);
            assert(pose.recovery >= previousRecovery); previousRecovery = pose.recovery;
        }
    }
});
