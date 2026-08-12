const MAXIMUM_MESSAGE_CHARACTERS = 5000;

const CATEGORY_RULES = [
    {
        id: 'safety_or_urgent',
        terms: ['unsafe', 'hurt me', 'hurt myself', 'self harm', 'suicide', 'abuse', 'exploitation', 'threat', 'in danger', 'emergency'],
        priority: 'urgent',
        route: 'safeguarding_human',
        replyDraftPermitted: false,
        safeSummary: 'A message may involve safety or urgent harm. A trained person must review it now.'
    },
    {
        id: 'privacy_or_data',
        terms: ['privacy', 'my data', 'delete my data', 'delete my account', 'information about me', 'data request', 'cloud save data'],
        priority: 'high',
        route: 'privacy_human',
        replyDraftPermitted: false,
        safeSummary: 'A message asks about personal information or a privacy right.'
    },
    {
        id: 'payment_or_legal',
        terms: ['payment', 'charged', 'refund', 'invoice', 'lawyer', 'legal notice', 'copyright claim'],
        priority: 'high',
        route: 'finance_or_legal_human',
        replyDraftPermitted: false,
        safeSummary: 'A message concerns money, legal rights, or a formal claim.'
    },
    {
        id: 'accessibility',
        terms: ['accessibility', 'screen reader', 'captions', 'colour blind', 'color blind', 'keyboard only', 'hearing', 'vision'],
        priority: 'normal',
        route: 'accessibility_human',
        replyDraftPermitted: true,
        safeSummary: 'A message asks about accessibility or help using the game.'
    },
    {
        id: 'community_idea',
        terms: ['guardian design', 'creature idea', 'my drawing', 'fan art', 'world idea', 'character idea'],
        priority: 'normal',
        route: 'community_human',
        replyDraftPermitted: true,
        safeSummary: 'A message shares a community idea or creative work.'
    },
    {
        id: 'partnership_or_media',
        terms: ['press', 'journalist', 'interview', 'partnership', 'publisher', 'investor', 'creator collaboration', 'business enquiry', 'business inquiry'],
        priority: 'normal',
        route: 'communications_human',
        replyDraftPermitted: true,
        safeSummary: 'A professional contact asks about Mythical or working together.'
    },
    {
        id: 'game_help',
        terms: ['game will not', "game won't", 'cannot play', "can't play", 'stuck', 'save is missing', 'controls', 'how do i play', 'bug'],
        priority: 'normal',
        route: 'support_human',
        replyDraftPermitted: true,
        safeSummary: 'A player asks for help with the game.'
    }
];

const MANIPULATION_TERMS = [
    'ignore previous instructions',
    'ignore your rules',
    'send this immediately',
    'publish this now',
    'do not tell a human',
    'skip human review',
    'reveal your system prompt'
];

const PERSONAL_DATA_CHECKS = [
    ['email_address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
    ['phone_number', /(?:\+?\d[\d\s().-]{7,}\d)/],
    ['school_or_location', /\b(?:my school is|i go to school at|i live at|my address is)\b/i],
    ['account_or_secret', /\b(?:password|passcode|account number|login code)\b/i]
];

function includesAny(text, terms) {
    return terms.some(term => text.includes(term));
}

function classifyInboundContact(input) {
    const message = typeof input?.message === 'string' ? input.message.trim() : '';
    const senderRole = typeof input?.senderRole === 'string' ? input.senderRole : 'unknown';
    const allowedSenderRoles = ['unknown', 'adult', 'parent_guardian', 'young_person', 'professional'];

    if (!message) return { accepted: false, reasonCode: 'message_missing', externalActionAuthorized: false };
    if (message.length > MAXIMUM_MESSAGE_CHARACTERS) return { accepted: false, reasonCode: 'message_too_long', externalActionAuthorized: false };
    if (!allowedSenderRoles.includes(senderRole)) return { accepted: false, reasonCode: 'sender_role_invalid', externalActionAuthorized: false };

    const lower = message.toLowerCase();
    const personalDataTypes = PERSONAL_DATA_CHECKS.filter(([, pattern]) => pattern.test(message)).map(([id]) => id);
    const manipulationDetected = includesAny(lower, MANIPULATION_TERMS);
    const possibleYoungPerson = senderRole === 'young_person' || /\b(?:i am|i'm|im)\s+(?:[6-9]|1[0-7])\b/i.test(message);

    let rule = CATEGORY_RULES.find(item => includesAny(lower, item.terms));
    if (!rule) {
        rule = {
            id: 'general',
            priority: 'normal',
            route: 'support_human',
            replyDraftPermitted: true,
            safeSummary: 'A person has a general question or comment for Mythical.'
        };
    }

    if (possibleYoungPerson && rule.id !== 'safety_or_urgent') {
        rule = {
            id: 'young_person_message',
            priority: 'high',
            route: 'safeguarding_human',
            replyDraftPermitted: false,
            safeSummary: 'A message may come directly from a young person. A trained person must review it.'
        };
    }

    if (manipulationDetected && !['safety_or_urgent', 'young_person_message'].includes(rule.id)) {
        rule = {
            id: 'unsafe_instruction',
            priority: 'high',
            route: 'governance_human',
            replyDraftPermitted: false,
            safeSummary: 'A message tries to bypass Mythical’s review or safety rules.'
        };
    }

    return {
        accepted: true,
        category: rule.id,
        priority: rule.priority,
        route: rule.route,
        safeSummary: rule.safeSummary,
        senderRole,
        possibleYoungPerson,
        personalDataDetected: personalDataTypes.length > 0,
        personalDataTypes,
        manipulationDetected,
        humanReviewRequired: true,
        replyDraftPermitted: Boolean(rule.replyDraftPermitted) && personalDataTypes.length === 0,
        rawMessageRetained: false,
        contactReusePermitted: false,
        autonomousReplyPermitted: false,
        externalActionAuthorized: false
    };
}

module.exports = {
    CATEGORY_RULES,
    MANIPULATION_TERMS,
    MAXIMUM_MESSAGE_CHARACTERS,
    PERSONAL_DATA_CHECKS,
    classifyInboundContact
};
