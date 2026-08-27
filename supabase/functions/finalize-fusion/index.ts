/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getSupabaseRuntimeKeys } from '../_shared/supabase-keys.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type JsonObject = Record<string, unknown>;

function jsonResponse(status: number, body: JsonObject) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
        }
    });
}

function normalizeName(value: unknown) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (
        trimmed.length < 1 ||
        trimmed.length > 20 ||
        !/^[\p{L}\p{N} '\-_]+$/u.test(trimmed)
    ) {
        return null;
    }
    return trimmed;
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization) {
        return jsonResponse(401, { error: 'Authentication required' });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const { publishableKey, secretKey } = getSupabaseRuntimeKeys();
    if (!supabaseUrl || !publishableKey || !secretKey) {
        return jsonResponse(500, { error: 'Fusion finalization is not configured' });
    }

    let body: JsonObject;
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'Invalid request body' });
    }
    const operationId = typeof body.operationId === 'string'
        ? body.operationId
        : '';
    if (!/^fusion_[A-Za-z0-9_-]{1,160}$/.test(operationId)) {
        return jsonResponse(400, { error: 'Invalid Fusion operation' });
    }
    if (!Array.isArray(body.names) || ![1, 2].includes(body.names.length)) {
        return jsonResponse(400, { error: 'Invalid Fusion names' });
    }
    const names = body.names.map(normalizeName);
    if (names.some(name => name === null)) {
        return jsonResponse(400, { error: 'Invalid Fusion names' });
    }

    const callerClient = createClient(supabaseUrl, publishableKey, {
        global: {
            headers: { Authorization: authorization }
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
    const userResult = await callerClient.auth.getUser();
    if (userResult.error || !userResult.data.user) {
        return jsonResponse(401, { error: 'Cloud identity could not be verified' });
    }

    const serviceClient = createClient(supabaseUrl, secretKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
    const finalized = await serviceClient.rpc(
        'finalize_fusion_operation',
        {
            p_user_id: userResult.data.user.id,
            p_operation_id: operationId,
            p_names: names
        }
    );
    if (finalized.error) {
        console.error('[finalize-fusion] Commit failed:', finalized.error.message);
        return jsonResponse(409, { error: 'Fusion lineage could not be committed' });
    }

    return jsonResponse(200, finalized.data);
});
