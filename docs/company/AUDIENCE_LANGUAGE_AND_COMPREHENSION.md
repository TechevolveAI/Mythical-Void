# Audience language and comprehension

## The rule

People should not need company, AI, legal, or engineering knowledge to
understand Mythical.

- Children and teenagers get the direct answer first.
- Parents and guardians get the important detail without hiding the young
  person's answer.
- Marketing explains what a player can see, feel, choose, or do.
- Support gives one clear next step when a next step is needed.
- Important messages explain what happens, what choice exists, and where to get
  help.
- Mythical does not use urgency, shame, emotional pressure, or childish wording
  to influence young people.

## What the check does

A-055 reviews current internal marketing, social, company, and support examples.
It can spot obvious specialist terms, unexplained short forms, long sentences,
weak support openings, pressure, patronising wording, and unsafe absolute
claims.

Run it locally:

```bash
node scripts/company/validate-audience-language-and-comprehension.cjs
node scripts/company/test-audience-language-and-comprehension.cjs
```

A valid check exits `2` because human review is still required.

## What the check cannot prove

A formula cannot prove that a child, teenager, parent, disabled reader, or
person reading in another language will understand a message. Before outward
use, a named human must still review accuracy, tone, safety, privacy,
accessibility, culture, translation, and the final words in their exact
context. Passing A-055 never publishes or sends anything.
