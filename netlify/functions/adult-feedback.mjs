import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import feedbackCore from '../lib/adult-feedback-core.cjs';

const { handler, _internal } = feedbackCore;

_internal.setRuntime({
    createClient: (url, key, options = {}) => createClient(url, key, {
        ...options,
        realtime: { ...options.realtime, transport: WebSocket }
    })
});

export const config = {
    rateLimit: {
        windowLimit: 3,
        windowSize: 3600,
        aggregateBy: ['ip', 'domain']
    }
};

export { handler };
