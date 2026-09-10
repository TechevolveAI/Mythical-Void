export const CADEN_BIRTHDAY_EVENT = Object.freeze({
    id: 'caden-birthday-2026',
    date: '2026-09-11',
    timeZone: 'Europe/Dublin',
    previewParam: 'birthday',
    previewValue: 'caden'
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
