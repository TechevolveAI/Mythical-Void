const allowedContexts = new Set(['adult_self_play', 'parent_observed_family_play']);
const allowedJourneys = new Set([
    'discover', 'understand', 'start', 'hatch', 'explore', 'combat', 'restore',
    'project_beacon', 'nasa_stem', 'return', 'share', 'seek_help'
]);
const allowedThemes = new Set([
    'positioning', 'trust', 'performance', 'accessibility', 'controls', 'story',
    'creature', 'progression', 'difficulty', 'safety', 'privacy', 'ai', 'support', 'stem'
]);
const allowedObservationKeys = new Set([
    'id', 'recordedAt', 'observedOn', 'context', 'journey', 'buildRef', 'worked',
    'confusing', 'nextCheck', 'themes', 'recordedBy', 'containsPersonalData',
    'containsDirectQuote', 'customerEvidence', 'publicationAuthorized'
]);
const personalDataPatterns = [
    { label: 'email address', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
    { label: 'phone number', regex: /(?:\+?\d[\d .()-]{7,}\d)/ },
    { label: 'web or social link', regex: /\b(?:https?:\/\/|www\.|@[a-z0-9_]{2,})/i },
    { label: 'exact age', regex: /\b(?:age[sd]?|aged)\s*[:=]?\s*\d{1,2}\b|\b\d{1,2}[ -]years?[ -]old\b/i },
    { label: 'birth date', regex: /\b(?:born|birth(?:day|date)|dob)\b/i },
    { label: 'school detail', regex: /\b(?:school|class teacher|teacher named)\b/i },
    { label: 'address or precise location', regex: /\b(?:home address|street address|postcode|eircode)\b/i },
    { label: 'account or username', regex: /\b(?:account id|user id|username|gamer tag|gamertag)\b/i },
    { label: 'child identity', regex: /\b(?:child(?:'s)? name|son(?:'s)? name|daughter(?:'s)? name|surname|last name)\b/i },
    { label: 'direct quote', regex: /["“”]|\b(?:he|she|they|child|player|son|daughter) said\b/i },
    { label: 'media reference', regex: /\b(?:photo|photograph|screenshot of (?:him|her|them|the child)|audio recording|video recording|voice recording)\b/i }
];

function isDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function nonEmpty(value, max = 320) {
    return typeof value === 'string' && value.trim().length >= 3 && value.trim().length <= max;
}

function scanText(value) {
    const scanValue = (value || '').replace(/\b\d{4}-\d{2}-\d{2}\b/g, '');
    return personalDataPatterns
        .filter(pattern => pattern.regex.test(scanValue))
        .map(pattern => pattern.label);
}

function validateRegister(register) {
    const failures = [];
    if (register?.schemaVersion !== 1) failures.push('schemaVersion must be 1');
    if (!isDate(register?.asOf)) failures.push('asOf must be a valid ISO date');
    if (!['internal_observation_route_ready_no_observations_recorded', 'internal_observations_recorded'].includes(register?.state)) {
        failures.push('state must describe the internal observation route');
    }
    for (const [field, expected] of Object.entries({
        customerEvidence: false,
        independentResearch: false,
        marketDemandEvidence: false,
        mayInformProductChecks: true,
        requiresSeparateHumanReviewBeforeCustomerEvidence: true
    })) if (register?.evidenceBoundary?.[field] !== expected) failures.push(`evidenceBoundary.${field} must be ${expected}`);
    for (const field of ['adultRecorderOnly']) if (register?.dataBoundary?.[field] !== true) failures.push(`dataBoundary.${field} must be true`);
    for (const field of ['personalDataPermitted', 'childIdentifiersPermitted', 'exactAgePermitted', 'directQuotesPermitted', 'audioVideoOrImagesPermitted', 'contactDetailsPermitted', 'creatureNamesPermitted']) {
        if (register?.dataBoundary?.[field] !== false) failures.push(`dataBoundary.${field} must remain false`);
    }
    for (const field of ['publicIntakeAuthorized', 'externalRecruitmentAuthorized', 'participantContactAuthorized', 'directMinorContactAuthorized', 'publicationAuthorized', 'marketingUseAuthorized', 'automatedProductDecisionAuthorized']) {
        if (register?.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);
    }
    if (JSON.stringify(register?.allowedContexts) !== JSON.stringify([...allowedContexts])) failures.push('allowedContexts must retain the approved values');
    if (JSON.stringify(register?.allowedJourneys) !== JSON.stringify([...allowedJourneys])) failures.push('allowedJourneys must retain the approved values');
    if (JSON.stringify(register?.allowedThemes) !== JSON.stringify([...allowedThemes])) failures.push('allowedThemes must retain the approved values');
    if (!Array.isArray(register?.observations)) failures.push('observations must be an array');

    const ids = new Set();
    for (const [index, observation] of (register?.observations || []).entries()) {
        const label = observation?.id || `observations[${index}]`;
        for (const key of Object.keys(observation || {})) if (!allowedObservationKeys.has(key)) failures.push(`${label} contains unsupported field ${key}`);
        if (!/^PO-\d{3,}$/.test(observation?.id || '')) failures.push(`${label} has an invalid ID`);
        if (ids.has(observation?.id)) failures.push(`duplicate ID ${observation.id}`);
        ids.add(observation?.id);
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(observation?.recordedAt || '')) failures.push(`${label} has invalid recordedAt`);
        if (!isDate(observation?.observedOn)) failures.push(`${label} has invalid observedOn`);
        if (!allowedContexts.has(observation?.context)) failures.push(`${label} has invalid context`);
        if (!allowedJourneys.has(observation?.journey)) failures.push(`${label} has invalid journey`);
        if (!nonEmpty(observation?.buildRef, 120)) failures.push(`${label} has invalid buildRef`);
        for (const field of ['worked', 'confusing', 'nextCheck']) if (!nonEmpty(observation?.[field])) failures.push(`${label}.${field} must be 3–320 characters`);
        if (!Array.isArray(observation?.themes) || observation.themes.length === 0 || new Set(observation.themes).size !== observation.themes.length || !observation.themes.every(theme => allowedThemes.has(theme))) failures.push(`${label} has invalid themes`);
        if (observation?.recordedBy !== 'Kevin Murphy') failures.push(`${label}.recordedBy must be Kevin Murphy for this founder route`);
        for (const [field, expected] of Object.entries({ containsPersonalData: false, containsDirectQuote: false, customerEvidence: false, publicationAuthorized: false })) {
            if (observation?.[field] !== expected) failures.push(`${label}.${field} must be ${expected}`);
        }
        const narrative = [observation?.buildRef, observation?.worked, observation?.confusing, observation?.nextCheck].join(' ');
        for (const hit of scanText(narrative)) failures.push(`${label} appears to contain ${hit}`);
    }
    if ((register?.observations || []).length === 0 && register?.state !== 'internal_observation_route_ready_no_observations_recorded') failures.push('empty register must retain the no-observations state');
    if ((register?.observations || []).length > 0 && register?.state !== 'internal_observations_recorded') failures.push('non-empty register must use internal_observations_recorded state');
    return failures;
}

module.exports = { allowedContexts, allowedJourneys, allowedThemes, isDate, nonEmpty, scanText, validateRegister };
