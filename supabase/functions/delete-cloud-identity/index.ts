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

async function removeAllMediaFiles(
    adminClient: ReturnType<typeof createClient>,
    userId: string,
    bucket: 'creature-portraits' | 'companion-videos'
) {
    const pageSize = 1000;
    const removalBatchSize = 100;

    while (true) {
        const { data: portraitFiles, error: listError } =
            await adminClient.storage
                .from(bucket)
                .list(userId, { limit: pageSize, offset: 0 });
        if (listError) throw listError;
        if (!portraitFiles?.length) return;

        const paths = portraitFiles.map(file => `${userId}/${file.name}`);
        for (let index = 0; index < paths.length; index += removalBatchSize) {
            const { error: storageError } = await adminClient.storage
                .from(bucket)
                .remove(paths.slice(index, index + removalBatchSize));
            if (storageError) throw storageError;
        }

        if (portraitFiles.length < pageSize) return;
    }
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

    try {
        await removeAllMediaFiles(adminClient, user.id, 'companion-videos');
        await removeAllMediaFiles(adminClient, user.id, 'creature-portraits');
    } catch (mediaError) {
        console.error(
            '[delete-cloud-identity] Living media deletion failed:',
            mediaError instanceof Error
                ? mediaError.message
                : String(mediaError)
        );
        return jsonResponse(500, {
            error: 'Cloud identity could not be deleted'
        });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
        console.error('[delete-cloud-identity] Delete failed:', deleteError.message);
        return jsonResponse(500, { error: 'Cloud identity could not be deleted' });
    }

    return jsonResponse(200, { deleted: true });
});
