import spaceSignalCore from '../lib/space-signal-core.cjs';

const { handler } = spaceSignalCore;

export default async function spaceSignal(request) {
    const result = await handler({ httpMethod: request.method });
    return new Response(result.body || '', {
        status: result.statusCode || 500,
        headers: result.headers || {}
    });
}
