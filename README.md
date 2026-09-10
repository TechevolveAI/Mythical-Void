# Mythical Void

**A free browser adventure where you hatch a strange alien creature, cross six
living realms and decide what your mission should tell Earth.**

[Play Mythical Void](https://mythicalvoid.com/play/) ·
[See what you do in the game](https://mythicalvoid.com/playable-now/) ·
[Latest game updates](https://mythicalvoid.com/updates/) ·
[Family guide](https://mythicalvoid.com/parents/) ·
[Player help](https://mythicalvoid.com/help/) ·
[Press and creator facts](https://mythicalvoid.com/press/)

No download, account, payment details, game adverts or public chat are needed.
The current game is a single-player early-access release for modern desktop and
mobile browsers. A keyboard is recommended for the platforming parts.

## Why enter the Void?

- Hatch and name an alien creature shaped by a procedural genetics system.
- Recover the Wanderer-77 expedition and follow Project Beacon across six realms.
- Run, jump, explore and fight the corruption holding each realm's Guardian.
- Restore living places, collect what survived and build a shared sanctuary.
- Make a final choice about what Project Beacon should become and tell Earth.

The six current realms are Mythical Forest, Crystal Caves, Stellar Reef, Void
Peaks, Aurora Depths and the Final Void. The game is playable now and still being
improved.

## Your first few minutes

1. Explore the Wanderer-77 crash site and follow the lights.
2. Recover the field kit and read the message.
3. Reach the egg, begin the hatch and name the creature that emerges.
4. Enter the Sanctuary, then choose where the expedition goes next.

Keyboard players can move with WASD or the arrow keys and use Space to interact
or jump. Touch controls appear on phones and tablets. The
[plain-language help page](https://mythicalvoid.com/help/) explains saving,
controls and safe fixes for common browser problems.

## A universe of creatures

Creature forms can vary through body plan, colour, nature, cosmic affinity and
rare changes. The system creates a wide range of possibilities; it does not
promise that every creature is globally unique.

The pixel creature shown inside the Phaser game is the trusted gameplay form.
Some optional pictures creatively interpret the same saved traits, and wider
universe artwork imagines what those forms might become. Those images are
clearly labelled. Generated universe artwork is never presented as gameplay.

[Explore the creature genetics](https://mythicalvoid.com/creature-genetics/) ·
[See the six-realm field guide](https://mythicalvoid.com/creature-field-guide/)

## Real space and STEM discovery

Optional learning moments can use selected public NASA space pictures and space
data to connect the fictional journey with the real universe. The free
[STEM Creature Lab](https://mythicalvoid.com/nasa-space-science/) helps families
and groups turn observation into creature ideas. NASA does not make or endorse
the game.

## The studio story

Mythical Void began in Ireland as a father-and-son experiment: Kevin and his
son exploring what imagination and generative AI tools could make possible.
Their conversations became strange creatures, living worlds and playable
moments.

AI helps this small independent studio explore, build and test. People remain
responsible for the story, safety boundaries, public claims and important
choices. The aim is an AI-first studio with human judgement and clear governance
at its heart—not a studio that pretends software can replace responsibility.

[Read the father-and-son story](https://mythicalvoid.com/studio/)

## Follow what changes

The [Latest News](https://mythicalvoid.com/updates/) records things that are
already live, with permanent pages that can be shared without tracking code.
You can also follow the [RSS feed](https://mythicalvoid.com/updates/feed.xml) or
[JSON feed](https://mythicalvoid.com/updates/feed.json) without creating an
account. The verified
[early-access release](https://github.com/TechevolveAI/Mythical-Void/releases/tag/early-access-2026-08-31)
leads to the same live browser game and does not attach a second build.

## Facts, artwork and coverage

The [official press and creator room](https://mythicalvoid.com/press/) contains
the current fact sheet, transparent emblem and clear media-use boundaries.
Earlier gameplay screenshots and videos were withdrawn because being a real
capture was not enough: the moment also needs to be clear, attractive and
approved by a person at normal desktop and phone size.

Please do not describe generated marketing artwork as gameplay, imply a NASA
partnership, promise global creature uniqueness or claim popularity that has not
been proven.

## Development

The public website is served at `/` and the Phaser game starts at `/play/`.

```bash
npm install
npm run dev
npm test -- --runInBand
npm run build
```

The Vite development server prints its local address. Open the root URL for the
website or add `/play/` to launch the game.

### Configuration

Environment values exposed to the browser must use the `VITE_` prefix. Create an `.env.local` (ignored by git) and add entries such as `VITE_ENABLE_API_FEATURES=true` to toggle optional integrations.

Optional cloud saves use the dedicated Supabase project configured by
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Cloud saving remains
disabled until the player explicitly opts in; local browser saves continue to
work without Supabase. See [docs/cloud-saves.md](docs/cloud-saves.md).

Useful project guides:

- [Development guide](DEVELOPMENT_GUIDE.md)
- [Game flow](GAME_FLOW_DOCUMENTATION.md)
- [Deployment](DEPLOYMENT.md)
- [Security](SECURITY.md)
- [Technical implementation](TECHNICAL_IMPLEMENTATION.md)
- [Tuning guide](TUNING_GUIDE.md)
- [Local server reference](LOCAL_SERVER_REFERENCE.md)

Plans under `archive/` describe historical or future ideas and may not match the
current game. The live website, current source and dated Latest News are the
better references for what exists now.

## Player privacy and safety

- Progress is stored in the current browser by default.
- Optional Cloud Save requires a separate choice inside the game.
- The public website asks before using limited website analytics; the game itself
  is excluded from that Google tag.
- Mythical Void does not provide public player profiles or chat with other
  players.
- The family guide explains fantasy battles, saving, AI-created imagery and the
  current early-access boundaries in plain language.

[Read the family guide](https://mythicalvoid.com/parents/) ·
[Privacy and safety](https://mythicalvoid.com/privacy/) ·
[Terms of use](https://mythicalvoid.com/terms/)
