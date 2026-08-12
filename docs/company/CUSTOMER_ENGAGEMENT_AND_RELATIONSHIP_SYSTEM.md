# Customer Engagement and Relationship System

**Status:** Foundation; no CRM, inbox, publisher, consent ledger, or outbound
executor connected  
**Date:** 11 August 2026

## 1. Objective

Build durable, useful relationships with players, guardians, research
participants, creators, press, partners, and prospective customers without
turning engagement into surveillance, bulk messaging, or unattended contact.

The machine-readable lifecycle is
[`engagement/lifecycle-programs.json`](engagement/lifecycle-programs.json).
A-020 validates it and fails closed when ownership, consent, safeguarding,
suppression, retention, claims, proof, or external approval is absent.

## 2. Relationship principles

1. **A relationship is not a lead count.** Record the purpose, value exchange,
   provenance, permission, next useful action, and stop condition.
2. **No invisible enrichment.** Agents may research public organizations and
   roles, but may not build private dossiers, infer personal traits, or purchase
   contact lists.
3. **Adults control outbound contact.** Do not directly recruit, market to, or
   privately message children.
4. **Consent and legitimate expectation are purpose-specific.** Research
   permission is not a marketing subscription; a support message is not sales
   permission; a creator reply is not permission for a bulk sequence.
5. **Low frequency by default.** One relevant initial message and at most one
   useful follow-up for approved creator/partner outreach. Silence is a stop
   signal, not an invitation to chase.
6. **Suppression beats persuasion.** Opt-outs, objections, restricted cases,
   wrong-audience signals, and closed relationships must prevent future sends.
7. **Agents prepare; trusted humans authorize.** Until evaluated executors and
   approval infrastructure exist, agents research, validate, draft, and
   summarize only.

## 3. Lifecycle

```text
Observed or invited
  -> purpose and source admitted
  -> eligibility / safeguarding gate
  -> consent or approved outreach scope
  -> exact human-approved action
  -> response / evidence / service outcome
  -> next useful action or suppression
  -> closed-loop learning
  -> retention expiry and deletion
```

Stage movement requires evidence. A drafted message is not contact; delivery is
not engagement; silence is not interest; a reply is not consent for a different
purpose; and a CRM record is not a customer.

## 4. Program boundaries

| Program | Intended value | Current boundary |
| --- | --- | --- |
| Adult research | Improve positioning, trust, and first value | Protocol ready; recruitment unapproved |
| Feedback close-loop | Tell eligible contributors what changed | No live intake or approved response route |
| Creator/press | Provide authentic, relevant product proof | Proof, account, sender, and outreach approval missing |
| Commercial partners | Explore aligned distribution and capability | Public research only; no organizations contacted |
| Adult/guardian updates | Send rare meaningful release updates | Deferred until consent, rights, sender, and suppression exist |
| Support/service | Resolve ordinary questions safely | Synthetic triage only; inbox and safeguarding owners absent |

## 5. Data separation

The shared company repository stores program logic and de-identified evidence,
not contact records. Any future operational system must separate:

- contact and consent records;
- message content and delivery audit;
- restricted safeguarding/security/legal cases;
- de-identified customer evidence;
- aggregate outcome reporting.

It must define access, purpose, source, retention, correction, deletion,
export, suppression, backup, incident handling, vendor/subprocessor terms, and
regional boundaries before importing a contact.

## 6. Agent permissions

Agents may:

- validate eligibility, sources, claims, proof, consent state, frequency, and
  suppression in an internal dry run;
- research public organizations and role-based contact routes;
- draft a single relevant message or response from approved evidence;
- propose the next useful action or closure;
- summarize de-identified outcomes and surface exceptions.

Agents may not:

- scrape, enrich, buy, import, or infer personal contact data;
- contact children or move a public conversation into private messaging;
- send, schedule, publish, reply, follow, subscribe, or enroll anyone;
- fabricate familiarity, urgency, testimonials, or social proof;
- reuse research, support, submission, or partner data for another purpose;
- ignore suppression, retry indefinitely, or optimize for reply volume;
- promise product, policy, price, rights, or commercial terms outside approved
  claims and authority.

## 7. Production gates

Before any connected engagement program:

- named business owner and backup;
- safeguarding owner and urgent route where players may contact Mythical;
- verified adult audience and purpose;
- approved sender identity, account, channel, and reply coverage;
- consent/legal-basis and child-data review against actual markets;
- consent and suppression ledgers with deletion/export rights;
- approved claims, proof, templates, frequency, stop rules, and expiry;
- least-privilege service identity and separated draft/send permissions;
- idempotency, bounce/failure handling, rate/spend limits, and kill switch;
- restricted-case routing and human-only send policy;
- delivery/reply/unsubscribe/incident reconciliation;
- vendor, retention, security, backup, and exit evidence;
- trusted approval record for every externally material action class.

## 8. Success measures

Use outcome and trust measures with small-sample context:

- eligible relationships with explicit purpose and provenance;
- useful replies, completed research, resolved cases, or qualified discovery;
- evidence that changed a decision or product outcome;
- opt-out, suppression, complaint, restricted-case, and wrong-audience rates;
- message accuracy and unsupported-claim rate;
- response workload and time to human escalation;
- retention/deletion compliance;
- partner/player outcome after the relationship closes.

Never report delivered messages, CRM records, followers, or reply rates alone as
customer value, traction, or revenue.
