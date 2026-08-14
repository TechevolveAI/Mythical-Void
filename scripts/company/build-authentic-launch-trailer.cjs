#!/usr/bin/env node

const { createHash } = require('crypto');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const chrome = process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const outputDir = path.join(root, 'public/press/trailer');
const outputPath = path.join(outputDir, 'mythical-void-play-free-launch-trailer.mp4');
const posterPath = path.join(outputDir, 'mythical-void-play-free-launch-trailer-poster.jpg');
const captionsPath = path.join(outputDir, 'mythical-void-play-free-launch-trailer.vtt');
const manifestPath = path.join(outputDir, 'manifest.json');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-launch-trailer-'));

const W = 1920;
const H = 1080;
const FPS = 30;
const gameplayVideo = path.join(
    root,
    'public/press/gameplay-video/mythical-forest-authentic-gameplay.mp4'
);
const gameTheme = path.join(root, 'public/audio/theme-music.mp3');
const emblem = path.join(root, 'public/marketing/mythical-void-emblem-v3.png');

function run(command, args, label) {
    const result = spawnSync(command, args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    if (result.status !== 0) {
        throw new Error(`${label} failed:\n${result.stderr || result.stdout}`);
    }
    return result.stdout;
}

function fileUrl(filename) {
    return `file://${filename.split(path.sep).map(encodeURIComponent).join('/')}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function sha256(filename) {
    return createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function gitValue(args) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    return result.status === 0 ? result.stdout.trim() || null : null;
}

function htmlDocument(body, { className = '', extraCss = '' } = {}) {
    return `<!doctype html>
<html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:#070619;color:#fff}
.frame{position:relative;width:100%;height:100%;overflow:hidden;background:
radial-gradient(circle at 82% 18%,rgba(80,225,202,.17),transparent 29%),
radial-gradient(circle at 14% 84%,rgba(124,63,227,.22),transparent 33%),
linear-gradient(135deg,#070619,#10092a 58%,#071d28)}
.frame:after{content:"";position:absolute;inset:34px;border:1px solid rgba(151,238,224,.19);border-radius:34px;pointer-events:none}
.stars{position:absolute;inset:0;opacity:.56;background-image:
radial-gradient(circle,#fff 0 1px,transparent 1.6px),
radial-gradient(circle,#7ce9d6 0 1px,transparent 1.7px),
radial-gradient(circle,#9b62ff 0 1.2px,transparent 1.8px);
background-size:137px 137px,211px 211px,307px 307px;background-position:20px 40px,80px 10px,140px 90px}
.safe{position:absolute;inset:82px 110px;z-index:2}
.eyebrow{font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#79ead4;font-size:27px}
h1{font-size:108px;line-height:.94;letter-spacing:-.055em;margin:28px 0 26px;max-width:1280px}
h2{font-size:66px;line-height:1.03;letter-spacing:-.04em;margin:18px 0 20px}
p{font-size:34px;line-height:1.35;color:#d9d6ea;margin:0;max-width:1120px}
.gold{color:#ffd766}.mint{color:#79ead4}.violet{color:#b793ff}.small{font-size:23px;color:#aba7c6}
.pill{display:inline-flex;align-items:center;padding:14px 22px;border-radius:999px;border:1px solid rgba(121,234,212,.45);background:rgba(8,8,28,.72);font-weight:800;font-size:21px;letter-spacing:.08em;text-transform:uppercase}
.logo{filter:drop-shadow(0 0 32px rgba(150,81,255,.38))}
.shot{position:absolute;overflow:hidden;border-radius:38px;border:2px solid rgba(196,181,255,.28);box-shadow:0 36px 100px rgba(0,0,0,.45);background:#050511}
.shot img{width:100%;height:100%;object-fit:cover}
.phone{border-radius:48px;border:3px solid rgba(174,238,228,.42);box-shadow:0 32px 75px rgba(0,0,0,.5);overflow:hidden;background:#060512}
.phone img{width:100%;height:100%;object-fit:cover}
.label{position:absolute;left:24px;bottom:22px;padding:11px 16px;border-radius:999px;background:rgba(5,5,20,.82);border:1px solid rgba(255,255,255,.26);font-size:17px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#fff}
.worlds{position:absolute;inset:110px 95px 95px;display:flex;gap:26px;align-items:flex-end}
.world{flex:1;height:760px;position:relative;border-radius:42px;overflow:hidden;border:2px solid rgba(189,171,255,.28);background:#0c0922;box-shadow:0 26px 70px rgba(0,0,0,.45)}
.world img{width:100%;height:100%;object-fit:cover}
.world span{position:absolute;left:18px;right:18px;bottom:18px;padding:13px 12px;border-radius:16px;background:rgba(5,5,20,.85);font-size:18px;text-align:center;font-weight:900;text-transform:uppercase;letter-spacing:.05em}
.caption{position:absolute;left:0;right:0;bottom:0;padding:92px 108px 78px;background:linear-gradient(transparent,rgba(4,4,18,.96));z-index:3}
.caption h2{margin:0 0 12px;font-size:72px}.caption p{font-size:29px}
.split{display:grid;grid-template-columns:1.02fr .98fr;gap:70px;align-items:center;height:100%}
.origin{display:flex;align-items:center;gap:36px;margin-top:38px;color:#d9d6ea;font-size:28px}.origin strong{color:#fff}
${extraCss}
</style></head><body class="${escapeHtml(className)}">${body}</body></html>`;
}

function renderCard(id, html) {
    const htmlPath = path.join(tempDir, `${id}.html`);
    const pngPath = path.join(tempDir, `${id}.png`);
    fs.writeFileSync(htmlPath, html);
    run(chrome, [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--allow-file-access-from-files',
        `--window-size=${W},${H}`,
        `--screenshot=${pngPath}`,
        fileUrl(htmlPath)
    ], `render card ${id}`);
    if (!fs.existsSync(pngPath)) throw new Error(`Card did not render: ${id}`);
    return pngPath;
}

function image(name) {
    return fileUrl(path.join(root, `public/press/gameplay/${name}`));
}

const cards = [
    {
        id: '01-title', duration: 5,
        html: htmlDocument(`<div class="frame"><div class="stars"></div><div class="safe split">
          <div><div class="eyebrow">A father-and-son experiment became a real game</div>
          <h1>MYTHICAL<br><span class="mint">VOID</span></h1>
          <p>A universe of creatures is waiting.</p></div>
          <div style="display:flex;justify-content:center"><img class="logo" src="${fileUrl(emblem)}" style="width:430px;height:700px;object-fit:contain"></div>
        </div></div>`)
    },
    {
        id: '02-signal', duration: 5,
        html: htmlDocument(`<div class="frame"><div class="shot" style="inset:34px"><img src="${image('project-beacon-start.png')}"></div>
        <div class="caption"><div class="eyebrow">Captured from the real browser game</div><h2>Wanderer-77 is down.</h2><p>Recover what survived. Follow the signal.</p></div></div>`)
    },
    {
        id: '03-contact', duration: 5,
        html: htmlDocument(`<div class="frame"><div class="shot" style="inset:34px"><img src="${image('project-beacon-live-egg.png')}"></div>
        <div class="caption"><div class="eyebrow">First contact</div><h2>Something survived with you.</h2><p>Hatch a strange creature and begin Project Beacon.</p></div></div>`)
    },
    {
        id: '04-gameplay-base', duration: 10,
        html: htmlDocument(`<div class="frame"><div class="stars"></div><div class="safe split">
          <div><div class="pill">Authentic gameplay · real build</div><h1 style="font-size:88px">Run. Leap.<br><span class="mint">Follow the signal.</span></h1>
          <p>Play on phone or computer. No download or account needed to begin.</p></div>
          <div style="height:900px"></div>
        </div></div>`)
    },
    {
        id: '05-hatch', duration: 5,
        html: htmlDocument(`<div class="frame"><div class="shot" style="inset:34px"><img src="${image('creature-cosmic-egg-hatch.png')}"></div>
        <div class="caption"><div class="eyebrow">Your creature begins here</div><h2>Strange forms. Unexpected traits.</h2><p>The creature system can combine shapes, colours, temperaments and rare mutations in many ways.</p></div></div>`)
    },
    {
        id: '06-worlds-a', duration: 6,
        html: htmlDocument(`<div class="frame"><div class="worlds">
          <div class="world"><img src="${image('realm-mythicalforest.png')}"><span>Mythical Forest</span></div>
          <div class="world"><img src="${image('realm-crystalcaves.png')}"><span>Crystal Caves</span></div>
          <div class="world"><img src="${image('realm-reef.png')}"><span>Cosmic Reef</span></div>
        </div><div class="safe"><div class="eyebrow">Authentic gameplay captures · six living realms</div></div></div>`)
    },
    {
        id: '07-worlds-b', duration: 6,
        html: htmlDocument(`<div class="frame"><div class="worlds">
          <div class="world"><img src="${image('realm-voidpeaks.png')}"><span>Void Peaks</span></div>
          <div class="world"><img src="${image('realm-auroradepths.png')}"><span>Aurora Depths</span></div>
          <div class="world"><img src="${image('realm-finalvoid.png')}"><span>Final Void</span></div>
        </div><div class="safe"><div class="eyebrow">Explore · restore · choose</div></div></div>`)
    },
    {
        id: '08-village', duration: 5,
        html: htmlDocument(`<div class="frame"><div class="stars"></div><div class="safe split">
          <div><div class="eyebrow">The Fend</div><h1 style="font-size:87px">Restore a world.<br><span class="gold">Build a home.</span></h1>
          <p>Gather resources and help the village grow.</p></div>
          <div class="phone" style="height:890px;width:412px;justify-self:center;position:relative"><img src="${image('village-first-construction.png')}"><div class="label">Real gameplay capture</div></div>
        </div></div>`)
    },
    {
        id: '09-nasa', duration: 5,
        html: htmlDocument(`<div class="frame"><div class="stars"></div><div class="safe split">
          <div><div class="eyebrow">Fantasy can open a door to real science</div><h1 style="font-size:83px">Real space.<br><span class="mint">Creature curiosity.</span></h1>
          <p>Optional, credited NASA discoveries invite young players to observe, question and imagine.</p>
          <p class="small" style="margin-top:24px">Independent Mythical Void feature. NASA does not endorse Mythical Void.</p></div>
          <div class="phone" style="height:890px;width:412px;justify-self:center;position:relative"><img src="${image('nasa-apollo11-real-space-discovery.png')}"><div class="label">Real in-game learning moment</div></div>
        </div></div>`)
    },
    {
        id: '10-origin', duration: 5,
        html: htmlDocument(`<div class="frame"><div class="stars"></div><div class="safe" style="display:flex;flex-direction:column;justify-content:center">
          <div class="eyebrow">Made in Ireland · imagination first</div>
          <h1 style="font-size:91px;max-width:1500px">It began with a father, his nine-year-old son and one question:</h1>
          <p style="font-size:43px;color:#79ead4;font-weight:800">What could we make with generative AI tools and imagination?</p>
          <div class="origin"><span class="pill">AI helps us build</span><strong>People remain responsible for story, safety and important choices.</strong></div>
        </div></div>`)
    },
    {
        id: '11-cta', duration: 7,
        html: htmlDocument(`<div class="frame"><div class="stars"></div><div class="safe split">
          <div><div class="eyebrow">The signal is live</div><h1>PLAY<br><span class="mint">FREE</span></h1>
          <p style="font-size:42px;color:#fff;font-weight:800">mythicalvoid.com</p>
          <p style="margin-top:22px">In your browser · No download · No account needed to begin</p></div>
          <div style="display:flex;justify-content:center"><img class="logo" src="${fileUrl(emblem)}" style="width:400px;height:670px;object-fit:contain"></div>
        </div></div>`)
    }
];

function makeStillClip(card, pngPath) {
    const clipPath = path.join(tempDir, `${card.id}.mp4`);
    run('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-loop', '1', '-framerate', String(FPS), '-i', pngPath,
        '-t', String(card.duration),
        '-vf', `scale=${W}:${H},fade=t=in:st=0:d=0.3,fade=t=out:st=${Math.max(0, card.duration - 0.3)}:d=0.3,format=yuv420p`,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
        '-r', String(FPS), '-an', clipPath
    ], `encode ${card.id}`);
    return clipPath;
}

function makeGameplayClip(card, pngPath) {
    const clipPath = path.join(tempDir, `${card.id}.mp4`);
    run('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-loop', '1', '-framerate', String(FPS), '-i', pngPath,
        '-i', gameplayVideo,
        '-filter_complex',
        `[0:v]scale=${W}:${H},trim=duration=${card.duration},setpts=PTS-STARTPTS[base];` +
        `[1:v]scale=-2:900:force_original_aspect_ratio=decrease,setpts=PTS-STARTPTS[game];` +
        `[base][game]overlay=x=1330-overlay_w/2:y=(H-overlay_h)/2:shortest=0,` +
        `fade=t=in:st=0:d=0.3,fade=t=out:st=${card.duration - 0.3}:d=0.3,format=yuv420p[out]`,
        '-map', '[out]', '-t', String(card.duration),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
        '-r', String(FPS), '-an', clipPath
    ], `encode ${card.id}`);
    return clipPath;
}

function inspectVideo(filename) {
    return JSON.parse(run('ffprobe', [
        '-v', 'error',
        '-show_entries', 'stream=codec_name,width,height,r_frame_rate,channels,sample_rate',
        '-show_entries', 'format=duration,size',
        '-of', 'json', filename
    ], 'inspect trailer'));
}

function main() {
    [chrome, gameplayVideo, gameTheme, emblem].forEach(filename => {
        if (!fs.existsSync(filename)) throw new Error(`Required source missing: ${filename}`);
    });
    fs.mkdirSync(outputDir, { recursive: true });
    const clips = cards.map(card => {
        process.stdout.write(`Rendering ${card.id}\n`);
        const png = renderCard(card.id, card.html);
        return card.id === '04-gameplay-base'
            ? makeGameplayClip(card, png)
            : makeStillClip(card, png);
    });

    const concatPath = path.join(tempDir, 'concat.txt');
    fs.writeFileSync(concatPath, clips.map(filename => `file '${filename}'`).join('\n') + '\n');
    const videoOnly = path.join(tempDir, 'trailer-video-only.mp4');
    run('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'concat', '-safe', '0', '-i', concatPath,
        '-c', 'copy', videoOnly
    ], 'join trailer scenes');

    const totalDuration = cards.reduce((sum, card) => sum + card.duration, 0);
    run('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', videoOnly,
        '-stream_loop', '-1', '-i', gameTheme,
        '-filter_complex',
        `[1:a]atrim=0:${totalDuration},volume=0.28,` +
        `afade=t=in:st=0:d=2,afade=t=out:st=${totalDuration - 3}:d=3[a]`,
        '-map', '0:v:0', '-map', '[a]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
        '-t', String(totalDuration), '-movflags', '+faststart', outputPath
    ], 'add first-party game theme');

    run('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-ss', '1.8', '-i', outputPath,
        '-frames:v', '1', '-q:v', '2', posterPath
    ], 'create trailer poster');

    const captions = `WEBVTT\n\n` +
`00:00:00.000 --> 00:00:05.000\nMythical Void. A father-and-son experiment became a real game.\n\n` +
`00:00:05.000 --> 00:00:10.000\nWanderer-77 is down. Recover what survived. Follow the signal.\n\n` +
`00:00:10.000 --> 00:00:15.000\nSomething survived with you. Hatch a strange creature and begin Project Beacon.\n\n` +
`00:00:15.000 --> 00:00:25.000\nAuthentic gameplay: run, leap and follow the signal through the Mythical Forest.\n\n` +
`00:00:25.000 --> 00:00:30.000\nStrange forms. Unexpected traits.\n\n` +
`00:00:30.000 --> 00:00:42.000\nExplore six living realms: Mythical Forest, Crystal Caves, Cosmic Reef, Void Peaks, Aurora Depths and Final Void.\n\n` +
`00:00:42.000 --> 00:00:47.000\nRestore a world. Build a home.\n\n` +
`00:00:47.000 --> 00:00:52.000\nOptional, credited NASA discoveries connect fantasy to real science. NASA does not endorse Mythical Void.\n\n` +
`00:00:52.000 --> 00:00:57.000\nMade in Ireland. AI helps us build. People remain responsible.\n\n` +
`00:00:57.000 --> 00:01:04.000\nPlay free at mythicalvoid.com. No download or account needed to begin.\n`;
    fs.writeFileSync(captionsPath, captions);

    const probe = inspectVideo(outputPath);
    const videoStream = probe.streams.find(stream => stream.width);
    const audioStream = probe.streams.find(stream => stream.channels);
    const sourceFiles = [
        gameplayVideo,
        gameTheme,
        emblem,
        ...[
            'project-beacon-start.png',
            'project-beacon-live-egg.png',
            'creature-cosmic-egg-hatch.png',
            'realm-mythicalforest.png',
            'realm-crystalcaves.png',
            'realm-reef.png',
            'realm-voidpeaks.png',
            'realm-auroradepths.png',
            'realm-finalvoid.png',
            'village-first-construction.png',
            'nasa-apollo11-real-space-discovery.png'
        ].map(name => path.join(root, 'public/press/gameplay', name))
    ];
    const manifest = {
        schemaVersion: 1,
        asOf: new Date().toISOString(),
        sourceCommit: gitValue(['rev-parse', 'HEAD']),
        sourceBranch: gitValue(['branch', '--show-current']),
        approvalState: 'internal_review_ready_waiting_for_kevin',
        purpose: 'A truthful 60-to-90-second launch trailer for the press room, YouTube and creator outreach.',
        audience: 'Families, teenagers, adult players, educators, creators and games press.',
        presentationBoundary: 'Moving gameplay is taken only from the authentic running-build recording. Other game views are clearly framed as authentic gameplay captures. No generated marketing illustration is presented as gameplay.',
        privacy: 'Uses only company-controlled QA captures. No child identity, player name, account, message, notification or personal save data appears.',
        nasaBoundary: 'The NASA learning moment is credited in the source capture and the trailer states that NASA does not endorse Mythical Void.',
        audioRights: 'Uses the first-party Mythical Void theme music already shipped with the game. No third-party stock music was added.',
        asset: {
            id: 'TR-001',
            filename: path.basename(outputPath),
            publicPath: `/press/trailer/${path.basename(outputPath)}`,
            posterFilename: path.basename(posterPath),
            posterPublicPath: `/press/trailer/${path.basename(posterPath)}`,
            captionsFilename: path.basename(captionsPath),
            captionsPublicPath: `/press/trailer/${path.basename(captionsPath)}`,
            classification: 'edited_first_party_launch_trailer_with_authentic_gameplay',
            disclosure: 'Includes authentic gameplay footage and authentic running-build screenshots. Edited with title cards and the first-party game theme; no generated gameplay footage.',
            sha256: sha256(outputPath),
            posterSha256: sha256(posterPath),
            captionsSha256: sha256(captionsPath),
            width: videoStream?.width,
            height: videoStream?.height,
            frameRate: videoStream?.r_frame_rate,
            durationSeconds: Number(Number(probe.format.duration).toFixed(2)),
            bytes: Number(probe.format.size),
            audio: audioStream ? {
                codec: audioStream.codec_name,
                channels: audioStream.channels,
                sampleRate: Number(audioStream.sample_rate)
            } : null
        },
        editStructure: cards.map(card => ({
            id: card.id,
            durationSeconds: card.duration,
            movingGameplay: card.id === '04-gameplay-base'
        })),
        sources: sourceFiles.map(filename => ({
            path: path.relative(root, filename),
            sha256: sha256(filename)
        })),
        requiredHumanReview: [
            'Watch the beginning, middle and end with sound.',
            'Confirm the pace and family-facing language.',
            'Confirm every gameplay statement still matches the live game.',
            'Choose the YouTube audience setting at upload.',
            'Approve the finished title, description, thumbnail and film together before publication.'
        ]
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    process.stdout.write(`Launch trailer complete: ${outputPath}\n`);
    process.stdout.write(`Duration: ${manifest.asset.durationSeconds}s\n`);
}

try {
    main();
} finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
