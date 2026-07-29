export const FIRST_EXPEDITION_DRILL_STATE_PATH =
    'story.projectBeacon.firstExpeditionDrill';

export const FIRST_EXPEDITION_DRILL_STEPS = Object.freeze([
    Object.freeze({
        id: 'footing',
        action: 'move',
        heading: 'KIHON 1/3 // FIND YOUR FOOTING',
        instruction: 'Guide {companion} forward. Stay together.',
        desktopControl: 'A / D  OR  LEFT / RIGHT',
        mobileControl: 'SLIDE THE MOVEMENT CONTROL'
    }),
    Object.freeze({
        id: 'root',
        action: 'jump',
        heading: 'KIHON 2/3 // CLEAR THE ROOT',
        instruction: 'Help {companion} clear the first root.',
        desktopControl: 'SPACE / W / UP',
        mobileControl: 'TAP THE GREEN JUMP CONTROL'
    }),
    Object.freeze({
        id: 'knot',
        action: 'melee',
        heading: 'KIHON 3/3 // RESTORE THE PATH',
        instruction: 'Clear the glowing corruption knot.',
        desktopControl: 'X // EARTH-FORGED FIELD KATANA',
        mobileControl: 'TAP THE RED MELEE CONTROL'
    })
]);

export function getFirstExpeditionCompanionName(value) {
    if (typeof value !== 'string') {
        return 'your companion';
    }

    const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 20);
    return normalized || 'your companion';
}

export function getFirstExpeditionDrillStep(
    stepIndex,
    { isMobile = false, companionName = null } = {}
) {
    const normalizedIndex = Math.max(
        0,
        Math.min(
            FIRST_EXPEDITION_DRILL_STEPS.length - 1,
            Number.isInteger(stepIndex) ? stepIndex : 0
        )
    );
    const step = FIRST_EXPEDITION_DRILL_STEPS[normalizedIndex];
    const displayName = getFirstExpeditionCompanionName(companionName);

    return {
        ...step,
        instruction: step.instruction.replace('{companion}', displayName),
        control: isMobile ? step.mobileControl : step.desktopControl
    };
}

export function advanceFirstExpeditionDrill(stepIndex, action) {
    const currentIndex = Number.isInteger(stepIndex) ? stepIndex : 0;
    const currentStep = FIRST_EXPEDITION_DRILL_STEPS[currentIndex];

    if (!currentStep || currentStep.action !== action) {
        return {
            advanced: false,
            completed: currentIndex >= FIRST_EXPEDITION_DRILL_STEPS.length,
            stepIndex: currentIndex
        };
    }

    const nextIndex = currentIndex + 1;
    return {
        advanced: true,
        completed: nextIndex >= FIRST_EXPEDITION_DRILL_STEPS.length,
        stepIndex: nextIndex
    };
}
