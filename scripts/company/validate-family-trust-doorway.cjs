const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../..');

function collectRuntimeSources(root) {
    const selected = [
        'package.json',
        'package-lock.json',
        'index.html',
        'public/discovery.js',
        'src/site/storefront.js',
        'src/site/analytics-consent.js'
    ];

    return selected
        .filter(relativePath => fs.existsSync(path.join(root, relativePath)))
        .map(relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8'))
        .join('\n');
}

function loadCurrent(root = repositoryRoot) {
    const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
    return {
        parentsHtml: read('public/parents/index.html'),
        playableHtml: read('public/playable-now/index.html'),
        claimsText: read('docs/company/content/claims.json'),
        llmsText: read('public/llms.txt'),
        operatingNote: read('docs/company/growth/FAMILY_TRUST_DOORWAY.md'),
        runtimeSources: collectRuntimeSources(root)
    };
}

function validateFamilyTrustDoorway(input) {
    const failures = [];
    const requireValue = (condition, message) => {
        if (!condition) failures.push(message);
    };

    requireValue(input.parentsHtml.includes('No game ads'), 'parent quick answers must state that the current game has no ads');
    requireValue(input.parentsHtml.includes('No public profiles or chat with other players'), 'parent quick answers must state the other-player boundary');
    requireValue(input.parentsHtml.includes('not a conversation with another person'), 'parent FAQ must distinguish creature dialogue from person-to-person chat');
    requireValue(input.parentsHtml.includes('no game adverts, public player profiles or chat with other players'), 'parent search description must carry the family trust promise');

    requireValue(input.playableHtml.includes('No game ads · No chat with other players'), 'Play doorway must show the ad and other-player boundaries before Play');
    requireValue(input.playableHtml.includes('no game ads, download, account, public profile or chat with other players'), 'Play doorway search description must carry the trust promise');
    requireValue(input.playableHtml.includes('Does Mythical Void have adverts or chat with other players?'), 'Play doorway structured FAQ must answer the family trust question');
    requireValue(input.playableHtml.includes('not a conversation with another person'), 'Play doorway FAQ must distinguish creature dialogue from person-to-person chat');

    requireValue(input.claimsText.includes('"id": "CL-014"') && input.claimsText.includes('The current game contains no paid advertising.'), 'claim registry must control the current-release advertising claim');
    requireValue(input.claimsText.includes('"id": "CL-015"') && input.claimsText.includes('no public player profiles or chat with other players'), 'claim registry must control the other-player claim');
    requireValue(input.claimsText.includes('Do not shorten this to ‘no chat’'), 'claim registry must protect the creature-dialogue distinction');

    requireValue(input.llmsText.includes('no paid advertising') && input.llmsText.includes('not person-to-person chat'), 'machine-readable guide must state the trust boundary accurately');
    requireValue(input.operatingNote.includes('Before adding adverts, multiplayer, public profiles or person-to-person chat'), 'operating note must define the future release check');

    const forbiddenRuntimePatterns = [
        /adsbygoogle/i,
        /googlesyndication\.com/i,
        /doubleclick\.net/i,
        /googleadservices\.com/i,
        /\badmob\b/i,
        /react-google-adsense/i,
        /\bpeerjs\b/i,
        /\bcolyseus\b/i,
        /\bpusher-js\b/i,
        /\bpubnub\b/i
    ];
    for (const pattern of forbiddenRuntimePatterns) {
        requireValue(!pattern.test(input.runtimeSources), `current runtime contradicts the family trust claim: ${pattern}`);
    }

    return failures;
}

if (require.main === module) {
    const failures = validateFamilyTrustDoorway(loadCurrent());
    if (failures.length) {
        console.error(failures.map(message => `- ${message}`).join('\n'));
        process.exit(1);
    }
    console.log('Family trust doorway validation passed.');
}

module.exports = { collectRuntimeSources, loadCurrent, validateFamilyTrustDoorway };

