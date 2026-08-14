#!/usr/bin/env node

const { createHash } = require('crypto');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const trailerDir = path.join(root, 'public/press/trailer');
const manifestPath = path.join(trailerDir, 'manifest.json');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function sha256(filename) {
    return createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function probe(filename) {
    const result = spawnSync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'stream=codec_type,width,height,r_frame_rate,channels,sample_rate',
        '-show_entries', 'format=duration,size',
        '-of', 'json', filename
    ], { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`ffprobe failed: ${result.stderr || result.stdout}`);
    }
    return JSON.parse(result.stdout);
}

function main() {
    assert(fs.existsSync(manifestPath), 'Trailer manifest is missing.');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const asset = manifest.asset;
    const videoPath = path.join(trailerDir, asset.filename);
    const posterPath = path.join(trailerDir, asset.posterFilename);
    const captionsPath = path.join(trailerDir, asset.captionsFilename);

    [videoPath, posterPath, captionsPath].forEach(filename => {
        assert(fs.existsSync(filename), `Trailer asset is missing: ${filename}`);
        assert(fs.statSync(filename).size > 0, `Trailer asset is empty: ${filename}`);
    });

    const inspected = probe(videoPath);
    const video = inspected.streams.find(stream => stream.codec_type === 'video');
    const audio = inspected.streams.find(stream => stream.codec_type === 'audio');
    const duration = Number(inspected.format.duration);
    assert(video?.width === 1920 && video?.height === 1080, 'Trailer must be 1920x1080.');
    assert(video?.r_frame_rate === '30/1', 'Trailer must be 30fps.');
    assert(duration >= 60 && duration <= 90, `Trailer duration must be 60-90 seconds, got ${duration}.`);
    assert(audio?.channels === 2, 'Trailer must include stereo audio.');
    assert(Number(audio?.sample_rate) === 44100, 'Trailer audio must be 44.1kHz.');

    assert(asset.sha256 === sha256(videoPath), 'Trailer fingerprint does not match manifest.');
    assert(asset.posterSha256 === sha256(posterPath), 'Poster fingerprint does not match manifest.');
    assert(asset.captionsSha256 === sha256(captionsPath), 'Caption fingerprint does not match manifest.');
    assert(asset.classification === 'edited_first_party_launch_trailer_with_authentic_gameplay', 'Trailer classification is incorrect.');
    assert(manifest.approvalState === 'internal_review_ready_waiting_for_kevin', 'Trailer must remain behind Kevin review.');
    assert(manifest.presentationBoundary.includes('No generated marketing illustration is presented as gameplay'), 'Gameplay presentation boundary is missing.');
    assert(manifest.nasaBoundary.includes('NASA does not endorse'), 'NASA non-endorsement boundary is missing.');
    assert(manifest.sources.every(source => /^[0-9a-f]{64}$/.test(source.sha256)), 'A source fingerprint is invalid.');
    assert(manifest.sources.every(source => fs.existsSync(path.join(root, source.path))), 'A trailer source file is missing.');

    const captions = fs.readFileSync(captionsPath, 'utf8');
    assert(captions.startsWith('WEBVTT'), 'Captions must be WebVTT.');
    assert(captions.includes('Authentic gameplay'), 'Captions must identify authentic gameplay.');
    assert(captions.includes('NASA does not endorse Mythical Void'), 'Captions must preserve NASA non-endorsement.');
    assert(captions.includes('mythicalvoid.com'), 'Captions must include the play address.');

    process.stdout.write(JSON.stringify({
        valid: true,
        durationSeconds: duration,
        dimensions: `${video.width}x${video.height}`,
        frameRate: video.r_frame_rate,
        audio: `${audio.channels} channels at ${audio.sample_rate}Hz`,
        sourcesVerified: manifest.sources.length,
        approvalState: manifest.approvalState
    }, null, 2) + '\n');
}

main();
