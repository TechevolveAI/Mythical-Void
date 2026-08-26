const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../..');
const registerPath = path.join(repositoryRoot, 'public/press/visual-publication-register.json');

function normalizePublicPath(value) {
    if (!value) return '';
    try {
        const parsed = new URL(value, 'https://mythicalvoid.com/');
        return parsed.pathname;
    } catch {
        return String(value).split(/[?#]/, 1)[0];
    }
}

function readVisualPublicationRegister(customPath = registerPath) {
    return JSON.parse(fs.readFileSync(customPath, 'utf8'));
}

function isWithdrawnPublicVisual(value, register = readVisualPublicationRegister()) {
    const pathname = normalizePublicPath(value);
    return register.withdrawnPathFamilies.some(prefix => pathname.startsWith(prefix))
        || register.withdrawnIndividualPaths.includes(pathname);
}

module.exports = {
    isWithdrawnPublicVisual,
    normalizePublicPath,
    readVisualPublicationRegister,
    registerPath
};
