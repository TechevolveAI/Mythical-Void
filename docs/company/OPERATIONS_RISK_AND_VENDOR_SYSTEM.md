# Operations, Risk, and Vendor System

**Status:** Foundation; several owners and vendor reviews remain open  
**Date:** 11 August 2026

## 1. Objective

Make Mythical operationally scalable without hiding risk, access, spend,
vendor dependency, or manual work behind agents.

The operating system answers:

- what services and automations the company depends on;
- who owns each outcome and exception;
- what data, IP, money, and permissions cross each boundary;
- what changed, why, and whether production/public copy still matches;
- how failure is detected, contained, recovered, and learned from;
- which decisions Kevin must make and by when.

## 2. Operating registers

| Register | Purpose | Review trigger |
| --- | --- | --- |
| Objectives | Outcomes, owners, measures, horizon | Weekly/monthly |
| Decisions | Approval, rationale, expiry | Every material choice |
| Experiments | Hypothesis, evidence, guardrails, result | Start/stop/result |
| Customer evidence | De-identified source-backed learning | New accepted evidence |
| Automations | Permission, evaluation, spend, kill switch | Every version/promotion |
| Access | Systems, role, purpose, owner | Grant/change/quarterly |
| Vendors | Service, data/IP, contract, retention, owner, exit | Onboarding/change/annual |
| Risks | Cause, consequence, controls, owner, due/review | Weekly for high/critical |
| Incidents | Timeline, impact, containment, recovery, learning | Every incident/near miss |
| Assets/claims | Rights, provenance, permitted claims | Capture/change/campaign |
| Commercial pipeline | Stage, fit, approval, terms, outcome | Weekly when active |

If a production dependency or automation is absent from its register, it is
uncontrolled—not “lightweight.”

## 3. Vendor lifecycle

### Discover and classify

Before use, record:

- service and legal contracting entity;
- business purpose and product feature;
- owner and technical operator;
- data and IP sent, generated, stored, logged, or inferred;
- audience and whether child/player data may be involved;
- subprocessors and data locations where relevant;
- model training/reuse terms for AI providers;
- security, access, retention, deletion, export, incident, and audit terms;
- price, currency, variable-cost driver, limit, renewal, and cancellation;
- availability/SLA, fallback, portability, and exit plan;
- contract/DPA/legal review status.

### Approve and integrate

- use the minimum service scope and least-privilege service identity;
- separate development, preview, and production where supported;
- store secrets only in the approved secret manager/environment;
- configure budget/rate/abuse limits before public enablement;
- verify logs do not capture secrets or unnecessary player content;
- test failure, timeout, provider rejection, deletion, export, and kill switch;
- update privacy, AI transparency, support, and incident documentation to the
  actual configuration before release.

### Operate

- monitor availability, errors, latency, cost, quota, policy changes, and
  security notices;
- reconcile invoices/usage to approved drivers;
- sample permissions and data flows;
- review model/version changes before automatic adoption;
- keep a provider-independent fallback for player-critical paths.

### Exit

- export required owned data in a portable format;
- disable traffic and revoke credentials;
- delete vendor data and obtain/record confirmation where applicable;
- remove SDK/code/config/public disclosures;
- preserve only legally/operationally required records;
- verify the player experience and support path after removal.

## 4. Change and release governance

The current repository is shared with an actively deploying Game Development
task. Company changes must not be bundled into production accidentally.

Every production-affecting company release needs:

1. exact scoped diff and owning task;
2. dependency and working-tree collision check;
3. claims/privacy/vendor documentation impact check;
4. tests plus preview or equivalent evidence;
5. complete deployment preview and rollback route;
6. named approver for public/customer-affecting behavior;
7. post-deploy checks, including A-001 where relevant;
8. register and handoff updates.

Manual Netlify production deploys observed on 11 August had no commit reference
in the returned metadata. This may be an intentional workflow, but it weakens
automatic source-to-deploy traceability. Record the source revision/build
artifact in future company release evidence even when deployment is manual.

## 5. Operational cadence

### Daily exception view

- C0/C1 incidents and safeguarding alerts;
- failed or paused production workflows;
- unexpected spend/quota/security events;
- deploy/availability changes;
- overdue high-risk actions.

### Weekly company operations review

- objectives and evidence;
- active risks and control effectiveness;
- automation runs, exceptions, cost, and human work;
- vendor/service health and material changes;
- access grants/removals;
- commercial commitments and forecast assumptions;
- Kevin decision queue.

