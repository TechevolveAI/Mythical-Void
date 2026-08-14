# Browser game distribution plan

As of 14 August 2026, the best route is to make the owned website easier to find, prepare itch.io as the first outside game page, and use Imirt for Irish industry credibility. CrazyGames is a later test. Poki is a longer-term target that needs a much lighter build.

This plan does not authorize an account, submission, payment or contract. It prepares the work so Kevin only needs to step in where identity, money or public publication is involved.

## The order

### 1. Turn on evidence from Google Search Console

Mythical Void already has a live sitemap and useful pages for creature genetics, NASA space learning, parents and the studio story. Google Search Console is the simplest way to see whether Google has found them and whether there are errors.

Kevin's part is a Google sign-in and ownership check. After that, submit `https://mythicalvoid.com/sitemap.xml` and inspect the four discovery URLs. A sitemap helps discovery but does not guarantee indexing or rankings.

### 2. Prepare itch.io as the first outside game page

The generated game is inside itch.io's published size and file-count ceilings. The current website build is not yet a valid portable release: its asset links begin at the website root, some optional services call Mythical Void's Netlify functions, and the production site deliberately blocks other sites from placing it in a frame.

The right solution is a separate portable build, not weakening the production site's protection. That build should use relative paths, keep `index.html` at the ZIP root, and switch hosted extras to safe unavailable states. The core game, local save and essential controls need to work without the Mythical Void website around them.

The draft listing is in `itch-launch-pack-2026-08-14.json`. It uses actual gameplay captures and avoids promises the game cannot prove.

### 3. Join the Irish game-making community

Imirt is a practical way to build relationships and credibility in Ireland. Its current 1–3 person company tier is listed at EUR 100 per year. This is not a player-acquisition promise; it is a company-network decision. Kevin should decide whether that spend is worthwhile and confirm the correct legal company details before anyone applies.

### 4. Test CrazyGames only when the build is ready

CrazyGames supports Phaser and publishes a 250 MB total ceiling, but it also asks for a small initial download, platform integration, three cover formats and preview videos. More importantly, its published audience is 13+ and its FAQ warns that content targeted at children may be rejected.

Mythical Void can be honestly described as a general-audience space adventure that families can enjoy, but we should not disguise its family appeal. Submit only if a fresh audience and safeguarding review says the fit is truthful.

### 5. Treat Poki as an optimization target

Poki's guide recommends at most 5 MB initially and 8 MB in total. The current generated build is roughly 50 MB. A Poki attempt now would create busywork. Revisit it after video and audio streaming, optional downloads, or a deliberately smaller web edition make the gap realistic.

## The portable-build brief

The first version should:

- preserve the real creature genetics, hatching, exploration and local-save experience;
- use relative asset paths;
- work from a platform-owned subdirectory and inside a platform frame;
- keep any AI media feature off unless its privacy, moderation and hosting path are explicitly approved;
- never expose service keys or move trusted server work into browser code;
- show a friendly message when an online extra is unavailable;
- keep gameplay screenshots separate from generated key art;
- be tested with a clean browser profile, a return visit, keyboard, touch, muted audio and fullscreen.

The production website should keep `X-Frame-Options: DENY`. The portable ZIP is a separate release artifact.

## What Kevin will eventually need to do

1. Sign in to Search Console and verify the domain.
2. Approve an itch.io account and the final page after the portable build passes testing.
3. Decide whether to spend EUR 100 on Imirt membership.
4. Approve any later platform agreement or monetization choice.

Nothing else in this plan needs to pause while those decisions wait.

## Sources checked

- Google Search Console ownership and sitemap documentation
- itch.io HTML5, getting-started and quality guidance
- Imirt home and membership pages
- CrazyGames introduction, gameplay, technical, cover and FAQ pages
- Poki developer home and web-engine guidance

The exact source links and current decisions are recorded in `platform-opportunities-2026-08-14.json`. Recheck them immediately before submitting or paying because platform rules can change.
