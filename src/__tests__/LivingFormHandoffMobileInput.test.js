const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadLivingFormHandoff() {
    const filePath = path.join(
        __dirname,
        '../ui/LivingFormHandoff.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            /import \{[\s\S]*?\} from '\.\.\/systems\/CompanionIdentityArchive\.js';/,
            'const AUTHORED_COMPANION_STUDIES = {};'
        )
        .replace(
            'export function getAuthoredCompanionStudy',
            'function getAuthoredCompanionStudy'
        )
        .replace(
            'export function prefetchAuthoredCompanionStudy',
            'function prefetchAuthoredCompanionStudy'
        )
        .replace(
            'export default class LivingFormHandoff',
            'class LivingFormHandoff'
        )
        .concat('\nmodule.exports = LivingFormHandoff;');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        document,
        window,
        requestAnimationFrame: callback => {
            callback();
            return 1;
        }
    };
    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createScene() {
    return {
        scale: { width: 390, height: 720 },
        add: {
            dom(_x, _y, root) {
                document.body.append(root);
                const domElement = {
                    setOrigin() {
                        return this;
                    },
                    setScrollFactor() {
                        return this;
                    },
                    setDepth() {
                        return this;
                    },
                    destroy: jest.fn(() => root.remove())
                };
                return domElement;
            }
        }
    };
}

