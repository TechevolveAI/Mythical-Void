const ENDPOINT = '/api/live-presence';
const HEARTBEAT_MS = 30_000;
const POLL_MS = 30_000;
const SESSION_STORAGE_KEY = 'mythical-live-presence-session';

function createSessionId() {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
    if (typeof cryptoApi?.getRandomValues !== 'function') {
        throw new Error('Secure random values are unavailable');
    }
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function getSessionId() {
    try {
        const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (existing) return existing;
        const created = createSessionId();
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
        return created;
    } catch (error) {
        return createSessionId();
    }
}

function presenceMessage(data) {
    if (data?.status === 'one') return 'Someone is playing now';
    if (data?.range) return `${data.range} playing now`;
    if (data?.status === 'quiet') return 'The Void is quiet — be the first to explore';
    return 'Early access is live';
}

async function requestPresence(options = {}) {
    const response = await fetch(ENDPOINT, {
        cache: 'no-store',
        credentials: 'same-origin',
        ...options
    });
    if (!response.ok) throw new Error('Presence unavailable');
    return response.json();
}

export function mountLivePresence(root = document) {
    const element = root.querySelector('[data-live-presence]');
    const copy = element?.querySelector('[data-live-presence-copy]');
    if (!element || !copy) return () => {};

    let timer = null;
    const refresh = async () => {
        try {
            const data = await requestPresence();
            copy.textContent = presenceMessage(data);
            element.dataset.state = data.status || 'unavailable';
        } catch (error) {
            copy.textContent = 'Early access is live';
            element.dataset.state = 'unavailable';
        }
    };
    const schedule = () => {
        window.clearInterval(timer);
        if (!document.hidden) {
            refresh();
            timer = window.setInterval(refresh, POLL_MS);
        }
    };
    const onVisibilityChange = () => schedule();

    schedule();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
        window.clearInterval(timer);
        document.removeEventListener('visibilitychange', onVisibilityChange);
    };
}

export function startGamePresence() {
    const sessionId = getSessionId();
    let timer = null;
    const heartbeat = async () => {
        if (document.hidden) return;
        try {
            await requestPresence({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
        } catch (error) {
            // Presence is optional and must never interrupt the game.
        }
    };
    const schedule = () => {
        window.clearInterval(timer);
        if (!document.hidden) {
            heartbeat();
            timer = window.setInterval(heartbeat, HEARTBEAT_MS);
        }
    };

    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => {
        window.clearInterval(timer);
        document.removeEventListener('visibilitychange', schedule);
    };
}

export const _internal = {
    createSessionId,
    presenceMessage
};
