import { Buffer } from 'node:buffer';
import nasaImageCore from '../lib/nasa-image-core.cjs';

const { handler } = nasaImageCore;

export const config = {
    rateLimit: {
        windowLimit: 30,
        windowSize: 60,
        aggregateBy: ['ip', 'domain']
    }
};

export default async function nasaImage(request) {
    const url = new URL(request.url);
    const result = await handler({
        httpMethod: request.method,
        queryStringParameters: Object.fromEntries(url.searchParams.entries())
    });
    const body = result.isBase64Encoded
        ? Buffer.from(result.body || '', 'base64')
        : result.body || '';
    return new Response(body, {
        status: result.statusCode || 500,
        headers: result.headers || {}
    });
}
