#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '../..');
const paths = {
    manifest: path.join(root, 'public/press/social-video/manifest.json'),
    captions: path.join(root, 'public/press/social-video/authentic-gameplay-caption-pack.json'),
    release: path.join(root, 'docs/company/content/generated/authentic-gameplay-social-kit-release.json'),
    sourceManifest: path.join(root, 'public/press/gameplay-video/manifest.json'),
    pressAssets: path.join(root, 'public/press/mythical-void-press-assets.json'),
    signal: path.join(root, 'public/updates/releases.json'),
    pressSource: path.join(root, 'src/site/storefront.js'),
    llms: path.join(root, 'public/llms.txt')
};

const expected = {
    sourceSha256: '3b9aa5e41bef7f9b2b5529a3c3d3e1a3cc6448676cb0e2643d0e61bd6c418a8c',
    formats: {
        vertical: { width: 1080, height: 1920 },
        square: { width: 1080, height: 1080 },
        wide: { width: 1920, height: 1080 }
    }
};

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function pngDimensions(file) {
    const buffer = fs.readFileSync(file);
    if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function validate(values, baseDir = root) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const { manifest, captions, release, sourceManifest, pressAssets, signal, pressSource, llms } = values;
    const sourcePath = path.join(baseDir, 'public/press/gameplay-video/mythical-forest-authentic-gameplay.mp4');

    requireValue(manifest.releaseId === 'AUTHENTIC-GAMEPLAY-SOCIAL-KIT-2026-08-26', 'wrong social kit release id');
    requireValue(manifest.state === 'withdrawn_visual_quality_failed_do_not_publish' && /broken creature render/i.test(manifest.withdrawalReason || ''), 'social kit must remain withdrawn with its visual failure recorded');
    requireValue(manifest.source?.sha256 === expected.sourceSha256, 'withdrawn kit lost the exact source fingerprint it was built from');
    requireValue(sha256(sourcePath) !== expected.sourceSha256, 'withdrawn source clip is still being presented as the current lead video');
    requireValue(manifest.source?.capturedFromRunningBuild === true && manifest.source?.generatedFramesUsed === false && manifest.source?.privatePlayerDataUsed === false, 'source must remain real running-build footage without generated frames or private player data');
    requireValue(sourceManifest.asset?.classification === 'authentic_running_build_story_moment' && sourceManifest.asset?.sha256 === sha256(sourcePath) && sourceManifest.ownedWebsiteProofUseAuthorized === true && sourceManifest.externalPromotionAuthorized === false && sourceManifest.kevinApprovalRequiredBeforeExternalPublication === true, 'replacement source must be the checked story moment while retaining the external promotion gate');

    requireValue(Array.isArray(manifest.assets) && manifest.assets.length === 3, 'exactly three social video formats are required');
    const assetFormats = new Set((manifest.assets || []).map(asset => asset.format));
    requireValue(Object.keys(expected.formats).every(format => assetFormats.has(format)), 'vertical, square and wide formats are all required');
    for (const asset of manifest.assets || []) {
        const shape = expected.formats[asset.format];
        const videoPath = path.join(baseDir, 'public', asset.publicPath.replace(/^\//, ''));
        const posterPath = path.join(baseDir, 'public', asset.posterPublicPath.replace(/^\//, ''));
        requireValue(Boolean(shape), `unknown video format ${asset.format}`);
        requireValue(asset.width === shape?.width && asset.height === shape?.height, `${asset.format} dimensions changed`);
        requireValue(asset.durationSeconds === 19.58 && asset.frameRate === '24/1', `${asset.format} duration or frame rate changed`);
        requireValue(asset.videoCodec === 'h264' && asset.pixelFormat === 'yuv420p' && asset.audio === 'none', `${asset.format} must remain silent H.264 yuv420p media`);
        requireValue(asset.fullGameplayFramePreserved === true, `${asset.format} must preserve the complete gameplay frame`);
        requireValue(asset.classification === 'branded_social_video_with_authentic_running_build_gameplay', `${asset.format} classification changed`);
        requireValue(/surrounding branded layout is not gameplay/i.test(asset.disclosure || '') && /No generated or replacement frames/i.test(asset.disclosure || ''), `${asset.format} disclosure lost the edit boundary`);
        requireValue(fs.existsSync(videoPath) && sha256(videoPath) === asset.sha256 && fs.statSync(videoPath).size === asset.bytes, `${asset.format} video file does not match its record`);
        const posterSize = fs.existsSync(posterPath) ? pngDimensions(posterPath) : null;
        requireValue(fs.existsSync(posterPath) && sha256(posterPath) === asset.posterSha256, `${asset.format} poster file does not match its record`);
        requireValue(posterSize?.width === shape?.width && posterSize?.height === shape?.height, `${asset.format} poster dimensions changed`);
        const releaseAsset = release.assets?.find(candidate => candidate.format === asset.format);
        requireValue(releaseAsset?.sha256 === asset.sha256 && releaseAsset?.posterSha256 === asset.posterSha256 && releaseAsset?.durationSeconds === 19.58, `${asset.format} release evidence drifted from its manifest`);
    }

    requireValue(captions.state === 'withdrawn_visual_quality_failed_do_not_publish' && captions.cleanDestination === 'https://mythicalvoid.com/playable-now/', 'caption pack must remain withdrawn and source-bound');
    requireValue(captions.mediaManifest === 'https://mythicalvoid.com/press/social-video/manifest.json', 'caption pack must cite its public media record');
    requireValue(Array.isArray(captions.drafts) && captions.drafts.length === 3, 'exactly three caption drafts are required');
    requireValue((captions.drafts || []).every(draft => /^https:\/\/mythicalvoid\.com\/press\/social-video\/.+\.mp4$/.test(draft.asset || '') && /https:\/\/mythicalvoid\.com\/playable-now\//.test(draft.caption || '') && !/[?&](?:utm_|ref=|source=)/i.test(draft.caption || '') && Boolean(draft.altText)), 'every caption must use a recorded asset, clean play link and useful alternative text');
    const publicWording = JSON.stringify({ captions, pressAssets, signal });
    requireValue(!/\bcompanions?\b/i.test(publicWording), 'public social kit wording must call them creatures');
    requireValue(!/\bno two creatures (?:are )?alike\b|\bevery creature is unique\b|\bguaranteed unique\b/i.test(publicWording), 'public social kit must not make an absolute uniqueness claim');
    requireValue(captions.boundaries?.absoluteCreatureUniquenessClaimPermitted === false && captions.boundaries?.generatedArtworkMayBeCalledGameplay === false && captions.boundaries?.nasaEndorsementClaimPermitted === false && captions.boundaries?.sentienceOrConsciousnessClaimPermitted === false && captions.boundaries?.childPhotoNameQuoteContactOrIdentifyingDetailPermitted === false && captions.boundaries?.trackingParametersPermitted === false && captions.boundaries?.inventedAudienceMetricsPermitted === false, 'caption pack lost a claims, identity or tracking boundary');
    requireValue(captions.authority?.publicPressRoomPublicationAuthorized === false && captions.authority?.externalSocialPublicationAuthorized === false && captions.authority?.creatorOutreachSendingAuthorized === false && captions.authority?.paidPromotionAuthorized === false && captions.authority?.publicRepliesAuthorized === false && captions.authority?.kevinApprovalRequiredBeforeExternalPublication === true && captions.authority?.externalActionPerformed === false, 'withdrawn caption authority must keep all publication, sending, spending and replies closed');

    requireValue(manifest.authority?.ownedPressRoomPublicationAuthorized === false && manifest.authority?.externalSocialPublicationAuthorized === false && manifest.authority?.creatorOutreachSendingAuthorized === false && manifest.authority?.paidPromotionAuthorized === false && manifest.authority?.publicRepliesAuthorized === false && manifest.authority?.kevinApprovalRequiredBeforeExternalPublication === true && manifest.authority?.externalActionPerformed === false, 'withdrawn media authority must keep all publication, sending, spending and replies closed');
    requireValue(release.state === 'withdrawn_visual_quality_failed_do_not_publish' && release.verification?.allMediaFingerprintsMatched === true && release.verification?.deterministicRebuildManifestMatched === true && release.verification?.browserVideoCount === 3 && release.verification?.productionUrlsVerified === false, 'withdrawn release must retain its file evidence and truthful pre-production record');
    requireValue(release.presentationBoundary?.fullGameplayFramePreserved === true && release.presentationBoundary?.surroundingBrandLayoutIsGameplay === false && release.presentationBoundary?.generatedMotionUsed === false && release.presentationBoundary?.replacementSceneryUsed === false && release.presentationBoundary?.replacementInterfaceUsed === false && release.presentationBoundary?.replacementAudioUsed === false && release.presentationBoundary?.audio === 'none', 'release presentation boundary changed');
    requireValue(release.authority?.ownedPressRoomPublicationAuthorized === false && release.authority?.externalSocialPublicationAuthorized === false && release.authority?.creatorOutreachSendingAuthorized === false && release.authority?.paidPromotionAuthorized === false && release.authority?.publicRepliesAuthorized === false && release.authority?.kevinApprovalRequiredBeforeExternalPublication === true && release.authority?.externalActionPerformed === false, 'withdrawn release authority silently widened');

    const pressAssetsVideos = (pressAssets.assets || []).filter(asset => asset.kind === 'branded_social_video_with_authentic_running_build_gameplay');
    requireValue(pressAssets.authenticGameplaySocialKit?.state === 'withdrawn_visual_quality_failed_do_not_publish' && pressAssetsVideos.length === 3 && pressAssetsVideos.every(asset => asset.state === 'withdrawn_visual_quality_failed_do_not_publish'), 'press manifest must retain the three withdrawn file records without presenting them as usable');
    requireValue(!pressSource.includes('id="real-gameplay-social-video"') && pressSource.includes('The public media library is being rebuilt.') && pressSource.includes('No gameplay download pack is approved.'), 'press room must hide the files and explain the withdrawal');
    requireValue(!llms.includes('Authentic gameplay social video kit:'), 'machine-readable site guide still promotes the withdrawn kit');
    const signalEntry = signal.entries?.find(entry => entry.id === 'UPDATE-010');
    requireValue(!signalEntry, 'Latest News still promotes the withdrawn social kit');

    return {
        valid: failures.length === 0,
        assetCount: manifest.assets?.length || 0,
        captionCount: captions.drafts?.length || 0,
        cleanDestination: captions.cleanDestination,
        externalPublicationAuthorized: manifest.authority?.externalSocialPublicationAuthorized,
        failures
    };
}

if (require.main === module) {
    const values = {
        manifest: readJson(paths.manifest),
        captions: readJson(paths.captions),
        release: readJson(paths.release),
        sourceManifest: readJson(paths.sourceManifest),
        pressAssets: readJson(paths.pressAssets),
        signal: readJson(paths.signal),
        pressSource: fs.readFileSync(paths.pressSource, 'utf8'),
        llms: fs.readFileSync(paths.llms, 'utf8')
    };
    const result = validate(values);
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exit(1);
}

module.exports = { paths, readJson, validate };
