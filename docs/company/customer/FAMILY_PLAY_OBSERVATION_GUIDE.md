# Family play observation guide

This gives Mythical a useful feedback route now, without opening a public form
or pretending that an unmonitored inbox exists.

An adult may record:

- what they saw happen in the game;
- what appeared to work;
- where the player got stuck or confused;
- one sensible thing for the studio to check next.

An adult must not record a person's name, contact details, exact age, school,
location, account, creature name, photograph, recording, or direct quote. Write
what happened in your own words. For example, use “The player looked for a
continue button after hatching,” not a child's words or identity.

These notes are internal product observations. They are not independent
customer research, proof of demand, a testimonial, or permission to publish or
contact anyone. They cannot be copied into the Customer Evidence Register
without the separate adult research and human-review process.

## One-minute record

From the project folder, preview the entry first:

```bash
npm run record:family-play -- \
  --context parent_observed_family_play \
  --journey hatch \
  --build-ref live-2026-08-14 \
  --worked "The creature reveal held attention." \
  --confusing "The next action was not obvious after the reveal." \
  --next-check "Test a clearer continue prompt after hatching." \
  --themes creature,controls \
  --confirmed-by "Kevin Murphy"
```

If the preview is accurate and contains no identifying details, repeat it with
`--apply`. The recorder creates the next `PO-` number and stores only the
de-identified note.

## Stop instead of recording

Do not put a safeguarding concern, personal data, account problem, payment
issue, legal request, security incident, or distressing disclosure in this
file. Stop ordinary note-taking and handle it through a suitable adult-led
private route. Mythical has not opened public feedback, comments, or direct
messages yet.
