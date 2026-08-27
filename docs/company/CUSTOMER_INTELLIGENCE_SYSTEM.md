# Mythical Customer Intelligence System

**Status:** A-005 synthesis pilot implemented; collection not activated  
**Owner:** Company task, accountable owner Kevin Murphy  
**Date:** 11 August 2026

## 1. Purpose

Create a trusted loop that turns player, parent, creator, partner, support, and
market signals into evidence-backed decisions without building surveillance
profiles or treating children as growth data.

```text
Approved sources
      ↓
Safety and privacy screen
      ↓
De-identify and classify
      ↓
Human-verified evidence
      ↓
Theme + confidence + decision
      ↓
Company action or Game Development handoff
      ↓
Outcome measurement + contributor close-loop
```

The system must preserve the distinction between:

- **signal:** an observation that may be relevant;
- **evidence:** a provenance-linked, appropriately collected observation;
- **insight:** an interpretation supported by one or more evidence items;
- **decision:** an accountable choice made with known uncertainty;
- **result:** what changed after the decision.

Agent summaries are interpretations. They are never the underlying evidence.

## 2. Approved source classes

| Source | Evidence value | Main risk | Initial mode |
| --- | --- | --- | --- |
| Moderated playtest observation | High for usability and comprehension | Child participation, recording, identifiers | Human-led with approved protocol |
| Parent/guardian interview | High for trust, permission, and value | Contact data and sensitive family context | Human-led, de-identified notes |
| Voluntary adult/guardian survey | Medium; depends on recruitment and wording | Selection bias and contact data | Small, purpose-specific |
| Support or enquiry email | High for concrete problems; weak for prevalence | Personal/sensitive data and safeguarding | Restricted inbox, human-first triage |
| Public review/comment | Medium for language and visible sentiment | Context collapse, usernames, brigading | Public-source reference, no profile enrichment |
| Identifier-free product counters | High for aggregate funnel direction | Miscounting, no unique-user inference | Proposed after review |
| Creator/partner conversation | High for distribution objections and fit | Commercial confidentiality | Human-owned notes |
| Search demand and visibility | Medium for discovery intent | Tool sampling and query ambiguity | Aggregate/read-only |
| Market/competitor research | Hypothesis input | False equivalence and stale data | Sourced desk research |
| Synthetic personas/agent simulation | Ideation only | False validation | Never entered as customer evidence |

## 3. Minimum evidence record

Every accepted item receives:

- evidence ID and observed date;
- source type and recruitment/context;
- applicable consent/protocol reference;
- product version and journey stage;
- de-identified observation;
- interpretation kept in a separate field;
- alternative explanations and known bias;
- confidence and recurrence;
- theme, severity, and possible implication;
- owner, next decision, and retention/delete date;
- restricted pointer to raw data, if raw data must exist.

Do not place names, email addresses, child ages, exact locations, voices, faces,
free-form child submissions, IP addresses, account identifiers, creature names,
or raw support messages in the shared register.

## 4. Intake and triage

### Stage 0: source admission

Before connecting a source, record:

1. purpose and decision served;
2. data fields and likely sensitive content;
3. audience, including whether minors may participate;
4. collection notice/consent or other reviewed basis;
5. storage, access, retention, deletion, and processor/vendor;
6. safeguarding, legal, security, and data-rights escalation;
7. whether an agent may see raw data.

If these are missing, collection remains off.

### Stage 1: safety gate

Human-first routing applies when content may include:

- a child or vulnerable person in immediate danger;
- abuse, exploitation, grooming, self-harm, or threats;
- illegal or sexual content;
- personal data in an unexpected context;
- account compromise, vulnerability disclosure, or active security incident;
- legal demand, data-rights request, press request, or payment dispute.

An agent must not summarize away, independently resolve, promise
confidentiality, diagnose, investigate a person, or make external reports from
these messages. It may apply a conservative restricted label and alert the
named human owner.

### Stage 2: minimization

For ordinary eligible inputs:

- strip message headers not needed for the case;
- separate contact details from content;
- remove names, handles, URLs with personal tokens, exact dates/locations, and
  unique story details when not decision-relevant;
- remove image metadata before review copies are created;
- use a random evidence ID rather than an inbox/customer ID;
- store only the shortest observation needed to support the decision.

### Stage 3: classification

Use controlled values:

- **audience role:** player, parent/guardian, creator, partner, press, unknown;
- **journey:** discover, understand, start, hatch, bond, explore, restore,
  return, share, seek help;
- **theme:** positioning, trust, performance, accessibility, controls, story,
  companion, progression, difficulty, safety, privacy, AI, support, commercial;
- **type:** confusion, friction, failure, delight, request, objection, risk;
- **severity:** S0 informational, S1 minor, S2 blocks value, S3 serious harm or
  broad failure, S4 immediate safety/security/legal crisis;
- **confidence:** low, medium, high;
- **recurrence:** isolated, repeated, systematic, unknown.

### Stage 4: evidence review

A human verifies:

- the record matches the source;
- inference is not written as fact;
- consent/protocol and minimization are valid;
- severity and escalation are appropriate;
- the item is not a duplicate or coordinated noise.

