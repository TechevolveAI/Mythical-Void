# Could Mythical Void become a YouTube Playable?

**Checked:** 27 August 2026
**Decision:** high-upside route worth preparing; not ready to request or submit

## Why this is unusually interesting

YouTube Playables are games people can start directly inside YouTube on its
website and apps. They can appear on the Playables shelf, in search and in a
person's saved games. This is closer to the end of the funnel than an advert or
ordinary video because the person can move from discovery into play without
leaving YouTube.

Google's current developer guide explicitly lists Phaser among the frameworks
that have already been used for Playables. Developer access is still early
access and begins with an interest form; selection is not promised.

## The good news

The current portable Mythical Void package is a promising starting point:

- the reconstructed first download is about **3.8 MB**, comfortably below
  YouTube's 15 MB recommendation and 30 MB hard limit;
- the full package is about **43 MB compressed** and 47 MB raw, below the
  current 250 MB hard limit;
- its largest file is about **11 MB**, below the 30 MB hard limit;
- it has **85 files**, far below the limit of 8,000;
- it already uses relative file paths and Phaser's standard web rendering.

These are local measurements of the itch.io-shaped package. They do not prove
that a YouTube package would load within five seconds or pass certification.

## Why it is not ready

### The audience decision comes first

YouTube says Playables must not be specifically made for children and must be
suitable for a general audience aged 13 and over. Mythical Void currently
welcomes families and includes material for ages 9–14. We must not quietly
relabel the game to fit a platform.

A Playables edition is only honest if product, safeguarding and professional
review confirm that it can genuinely be offered as a general-audience 13+
edition while the owned Mythical Void experience continues to serve families.

### The current game talks to outside services

YouTube currently forbids outside calls. The portable build still contains
routes for live NASA information, Open Notify, Mythical's hosted AI features,
observability and other hosted functions. A YouTube edition would need to keep
the complete core adventure inside its package. Carefully selected NASA/STEM
material could remain bundled and credited, but live calls and hosted AI could
not be promised there.

### YouTube controls saving and the surrounding experience

The current game uses browser storage and offers optional sharing after a
hatch and at the ending. YouTube requires its own cloud-save, ready, pause,
resume and audio controls. It also forbids in-game sharing prompts, outside
links, separate user agreements and login-like screens.

The current package has no YouTube Playables connection, which is correct
before access and approval but means it is not a candidate build yet.

### The presentation still has to earn the click

The four authentic gameplay moments remain at 0 of 4 approved. YouTube also
forbids misleading thumbnails and does not allow branding or logos in
Playables thumbnails. We need a striking real game moment—not the logo and not
the imagined creature-universe illustration.

## The separate edition we would need

Game Development should eventually produce a `youtube-playables` edition that:

1. makes no outside calls and keeps the core story playable offline;
2. removes all in-game sharing, clipboard, external-link, login and separate
   agreement screens;
3. replaces browser saving with YouTube loading and saving;
4. obeys YouTube's ready, pause, resume and audio controls;
5. works with touch and mouse across very narrow, square and wide screens;
6. preserves a clear ending and all required rights and credits;
7. uses approved real gameplay for unbranded thumbnails;
8. is described honestly as general-audience 13+ only if that audience decision
   passes review.

Do not build the final YouTube connection or submit the interest form until an
official channel, its administrator, audience decision and exact approval
exist. The no-network build boundary can be designed and tested earlier.

## Recommendation

Add YouTube Playables as a high-upside route beside Poki, not as a replacement
for the owned family game. Prepare the no-network edition while the gameplay
and visuals improve. When the audience, rights, touch, first-minute and 4/4
visual gates pass, Kevin can decide whether to authorize one interest-form
submission.

Nothing in this assessment creates a YouTube channel, submits a form, uploads
a game, accepts terms, enables advertising or changes the game's age audience.

## Official sources

- https://developers.google.com/youtube/gaming/playables
- https://support.google.com/youtube/answer/14328604?hl=en
- https://developers.google.com/youtube/gaming/playables/certification/requirements_stability
- https://developers.google.com/youtube/gaming/playables/certification/requirements_design
- https://developers.google.com/youtube/gaming/playables/certification/requirements_privacydata
- https://developers.google.com/youtube/gaming/playables/certification/requirements_trustsafety
- https://developers.google.com/youtube/gaming/playables/certification/requirements_integration
- https://developers.google.com/youtube/gaming/playables/reference/sdk
