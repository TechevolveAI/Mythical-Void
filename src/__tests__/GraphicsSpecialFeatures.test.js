const fs = require('fs');
const path = require('path');

describe('GraphicsEngine optional genetic features', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '../systems/GraphicsEngine.js'),
        'utf8'
    );

    test('defines every renderer dispatched by the special-feature switch', () => {
        const switchStart = source.indexOf('addSpecialFeatureEffect(');
        const switchEnd = source.indexOf('addEnhancedMarkings(', switchStart);
        const dispatcher = source.slice(switchStart, switchEnd);
        const calledRenderers = [
            ...dispatcher.matchAll(/this\.(add[A-Z][A-Za-z0-9]+)\(/g)
        ].map(match => match[1]);
        const missingRenderers = [...new Set(calledRenderers)].filter(method => {
            const definition = new RegExp(`\\n\\s{4}${method}\\(`);
            return !definition.test(source);
        });

        expect(missingRenderers).toEqual([]);
    });

    test('isolates an optional effect failure from the base creature render', () => {
        expect(source).toContain(
            'graphics:warn [GraphicsEngine] Optional feature'
        );
        expect(source).toContain('this.addAuroraWingTips(');
        expect(source).toContain('this.addPrismaticScales(');
    });
});
