export const CADEN_BIRTHDAY_EVENT = Object.freeze({
    id: 'caden-birthday-2026',
    date: '2026-09-11',
    timeZone: 'Europe/Dublin',
    previewParam: 'birthday',
    previewValue: 'caden',
    answerDigest: '1887884b8865c9620cd7e3f2bacfc8eb9b1a2443877f603baebef739f9f01ea1'
});

function getCalendarDate(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, part.value])
    );
    return `${values.year}-${values.month}-${values.day}`;
}

export function isCadenBirthdayCelebrationActive({
    date = new Date(),
    search = globalThis.location?.search || ''
} = {}) {
    const params = new URLSearchParams(search);
    if (
        params.get(CADEN_BIRTHDAY_EVENT.previewParam) ===
        CADEN_BIRTHDAY_EVENT.previewValue
    ) {
        return true;
    }
    return getCalendarDate(date, CADEN_BIRTHDAY_EVENT.timeZone) ===
        CADEN_BIRTHDAY_EVENT.date;
}

export async function isCadenBirthdayAnswer(
    value,
    cryptoApi = globalThis.crypto
) {
    const normalized = String(value ?? '').trim();
    if (!/^\d{1,4}$/.test(normalized) || !cryptoApi?.subtle) return false;
    const bytes = new TextEncoder().encode(
        `mythical-void:${CADEN_BIRTHDAY_EVENT.id}:${normalized}`
    );
    const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
    const encoded = Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    return encoded === CADEN_BIRTHDAY_EVENT.answerDigest;
}
