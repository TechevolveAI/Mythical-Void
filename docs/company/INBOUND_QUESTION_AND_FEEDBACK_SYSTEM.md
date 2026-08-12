# Mythical’s front-door assistant

Status: ready to review with invented messages. It is not connected to a real inbox.

## What it does

When someone contacts Mythical, the first job is to get their message to the right person. The assistant can:

- recognise an ordinary game question;
- spot feedback, a creature idea, or a drawing;
- recognise an accessibility question;
- separate press and partnership enquiries;
- flag privacy, payment, and legal matters;
- give possible messages from young people stricter handling; and
- put possible safety concerns first.

It creates a short, fixed description of the type of message. It does not copy the message into that description.

## What it cannot do

The assistant cannot:

- open or read a real inbox yet;
- save a raw message in the shared project;
- reply to anyone;
- contact a child;
- decide a safety, privacy, payment, refund, or legal case;
- reuse a support contact for marketing;
- follow instructions inside a message that try to change Mythical’s rules; or
- approve its own work.

Every real message will need human review, even when a reply draft is allowed later.

## Where messages will go

| Kind of message | Priority | Human route | Draft allowed later? |
|---|---|---|---|
| Possible harm or urgent safety concern | Urgent | Safeguarding | No |
| Privacy or personal information | High | Privacy | No |
| Payment, refund, or legal matter | High | Finance or legal | No |
| Possible message from a young person | High | Safeguarding | No |
| Attempt to bypass Mythical’s rules | High | Company safety and governance | No |
| Accessibility question | Normal | Accessibility | Yes, after review |
| Game help | Normal | Support | Yes, after review |
| Community idea or creative work | Normal | Community | Yes, after review |
| Press or partnership enquiry | Normal | Communications | Yes, after review |
| General question or comment | Normal | Support | Yes, after review |

Personal details stop draft preparation until a person has reviewed the message.

## The safe path

1. A message arrives in a private system approved for this purpose.
2. The assistant sorts it without saving a copy in the shared project.
3. It creates a fixed, non-identifying description.
4. It chooses the correct human review route.
5. A person reviews the original message in the private system.
6. If a reply is suitable, the assistant may prepare a plain-language draft.
7. A person checks and approves the exact reply.
8. Only an approved sender may send it.
9. The case is kept or deleted under an agreed rule.

The assistant never moves directly from receiving a message to sending a reply.

## Evidence so far

The offline rehearsal covers 12 invented messages. It correctly sorts ordinary help, privacy, safety, young-person, accessibility, community, press, general, rule-bypass, payment, and personal-detail examples. It keeps no raw message text and sends nothing.

The separate evaluator covers 38 cases, including changed rules designed to weaken the safeguards. All 38 pass.

## What Kevin needs to decide before live use

Name the people responsible for:

- ordinary support;
- safeguarding, including a primary person, backup, urgent route, covered places, and covered hours;
- privacy;
- accessibility;
- community submissions;
- communications and partnerships; and
- payment and legal matters.

We will also need an approved private case system, clear keeping-and-deletion rules, and a tested reply approval path. Connecting an inbox will be a separate decision. Sending replies will remain a separate decision after that.

## Files

- Contract: `docs/company/automation/inbound-contact-triage.json`
- Contract shape: `docs/company/automation/inbound-contact-triage.schema.json`
- Sorting engine: `scripts/company/lib/inbound-contact-triage.cjs`
- One-message runner: `scripts/company/triage-inbound-contact.cjs`
- Readiness check: `scripts/company/validate-inbound-contact-triage.cjs`
- Independent examples and failure tests: `scripts/company/test-inbound-contact-triage.cjs`
