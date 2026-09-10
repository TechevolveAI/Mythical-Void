export const CAYDEN_BIRTHDAY_EVENT = Object.freeze({
    id: 'cayden-birthday-2026',
    date: '2026-09-11',
    timeZone: 'Europe/Dublin',
    previewParam: 'birthday',
    previewValue: 'cayden',
    answerDigest: '388eb2619930b5dfe5c95e0f0934ed8bbb7d6db91e80740606ab4fa6d88cab83'
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

export function isCaydenBirthdayCelebrationActive({
    date = new Date(),
    search = globalThis.location?.search || ''
} = {}) {
    const params = new URLSearchParams(search);
    if (
        params.get(CAYDEN_BIRTHDAY_EVENT.previewParam) ===
        CAYDEN_BIRTHDAY_EVENT.previewValue
    ) {
        return true;
    }
    return getCalendarDate(date, CAYDEN_BIRTHDAY_EVENT.timeZone) ===
        CAYDEN_BIRTHDAY_EVENT.date;
}

export async function isCaydenBirthdayAnswer(
    value,
    cryptoApi = globalThis.crypto
) {
    const normalized = String(value ?? '').trim();
    if (!/^\d{1,4}$/.test(normalized) || !cryptoApi?.subtle) return false;
    const bytes = new TextEncoder().encode(
        `mythical-void:${CAYDEN_BIRTHDAY_EVENT.id}:${normalized}`
    );
    const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
    const encoded = Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    return encoded === CAYDEN_BIRTHDAY_EVENT.answerDigest;
}
