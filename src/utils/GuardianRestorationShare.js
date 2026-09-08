export const GUARDIAN_RESTORATION_SHARE_DATA = Object.freeze({
    title: 'Mythical Void — the first Guardian is free',
    text: 'I helped free the first Guardian in Mythical Void. Hatch an alien creature and see how your journey begins.',
    url: 'https://mythicalvoid.com/hatch-challenge/'
});

/**
 * Open the device's normal sharing choices, or copy one clean public link.
 * No player, creature, save, recipient, or tracking data is read or added.
 */
export async function shareGuardianRestoration(
    navigatorValue = globalThis.navigator
) {
    try {
        if (typeof navigatorValue?.share === 'function') {
            await navigatorValue.share(GUARDIAN_RESTORATION_SHARE_DATA);
            return 'shared';
        }

        if (typeof navigatorValue?.clipboard?.writeText === 'function') {
            await navigatorValue.clipboard.writeText(
                GUARDIAN_RESTORATION_SHARE_DATA.url
            );
            return 'copied';
        }
    } catch (error) {
        if (error?.name === 'AbortError') return 'cancelled';
    }

    return 'shown';
}
