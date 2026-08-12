import observabilityCore from '../lib/observability-events-core.cjs';

const { handler } = observabilityCore;

export const config = {
    path: '/api/observability-events',
    rateLimit: {
        windowLimit: 20,
        windowSize: 60,
        aggregateBy: ['ip', 'domain']
    }
};

export { handler };
