# The “what do I feel like playing?” doorway

Status: approved for the owned website; production proof still required  
Route: https://mythicalvoid.com/playable-now/

## Why this exists

People rarely choose a game because of a list of technology. They choose it
because they want a feeling: wonder, creativity, challenge or a story that
matters.

The Playable Now page now lets a visitor choose one of four honest ways into
Mythical Void:

- **Show me something strange** — the six living realms and alien discovery.
- **Let me make something** — the creature engine and the hatch.
- **Give me a mission** — movement, investigation and restoring the guardians.
- **Make my choices matter** — Project Beacon and the final message to Earth.

Each choice gives one short explanation and one clean Play button. It is not a
personality quiz and it does not pretend to know the visitor.

Each answer also has a clean “Share this way in” link. A wonder link reopens
the wonder answer; creation, challenge and story do the same. The choice lives
only in the address after `#` so the receiving page can reopen it. It is not
sent to the server, remembered as a profile or added to analytics. This lets an
adult say “this is the part you might like” without making Mythical guess who
the recipient is.

## What we can learn

The initial choice click is not sent anywhere. If optional website analytics
have been allowed and the visitor then presses Play, the existing
`play_selected` event records which of the four Play buttons was used. Google
Analytics stores that small event, but Mythical does not remember the choice in
the browser or build an individual profile from it. The game remains outside
website analytics.

This can answer one useful question: which truthful promise most often leads to
a Play selection? It cannot tell us who selected it, why someone left, whether
they are a child, or whether they enjoyed the game.

Do not change the main message from a tiny result. Wait for at least 50
consented page views and 10 Play selections from this section. Treat the result
as a direction to test again, not as a fact about the market.

## Safety and quality boundaries

- No name, email, age, creature information or free text is collected.
- No choice is remembered in the browser for a later visit.
- No tracking code is added to the Play address.
- Shared routes contain only one of four public words after `#`: `wonder`,
  `create`, `challenge` or `story`.
- No new screenshot or video is published while the authentic visual gate is
  still 0 of 4 approved moments.
- This release does not authorize a social post, portal submission, advert,
  outreach message or account change.

## How to check it

```bash
npm run validate:play-intent
npm run test:play-intent
```
