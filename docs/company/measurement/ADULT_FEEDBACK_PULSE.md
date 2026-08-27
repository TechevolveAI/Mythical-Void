# Adult Feedback Pulse

This turns the protected, fixed-choice adult feedback responses into one short
weekly studio recommendation. It is the bridge between “we collected feedback”
and “we know what to do next.”

## What it reports

- how far responses say they reached;
- how the experience felt overall;
- what they found strongest;
- what they think needs attention next;
- whether they would recommend the game;
- one next action, limited by the authentic visual gate.

The brief counts anonymous responses, not unique people. It cannot connect a
response to a website visit or game event, and it does not turn a handful of
answers into a market percentage.

## Run against production

Use the protected live command. It asks the authenticated Supabase CLI for the
current project service-role key, keeps it in process memory and does not print
or copy it into a file:

```bash
npm run feedback:pulse:live
```

To save aggregate Markdown and JSON reports outside the repository:

```bash
npm run feedback:pulse:live -- \
  --output /private/path/ADULT_FEEDBACK_PULSE.md \
  --json-output /private/path/ADULT_FEEDBACK_PULSE.json
```

A privacy-reviewed local JSON export with only the eight accepted database
columns can be used instead of `--live`. Raw exports must remain outside the
repository.

## Decision rules

- No responses: make no player claim; run the First Five check.
- Repeated confusion or inability to start: pause wider invitations and repair
  the first-play experience.
- At least half of responses stopping at or before Start: improve the route to
  the first hatch.
- A repeated improvement selected by at least two responses and 35% of the
  period: investigate that single issue.
- At least eight responses, with 60% positive and 60% saying yes or maybe to a
  recommendation: the feedback pattern can support the next invitation batch,
  but only if the separate First Five and visual gates are open.

These are operating triggers, not scientific thresholds. A serious safety or
trust issue still requires human judgement.

## Privacy and authority

The reader requests only the six fixed answers, receipt time and release ID. It
rejects names, emails, written answers, identifiers, child details, devices and
locations. It never prints an individual row and it cannot write to the
database, publish, message anyone, spend money or widen invitations. Feedback
records remain subject to the 180-day deletion rule.
