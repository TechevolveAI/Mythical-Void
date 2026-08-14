import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import videoCore from '../lib/generate-companion-video-core.cjs';

const { handler, _internal } = videoCore;

_internal.setRuntime({
    createClient: (url, key, options = {}) => createClient(url, key, {
        ...options,
        realtime: {
            ...options.realtime,
            transport: WebSocket
        }
    }),
    // Preserve Netlify AI Gateway routing for Veo as well as Gemini images.
    createGeminiClient: () => new GoogleGenAI({})
});

export { handler };
