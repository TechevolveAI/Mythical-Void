# Itch target acceptance handoff

The portable Mythical Void build and game-page materials are ready for a private platform test. They are not approved for public release yet.

## What is already proved

- `npm run build:portable` creates the game as a separate platform release.
- `npm run package:itch` rebuilds, validates and creates the private-test ZIP plus its checksum record under `release-artifacts/`.
- `index.html` sits at the release root and game files work below a platform-owned path.
- The game starts inside an iframe.
- The local save loads again after the page reloads.
- Keyboard interaction unlocks audio and the theme music starts.
- The 390x844 phone layout fits without horizontal overflow.
- Cloud saves, optional online AI media, public analytics and website-only health reporting are off.
- The build has stayed within itch.io's published size and file-count ceilings.
- Five real gameplay screenshots, one real gameplay video and a 630x500 key-art cover are prepared.

## What Kevin does when ready

1. Create or sign in to the official Mythical Void itch.io account using an adult-owned studio address.
2. Create a private or draft game page. Do not publish it yet.
3. Run `npm run package:itch`, then upload `release-artifacts/mythical-void-itch-private-test.zip`. Its root contains `index.html`.
4. Set the project to run in the browser and enable the platform's mobile-friendly/fullscreen option if it is still available.
5. Use `public/marketing/mythical-void-itch-cover-v1.png` as the cover.
6. Add the five files listed under `media.screenshots` in `itch-launch-pack-2026-08-14.json` as screenshots, in that order.
7. Copy the reviewed listing text from that file. Keep the cover labelled as AI-generated key art and the screenshots labelled as real gameplay.
8. Leave payments and donations off for the first test.

## Private-page acceptance test

Run this before the page is made public:

- Start with a private browser window or clean browser profile.
- Confirm the Project Beacon opening appears without a broken asset.
- Start the story using keyboard and pointer input.
- Confirm music can start after interaction and can be muted.
- Make one piece of progress, reload, and confirm it returns.
- Test the actual page on one phone or tablet with real touch input.
- Confirm the on-screen controls do not cover the main action.
- Enter and leave fullscreen twice.
- Confirm no sign-in, payment or download is demanded before play.
- Confirm optional AI media and cloud-save choices do not appear in this build.
- Confirm the page does not describe artwork as gameplay or imply NASA endorsement.
- Record the test date, device/browser and result in `itch-release-approval-DRAFT.json`.

## Publication gate

Only Kevin can turn `publicationAuthorized` to `true`. Before that happens:

- every private-page acceptance check must pass;
- the current itch.io rules and terms must be read again;
- the final title, description, tags, screenshots and cover must be visually reviewed;
- any new data flow, platform SDK, advertising or payment feature requires a fresh privacy and safeguarding review.

If one test fails, the page stays private and the failure becomes a normal game-development task. It is not worked around with a misleading listing.
