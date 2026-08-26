#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const sourcePath = path.join(root, 'public/press/gameplay-video/mythical-forest-authentic-gameplay.mp4');
const emblemPath = path.join(root, 'public/marketing/mythical-void-emblem-v3.png');
const outputDir = path.join(root, 'public/press/social-video');
const expectedSourceSha256 = '3b9aa5e41bef7f9b2b5529a3c3d3e1a3cc6448676cb0e2643d0e61bd6c418a8c';
const expectedEmblemSha256 = '727245608b576923688b91fe200a88444eb68d1eb089ce63f70b418306c41cb8';
const durationSeconds = 19.583333;

function sha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function run(command, args) {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
    }
    return result.stdout;
}

function xml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    })[char]);
}

function dataUrl(file) {
    return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}

function commonSvg({ width, height, content }) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="glow" cx="76%" cy="12%" r="76%">
      <stop offset="0" stop-color="#203e4e" stop-opacity="0.86"/>
      <stop offset="0.38" stop-color="#18152f" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#070611"/>
    </radialGradient>
    <linearGradient id="line" x1="0" x2="1">
      <stop offset="0" stop-color="#76e3cf"/>
      <stop offset="1" stop-color="#ab66ff"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="34"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="#070611"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <circle cx="${Math.round(width * 0.83)}" cy="${Math.round(height * 0.17)}" r="${Math.round(Math.min(width, height) * 0.22)}" fill="#7441d9" opacity="0.16" filter="url(#soft)"/>
  <circle cx="${Math.round(width * 0.13)}" cy="${Math.round(height * 0.84)}" r="${Math.round(Math.min(width, height) * 0.18)}" fill="#38cdb0" opacity="0.11" filter="url(#soft)"/>
  ${content}
