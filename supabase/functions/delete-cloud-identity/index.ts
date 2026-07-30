import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(status: number, body: Record<string, unknown>) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
        }
    });
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
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
        return jsonResponse(500, { error: 'Cloud deletion is not configured' });
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
    const {
        data: { user },
        error: userError
    } = await callerClient.auth.getUser();

    if (userError || !user) {
        return jsonResponse(401, { error: 'Cloud identity could not be verified' });
    }
    if (!user.is_anonymous) {
        return jsonResponse(403, { error: 'Only anonymous cloud identities can self-delete' });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });

    const { data: portraitFiles, error: listError } = await adminClient.storage
        .from('creature-portraits')
        .list(user.id, { limit: 1000 });
    if (listError) {
        console.error('[delete-cloud-identity] Portrait listing failed:', listError.message);
        return jsonResponse(500, { error: 'Cloud identity could not be deleted' });
    }
    if (portraitFiles?.length) {
        const paths = portraitFiles.map(file => `${user.id}/${file.name}`);
        const { error: storageError } = await adminClient.storage
            .from('creature-portraits')
            .remove(paths);
        if (storageError) {
            console.error('[delete-cloud-identity] Portrait deletion failed:', storageError.message);
            return jsonResponse(500, { error: 'Cloud identity could not be deleted' });
        }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
        console.error('[delete-cloud-identity] Delete failed:', deleteError.message);
        return jsonResponse(500, { error: 'Cloud identity could not be deleted' });
    }

    return jsonResponse(200, { deleted: true });
});
