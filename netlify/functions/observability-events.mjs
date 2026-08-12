import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import observabilityCore from '../lib/observability-events-core.cjs';

const { handler, _internal } = observabilityCore;

_internal.setRuntime({
    createClient: (url, key, options = {}) => createClient(url, key, {
        ...options,
        realtime: {
            ...options.realtime,
            transport: WebSocket
        }
    })
});

export const config = {
    path: '/api/observability-events',
    rateLimit: {
        windowLimit: 20,
        windowSize: 60,
        aggregateBy: ['ip', 'domain']
    }
};

export { handler };
