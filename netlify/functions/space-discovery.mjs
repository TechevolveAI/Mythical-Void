import spaceDiscoveryCore from '../lib/space-discovery-core.cjs';

const { handler } = spaceDiscoveryCore;

export default async function spaceDiscovery(request) {
    const result = await handler({ httpMethod: request.method });
    return new Response(result.body || '', {
        status: result.statusCode || 500,
        headers: result.headers || {}
    });
}