### Monthly control review

- vendor usage/spend and upcoming renewals;
- data map, retention/deletion, and subprocessors;
- claim/policy/configuration drift;
- incident/near-miss themes;
- access and service-identity exceptions;
- business continuity and backup status;
- automations eligible for promotion, demotion, or retirement.

### Quarterly assurance

- revoke unused access;
- exercise critical kill switches and one restore path;
- test vendor exit for one material dependency;
- reconcile public privacy/AI/security claims to actual flows;
- review legal/regulatory assumptions professionally;
- verify the company still has a human owner for every high-impact system.

## 6. Spend and financial controls

Before any paid workflow or campaign:

- cost center/purpose, owner, currency, tax treatment, supplier, and approval;
- per-run, daily, monthly, and campaign caps;
- forecast with explicit volume/price assumptions;
- alert thresholds before the hard limit;
- idempotency and duplicate-charge protections;
- invoice/usage reconciliation;
- refund/credit handling;
- stop condition and who can activate it.

Agents may calculate, classify, reconcile, and alert. They may not open bank or
payment accounts, move money, accept financial terms, approve their own spend,
or change limits without A4 authority.

For AI media, track cost per requested, successful, accepted, stored, viewed,
and retained output. Cost per provider call alone hides identity failures and
unused generation.

## 7. Incident model

| Severity | Examples | Immediate action |
| --- | --- | --- |
| I0 Critical | Child safeguarding emergency, material data exposure, active credential compromise, unauthorized public/spend action | Stop affected workflows, restrict evidence, alert named owners immediately |
| I1 High | Wrong provider/data disclosure, material policy mismatch, major outage/data loss, significant harmful public claim | Contain, disable affected feature/action, notify owner, preserve timeline |
| I2 Medium | Repeated degraded feature, incorrect internal synthesis, budget warning, failed deletion/retention job | Pause/demote workflow and create owned corrective action |
| I3 Low | Bounded transient failure or minor documentation defect | Retry/fix under playbook and include in trend review |
| I4 Near miss | Control caught the action before impact | Record and improve control; do not hide because no impact occurred |

Incident records separate facts from hypotheses, use UTC timestamps, restrict
sensitive evidence, and include detection, containment, recovery, communication,
root causes, contributing system incentives, and verified prevention actions.

## 8. Business continuity

Critical experiences must degrade safely:

- game remains playable locally when Supabase or AI media is unavailable;
- authored/pixel media remains the canonical fallback;
- company registers and source remain exportable and versioned;
- no single agent credential can publish, spend, access restricted support, and
  alter governance;
- recovery documentation names prerequisites rather than assuming Kevin's
  memory;
- domain, source, hosting, database, and business email recovery methods have
  more than one controlled path when the company is ready to scale.

Do not claim recovery readiness until backups/restores are exercised and the
result is recorded.

## 9. Current material vendor drift

Code inspected on 11 August shows:

- portrait generation defaults to Google Gemini image generation, with
  Replicate fallback;
- companion video supports `auto`, preferring Google Gemini/Veo and falling
  back to Replicate when configured;
- finished media is designed to copy into private Supabase storage;
- Netlify hosts the site and protected functions;
- browser-side NASA requests may disclose standard request metadata;
- creature conversation remains human-authored/deterministic rather than an
  external LLM call.

However, several documents and code labels still describe Replicate as the
default/current portrait provider, reference a deleted `.js` function, or omit
Google Gemini from public privacy text. Production deploy titles indicate
Gemini activation, but titles are not sufficient evidence of the complete
runtime data flow or vendor terms.

Required resolution:

1. verify active provider preference and credentials without exposing secrets;
2. run controlled end-to-end provenance checks for each enabled path;
3. map exact fields, storage, logs, retention, model/provider reuse, regions,
   deletion, and fallback behavior;
4. update code labels, deployment docs, AI inventory, privacy/trust copy, and
   vendor register together;
5. obtain professional privacy/contract review before treating the public
   description as complete.

No agent may “fix” the privacy policy by guessing which environment variables
are present.

The read-only A-010 audit makes these contradictions repeatable and
machine-readable. A non-ready result is expected until GDH-006 verifies the
runtime and D-013 completes coordinated review; it is a control signal, not a
license to edit public policy automatically.
