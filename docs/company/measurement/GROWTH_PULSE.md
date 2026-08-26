# Mythical Growth Pulse

This turns one small weekly Google Analytics export into a plain-English answer
to three questions:

1. Did people reach Mythical Void's public pages?
2. Did those pages lead to Play?
3. Which public page earned that Play interest?

It deliberately does not try to identify a person or follow a child through the
game.

## The weekly input

Export one seven-day aggregate table from Google Analytics with only these four
columns:

- `Date`
- `Page path and screen class`
- `Event name`
- `Event count`

The report uses only `page_view`, `play_selected`, `share_completed`, and
`share_link_copied`. Other event rows are ignored. It rejects exports containing
personal, device, location, full-address, referrer, query or identifier fields.

## Run the report

```bash
npm run growth:pulse -- /path/to/ga4-export.csv
```

To keep a Markdown and JSON copy:

```bash
npm run growth:pulse -- /path/to/ga4-export.csv \
  --output /path/to/GROWTH_PULSE.md \
  --json-output /path/to/GROWTH_PULSE.json
```

The raw export should remain outside the repository. Only an aggregate report
that has passed the checks should enter a company review.

## The decision rule

- Fewer than 50 public-page views: do not rewrite the site from weak evidence;
  improve distribution first.
- At least 50 views but fewer than 8 Play selections per 100 views: improve the
  first-screen proof and Play invitation before adding traffic.
- A healthier Play-selection signal: protect the winning public page and move
  measurement attention toward successful game starts and first hatches.

These are operating triggers, not claims of statistical certainty. The report
uses “events” and “attempts,” never “people” or “players,” because the same
visitor can produce more than one event.

## Current boundary

The public website tag is consent-based and does not run inside the game. This
report neither changes that boundary nor activates the proposed in-game
measurement system. It cannot post content, message anyone, spend money, or
change a live account.