</svg>`;
}

const emblem = dataUrl(emblemPath);
const font = 'Arial, Helvetica, sans-serif';
const layouts = [
    {
        id: 'vertical',
        filename: 'mythical-void-real-gameplay-vertical.mp4',
        posterFilename: 'mythical-void-real-gameplay-vertical-poster.png',
        width: 1080,
        height: 1920,
        game: { x: 166, y: 150, width: 748, height: 1618 },
        svg() {
            return commonSvg({ width: this.width, height: this.height, content: `
  <rect x="154" y="138" width="772" height="1642" rx="38" fill="#090817" stroke="url(#line)" stroke-width="5"/>
  <image href="${emblem}" x="38" y="29" width="39" height="64"/>
  <text x="96" y="67" fill="#fff8ec" font-family="${font}" font-size="27" font-weight="700" letter-spacing="2.6">MYTHICAL VOID</text>
  <rect x="771" y="36" width="269" height="54" rx="27" fill="#76e3cf"/>
  <text x="905" y="71" text-anchor="middle" fill="#071411" font-family="${font}" font-size="21" font-weight="700" letter-spacing="1.5">REAL GAMEPLAY</text>
  <text x="540" y="1841" text-anchor="middle" fill="#fff8ec" font-family="${font}" font-size="30" font-weight="700">PLAY FREE IN YOUR BROWSER</text>
  <text x="540" y="1882" text-anchor="middle" fill="#76e3cf" font-family="${font}" font-size="23" font-weight="700" letter-spacing="1.2">MYTHICALVOID.COM/PLAYABLE-NOW</text>` });
        }
    },
    {
        id: 'square',
        filename: 'mythical-void-real-gameplay-square.mp4',
        posterFilename: 'mythical-void-real-gameplay-square-poster.png',
        width: 1080,
        height: 1080,
        game: { x: 58, y: 86, width: 416, height: 900 },
        svg() {
            return commonSvg({ width: this.width, height: this.height, content: `
  <rect x="46" y="74" width="440" height="924" rx="34" fill="#090817" stroke="url(#line)" stroke-width="5"/>
  <image href="${emblem}" x="551" y="76" width="57" height="93"/>
  <text x="628" y="121" fill="#fff8ec" font-family="${font}" font-size="29" font-weight="700" letter-spacing="2.3">MYTHICAL VOID</text>
  <text x="552" y="223" fill="#76e3cf" font-family="${font}" font-size="22" font-weight="700" letter-spacing="2.6">REAL GAMEPLAY // EARLY ACCESS</text>
  <text x="552" y="300" fill="#fff8ec" font-family="${font}" font-size="56" font-weight="700">
    <tspan x="552" dy="0">CRASH BEYOND</tspan><tspan x="552" dy="67">MAPPED SPACE.</tspan>
    <tspan x="552" dy="86">HATCH</tspan><tspan x="552" dy="64">SOMETHING</tspan><tspan x="552" dy="64">STRANGE.</tspan>
  </text>
  <text x="552" y="670" fill="#c9c2dc" font-family="${font}" font-size="30">
    <tspan x="552" dy="0">Cross six living realms.</tspan><tspan x="552" dy="43">Decide what Project Beacon</tspan><tspan x="552" dy="43">should become.</tspan>
  </text>
  <rect x="552" y="835" width="454" height="86" rx="43" fill="#76e3cf"/>
  <text x="779" y="889" text-anchor="middle" fill="#071411" font-family="${font}" font-size="26" font-weight="700">PLAY FREE IN YOUR BROWSER</text>
  <text x="779" y="969" text-anchor="middle" fill="#fff8ec" font-family="${font}" font-size="21" font-weight="700" letter-spacing="1">MYTHICALVOID.COM/PLAYABLE-NOW</text>` });
        }
    },
    {
        id: 'wide',
        filename: 'mythical-void-real-gameplay-wide.mp4',
        posterFilename: 'mythical-void-real-gameplay-wide-poster.png',
        width: 1920,
        height: 1080,
        game: { x: 1372, y: 60, width: 444, height: 960 },
        svg() {
            return commonSvg({ width: this.width, height: this.height, content: `
  <rect x="1358" y="46" width="472" height="988" rx="38" fill="#090817" stroke="url(#line)" stroke-width="6"/>
  <image href="${emblem}" x="98" y="76" width="72" height="118"/>
  <text x="194" y="133" fill="#fff8ec" font-family="${font}" font-size="39" font-weight="700" letter-spacing="3.4">MYTHICAL VOID</text>
  <text x="101" y="284" fill="#76e3cf" font-family="${font}" font-size="28" font-weight="700" letter-spacing="3.2">REAL GAMEPLAY // FREE EARLY ACCESS</text>
  <text x="96" y="402" fill="#fff8ec" font-family="${font}" font-size="112" font-weight="700">
    <tspan x="96" dy="0">THE VOID</tspan><tspan x="96" dy="118">IS WAITING.</tspan>
  </text>
  <text x="101" y="690" fill="#c9c2dc" font-family="${font}" font-size="39">
    <tspan x="101" dy="0">Crash beyond mapped space. Hatch a strange alien creature.</tspan>
    <tspan x="101" dy="57">Cross six living realms. Choose what Project Beacon becomes.</tspan>
  </text>
  <rect x="101" y="842" width="520" height="100" rx="50" fill="#76e3cf"/>
  <text x="361" y="905" text-anchor="middle" fill="#071411" font-family="${font}" font-size="31" font-weight="700">PLAY FREE IN YOUR BROWSER</text>
  <text x="666" y="905" fill="#fff8ec" font-family="${font}" font-size="27" font-weight="700" letter-spacing="1.2">MYTHICALVOID.COM/PLAYABLE-NOW</text>` });
        }
    }
];

if (sha256(sourcePath) !== expectedSourceSha256) throw new Error('Authentic gameplay source fingerprint changed; review the new source before rebuilding.');
if (sha256(emblemPath) !== expectedEmblemSha256) throw new Error('Brand emblem fingerprint changed; review the new emblem before rebuilding.');
fs.mkdirSync(outputDir, { recursive: true });
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-social-video-'));

try {
    for (const layout of layouts) {
        const svgPath = path.join(tempDir, `${layout.id}.svg`);
        const backgroundPath = path.join(tempDir, `${layout.id}-background.png`);
        const outputPath = path.join(outputDir, layout.filename);
        const posterPath = path.join(outputDir, layout.posterFilename);
        fs.writeFileSync(svgPath, layout.svg());
        run('rsvg-convert', ['-w', String(layout.width), '-h', String(layout.height), '-o', backgroundPath, svgPath]);

        const filter = [
            `[0:v]fps=24,scale=${layout.game.width}:${layout.game.height}:flags=lanczos:in_range=full:out_range=tv,setsar=1[game]`,
            `[1:v]fps=24,format=rgba[background]`,
            `[background][game]overlay=${layout.game.x}:${layout.game.y}:shortest=1,fade=t=in:st=0:d=0.35,fade=t=out:st=19:d=0.58,scale=in_range=full:out_range=tv,format=yuv420p,setparams=range=tv[out]`
        ].join(';');

        run('ffmpeg', [
            '-hide_banner', '-loglevel', 'error', '-y',
            '-i', sourcePath,
            '-loop', '1', '-i', backgroundPath,
            '-filter_complex', filter,
            '-map', '[out]', '-an', '-t', String(durationSeconds),
            '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'medium', '-crf', '21',
            '-r', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath
        ]);
        run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '6', '-i', outputPath, '-frames:v', '1', posterPath]);
    }

    const assets = layouts.map(layout => {
        const outputPath = path.join(outputDir, layout.filename);
        const posterPath = path.join(outputDir, layout.posterFilename);
        const probe = JSON.parse(run('ffprobe', [
            '-v', 'error', '-show_entries', 'stream=width,height,r_frame_rate,codec_name,pix_fmt,codec_type:format=duration,size',
            '-of', 'json', outputPath
        ]));
        const video = probe.streams.find(stream => stream.codec_type === 'video');
        const audio = probe.streams.find(stream => stream.codec_type === 'audio');
        return {
            id: `GSV-${String(layouts.indexOf(layout) + 1).padStart(3, '0')}`,
            format: layout.id,
            filename: layout.filename,
            publicPath: `/press/social-video/${layout.filename}`,
            posterFilename: layout.posterFilename,
            posterPublicPath: `/press/social-video/${layout.posterFilename}`,
            width: video.width,
            height: video.height,
            frameRate: video.r_frame_rate,
            durationSeconds: Number(Number(probe.format.duration).toFixed(2)),
            bytes: Number(probe.format.size),
            sha256: sha256(outputPath),
            posterSha256: sha256(posterPath),
            videoCodec: video.codec_name,
            pixelFormat: video.pix_fmt,
            audio: audio ? audio.codec_name : 'none',
            fullGameplayFramePreserved: true,
            classification: 'branded_social_video_with_authentic_running_build_gameplay',
            disclosure: 'The complete gameplay frame was recorded from the real Mythical Void browser game. The surrounding branded layout is not gameplay. No generated or replacement frames, scenery, interface or audio were added.'
        };
    });

    const manifest = {
        schemaVersion: 1,
        releaseId: 'AUTHENTIC-GAMEPLAY-SOCIAL-KIT-2026-08-26',
        state: 'owned_press_room_release_waiting_for_external_channel_and_kevin_approval',
        source: {
            filename: path.basename(sourcePath),
            publicPath: '/press/gameplay-video/mythical-forest-authentic-gameplay.mp4',
            sha256: expectedSourceSha256,
            durationSeconds: 19.58,
            width: 390,
            height: 844,
            capturedFromRunningBuild: true,
            generatedFramesUsed: false,
            privatePlayerDataUsed: false
        },
        brandEmblem: {
            publicPath: '/marketing/mythical-void-emblem-v3.png',
            sha256: expectedEmblemSha256
        },
        assets,
        captionPack: '/press/social-video/authentic-gameplay-caption-pack.json',
        authority: {
            ownedPressRoomPublicationAuthorized: true,
            externalSocialPublicationAuthorized: false,
            creatorOutreachSendingAuthorized: false,
            paidPromotionAuthorized: false,
            publicRepliesAuthorized: false,
            kevinApprovalRequiredBeforeExternalPublication: true,
            externalActionPerformed: false
        }
    };
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Built ${assets.length} authentic gameplay social videos in ${outputDir}.`);
} finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
