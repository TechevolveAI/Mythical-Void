#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const outputDir = path.join(root, 'public/press/creator-kit');
const archivePath = path.join(outputDir, 'mythical-void-authentic-gameplay-creator-kit.zip');
const manifestPath = path.join(outputDir, 'manifest.json');
const packageRoot = 'mythical-void-creator-kit';
const fixedTime = new Date('2026-08-26T00:00:00.000Z');

function sha256Buffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(file) {
    return sha256Buffer(fs.readFileSync(file));
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeText(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text.replace(/\r\n/g, '\n'), 'utf8');
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function buildCreatorKit() {
    const socialManifest = readJson(path.join(root, 'public/press/social-video/manifest.json'));
    const captionPath = path.join(root, 'public/press/social-video/authentic-gameplay-caption-pack.json');
    const factSheetPath = path.join(root, 'public/press/mythical-void-fact-sheet.txt');
    const emblemPath = path.join(root, 'public/marketing/mythical-void-emblem-v3.png');
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-creator-kit-'));
    const kit = path.join(temporary, packageRoot);

    const readme = `MYTHICAL VOID — AUTHENTIC GAMEPLAY CREATOR KIT
=================================================

Mythical Void is a free early-access creature adventure from an independent Irish studio. It began as a father-and-son experiment to see what imagination and generative AI tools could make possible, and grew into a real browser game.

PLAY THE GAME
https://mythicalvoid.com/playable-now/

WHAT IS IN THIS PACKAGE
- Three silent videos: vertical, square and wide.
- Three matching poster images.
- A caption pack with checked wording and useful alternative text.
- The official Mythical Void emblem.
- A plain-text fact sheet.
- A checklist for an official Mythical Void channel release.
- PACKAGE_MANIFEST.json, which records every included file.

MEDIA TRUTH
The complete moving game frame in each video is real Mythical Void gameplay recorded from the running browser game. The surrounding branded layout is not gameplay. No generated motion, replacement scenery, replacement interface or replacement audio was added.

SAFE EDITORIAL USE
Adults, journalists and creators may use these assets for truthful coverage of Mythical Void when the media truth above is kept clear. Do not describe the branded layout as raw gameplay. Do not imply that NASA endorses Mythical Void. Do not claim that every creature is globally unique, sentient or conscious.

CHILD SAFEGUARDING
The studio story may say that Mythical Void began as a father-and-son project and that the son was nine when it began. Do not add a child's name, photograph, quotation, contact route or identifying detail. Do not invite children to contact the studio directly.

OFFICIAL MYTHICAL VOID POSTS
Publishing through an official Mythical Void social account still requires Kevin's approval. Follow OFFICIAL_CHANNEL_RELEASE_CHECKLIST.txt before an official post.
`;

    const checklist = `MYTHICAL VOID — OFFICIAL CHANNEL RELEASE CHECKLIST
===================================================

Use this before publishing from an official Mythical Void social account.

[ ] Kevin has approved the exact video, caption and channel.
[ ] The channel is an official Mythical Void account and its public address has been checked.
[ ] An adult has watched the complete video from beginning to end.
[ ] The caption links only to https://mythicalvoid.com/playable-now/ with no tracking code.
[ ] The post says the moving game frame is real gameplay and the surrounding layout is branding.
[ ] No claim says that every creature is globally unique, sentient or conscious.
[ ] No wording implies NASA endorsement or partnership.
[ ] No child's name, photograph, quotation, contact route or identifying detail appears.
[ ] Comments and direct messages remain closed unless a named safeguarding adult and backup are ready to moderate them.
[ ] No child is invited to contact the studio directly.
[ ] No paid promotion or spending has been added unless Kevin has approved it.
[ ] The published address and time will only be recorded after the post is genuinely live.

If any box cannot be checked, stop and ask Kevin before publishing.
`;

    const entries = [
        { archivePath: `${packageRoot}/README.txt`, content: Buffer.from(readme, 'utf8') },
        { archivePath: `${packageRoot}/OFFICIAL_CHANNEL_RELEASE_CHECKLIST.txt`, content: Buffer.from(checklist, 'utf8') },
        { archivePath: `${packageRoot}/captions/authentic-gameplay-caption-pack.json`, source: captionPath },
        { archivePath: `${packageRoot}/brand/mythical-void-emblem-v3.png`, source: emblemPath },
        { archivePath: `${packageRoot}/facts/mythical-void-fact-sheet.txt`, source: factSheetPath }
    ];

    for (const asset of socialManifest.assets) {
        entries.push({ archivePath: `${packageRoot}/videos/${asset.filename}`, source: path.join(root, 'public', asset.publicPath.replace(/^\//, '')), expectedSha256: asset.sha256 });
        entries.push({ archivePath: `${packageRoot}/posters/${asset.posterFilename}`, source: path.join(root, 'public', asset.posterPublicPath.replace(/^\//, '')), expectedSha256: asset.posterSha256 });
    }

    for (const entry of entries) {
        const content = entry.content || fs.readFileSync(entry.source);
        if (entry.expectedSha256) assert(sha256Buffer(content) === entry.expectedSha256, `${entry.archivePath} no longer matches the social-video record`);
        entry.content = content;
        const destination = path.join(temporary, entry.archivePath);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, content);
    }

    const contentRecords = entries
        .map(entry => ({ path: entry.archivePath, bytes: entry.content.length, sha256: sha256Buffer(entry.content) }))
        .sort((a, b) => a.path.localeCompare(b.path));
    const packageManifest = {
        schemaVersion: 1,
        releaseId: 'MYTHICAL-VOID-AUTHENTIC-GAMEPLAY-CREATOR-KIT-2026-08-26',
        cleanPlayUrl: 'https://mythicalvoid.com/playable-now/',
        contents: contentRecords,
        mediaTruth: 'The complete moving game frame is real Mythical Void gameplay. The surrounding branded layout is not gameplay. No generated motion, replacement scenery, replacement interface or replacement audio was added.',
        authority: {
            truthfulEditorialUsePermitted: true,
            officialMythicalVoidSocialPublicationAuthorized: false,
            kevinApprovalRequiredBeforeOfficialPublication: true,
            creatorOutreachSendingAuthorized: false,
            paidPromotionAuthorized: false,
            publicRepliesAuthorized: false,
            externalActionPerformed: false
        }
    };
    const packageManifestText = `${JSON.stringify(packageManifest, null, 2)}\n`;
    const packageManifestArchivePath = `${packageRoot}/PACKAGE_MANIFEST.json`;
    writeText(path.join(temporary, packageManifestArchivePath), packageManifestText);

    const files = [...contentRecords.map(record => record.path), packageManifestArchivePath].sort();
    const directories = new Set();
    for (const file of files) {
        let directory = path.dirname(file);
        while (directory !== '.' && directory !== path.dirname(directory)) {
            directories.add(directory);
            directory = path.dirname(directory);
        }
    }
    for (const relative of [...directories].sort()) {
        fs.chmodSync(path.join(temporary, relative), 0o755);
        fs.utimesSync(path.join(temporary, relative), fixedTime, fixedTime);
    }
    for (const relative of files) {
        fs.chmodSync(path.join(temporary, relative), 0o644);
        fs.utimesSync(path.join(temporary, relative), fixedTime, fixedTime);
    }

    fs.mkdirSync(outputDir, { recursive: true });
    fs.rmSync(archivePath, { force: true });
    const zip = spawnSync('zip', ['-X', '-9', '-q', archivePath, ...files], { cwd: temporary, encoding: 'utf8' });
    if (zip.status !== 0) throw new Error(`zip failed: ${zip.stderr || zip.stdout}`);

    const archiveSha256 = sha256File(archivePath);
    const outerManifest = {
        schemaVersion: 1,
        releaseId: packageManifest.releaseId,
        state: 'owned_press_room_release_waiting_for_external_channel_and_kevin_approval',
        archive: {
            filename: path.basename(archivePath),
            publicUrl: `https://mythicalvoid.com/press/creator-kit/${path.basename(archivePath)}`,
            bytes: fs.statSync(archivePath).size,
            sha256: archiveSha256,
            rootFolder: packageRoot,
            fileCount: files.length
        },
        contents: [
            ...contentRecords,
            { path: packageManifestArchivePath, bytes: Buffer.byteLength(packageManifestText), sha256: sha256Buffer(Buffer.from(packageManifestText, 'utf8')) }
        ].sort((a, b) => a.path.localeCompare(b.path)),
        mediaSourceManifest: 'https://mythicalvoid.com/press/social-video/manifest.json',
        cleanPlayUrl: packageManifest.cleanPlayUrl,
        permissions: 'Adults, press and creators may use the package for truthful editorial coverage when the included media disclosures are preserved.',
        authority: packageManifest.authority
    };
    writeText(manifestPath, `${JSON.stringify(outerManifest, null, 2)}\n`);
    fs.rmSync(temporary, { recursive: true, force: true });
    return outerManifest;
}

if (require.main === module) {
    const manifest = buildCreatorKit();
    console.log(JSON.stringify({ archive: archivePath, bytes: manifest.archive.bytes, sha256: manifest.archive.sha256, fileCount: manifest.archive.fileCount }, null, 2));
}

module.exports = { archivePath, manifestPath, buildCreatorKit };
