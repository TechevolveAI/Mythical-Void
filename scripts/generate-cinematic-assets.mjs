#!/usr/bin/env node

import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { CINEMATIC_ASSET_DEFINITIONS } from '../src/config/cinematic-media.js';

const DEFAULT_MODEL = 'veo-3.1-generate-preview';
const MAX_WAIT_MS = 12 * 60 * 1000;
const POLL_DELAY_MS = 10000;
const JOB_DIRECTORY = '/private/tmp/mythical-void-cinematic-jobs';

function getAssetId() {
    const value = process.argv.find(argument => argument.startsWith('--asset='));
    return value?.slice('--asset='.length) || null;
}

function isForceEnabled() {
    return process.argv.includes('--force');
}

function getVideoUri(operation) {
    return operation?.response?.generatedVideos?.[0]?.video?.uri || null;
}

function getImageMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    return extension === '.png' ? 'image/png' : 'image/webp';
}

async function fileExists(filePath) {
    try {
        return (await stat(filePath)).isFile();
    } catch {
        return false;
    }
}

function getJobPath(assetId) {
    return path.join(JOB_DIRECTORY, `${assetId}.json`);
}

async function readPendingJob(assetId) {
    try {
        const job = JSON.parse(await readFile(getJobPath(assetId), 'utf8'));
        return typeof job?.name === 'string' ? job : null;
    } catch {
        return null;
    }
}

async function savePendingJob(assetId, operation) {
    if (!operation?.name) throw new Error(`${assetId}: Veo returned no operation id`);
    await mkdir(JOB_DIRECTORY, { recursive: true });
    await writeFile(getJobPath(assetId), JSON.stringify({ name: operation.name }));
}

async function generateAsset(assetId, definition) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is required');
    const outputPath = path.resolve(definition.output);
    if (!isForceEnabled() && await fileExists(outputPath)) {
        console.log(`${assetId}: existing asset retained at ${definition.output}`);
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const pending = await readPendingJob(assetId);
    let operation;
    if (pending) {
        console.log(`${assetId}: resuming Veo generation`);
        operation = await ai.operations.getVideosOperation({ operation: pending });
    } else {
        const referenceImagePath = path.resolve(definition.referenceImage);
        const imageBytes = await readFile(referenceImagePath);
        console.log(`${assetId}: starting Veo 3.1 Standard generation`);
        operation = await ai.models.generateVideos({
            model: process.env.CINEMATIC_VIDEO_MODEL || DEFAULT_MODEL,
            source: {
                prompt: definition.prompt,
                image: {
                    imageBytes: imageBytes.toString('base64'),
                    mimeType: getImageMimeType(referenceImagePath)
                }
            },
            config: {
                numberOfVideos: 1,
                durationSeconds: 8,
                aspectRatio: '16:9',
                resolution: '720p',
                negativePrompt: 'text, subtitles, logo, user interface, character deformation, flicker, jump cuts, cartoon, low detail'
            }
        });
        await savePendingJob(assetId, operation);
    }

    const startedAt = Date.now();
    while (!operation.done && Date.now() - startedAt < MAX_WAIT_MS) {
        await new Promise(resolve => setTimeout(resolve, POLL_DELAY_MS));
        operation = await ai.operations.getVideosOperation({ operation });
        console.log(`${assetId}: generation in progress`);
    }
    if (!operation.done || operation.error) {
        throw new Error(`${assetId}: Veo generation did not complete`);
    }

    const videoUri = getVideoUri(operation);
    if (!videoUri) throw new Error(`${assetId}: Veo returned no video`);
    const response = await fetch(videoUri, {
        headers: { 'x-goog-api-key': apiKey }
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp') {
        throw new Error(`${assetId}: Veo returned an invalid MP4`);
    }
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, bytes);
    await rm(getJobPath(assetId), { force: true });
    console.log(`${assetId}: saved ${(bytes.length / 1024 / 1024).toFixed(1)} MB to ${definition.output}`);
}

const assetId = getAssetId();
if (!assetId || !CINEMATIC_ASSET_DEFINITIONS[assetId]) {
    console.error(`Usage: node scripts/generate-cinematic-assets.mjs --asset=<${Object.keys(CINEMATIC_ASSET_DEFINITIONS).join('|')}> [--force]`);
    process.exitCode = 1;
} else {
    generateAsset(assetId, CINEMATIC_ASSET_DEFINITIONS[assetId]).catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
