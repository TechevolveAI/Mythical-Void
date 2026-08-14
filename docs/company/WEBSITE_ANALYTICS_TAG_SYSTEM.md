# Mythical’s public website measurement

**Status:** live on the public website; consent required; reporting trust still needs Kevin’s Google property check

The Google tag requested for Mythical is live:

`G-FTM4W73EQC`

It is limited to the public website. It is not loaded inside the game.

## What visitors choose

The first time someone visits, they see a simple choice:

- **No thanks** keeps analytics off and does not request the Google tag.
- **Allow analytics** loads the Google tag for public-page counting and five small website actions.

Advertising features remain off. The visitor’s choice is kept in that browser
so the question does not appear every time.

## What Mythical can count after “Allow analytics”

1. A visit to a public information page.
2. `public_play_selected` when someone chooses a public Play link.
3. `public_share_selected` when someone chooses the Share button.
4. `public_trailer_started` the first time someone starts the official trailer on that page.
5. `public_stem_resource_selected` when someone chooses the free STEM activity.
6. `public_press_asset_selected` when someone chooses a press download.

The five actions carry one broad page group such as `home`, `trailer`,
`nasa_stem` or `studio`. They do not carry the button wording, full address,
query string, referrer, search term, resource name or file name.

That broad page group is the only extra detail Mythical adds to an action.
Google Analytics may still process its standard browser, device and connection
information after consent. The code blanks the page referrer. The Google
property must also have enhanced measurement switched off so it does not add
unapproved scroll, search, video, outbound-link or file-download events.

These are selections, not people or completed outcomes:

- a Play selection does not prove that the game loaded or that someone played;
- a Share selection does not prove that sharing completed;
- a trailer start does not prove that the trailer was watched to the end;
- a resource selection does not prove that the file downloaded or was used; and
- no public event should be described as a child, customer or unique player.

## What Mythical does not send

Mythical does not add a player name, email, age, child detail, account number,
creature identity, save, game progress, story choice, full URL, query string,
raw referrer, search term, user ID or advertising ID.

The game does not use this measurement. There is no gameplay event, in-game
funnel, child profile, advertising audience or personalised advertising.

## What is already checked

- the tag ID is correct;
- the browser does not request the Google tag before affirmative consent;
- analytics and every advertising choice start denied when the tag is loaded;
- the public action helper checks for an affirmative choice;
- only five action names and one broad property are allowed;
- game routes stop before the tag loads;
- advertising features and Google Signals are off;
- the privacy page explains the page and action counting;
- all nine public information routes use the same boundary;
- production hosting allows only the files needed by the tag; and
- removing the small tag and helper remains the kill switch.

## Before numbers become company truth

Kevin still needs to confirm inside Google Analytics:

1. which Google property receives `G-FTM4W73EQC`;
2. who owns and can remove access;
3. the retention setting;
4. that enhanced measurement is switched off;
5. that the nine public page groups and five allowed actions arrive; and
6. that no game route or unexpected field appears.

The privacy page always offers both **Allow analytics** and **Turn analytics off** so the choice can be changed later in the same browser.

Until then, the measurement may operate after consent, but a dashboard number
must not be used as an official studio result. If the property receives an
unexpected event or advertising feature, remove the tag and investigate.

## Working files

- Contract: `docs/company/automation/website-analytics-tag.json`
- Contract shape: `docs/company/automation/website-analytics-tag.schema.json`
- Source check: `scripts/company/validate-website-analytics-tag.cjs`
- Independent checks: `scripts/company/test-website-analytics-tag.cjs`
- Browser-behaviour checks: `src/__tests__/PublicWebsiteMeasurement.test.js`
