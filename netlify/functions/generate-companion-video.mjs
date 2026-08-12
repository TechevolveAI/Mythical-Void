import { GoogleGenAI } from '@google/genai';
import videoCore from '../lib/generate-companion-video-core.cjs';

const { handler, _internal } = videoCore;

_internal.setRuntime({
    createGeminiClient: () => new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    })
});

export { handler };
