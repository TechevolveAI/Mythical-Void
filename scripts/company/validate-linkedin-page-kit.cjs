#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const manifestPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'public/marketing/channel-kit/linkedin/manifest.json');
const activationPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json');
const handoffPath = process.argv[4] ? path.resolve(process.argv[4]) : path.join(root, 'docs/company/content/channel-launch/LINKEDIN_PAGE_HANDOFF.md');
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

requireValue(manifest.schemaVersion === 1 && manifest.channelRef === 'CH-004', 'LinkedIn kit identity is invalid.');
requireValue(manifest.state === 'ready_for_kevin_visual_check_and_page_creation', 'LinkedIn kit must remain waiting for Kevin visual review and Page creation.');
verifyAsset(manifest.assets?.logo || {}, 'png');
verifyAsset(manifest.assets?.cover || {}, 'jpeg');
requireValue(manifest.assets?.logo?.width === 400 && manifest.assets?.logo?.height === 400, 'LinkedIn logo must retain the current recommended 400 by 400 dimensions.');
requireValue(manifest.assets?.cover?.width === 4200 && manifest.assets?.cover?.height === 700, 'LinkedIn cover must retain the current recommended 4200 by 700 dimensions.');
requireValue((manifest.assets?.logo?.bytes || Infinity) < 3 * 1024 * 1024 && (manifest.assets?.cover?.bytes || Infinity) < 3 * 1024 * 1024, 'LinkedIn artwork must remain below 3 MB per asset.');
requireValue(/AI-generated/i.test(manifest.artworkDisclosure || '') && /not gameplay/i.test(manifest.artworkDisclosure || ''), 'LinkedIn generated-art disclosure must remain explicit.');

for (const field of ['pageCreationAuthorized', 'assetUploadAuthorized', 'postPublicationAuthorized', 'pageMessagingAuthorized', 'commentReplyingAuthorized', 'paidPromotionAuthorized']) {
    requireValue(manifest.authority?.[field] === false, `${field} must remain false until Kevin acts.`);
}
requireValue(manifest.approval?.kevinVisualApprovalRequired === true && manifest.approval?.approvedAt === null && manifest.approval?.pageUrl === null, 'Kevin review and real LinkedIn Page URL must remain open.');

const linkedin = activation.channels?.find(channel => channel.channelRef === 'CH-004');
requireValue(linkedin?.accountState === 'not_created_owner_confirmed', 'LinkedIn Page must not be recorded as created.');
requireValue(linkedin?.channelKit?.manifest === 'public/marketing/channel-kit/linkedin/manifest.json', 'Activation pack must link the reviewed LinkedIn manifest.');
requireValue(linkedin?.channelKit?.coverAsset === manifest.assets.cover.path && linkedin?.channelKit?.logoAsset === manifest.assets.logo.path, 'Activation pack must use the reviewed LinkedIn cover and logo.');
requireValue(linkedin?.channelKit?.uploadAuthorized === false && linkedin?.channelKit?.kevinVisualApprovalRequired === true, 'LinkedIn artwork upload must remain gated by Kevin visual review.');
requireValue(linkedin?.firstPosts?.length === 6 && linkedin.firstPosts.every(post => post.approvalState === 'awaiting_kevin_and_page'), 'All six LinkedIn posts must remain prepared and unpublished.');
requireValue(linkedin?.engagementSetting?.pageMessagingBeforeAdultCoverage === 'off' && linkedin?.engagementSetting?.privateRepliesToChildren === false, 'LinkedIn messaging and child-contact safeguards must remain closed.');

const publicWords = `${linkedin?.tagline || ''}\n${linkedin?.about || ''}\n${manifest.wording?.coverPromise || ''}\n${handoff}`;
requireValue(!/\bcompanions?\b/i.test(publicWords), 'LinkedIn kit must use creature language.');
requireValue(!/no two creatures|every creature is unique|infinite unique creatures/i.test(publicWords), 'LinkedIn kit must not promise absolute uniqueness.');
requireValue(/created for free/i.test(handoff) && /no separate username or shared password/i.test(handoff), 'Handoff must retain the free Page and personal-profile ownership facts.');
requireValue(/Do not turn on Page messaging/i.test(handoff) && /do not.*create a post/i.test(handoff), 'Handoff must keep messaging and publication closed.');

if (errors.length) {
    console.error(`LinkedIn Page kit validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`LinkedIn Page kit valid: ${manifest.assets.cover.width}x${manifest.assets.cover.height} cover, 400x400 logo, six gated posts, no Page or publication authority.`);
