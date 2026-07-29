# Cloud Saves

Mythical Void uses a local-first save model. `GameState` writes to browser
`localStorage` before any cloud operation, and the game remains playable when
Supabase is unavailable.

## Runtime Configuration

Set these values in `.env.local` for development and in the hosting provider for
production:

```text
VITE_SUPABASE_URL=https://mkcmdbzcihjgidjuypqe.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Production hosting must also include the configured Supabase origin in the
Content Security Policy `connect-src` directive. The repository's Vercel and
Netlify policies already allow the Mythical Void project origin.

Only use a Supabase publishable key in the browser. Never expose a secret or
legacy service-role key.

## Player Opt-In

Configuration makes cloud saving available but does not enable it. The in-game
Cloud Save settings explain what is stored and require explicit player consent
before calling:

```js
await window.CloudSave.enable({ consentConfirmed: true });
```

Players can return to local-only saving with:

```js
window.CloudSave.disable();
```

Deleting cloud data is a separate, explicit operation:

```js
await window.CloudSave.deleteCloudSave();
```

For anonymous players, deletion invokes the authenticated
`delete-cloud-identity` Edge Function. The function verifies the caller, uses
the server-side Supabase admin API to delete only that anonymous identity, and
relies on the `game_saves.user_id` cascade to remove its save row. The browser
then clears its local Supabase session. Local game progress is not deleted.

Under-13 profiles remain local-only in the current release. This restriction is
enforced by `CloudSaveManager`, not only by the settings UI. Any future parental
consent flow requires separate product and legal review before that restriction
is relaxed.

## Database Workflow

The schema and RLS policies live in `supabase/migrations`. Develop against the
local Supabase stack, verify migrations with `npx supabase db reset`, and preview
remote changes before applying them:

```bash
npx supabase link --project-ref mkcmdbzcihjgidjuypqe
npx supabase db push --dry-run
npx supabase db push
```

The `game_saves` table permits one or more named slots per authenticated player.
RLS restricts reads and writes to `auth.uid()`, and the database increments the
save revision on every write.

Before each upload, the client re-reads the remote row and compares its
`client_saved_at` timestamp with the pending local snapshot. A newer remote save
is restored instead of overwritten. Browsers that support the Web Locks API
also serialize the comparison and upload across Mythical Void tabs in the same
origin. Browsers without Web Locks still perform the freshness check, but cannot
guarantee cross-tab serialization.

If the browser still has its anonymous Supabase identity but its local game-save
record is missing, the remote save is restored regardless of the newly created
default state's timestamp. This prevents an empty first-run state from replacing
recoverable cloud progress.

## Privacy Boundary

Cloud snapshots exclude the active session, guardian PIN hash, guardian
verification timestamp, safety audit log, and memory-deletion log. Playtest
analytics must use a separate table and a separate consent decision; they must
not be added to `game_saves`.
