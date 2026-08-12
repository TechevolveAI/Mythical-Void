# Privacy-Conscious Production Observability

Mythical Void records a deliberately small set of operational failure signals so
release-blocking problems can be diagnosed without building player profiles.
Local saves remain authoritative and observability failure never blocks gameplay.

## Captured events

The browser can report only these operational categories:

- uncaught runtime and promise failures;
- Phaser and scene lifecycle failures;
- local save/load failures;
- cloud-save error, conflict, and stalled-sync states;
- generic network request failures; and
- objective stuck flows: a scene taking over 15 seconds to create or no active
  scene for over 12 seconds while the visible game loop is running.

Each event contains only an event UUID, timestamps, allowlisted category/code,
severity, allowlisted scene key, lifecycle phase, recovery strategy, online/offline
state, coarse viewport class, whether recovery UI was shown, and Netlify deploy ID.

## Explicitly excluded data

The application and database schema contain no fields for:

- player, account, device, installation, or session identifiers;
- creature names, user-entered text, chat, prompts, or save-game content;
- email addresses, age, child identity, authentication tokens, or Supabase user IDs;
- stack traces, raw exception messages, source URLs, query strings, or referrers;
- IP addresses, GPS coordinates, or precise location; or
- exact screen dimensions or interaction coordinates.

The Netlify rate limiter groups requests by IP at the hosting edge, but the
application does not receive or persist that value. Normal Netlify infrastructure
request logs remain governed by the site's Netlify retention and access settings.

## Delivery and recovery

`ErrorHandler` sanitizes events before they leave memory. At most 20 sanitized
events are retained in `localStorage` while offline or during a collector outage.
Events are delivered in batches of 10 to the same-origin
`/api/observability-events` endpoint and removed locally only after a successful
response. Duplicate event shapes are suppressed for 30 seconds.

The queue contains no raw errors. Delivery failures are not recursively reported.
Save and cloud-sync failures retain the existing local-save fallback and retry
behavior. Critical browser errors are no longer hidden with `preventDefault()`,
and generic fetch failures are no longer blanket-suppressed.

## Server controls

The Netlify collector:

- accepts only same-origin `POST` requests;
- rate-limits to 20 requests per minute per IP/domain at Netlify's edge;
- limits bodies to 6 KB and batches to 10 events;
- rejects unknown fields, stale timestamps, arbitrary scene names, and free text;
- uses the Supabase service-role key only on the server; and
- never logs request bodies or storage error messages.

The `game_observability_events` table has RLS enabled with no browser policies.
`anon` and `authenticated` roles have no privileges. A statement trigger removes
events older than 30 days whenever a new batch is inserted.

## Deployment

1. Apply `supabase/migrations/20260811000200_create_privacy_observability.sql`.
2. Confirm Netlify has `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` set.
3. Deploy the site so `observability-events.mjs` and its rate-limit configuration
   are published.
4. Trigger a controlled local or deploy-preview error and verify a sanitized row.
5. Confirm direct reads with the public Supabase key are denied.

No additional browser key or consent setting is required because events are not
linked to a player and contain no content. This mechanism must not be expanded
with identifiers or free-text fields without a new privacy review.

## Operations

Use aggregated queries in the protected Supabase SQL editor. Do not export row
data unless necessary for a live incident.

```sql
select
    code,
    scene,
    deployment_id,
    count(*) as failures,
    max(received_at) as latest
from public.game_observability_events
where received_at >= now() - interval '24 hours'
group by code, scene, deployment_id
order by failures desc;
```

Suggested release alerts:

- any `game_boot_failed` or `scene_no_active` event;
- three or more `scene_loading_timeout` events for one deployment;
- a material increase in local save/load failures; and
- repeated `cloud_sync_failed` or `cloud_sync_stalled` events after a backend change.

## Verification

```bash
npx jest src/__tests__/ErrorHandlerObservability.test.js \
  src/__tests__/ObservabilityFunction.test.js --runInBand
npm run build
```
