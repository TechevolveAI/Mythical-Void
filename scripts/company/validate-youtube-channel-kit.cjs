#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const manifestPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'public/marketing/channel-kit/youtube/manifest.json');
const activationPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json');
const handoffPath = process.argv[4] ? path.resolve(process.argv[4]) : path.join(root, 'docs/company/content/channel-launch/YOUTUBE_CHANNEL_HANDOFF.md');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const activation = JSON.parse(fs.readFileSync(activationPath, 'utf8'));
const handoff = fs.readFileSync(handoffPath, 'utf8');
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };

function pngDimensions(buffer) {
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegDimensions(buffer) {
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        if ([0xc0, 0xc1, 0xc2].includes(marker)) {
            return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
        const length = buffer.readUInt16BE(offset + 2);
        if (length < 2) break;
        offset += 2 + length;
    }
    return null;
}

function verifyAsset(asset, expectedType) {
    const absolute = path.resolve(root, asset.path || '');
    requireValue(fs.existsSync(absolute), `${asset.path || 'Unknown asset'} is missing.`);
    if (!fs.existsSync(absolute)) return;
    const buffer = fs.readFileSync(absolute);
    const dimensions = expectedType === 'png' ? pngDimensions(buffer) : jpegDimensions(buffer);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    requireValue(dimensions?.width === asset.width && dimensions?.height === asset.height, `${asset.path} dimensions do not match the manifest.`);
    requireValue(buffer.length === asset.bytes, `${asset.path} byte size does not match the manifest.`);
    requireValue(hash === asset.sha256, `${asset.path} hash does not match the reviewed asset.`);
}

requireValue(manifest.schemaVersion === 1 && manifest.channelRef === 'CH-002', 'YouTube kit identity is invalid.');
requireValue(manifest.state === 'ready_for_kevin_visual_check_and_account_creation', 'YouTube kit must remain waiting for Kevin visual review and account creation.');
verifyAsset(manifest.assets?.profile || {}, 'png');
verifyAsset(manifest.assets?.banner || {}, 'jpeg');
verifyAsset(manifest.assets?.generatedBackground || {}, 'png');
requireValue(manifest.assets?.profile?.width === manifest.assets?.profile?.height && manifest.assets?.profile?.width >= 512, 'Profile image must remain a high-quality square.');
requireValue(manifest.assets?.banner?.width === 2560 && manifest.assets?.banner?.height === 1440, 'Banner must retain the current recommended 2560 by 1440 dimensions.');
requireValue((manifest.assets?.banner?.bytes || Infinity) < 6 * 1024 * 1024, 'Banner must remain below 6 MB.');
requireValue(manifest.assets?.banner?.textAndLogoSafeArea?.width >= 1543 && manifest.assets?.banner?.textAndLogoSafeArea?.height >= 422, 'Banner must retain the scaled central text and logo safe area.');
requireValue(/AI-generated/i.test(manifest.artworkDisclosure || '') && /not gameplay/i.test(manifest.artworkDisclosure || ''), 'Generated artwork disclosure must remain explicit.');
requireValue(/radial beings/i.test(manifest.generation?.finalPrompt || '') && /liquid bodies/i.test(manifest.generation?.finalPrompt || ''), 'Final alien-life direction must remain recorded.');

for (const field of ['accountCreationAuthorized', 'assetUploadAuthorized', 'videoUploadAuthorized', 'publicationAuthorized', 'commentOpeningAuthorized', 'paidPromotionAuthorized']) {
    requireValue(manifest.authority?.[field] === false, `${field} must remain false until Kevin acts.`);
}
requireValue(manifest.approval?.kevinVisualApprovalRequired === true && manifest.approval?.approvedAt === null && manifest.approval?.channelUrl === null, 'Kevin review and real channel URL must remain open.');

const youtube = activation.channels?.find(channel => channel.channelRef === 'CH-002');
requireValue(youtube?.accountState === 'not_created_owner_confirmed', 'YouTube must not be recorded as created.');
requireValue(youtube?.channelKit?.manifest === 'public/marketing/channel-kit/youtube/manifest.json', 'Activation pack must link the reviewed channel-kit manifest.');
requireValue(youtube?.channelKit?.bannerAsset === manifest.assets.banner.path && youtube?.channelKit?.profileAsset === manifest.assets.profile.path, 'Activation pack must use the reviewed banner and profile image.');
requireValue(youtube?.channelKit?.uploadAuthorized === false && youtube?.channelKit?.kevinVisualApprovalRequired === true, 'Activation pack must not authorize upload before Kevin visual review.');
requireValue(youtube?.commentSetting?.beforeNamedAdultCoverage === 'off' && youtube?.commentSetting?.privateRepliesToChildren === false, 'Comments and child-contact safeguards must remain closed.');
requireValue(youtube?.audienceSetting?.recommendedChoice === 'Review this setting for every video', 'Every upload must retain its audience-setting review.');

const publicWords = `${youtube?.profileDescription || ''}\n${manifest.wording?.bannerPromise || ''}\n${handoff}`;
requireValue(!/\bcompanions?\b/i.test(publicWords), 'YouTube kit must use creature language.');
requireValue(!/no two creatures|every creature is unique|infinite unique creatures/i.test(publicWords), 'YouTube kit must not promise absolute uniqueness.');
requireValue(/does not need another Google Workspace subscription/i.test(handoff.replace(/\*/g, '')), 'Handoff must preserve the existing-account decision.');
requireValue(/Do not upload a video yet/i.test(handoff) && /Keep comments off/i.test(handoff), 'Handoff must keep publication and comments closed.');

if (errors.length) {
    console.error(`YouTube channel kit validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`YouTube channel kit valid: ${manifest.assets.banner.width}x${manifest.assets.banner.height} banner, square profile, truthful disclosure, existing-account handoff, no upload authority.`);
