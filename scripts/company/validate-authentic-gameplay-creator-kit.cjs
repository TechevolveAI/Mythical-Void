#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const root = path.resolve(__dirname, '../..');
const paths = {
    archive: path.join(root, 'public/press/creator-kit/mythical-void-authentic-gameplay-creator-kit.zip'),
    manifest: path.join(root, 'public/press/creator-kit/manifest.json'),
    socialManifest: path.join(root, 'public/press/social-video/manifest.json'),
    captions: path.join(root, 'public/press/social-video/authentic-gameplay-caption-pack.json'),
    pressAssets: path.join(root, 'public/press/mythical-void-press-assets.json'),
    signal: path.join(root, 'public/updates/releases.json'),
    pressSource: path.join(root, 'src/site/storefront.js'),
    llms: path.join(root, 'public/llms.txt'),
    release: path.join(root, 'docs/company/content/generated/authentic-gameplay-creator-kit-release.json')
};

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function findEndOfCentralDirectory(buffer) {
    const earliest = Math.max(0, buffer.length - 65557);
    for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
    }
    throw new Error('ZIP end record was not found');
}

function extractZip(buffer) {
    const eocd = findEndOfCentralDirectory(buffer);
    const entryCount = buffer.readUInt16LE(eocd + 10);
    let offset = buffer.readUInt32LE(eocd + 16);
    const files = new Map();
    for (let index = 0; index < entryCount; index += 1) {
        if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error(`Invalid ZIP central entry ${index}`);
        const method = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const uncompressedSize = buffer.readUInt32LE(offset + 24);
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localOffset = buffer.readUInt32LE(offset + 42);
        const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
        if (!name || name.startsWith('/') || name.includes('..') || name.includes('\\')) throw new Error(`Unsafe ZIP path: ${name}`);
        if (files.has(name)) throw new Error(`Duplicate ZIP path: ${name}`);
        if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid local ZIP entry: ${name}`);
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
        const content = method === 0 ? compressed : method === 8 ? zlib.inflateRawSync(compressed) : null;
        if (!content) throw new Error(`Unsupported ZIP method ${method}: ${name}`);
        if (content.length !== uncompressedSize) throw new Error(`Wrong extracted size: ${name}`);
        files.set(name, content);
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return files;
}

function validate(values) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const { archiveBuffer, manifest, socialManifest, captionsBuffer, emblemBuffer, factSheetBuffer, pressAssets, signal, pressSource, llms, release } = values;
    let files = new Map();
    try {
        files = extractZip(archiveBuffer);
    } catch (error) {
        failures.push(`archive cannot be safely read: ${error.message}`);
    }

    const archiveSha256 = sha256(archiveBuffer);
    requireValue(manifest.releaseId === 'MYTHICAL-VOID-AUTHENTIC-GAMEPLAY-CREATOR-KIT-2026-08-26', 'creator kit release id changed');
    requireValue(manifest.state === 'withdrawn_visual_quality_failed_do_not_publish' && /must not be used or shared/i.test(manifest.withdrawalReason || ''), 'creator kit must remain withdrawn with its visual-quality reason recorded');
    requireValue(manifest.archive?.sha256 === archiveSha256 && manifest.archive?.bytes === archiveBuffer.length && manifest.archive?.fileCount === 12 && manifest.archive?.rootFolder === 'mythical-void-creator-kit', 'archive fingerprint, size, count or root folder changed');
    requireValue(files.size === 12, 'archive must contain exactly twelve files');

    const expectedPaths = new Set((manifest.contents || []).map(record => record.path));
    requireValue(expectedPaths.size === 12 && [...files.keys()].every(name => expectedPaths.has(name)), 'archive paths must exactly match the public package record');
    for (const record of manifest.contents || []) {
        const content = files.get(record.path);
        requireValue(Boolean(content) && content.length === record.bytes && sha256(content || Buffer.alloc(0)) === record.sha256, `${record.path} does not match its public package record`);
    }

    const packageManifestBuffer = files.get('mythical-void-creator-kit/PACKAGE_MANIFEST.json');
    let packageManifest = {};
    try {
        packageManifest = JSON.parse((packageManifestBuffer || Buffer.from('{}')).toString('utf8'));
    } catch (error) {
        failures.push('inside package record is not valid JSON');
    }
    requireValue(packageManifest.releaseId === manifest.releaseId && packageManifest.cleanPlayUrl === 'https://mythicalvoid.com/playable-now/', 'inside package record lost its release identity or clean play link');
    requireValue(Array.isArray(packageManifest.contents) && packageManifest.contents.length === 11, 'inside package record must cover the eleven other files');
    for (const record of packageManifest.contents || []) {
        const content = files.get(record.path);
        requireValue(Boolean(content) && content.length === record.bytes && sha256(content || Buffer.alloc(0)) === record.sha256, `${record.path} does not match the inside package record`);
    }

    const captionsPath = 'mythical-void-creator-kit/captions/authentic-gameplay-caption-pack.json';
    const emblemPath = 'mythical-void-creator-kit/brand/mythical-void-emblem-v3.png';
    const factSheetPath = 'mythical-void-creator-kit/facts/mythical-void-fact-sheet.txt';
    requireValue(sha256(files.get(captionsPath) || Buffer.alloc(0)) === 'd4ba65588da0f0e559e0b55e8372bc37738f915be5571b9fec71a7976e8c9567', 'archived caption pack changed from the exact withdrawn package record');
    let publicCaptions = {};
    try { publicCaptions = JSON.parse(captionsBuffer.toString('utf8')); } catch (error) { failures.push('public caption withdrawal record is not valid JSON'); }
    requireValue(publicCaptions.state === 'withdrawn_visual_quality_failed_do_not_publish' && publicCaptions.authority?.publicPressRoomPublicationAuthorized === false, 'public captions are not withdrawn');
    requireValue(sha256(files.get(emblemPath) || Buffer.alloc(0)) === sha256(emblemBuffer), 'emblem is not the checked public emblem');
    requireValue(sha256(files.get(factSheetPath) || Buffer.alloc(0)) === sha256(factSheetBuffer), 'fact sheet is not the checked public fact sheet');
    for (const asset of socialManifest.assets || []) {
        requireValue(sha256(files.get(`mythical-void-creator-kit/videos/${asset.filename}`) || Buffer.alloc(0)) === asset.sha256, `${asset.format} video is not the verified social video`);
        requireValue(sha256(files.get(`mythical-void-creator-kit/posters/${asset.posterFilename}`) || Buffer.alloc(0)) === asset.posterSha256, `${asset.format} poster is not the verified social poster`);
    }

    const readme = (files.get('mythical-void-creator-kit/README.txt') || Buffer.alloc(0)).toString('utf8');
    const checklist = (files.get('mythical-void-creator-kit/OFFICIAL_CHANNEL_RELEASE_CHECKLIST.txt') || Buffer.alloc(0)).toString('utf8');
    requireValue(/complete moving game frame.+real Mythical Void gameplay/i.test(readme) && /surrounding branded layout is not gameplay/i.test(readme) && /No generated motion/i.test(readme), 'README lost its authentic-gameplay disclosure');
    requireValue(/father-and-son/i.test(readme) && /son was nine/i.test(readme) && /Do not add a child's name, photograph, quotation, contact route or identifying detail/i.test(readme), 'README lost the careful founder-story and child boundary');
    requireValue(/Kevin has approved the exact video, caption and channel/i.test(checklist) && /Comments and direct messages remain closed/i.test(checklist) && /No child is invited to contact the studio directly/i.test(checklist) && /No paid promotion/i.test(checklist), 'official-channel checklist lost an approval, safeguarding, contact or spending gate');
    const publicWords = JSON.stringify({ manifest, packageManifest, pressAssets, signal, release, readme, checklist });
    requireValue(!/\bcompanions?\b/i.test(publicWords), 'creator kit public wording must call them creatures');
    requireValue(!/\bno two creatures (?:are )?alike\b|\bevery creature is unique\b|\bguaranteed unique\b/i.test(publicWords), 'creator kit must not make an absolute uniqueness claim');
    requireValue(!/[?&](?:utm_|ref=|source=)/i.test(publicWords), 'creator kit must not contain tracking parameters');

    const authority = manifest.authority || {};
    requireValue(authority.truthfulEditorialUsePermitted === false && authority.officialMythicalVoidSocialPublicationAuthorized === false && authority.kevinApprovalRequiredBeforeOfficialPublication === true && authority.creatorOutreachSendingAuthorized === false && authority.paidPromotionAuthorized === false && authority.publicRepliesAuthorized === false && authority.externalActionPerformed === false, 'withdrawn package authority silently widened');
    requireValue(packageManifest.authority?.officialMythicalVoidSocialPublicationAuthorized === false && packageManifest.authority?.kevinApprovalRequiredBeforeOfficialPublication === true && packageManifest.authority?.externalActionPerformed === false, 'inside package authority silently widened');
    requireValue(pressAssets.creatorDownloadKit?.archive === manifest.archive?.publicUrl && pressAssets.creatorDownloadKit?.manifest === 'https://mythicalvoid.com/press/creator-kit/manifest.json' && pressAssets.creatorDownloadKit?.state === manifest.state && /Withdrawn/i.test(pressAssets.creatorDownloadKit?.contents || ''), 'press asset record does not retain the withdrawn kit and warning');
    requireValue(!pressSource.includes('id="creator-download-kit"') && pressSource.includes('The previous social video pack is withdrawn.'), 'press room still exposes the withdrawn creator package');
    requireValue(!llms.includes('One-download creator kit:'), 'machine-readable guide still exposes the withdrawn creator package');
    const signalEntry = signal.entries?.find(entry => entry.id === 'SIGNAL-011');
    requireValue(!signalEntry, 'Signal Log still promotes the withdrawn creator package');
    requireValue(release?.state === 'withdrawn_visual_quality_failed_do_not_publish' && release?.archive?.sha256 === archiveSha256 && release?.archive?.bytes === archiveBuffer.length && release?.archive?.fileCount === 12 && release?.verification?.deterministicRebuildMatched === true && release?.verification?.archiveIntegrityPassed === true && release?.verification?.allInsideFilesMatchedPackageRecord === true && release?.verification?.desktopPressRoomVisualReviewPassed === true && release?.verification?.phonePressRoomVisualReviewPassed === true && release?.verification?.phoneWidth === 390 && release?.verification?.phoneHorizontalOverflowObserved === false && release?.verification?.creatorKitContractTestsPassed === 24 && release?.verification?.fullTestSuitesPassed === 181 && release?.verification?.fullTestsPassed === 1655 && release?.verification?.productionUrlVerified === false, 'withdrawn release must retain archive integrity, completed review, test evidence and its pre-production record');
    requireValue(release?.authority?.truthfulEditorialUsePermitted === false && release?.authority?.officialMythicalVoidSocialPublicationAuthorized === false && release?.authority?.kevinApprovalRequiredBeforeOfficialPublication === true && release?.authority?.externalActionPerformed === false, 'withdrawn release authority silently widened');

    return { valid: failures.length === 0, archiveSha256, archiveBytes: archiveBuffer.length, fileCount: files.size, failures };
}

function loadValues(baseDir = root) {
    return {
        archiveBuffer: fs.readFileSync(path.join(baseDir, path.relative(root, paths.archive))),
        manifest: readJson(path.join(baseDir, path.relative(root, paths.manifest))),
        socialManifest: readJson(path.join(baseDir, path.relative(root, paths.socialManifest))),
        captionsBuffer: fs.readFileSync(path.join(baseDir, 'public/press/social-video/authentic-gameplay-caption-pack.json')),
        emblemBuffer: fs.readFileSync(path.join(baseDir, 'public/marketing/mythical-void-emblem-v3.png')),
        factSheetBuffer: fs.readFileSync(path.join(baseDir, 'public/press/mythical-void-fact-sheet.txt')),
        pressAssets: readJson(path.join(baseDir, path.relative(root, paths.pressAssets))),
        signal: readJson(path.join(baseDir, path.relative(root, paths.signal))),
        pressSource: fs.readFileSync(path.join(baseDir, path.relative(root, paths.pressSource)), 'utf8'),
        llms: fs.readFileSync(path.join(baseDir, path.relative(root, paths.llms)), 'utf8'),
        release: readJson(path.join(baseDir, path.relative(root, paths.release)))
    };
}

if (require.main === module) {
    const result = validate(loadValues());
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exit(1);
}

module.exports = { paths, extractZip, loadValues, validate };
