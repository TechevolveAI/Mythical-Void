const { classifyInboundContact } = require('./inbound-contact-triage.cjs');

const RESTRICTED_CATEGORIES = new Set([
    'safety_or_urgent',
    'privacy_or_data',
    'payment_or_legal',
    'young_person_message',
    'unsafe_instruction'
]);

function refuse(reasonCode, triage = null) {
    return {
        accepted: false,
        reasonCode,
        category: triage?.category || null,
        route: triage?.route || null,
        humanReviewRequired: true,
        draftCreated: false,
        replySendAuthorized: false,
        autonomousReplyPermitted: false,
        rawMessageRetained: false,
        externalActionAuthorized: false
    };
}

function createGroundedSupportDraft(input, knowledgeBase) {
    if (input?.synthetic !== true || input?.sanitized !== true) return refuse('live_or_unsanitized_message_not_permitted');
    const triage = classifyInboundContact({ message: input.message, senderRole: input.senderRole });
    if (!triage.accepted) return refuse(triage.reasonCode);
    if (RESTRICTED_CATEGORIES.has(triage.category)) return refuse('restricted_case_human_only', triage);
    if (triage.personalDataDetected) return refuse('personal_details_require_human_review', triage);
    if (typeof input.intent !== 'string' || !input.intent) return refuse('intent_missing', triage);

    const article = (knowledgeBase?.articles || []).find(item => item.intent === input.intent);
    if (!article || typeof article.candidateReply !== 'string' || !article.candidateReply.trim()) return refuse('approved_answer_not_found', triage);

    return {
        accepted: true,
        reasonCode: null,
        category: triage.category,
        route: triage.route,
        intent: input.intent,
        articleId: article.id,
        source: article.source,
        candidateReply: article.candidateReply,
        knowledgeBaseApprovedForLiveDrafts: knowledgeBase.approvedForSupportDrafts === true,
        rehearsalOnly: true,
        humanReviewRequired: true,
        draftCreated: true,
        replySendAuthorized: false,
        autonomousReplyPermitted: false,
        rawMessageRetained: false,
        externalActionAuthorized: false
    };
}

module.exports = { RESTRICTED_CATEGORIES, createGroundedSupportDraft };
