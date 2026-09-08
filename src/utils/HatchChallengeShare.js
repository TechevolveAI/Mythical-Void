export const HATCH_CHALLENGE_SHARE_DATA = Object.freeze({
    title: 'The Mythical Void Hatch Challenge',
    text: 'I just hatched an alien creature. Hatch yours from the same starting point, then compare what the creature engine made.',
    url: 'https://mythicalvoid.com/hatch-challenge/'
});

/**
 * Open the device's normal sharing choices, or copy one clean public link.
 * No player, creature, save, recipient, or tracking data is read or added.
 */
export async function shareHatchChallenge(
    navigatorValue = globalThis.navigator
) {
    try {
        if (typeof navigatorValue?.share === 'function') {
            await navigatorValue.share(HATCH_CHALLENGE_SHARE_DATA);
            return 'shared';
        }

        if (typeof navigatorValue?.clipboard?.writeText === 'function') {
            await navigatorValue.clipboard.writeText(
                HATCH_CHALLENGE_SHARE_DATA.url
            );
            return 'copied';
        }
    } catch (error) {
        if (error?.name === 'AbortError') return 'cancelled';
    }

    return 'shown';
}
