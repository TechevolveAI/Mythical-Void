import { createClient } from '@supabase/supabase-js';
import livePresenceCore from '../lib/live-presence-core.cjs';

const { handler, _internal } = livePresenceCore;

_internal.setRuntime({ createClient });

export const config = {
    rateLimit: {
        windowLimit: 90,
        windowSize: 60,
        aggregateBy: ['ip', 'domain']
    }
};

export { handler };
