# Mythical’s website visit counter

Status: live on the public website; Google-property receipt still needs checking.

The public shop window now has the Google tag requested for Mythical:

`G-FTM4W73ECQ`

It is limited to the public pages before the game. The game does not load it.

## What visitors see

The first time someone visits, they see a simple choice:

- “No thanks” keeps analytics off.
- “Allow analytics” allows a basic visit count and tells us when a public-site button leads to Play or Share.

Analytics starts off. Advertising features start off. A visitor’s choice is kept in that browser so the question does not appear every time.

## What the tag does not receive from Mythical

The tag is not given a player name, email, age, child detail, account number, creature name, save data, story choice, or user ID. It uses the public page path rather than a full address with extra query details.

It is not used to measure the game, follow children, build advertising audiences, or personalise adverts. Play and Share checks contain only the public page and a broad area such as the header or hero. They do not contain a recipient, contact detail, creature detail, game activity, full address, or search text.

## Checks completed

The source checker confirms:

- the tag ID is correct;
- consent is denied at the start;
- no page view is sent before a visitor allows analytics;
- the game routes are excluded;
- advertising features are off;
- both production hosting policies allow the required Google files; and
- the privacy page explains the choice.

The independent check covers 28 cases. The public website tests still pass, and the release package includes the consent helper and both hosting policy changes.

## What the live check proved

On 31 August 2026, the current production release was checked directly:

- the homepage loaded the correct Google tag script;
- the privacy explanation was live; and
- the game runtime did not load a Google tag script.

The browser already held a visitor choice, so no browser data was deleted and
the first-visit banner was not replayed. No Google Analytics report was opened.

## Before we trust live numbers

The remaining property-side check must prove that:

1. the public pages load the tag;
2. the game does not;
3. “No thanks” sends nothing;
4. “Allow analytics” sends only the public page visit; and
5. advertising remains off.

Kevin should also confirm the Google property, who can remove the tag, and the
chosen retention setting. Until then, no missing count is called zero interest
and no visible count is treated as a player, a child, conversion or retention.

## Files

- Contract: `docs/company/automation/website-analytics-tag.json`
- Contract shape: `docs/company/automation/website-analytics-tag.schema.json`
- Source check: `scripts/company/validate-website-analytics-tag.cjs`
- Independent checks: `scripts/company/test-website-analytics-tag.cjs`
