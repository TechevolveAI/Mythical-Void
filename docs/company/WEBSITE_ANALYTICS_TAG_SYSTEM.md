# Mythical’s website visit counter

Status: code ready for the public release; live deployment and live measurement still need checking.

The public shop window now has the Google tag requested for Mythical:

`G-FTM4W73EQC`

It is limited to the public pages before the game. The game does not load it.

## What visitors see

The first time someone visits, they see a simple choice:

- “No thanks” keeps analytics off.
- “Allow analytics” allows a basic visit count for the public website.

Analytics starts off. Advertising features start off. A visitor’s choice is kept in that browser so the question does not appear every time.

## What the tag does not receive from Mythical

The tag is not given a player name, email, age, child detail, account number, creature name, save data, story choice, or user ID. It uses the public page path rather than a full address with extra query details.

It is not used to measure the game, follow children, build advertising audiences, or personalise adverts.

## Checks completed

The source checker confirms:

- the tag ID is correct;
- consent is denied at the start;
- no page view is sent before a visitor allows analytics;
- the game routes are excluded;
- advertising features are off;
- both production hosting policies allow the required Google files; and
- the privacy page explains the choice.

The independent check covers 25 cases. The public website tests still pass, and the release package now includes the consent helper and both hosting policy changes.

## Before we trust live numbers

The live site still needs a check that:

1. the public pages load the tag;
2. the game does not;
3. “No thanks” sends nothing;
4. “Allow analytics” sends only the public page visit; and
5. advertising remains off.

Kevin should also confirm the Google property, who can remove the tag, and the chosen retention setting. A live number is not treated as company truth until those checks are recorded.

## Files

- Contract: `docs/company/automation/website-analytics-tag.json`
- Contract shape: `docs/company/automation/website-analytics-tag.schema.json`
- Source check: `scripts/company/validate-website-analytics-tag.cjs`
- Independent checks: `scripts/company/test-website-analytics-tag.cjs`