describe('LivingFormHandoff mobile continuation', () => {
    const LivingFormHandoff = loadLivingFormHandoff();

    afterEach(() => {
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    test('tracks the visual viewport while the mobile keyboard opens and closes', () => {
        let resizeListener;
        const originalVisualViewport = window.visualViewport;
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: {
                width: 390,
                height: 500,
                addEventListener: jest.fn((eventName, listener) => {
                    if (eventName === 'resize') resizeListener = listener;
                }),
                removeEventListener: jest.fn()
            }
        });
        const handoff = new LivingFormHandoff(createScene());
        handoff.show({ name: 'Nova', species: 'nebulaSprite' });
        const root = document.querySelector('[data-testid="living-form-handoff"]');
        expect(root.style.height).toBe('500px');

        window.visualViewport.height = 720;
        resizeListener();
        expect(root.style.height).toBe('720px');

        handoff.destroy();
        expect(window.visualViewport.removeEventListener).toHaveBeenCalled();
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: originalVisualViewport
        });
    });

    test('a mobile pointer release enters the Sanctuary exactly once', () => {
        const onContinue = jest.fn();
        const handoff = new LivingFormHandoff(createScene());
        expect(handoff.show({
            name: 'Nova',
            species: 'nebulaSprite',
            onContinue
        })).toBe(true);
        const button = document.querySelector(
            '[data-testid="living-form-continue"]'
        );

        button.dispatchEvent(new Event('pointerup', {
            bubbles: true,
            cancelable: true
        }));
        button.dispatchEvent(new Event('click', {
            bubbles: true,
            cancelable: true
        }));

        expect(onContinue).toHaveBeenCalledTimes(1);
        expect(handoff.isVisible).toBe(false);
        expect(document.querySelector(
            '[data-testid="living-form-handoff"]'
        )).toBeNull();
    });

    test.each(['touchend', 'click'])(
        '%s remains a guarded continuation fallback',
        eventName => {
            const onContinue = jest.fn();
            const handoff = new LivingFormHandoff(createScene());
            handoff.show({
                name: 'Nova',
                species: 'nebulaSprite',
                onContinue
            });
            const button = document.querySelector(
                '[data-testid="living-form-continue"]'
            );

            button.dispatchEvent(new Event(eventName, {
                bubbles: true,
                cancelable: true
            }));

            expect(onContinue).toHaveBeenCalledTimes(1);
            expect(handoff.isVisible).toBe(false);
        }
    );

    test('the reveal scene explicitly enables DOM input before showing the handoff', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/SoulRevealScene.js'),
            'utf8'
        );
        expect(source.indexOf(
            'this.prepareDomContainerForHandoff();'
        )).toBeLessThan(source.indexOf(
            'this.livingFormHandoff.show({'
        ));
        expect(source).toContain(
            "this.game.domContainer.style.pointerEvents = 'auto';"
        );
        expect(source).toContain(
            'this.restoreDomContainerStyles();'
        );
        expect(source).toContain(
            "this.previousDomContainerStyles.pointerEvents || 'none'"
        );
        expect(source).not.toContain(
            "this.previousDomContainerStyles.pointerEvents || 'auto'"
        );
    });

    test('a slow portrait never blocks entry and names its later destination', () => {
        jest.useFakeTimers();
        const handoff = new LivingFormHandoff(createScene());
        handoff.show({
            name: 'Nova',
            species: 'nebulaSprite',
            portraitPromise: new Promise(() => {}),
            referenceImage: 'data:image/png;base64,iVBORw0KGgo='
        });

        expect(document.querySelector('.living-form-loading-detail').textContent)
            .toContain("Nova's");

        jest.advanceTimersByTime(7500);

        expect(document.querySelector('.living-form-status').textContent)
            .toContain('open there when it arrives');
        expect(document.querySelector('.living-form-spinner')).not.toBeNull();
        expect(document.querySelector('.living-form-progress')).not.toBeNull();
        expect(document.querySelector('.living-form-loading-detail').textContent)
            .toContain('continue without losing the reveal');
        expect(document.querySelector('[data-testid="living-form-continue"]')?.textContent)
            .toBe('ENTER SANCTUARY NOW');
        expect(document.querySelector('.living-form-continue-note')?.textContent)
            .toContain('open over the Sanctuary');
        expect(document.querySelector('[data-testid="living-form-actions"]'))
            .not.toBeNull();
        expect(document.querySelector('.living-form-action-kicker')?.textContent)
            .toContain('CONTINUE NOW');
        expect(document.querySelector('[data-testid="living-form-handoff"]')?.dataset.portraitState)
            .toBe('developing');
        expect(document.querySelector('[data-testid="living-form-continue"]')?.disabled)
            .toBe(false);
        handoff.destroy();
        jest.useRealTimers();
    });

    test('a protected portrait visibly replaces the pixel reference', async () => {
        const imageUrl =
            'https://mkcmdbzcihjgidjuypqe.supabase.co/storage/v1/object/sign/creature-portraits/portrait.jpg';
        const onPortraitShown = jest.fn();
        const handoff = new LivingFormHandoff(createScene());
        handoff.show({
            name: 'Nova',
            species: 'nebulaSprite',
            portraitPromise: Promise.resolve({
                identityKey: 'nova:baby:portrait',
                stage: 'baby',
                imageUrl,
                assetRef: 'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074'
            }),
            onPortraitShown,
            referenceImage: 'data:image/png;base64,iVBORw0KGgo='
        });

        await new Promise(resolve => setTimeout(resolve, 0));
        handoff.image.onload();

        expect(handoff.image.src).toBe(imageUrl);
        expect(handoff.image.classList.contains('is-generated-portrait')).toBe(true);
        expect(handoff.image.classList.contains('is-ready')).toBe(true);
        expect(document.querySelector('.living-form-source').textContent)
            .toBe('PROTECTED LIVING PORTRAIT');
        expect(document.querySelector('.living-form-media-fallback')
            .classList.contains('is-hidden')).toBe(true);
        expect(document.querySelector('[data-testid="living-form-handoff"]')?.dataset.portraitState)
            .toBe('ready');
        expect(document.querySelector('[data-testid="living-form-continue"]')?.textContent)
            .toBe('ENTER SANCTUARY');
        expect(document.querySelector('.living-form-continue-note')).toBeNull();
        expect(onPortraitShown).toHaveBeenCalledTimes(1);
        expect(onPortraitShown).toHaveBeenCalledWith(expect.objectContaining({
            identityKey: 'nova:baby:portrait'
        }));
        handoff.image.onload();
        expect(onPortraitShown).toHaveBeenCalledTimes(1);
        handoff.destroy();
    });
});