Only then may the status become `accepted evidence`.

## 5. Theme synthesis

Agents may cluster accepted de-identified evidence. Each theme report must show:

- evidence IDs, source diversity, product versions, and time window;
- observed pattern and exact boundary of the claim;
- disconfirming evidence and sampling bias;
- confidence: directional, credible, or decision-grade;
- affected audience and journey stage;
- recommended action, experiment, or no-action reason;
- what new evidence would change the recommendation.

Do not use a raw count as prevalence unless the sampling method supports that
inference. Ten similar voluntary emails can prove a problem exists; they do not
prove ten percent of players have it.

## 6. Prioritization

Avoid false-precision scoring. Use this decision order:

1. **Safety, rights, or trust:** act or escalate irrespective of frequency.
2. **Critical journey blockage:** prioritize when credible evidence shows
   players cannot reach the intended value.
3. **Strategic differentiation:** prioritize evidence that strengthens the
   creature bond, living world, choice, or trust proposition.
4. **Repeated friction:** prioritize when recurrence crosses sources or
   methods.
5. **Delight expansion:** scale moments that produce voluntary, healthy
   engagement without manipulative pressure.
6. **Requests:** validate the underlying need before building the requested
   feature.

For comparable items, rate `impact`, `evidence strength`, `reach confidence`,
`strategic fit`, `risk reduction`, and `delivery cost` as low/medium/high and
show the reasoning. Do not collapse them into an unexplained number.

## 7. Game Development handoff contract

A product handoff contains:

```text
Handoff ID and owner
Decision requested
Observed player/customer problem
Accepted evidence IDs and confidence
Affected audience, journey, and product version
Expected player outcome
Recommended intervention boundary (not a dictated implementation)
Safety/privacy/accessibility constraints
Success and regression measures
Urgency and consequence of no action
Company follow-up owner and review date
Game Development disposition: accepted | research | declined | scheduled
```

The company task owns the evidence and expected outcome. Game Development owns
technical design, sizing, sequencing, and implementation unless Kevin decides
otherwise.

## 8. Closing the loop

Every accepted theme must end as one of:

- fixed or improved;
- experiment launched;
- more research required;
- accepted risk with owner/review date;
- declined with reason;
- duplicate/superseded;
- outside current strategy.

Where contact was appropriately retained, a human-approved response may tell
the contributor what changed. Do not expose internal prioritization, other
contributors, or personal data.

## 9. Quality measures

| Measure | Definition | Initial target |
| --- | --- | --- |
| Evidence provenance coverage | Accepted items with source/protocol/version | 100% |
| Sensitive-data leakage | Shared records containing prohibited raw data | 0 |
| Human verification | Accepted items reviewed before synthesis | 100% |
| Decision linkage | Accepted themes linked to a decision/experiment/handoff | 90%+ |
| Closed-loop rate | Due items with a recorded disposition | 90%+ |
| Unsupported prevalence claims | Audited reports making invalid population claims | 0 |
| Safeguarding routing time | Time from restricted classification to human alert | Defined before inbox connection |

## 10. Implementation stages

1. **Manual, de-identified pilot:** five to ten moderated sessions and parent
   trust tests; no automated ingestion.
2. **Draft-mode synthesis:** agents receive only reviewed, de-identified
   records and produce themes for human verification.
3. **Restricted inbox triage:** only after policies, access, evaluation, and
   safeguarding ownership exist; agent labels/drafts, human sends.
4. **Bounded closed-loop automation:** reminders and internal routing only.
5. **Selective response automation:** considered only for low-risk, fully
   templated operational cases after a measured pilot.

Public or child-originating free-text ingestion never becomes an unattended
agent workflow.

The A-005 pilot reads only the shared de-identified evidence register. It
rejects accepted records without human review, records marked synthetic or as
containing personal data, prohibited identity fields, and obvious email/phone
leakage. It emits no credible theme until the configured minimum is met, and
every theme remains qualitative and requires human insight review.

## 11. Regulatory design basis

This specification is operational guidance, not legal advice. It uses a high
floor of protection because the service is likely to be accessed by children.
The Irish Data Protection Commission recommends a child-protective default,
child-oriented transparency, data minimization, and DPIAs for processing
children's data. The UK ICO's gaming DPIA examples treat gameplay telemetry as
personal data where it relates to players and emphasize minimization and
profiling controls. The FTC identifies persistent identifiers as personal
information under COPPA, while describing a narrow internal-operations
analytics exception that does not permit behavioral advertising or profile
building. The EU's DSA guidance for minors emphasizes privacy, safety,
security, and explicit rather than behavioral signals.

Primary references:

- [Irish DPC: Fundamentals for a Child-Oriented Approach](https://www.dataprotection.ie/en/dpc-guidance/fundamentals-child-oriented-approach-data-processing)
- [ICO: Mobile gaming DPIA — describe the processing](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/dpia-tools/mobile-gaming-app/step-2-describe-the-processing/)
- [FTC: Complying with COPPA — FAQs](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [European Commission: DSA guidelines on protection of minors](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors)
