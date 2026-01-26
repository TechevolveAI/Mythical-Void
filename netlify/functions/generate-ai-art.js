/**
 * Netlify Function: AI Art Generator
 *
 * Transforms creature images into realistic/artistic versions using AI
 * Supports multiple backends: Replicate, OpenArt, Stability AI
 *
 * Request body:
 * {
 *   imageBase64: string,        // Base64 encoded creature image
 *   prompt: string,             // Generated prompt from creature traits
 *   style: string,              // Art style: 'realistic', 'fantasy', 'anime', 'oil_painting'
 *   creatureData: object        // Creature metadata for prompt enhancement
 * }
 */

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const OPENART_API_KEY = process.env.OPENART_API_KEY;

// Supported art styles with prompt modifiers
const STYLE_MODIFIERS = {
    realistic: 'photorealistic, highly detailed, 8k resolution, cinematic lighting, professional photography',
    fantasy: 'fantasy art style, magical atmosphere, ethereal glow, mystical creature, detailed illustration',
    anime: 'anime style, studio ghibli inspired, vibrant colors, expressive eyes, detailed character art',
    oil_painting: 'oil painting, classical art style, rich textures, museum quality, masterpiece',
    cosmic: 'cosmic art, space nebula background, bioluminescent, otherworldly creature, sci-fi fantasy'
};

// Build enhanced prompt from creature data
function buildCreaturePrompt(creatureData, style) {
    const {
        name = 'mythical creature',
        personality = 'curious',
        rarity = 'common',
        colors = {},
        bodyType = 'balanced',
        cosmicAffinity = 'star'
    } = creatureData || {};

    const primaryColor = colors.primary || 'purple';
    const secondaryColor = colors.secondary || 'blue';
    const accentColor = colors.accent || 'gold';

    // Base creature description
    let prompt = `A beautiful mythical creature called "${name}", `;

    // Add personality traits
    const personalityDescriptions = {
        curious: 'with intelligent, curious eyes and an inquisitive expression',
        playful: 'with a playful, mischievous expression and dynamic pose',
        gentle: 'with soft, gentle features and a serene, peaceful demeanor',
        wise: 'with ancient, wise eyes that seem to hold cosmic knowledge',
        energetic: 'with vibrant energy radiating from its form, in an active pose'
    };
    prompt += personalityDescriptions[personality] || personalityDescriptions.curious;

    // Add colors
    prompt += `. Its body features ${primaryColor} as the main color with ${secondaryColor} accents and ${accentColor} highlights. `;

    // Add rarity-based features
    const rarityFeatures = {
        common: 'A charming creature with subtle magical properties.',
        uncommon: 'An elegant creature with visible magical aura.',
        rare: 'A magnificent creature with glowing magical markings.',
        epic: 'A breathtaking creature with powerful magical energy swirling around it.',
        legendary: 'An awe-inspiring legendary creature with reality-bending presence and cosmic power.'
    };
    prompt += rarityFeatures[rarity] || rarityFeatures.common;

    // Add cosmic affinity
    const affinityDescriptions = {
        star: 'Connected to stellar energy, with star-like sparkles in its aura.',
        moon: 'Attuned to lunar power, with a soft silvery glow.',
        nebula: 'Infused with nebula essence, colors swirling like cosmic clouds.',
        crystal: 'Resonating with crystal energy, with prismatic light refractions.',
        void: 'Touched by void energy, with mysterious dark matter effects.'
    };
    prompt += ' ' + (affinityDescriptions[cosmicAffinity] || affinityDescriptions.star);

    // Add style modifiers
    prompt += ' ' + (STYLE_MODIFIERS[style] || STYLE_MODIFIERS.fantasy);

    return prompt;
}

// Generate image using Replicate API (img2img with SDXL)
async function generateWithReplicate(imageBase64, prompt) {
    if (!REPLICATE_API_TOKEN) {
        throw new Error('REPLICATE_API_TOKEN not configured');
    }

    // Use SDXL img2img model
    const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Token ${REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            // SDXL img2img model
            version: 'a00d0b7dcbb9c3fbb34ba87d2d5b46c56969c84a628bf778a7fdaec30b1b99c5',
            input: {
                image: `data:image/png;base64,${imageBase64}`,
                prompt: prompt,
                negative_prompt: 'ugly, blurry, low quality, distorted, deformed, disfigured, bad anatomy, watermark, text, logo',
                num_outputs: 1,
                guidance_scale: 7.5,
                prompt_strength: 0.8,  // How much to change from original (0.8 = significant transformation)
                num_inference_steps: 30
            }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Replicate API error: ${error}`);
    }

    const prediction = await response.json();

    // Poll for completion
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max wait

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const pollResponse = await fetch(result.urls.get, {
            headers: {
                'Authorization': `Token ${REPLICATE_API_TOKEN}`
            }
        });
        result = await pollResponse.json();
        attempts++;
    }

    if (result.status === 'failed') {
        throw new Error(`Image generation failed: ${result.error}`);
    }

    if (result.status !== 'succeeded') {
        throw new Error('Image generation timed out');
    }

    return result.output[0]; // Return the generated image URL
}

// Alternative: Generate with text-to-image (no input image needed)
async function generateTextToImage(prompt) {
    if (!REPLICATE_API_TOKEN) {
        throw new Error('REPLICATE_API_TOKEN not configured');
    }

    // Use SDXL for high quality text-to-image
    const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Token ${REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            // SDXL text-to-image model
            version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
            input: {
                prompt: prompt,
                negative_prompt: 'ugly, blurry, low quality, distorted, deformed, disfigured, bad anatomy, watermark, text, logo, human, person',
                width: 1024,
                height: 1024,
                num_outputs: 1,
                guidance_scale: 7.5,
                num_inference_steps: 30
            }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Replicate API error: ${error}`);
    }

    const prediction = await response.json();

    // Poll for completion
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 60;

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const pollResponse = await fetch(result.urls.get, {
            headers: {
                'Authorization': `Token ${REPLICATE_API_TOKEN}`
            }
        });
        result = await pollResponse.json();
        attempts++;
    }

    if (result.status === 'failed') {
        throw new Error(`Image generation failed: ${result.error}`);
    }

    if (result.status !== 'succeeded') {
        throw new Error('Image generation timed out');
    }

    return result.output[0];
}

// Main handler
exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { imageBase64, style = 'fantasy', creatureData, mode = 'text2img' } = body;

        // Build the prompt from creature data
        const prompt = buildCreaturePrompt(creatureData, style);

        console.log('[AI Art] Generating with prompt:', prompt.substring(0, 200) + '...');

        let imageUrl;

        if (mode === 'img2img' && imageBase64) {
            // Transform the creature image
            imageUrl = await generateWithReplicate(imageBase64, prompt);
        } else {
            // Generate from text description only
            imageUrl = await generateTextToImage(prompt);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                imageUrl,
                prompt: prompt
            })
        };

    } catch (error) {
        console.error('[AI Art] Error:', error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message || 'Failed to generate image'
            })
        };
    }
};
