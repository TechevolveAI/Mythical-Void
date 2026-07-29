const fs = require('fs');
const path = require('path');

const storefront = fs.readFileSync(
    path.join(__dirname, '../site/storefront.js'),
    'utf8'
);
const metadata = fs.readFileSync(
    path.join(__dirname, '../../index.html'),
    'utf8'
);
const styles = fs.readFileSync(
    path.join(__dirname, '../site/storefront.css'),
    'utf8'
);
const projectBeacon = require('../config/project-beacon.json');

describe('storefront Project Beacon story contract', () => {
    test('matches the implemented 2026 astronaut opening', () => {
        expect(projectBeacon.year).toBe(2026);
        expect(projectBeacon.openingPages[0].content).toContain(
            'One astronaut survived the crash.'
        );
        expect(storefront).toContain('PROJECT BEACON // 2026');
        expect(storefront).toContain(
            'You are the astronaut-pilot of The Wanderer-7'
        );
        expect(storefront).toContain('launched from a desperate Earth');
        expect(storefront).not.toContain('You were a scientist aboard');
    });

    test('centers first contact on intelligence, vulnerability, and trust', () => {
        expect(storefront).toContain(
            'the first alien life to trust a human'
        );
        expect(storefront).toContain(
            'It is intelligent, vulnerable'
        );
        expect(metadata).toContain(
            'Bond with a one-of-a-kind alien companion'
        );
    });

    test('describes boss encounters as restoration instead of conquest', () => {
        expect(storefront).toContain('Restore the guardians');
        expect(storefront).toContain(
            'Each guardian has been wounded or distorted by the Void.'
        );
        expect(storefront).toContain('restoration rather than destruction');
        expect(storefront).not.toContain('defeat their guardians');
        expect(storefront).not.toContain('Distinct realms to reclaim');
    });

    test('keeps the final responsibility unresolved', () => {
        expect(storefront).toContain(
            'decide what Project Beacon should tell Earth'
        );
        expect(storefront).toContain('decide what home means');
        expect(storefront).not.toContain('Earth is saved');
        expect(storefront).not.toContain('this world is saved');
    });

    test('keeps the hero immersive while revealing the next section', () => {
        expect(styles).toMatch(
            /\.hero\s*\{[\s\S]*?height:\s*min\(650px,\s*calc\(100svh - 144px\)\)/
        );
        expect(styles).toMatch(
            /\.hero-creature\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?right:\s*0;[\s\S]*?object-fit:\s*cover;/
        );
        expect(styles).not.toMatch(
            /\.hero\s*\{[^}]*grid-template-columns:/
        );
    });

    test('publishes absolute social media assets and route-aware canonical metadata', () => {
        expect(metadata).toContain(
            'content="https://www.mythicalvoid.com/marketing/nova.webp"'
        );
        expect(metadata).toContain(
            '<link rel="canonical" href="https://www.mythicalvoid.com/">'
        );
        expect(storefront).toContain('function updatePageMetadata');
        expect(storefront).toContain('link[rel="canonical"]');
        expect(storefront).toContain(
            "path: isPrivacy ? '/privacy/' : '/terms/'"
        );
    });
});
