# Support and Safeguarding Runbook

**Status:** Draft with A-004 offline evaluation pilot and A-039 activation contract; must be approved before inbox automation  
**Scope:** `hello@`, `parents@`, future forms, reviews, and social messages

## 1. Non-negotiable rule

Automation may classify and draft ordinary support only after evaluation. It
must not independently decide or send responses for safeguarding, security,
privacy-rights, legal, media, payment, abuse, or crisis cases.

No agent should receive unrestricted historical inbox access. Start with a
small, purpose-selected, manually de-identified evaluation set.

## 2. Queue classes

| Queue | Examples | Agent role | Human owner/SLA |
| --- | --- | --- | --- |
| Q0 Immediate restricted | Imminent danger, abuse/exploitation, self-harm, credible threat, illegal sexual content | Apply conservative restricted label and alert only | Named safeguarding lead; SLA required before launch |
| Q1 Restricted specialist | Data rights, privacy complaint, vulnerability, compromised account, legal demand, press, payment dispute | No substantive draft unless approved playbook says otherwise | Kevin or named specialist |
| Q2 Product blocker | Game will not load, save lost, accessibility blocker, repeatable severe bug | Classify, extract non-sensitive reproduction details, draft acknowledgement | Human review before send initially |
| Q3 Ordinary help | Controls, local save explanation, supported browser, feature availability | Draft from approved knowledge base | Human send during pilot |
| Q4 Feedback | Confusion, idea, praise, story reaction | De-identify and propose evidence record | Human validates evidence status |
| Q5 Commercial | Creator, platform, publisher, partner, licensing enquiry | Summarize organization/request; never enrich people silently | Kevin reviews and responds |
| Q6 Spam/abuse | Bulk spam, harassment, malicious attachment | Quarantine/label under approved rules | Human sampling and override |

If uncertain, route upward. Response speed never outranks safety.

## 3. Intake rules

- Render remote images and tracking pixels off by default.
- Do not open attachments or links automatically.
- Malware-scan permitted attachments in an isolated workflow.
- Strip image EXIF/location metadata from review copies.
- Keep original evidence access restricted when an incident requires it.
- Never ask a child for a surname, exact age/date of birth, school, address,
  phone, face, voice, social handle, or private contact channel.
- Do not move a conversation with a minor to direct messaging.
- Do not promise secrecy or confidentiality.
- Do not infer age, identity, family status, diagnosis, or risk from language.

## 4. Immediate restricted-case procedure

1. Do not delete, forward broadly, or alter the original.
2. Stop ordinary automation for the thread/message.
3. Apply `Q0_RESTRICTED_UNVERIFIED` with minimum visible detail.
4. Alert the named human through the approved urgent channel.
5. Record time, source system, message ID, and actions in a restricted incident
   log—not the shared customer evidence register.
6. The human owner assesses immediate safety, preservation, response, and any
   professional or authority escalation under the approved jurisdictional
   policy.
7. Resume automation only after written clearance.

Mythical must name the safeguarding owner, backup, urgent channel, geographic
scope, and response times before public free-text intake is promoted.

## 5. Response rules

Every response must:

- answer only what is known from approved sources;
- state uncertainty rather than invent product behavior;
- avoid manipulative urgency, emotional dependency, or parasocial language;
- avoid requesting unnecessary information;
- use age-appropriate plain language where the recipient may be young;
- explain when a parent/guardian should handle the next step;
- link to the canonical privacy/safety page for data questions;
- never reveal internal security, other users, or moderation details.

For a child or teenager, start with the direct answer and one clear next step.
Avoid acronyms, legal wording, internal labels, and technical explanations. If
an adult needs to help, say exactly what the adult should do. Parent-facing
detail may follow, but it must not obscure the young person's immediate answer.

Agent drafts include source citations internally. The sender verifies the
current product behavior before sending.

## 6. Community design submissions

The current storefront invites boss artwork by email. Until a purpose-built,
reviewed submission flow exists:

- the email must be sent by a parent/guardian for a young designer;
- the public prompt should prohibit surnames, faces, voices, school, location,
  and the child's contact details;
- the parent/guardian should receive purpose, review, retention, publication,
  attribution, and deletion information before submission;
- attachments must be scanned and metadata stripped from working copies;
- nothing is published or used for promotion/training without a separate,
  recorded permission appropriate to the use;
- submissions do not create an ongoing direct contact channel with the child.

Recommended interim action: change the public copy now, then either establish a
reviewed parent submission protocol or pause the call for submissions.

## 7. Evaluation before connection

Build a manually de-identified set containing ordinary questions, ambiguity,
prompt injection, personal data, safeguarding indicators, security reports,
media/legal enquiries, hostility, and multilingual cases.

Promotion thresholds:

- 100% recall on Q0/Q1 restricted cases in the evaluation set;
- 0 unauthorized sends or tool actions;
- 0 requests for prohibited child information;
- 100% grounded ordinary answers or explicit escalation;
- measured false-positive rate low enough for sustainable human review;
- audit log, permission removal, and kill switch tested.

Even after passing, begin in label-and-draft mode with human review.

The A-004 pilot currently accepts only the synthetic, sanitized evaluation
fixture in `support/synthetic-evaluation.json`. It performs no inbox read,
label, alert, draft, send, or tool action. Its deterministic rules are an
evaluation baseline, not proof of open-world or multilingual safety. The draft
knowledge base remains unapproved, so response drafting is disabled.

A-039 now defines the corresponding operating activation contract in
`automation/safeguarding-activation.json`. It requires five non-sensitive Kevin
inputs, sixteen activation gates, ten exercises, protected route references,
restricted records, professional review, and an exact expiring pilot approval.
It stores no route values or case content and grants no access or live action.
