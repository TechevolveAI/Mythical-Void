import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import portraitCore from '../lib/generate-ai-art-core.cjs';

const { handler, _internal } = portraitCore;

_internal.setRuntime({
    createClient: (url, key, options = {}) => createClient(url, key, {
        ...options,
        realtime: {
            ...options.realtime,
            transport: WebSocket
        }
    }),
    createGeminiClient: () => new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    })
});

function createLambdaEvent(request) {
    const url = new URL(request.url);
    return {
        httpMethod: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        queryStringParameters: Object.fromEntries(url.searchParams.entries()),
        body: null
    };
}

export default async function generateAIArt(request) {
    const event = createLambdaEvent(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        event.body = await request.text();
    }

    const result = await handler(event);
    return new Response(result.body || '', {
        status: result.statusCode || 500,
        headers: result.headers || {}
    });
}
