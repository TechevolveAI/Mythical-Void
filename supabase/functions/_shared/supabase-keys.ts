type SupabaseRuntimeKeys = {
    publishableKey: string | null;
    secretKey: string | null;
};

function readNamedKeyMap(variableName: string) {
    const raw = Deno.env.get(variableName);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        const values = Object.values(parsed).filter(
            value => typeof value === 'string' && value.length > 0
        ) as string[];
        const defaultValue = (parsed as Record<string, unknown>).default;
        return typeof defaultValue === 'string' && defaultValue.length > 0
            ? defaultValue
            : values[0] || null;
    } catch {
        return null;
    }
}

export function getSupabaseRuntimeKeys(): SupabaseRuntimeKeys {
    return {
        publishableKey: readNamedKeyMap('SUPABASE_PUBLISHABLE_KEYS') ||
            Deno.env.get('SUPABASE_ANON_KEY') || null,
        secretKey: readNamedKeyMap('SUPABASE_SECRET_KEYS') ||
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || null
    };
}
