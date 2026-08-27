const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../..');

function loadCurrent(root = repositoryRoot) {
    const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
    return {
        helpHtml: read('public/help/index.html'),
        storefront: read('src/site/storefront.js'),
        parentsHtml: read('public/parents/index.html'),
        playableHtml: read('public/playable-now/index.html'),
        sitemap: read('public/sitemap.xml'),
        llms: read('public/llms.txt'),
        netlify: read('netlify.toml'),
        vercel: read('vercel.json')
    };
}

function validatePlayerHelpDoorway(input) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const help = input.helpHtml;

    requireValue(help.includes('<link rel="canonical" href="https://mythicalvoid.com/help/">'), 'Help page must have its canonical URL');
    requireValue(help.includes('Lost in the Void? Start here.'), 'Help page must lead with a plain-language doorway');
    requireValue(help.includes('Recover the field kit') && help.includes('Reach the creature egg'), 'Help page must explain the first playable objective');
    requireValue(help.includes('WASD') && help.includes('arrow keys') && help.includes('press Space'), 'Help page must provide verified keyboard controls');
    requireValue(help.includes('Touch screen') && help.includes('controls shown on the game screen'), 'Help page must explain touch controls without inventing buttons');
    requireValue(help.includes('do not clear browser data') && help.includes('private or incognito window'), 'Help page must protect local-only saves during recovery');
    requireValue(help.includes('Cloud Save is optional'), 'Help page must state the optional Cloud Save boundary');
    requireValue(help.includes('staffed Mythical Void help inbox is not open yet'), 'Help page must not imply staffed support exists');
    requireValue(help.includes('parent, guardian or another trusted adult'), 'Help page must give younger players a safe escalation path');
    requireValue(!/<form\b/i.test(help) && !/mailto:/i.test(help), 'Help page must not collect details or invent an email channel');
    requireValue(!/guarantee|24\/7|response time|support team/i.test(help), 'Help page must not make unsupported service promises');
    requireValue(help.includes('"@type": "FAQPage"'), 'Help page must expose its answers as structured FAQ content');
    requireValue(input.storefront.includes('href="/help/">Help</a>'), 'Main website footer must link to Help');
    requireValue(input.parentsHtml.includes('href="/help/">Help</a>'), 'Family guide footer must link to Help');
    requireValue(input.playableHtml.includes('href="/help/">Help</a>'), 'Playable doorway footer must link to Help');
    requireValue(input.sitemap.includes('<loc>https://mythicalvoid.com/help/</loc>'), 'Sitemap must include Help');
    requireValue(input.llms.includes('[Help playing Mythical Void](https://mythicalvoid.com/help/)'), 'Machine-readable guide must include Help');
    requireValue(input.netlify.includes('from = "/help/"') && input.netlify.includes('to = "/help/index.html"'), 'Netlify must route Help explicitly');
    requireValue(input.vercel.includes('"source": "/help/"') && input.vercel.includes('"destination": "/help/index.html"'), 'Vercel must route Help explicitly');

    return failures;
}

if (require.main === module) {
    const failures = validatePlayerHelpDoorway(loadCurrent());
    if (failures.length) {
        console.error(failures.map(message => `- ${message}`).join('\n'));
        process.exit(1);
    }
    console.log('Player Help doorway validation passed.');
}

module.exports = { loadCurrent, validatePlayerHelpDoorway };
