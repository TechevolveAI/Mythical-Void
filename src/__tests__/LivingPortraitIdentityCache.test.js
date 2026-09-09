const fs = require('fs');
const path = require('path');

describe('living portrait identity cache migration', () => {
    const migration = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/20260811000100_cache_portrait_identities.sql'
        ),
        'utf8'
    );
    const quotaRecoveryMigration = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/20260811000300_release_failed_portrait_quota.sql'
        ),
        'utf8'
    );
    const currentPrivacyBoundary = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/20260908000100_creature_media_all_ages_privacy_boundary.sql'
        ),
        'utf8'
    );

    test('reuses active or completed identity jobs before checking quota', () => {
        const reuseIndex = migration.indexOf("status in ('starting', 'processing', 'succeeded')");
        const quotaIndex = migration.indexOf('if recent_count >= p_daily_limit');

        expect(reuseIndex).toBeGreaterThan(-1);
        expect(quotaIndex).toBeGreaterThan(reuseIndex);
        expect(migration).toContain("'reused', true");
        expect(migration).toContain("'counts_toward_daily_limit', false");
    });

    test('charges only the first identity reservation and exempts retries', () => {
        expect(migration).toContain('identity_previously_seen boolean');
        expect(migration).toContain('and counts_toward_daily_limit = true');
        expect(migration).toContain('not identity_previously_seen');
        expect(migration).toContain("'retry', identity_previously_seen");
        expect(migration).toContain('partition by user_id, identity_key');
        expect(migration).not.toContain(
            'partition by user_id, identity_key, style'
        );
        expect(migration).toContain(
            'on public.creature_portrait_jobs (user_id, identity_key)'
        );
    });

    test('supersedes the historical age gate with authenticated owner isolation', () => {
        expect(currentPrivacyBoundary).toContain('v_user_id uuid := auth.uid()');
        expect(currentPrivacyBoundary).toContain('to authenticated');
        expect(currentPrivacyBoundary).not.toContain('player_privacy_profiles');
        expect(currentPrivacyBoundary).not.toContain("'reason', 'age_restricted'");
        expect(currentPrivacyBoundary).not.toContain('p_user_id');
    });

    test('releases historical failed and canceled reservations', () => {
        expect(quotaRecoveryMigration).toContain(
            'set counts_toward_daily_limit = false'
        );
        expect(quotaRecoveryMigration).toContain(
            "status in ('failed', 'canceled')"
        );
    });
});
