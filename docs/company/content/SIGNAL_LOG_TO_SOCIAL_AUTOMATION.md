# Signal Log to social drafts

**Status:** working internal automation; publishing stays closed  
**Started:** 14 August 2026

## What this does

The public Signal Log is the source. When a checked release is added there, the
builder prepares three matching drafts:

- a professional-network post;
- a text post for a future video channel community;
- a short source note that can later be tailored for one press or creator
  contact.

The drafts reuse the release title, summary, checked details, link and media
label. They do not guess player numbers, add tracking codes or turn generated
artwork into gameplay.

## What this does not do

It does not create an account, choose a recipient, publish, schedule, message,
reply, enable comments or spend money. Every draft stays blocked until the
channel is confirmed, Kevin sees the complete post, and adult reply coverage is
ready where comments could open.

## Routine

1. Put a meaningful change live and check its destination.
2. Add the checked note to `public/updates/releases.json`.
3. Rebuild and validate the public Signal Log.
4. Run `npm run build:signal-release-pack`.
5. Run `npm run validate:signal-release-pack` and
   `npm run test:signal-release-pack`.
6. Review one complete draft with its image, label, audience and link.
7. Record a separate approval before any outward action.

The generated pack is written to
`docs/company/content/generated/signal-log-release-pack.json`.
