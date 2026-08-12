# Mythical Agent and Automation Architecture

**Status:** Foundation architecture  
**Date:** 11 August 2026  
**Principle:** many narrow accountable workflows, not one all-powerful company
agent

## 1. Target operating model

Mythical's company system should behave like an event-driven operating layer:

```text
Sources              Control plane                 Outcomes
───────              ─────────────                 ────────
Website health ─┐    policy + identity ───────┐    alerts
Search data ────┤    workflow registry        │    internal briefs
Research ───────┤ -> event/queue -> agents -> │ -> approved content
Support ────────┤    evidence + decisions     │    routed cases
Social/press ───┤    evaluations              │    experiments
Partners ───────┤    audit + cost              │    product handoffs
Operations ─────┘    approval + kill switch ──┘    external actions
```

Each workflow is independently permissioned, evaluated, budgeted, observed,
and stoppable. Agents share approved facts through the control plane, not
through unrestricted access to every system.

## 2. System roles

| Role | Responsibility | May not do |
| --- | --- | --- |
| Sensor | Read an approved source and normalize new signals | Decide, publish, or enrich people |
| Classifier | Apply controlled taxonomy, confidence, and routing | Treat a label as verified fact |
| Synthesizer | Cluster accepted evidence and produce a sourced brief | Read restricted raw data by default |
| Planner | Propose actions, experiments, owners, and stop conditions | Commit spend or external action |
| Executor | Perform one bounded approved workflow | Expand its own permissions or scope |
| Evaluator | Test output against factual, brand, safety, and task criteria | Modify the artifact it evaluates |
| Governor | Enforce permissions, approvals, budgets, and kill switches | Waive policy without named human authority |
| Archivist | Maintain decisions, evidence pointers, versions, and retention | Preserve data beyond its approved purpose |

The same model invocation must not both produce and approve a consequential
external action. Evaluation and governance remain separate boundaries even if
they use the same underlying model family.

## 3. Data zones

### Z0 Public

Public website, public posts, public reviews, platform documentation, and
approved public product facts. A0/A1 agents may read.

### Z1 Internal

Strategy, drafts, aggregate metrics, experiment plans, de-identified evidence,
and operating reports. Approved company agents may read only what their
workflow needs.

### Z2 Confidential

Unreleased plans, commercial discussions, financial summaries, vendor terms,
security architecture, and identifiable adult business contacts. Named
workflows and service identities only.

### Z3 Restricted

Raw customer/support content, child or guardian contact data, safeguarding,
legal requests, security incidents, credentials, production databases,
contracts, and payment systems. Human-first; agents denied unless a separately
approved restricted workflow requires bounded access.

### Z4 Prohibited from agent context

Passwords, recovery codes, private cryptographic keys, complete payment-card
data, unnecessary child identity, or data collected without an approved
purpose. These must not enter prompts, traces, evaluation sets, or registers.

## 4. Workflow contract

Every workflow has a versioned definition:

```yaml
id: A-000
version: 1
purpose: one testable business purpose
owner: named accountable person
autonomy: A0
trigger: schedule | event | manual
inputs:
  - source, zone, schema, freshness
outputs:
  - destination, schema, audience
permissions:
  read: []
  write: []
prohibitions: []
approval:
  required: true
  role: Kevin
evaluations:
  - factual_grounding
  - privacy
limits:
  runs_per_day: 1
  spend_per_run: 0
failure:
  retry: bounded
  dead_letter: true
  alert: named route
rollback: documented operation
kill_switch: feature flag or credential revocation
retention: run metadata and output periods
```

The registered version, not an agent's interpretation of a natural-language
request, determines what tools and actions are allowed.

## 5. Execution lifecycle

1. **Trigger:** accept a scheduled, event, or human request with a unique run
   ID and workflow version.
2. **Authorize:** verify identity, scope, approval state, budget, and data zone.
3. **Acquire:** fetch only allowlisted fields/sources and record provenance.
4. **Minimize:** remove unnecessary data before any model context is created.
5. **Act:** run deterministic processing first, model reasoning only where it
   adds value, and tools only under scoped permissions.
6. **Evaluate:** run schema, policy, factual, brand, and task-specific checks.
7. **Approve:** pause for human approval at the registered boundary.
8. **Execute externally:** use an idempotency key and record the exact action.
9. **Observe:** capture status, latency, cost, exceptions, and outcome signals.
10. **Close:** update the relevant register, delete expired temporary data, and
    route failures to a dead-letter queue.

## 6. Approval design

An approval request must show Kevin exactly what will happen:

- workflow and version;
- destination/account/audience;
- complete final artifact or action preview;
- sources and unresolved uncertainty;
- expected outcome and measurement;
- cost/spend and rate limit;
- safety, privacy, legal, and brand checks;
- expiry time and rollback path.

Approval is specific and expiring. “Approve social automation” is invalid;
“approve these three posts to these two accounts during this window” is valid.
Changing content, audience, destination, spend, or time window invalidates the
approval.

The A-011 repository pilot validates this scope and content-addresses the final
artifact. It is deliberately not an authorization system: repository files do
not prove approver identity. See
[Approval and External Action Control](APPROVAL_AND_EXTERNAL_ACTION_CONTROL.md).

## 7. Observability

Store operational metadata for every run:

- run ID, workflow/version, trigger, start/end, and status;
- service identity and approval reference;
- source identifiers and freshness without copying restricted content;
- tool/model versions and prompt/policy version;
- token/API/paid-media cost;
- evaluation results and overrides;
- exact external action IDs;
- retries, exceptions, dead-letter state, and rollback;
- outcome link and register updates.

Alert on exceptions rather than every successful run. Initial severities:

- **C0:** immediate safety, active security, unlawful/unauthorized external
  action—stop affected workflows and alert human owner;
- **C1:** wrong audience/destination, material factual/brand error, budget
  breach—stop workflow and require review;
- **C2:** repeated failure, stale source, degraded quality—pause promotion and
  route to maintenance;
- **C3:** transient bounded failure—retry under policy, then dead-letter;
- **C4:** informational trend—include in weekly review.

## 8. Evaluation stack

### Deterministic gates

- schema and allowed-field validation;
- source/destination allowlists;
- secret and personal-data detection;
- link/canonical/asset validation;
- budget, rate, time-window, and duplication limits;
- approval token match;
- prohibited claim and unapproved campaign checks.

### Model-based evaluations

- factual grounding against approved source excerpts;
- brand voice and audience appropriateness;
- privacy/safety ambiguity;
- whether uncertainty is disclosed;
- whether the output answers the intended task.

### Human sampling

Even A2 workflows receive random and risk-weighted human review. Sampling rises
after any failure, source change, model/tool upgrade, new audience, or campaign.

An evaluation set includes normal, ambiguous, adversarial, stale, conflicting,
multilingual, personal-data, prompt-injection, and safety-escalation examples.

## 9. Autonomy promotion

```text
A0 observe
  ↓ accurate sourced reports
A1 prepare
  ↓ evaluated drafts + zero prohibited actions
A2 bounded execution
  ↓ sustained quality, rollback drills, low exception rate
A3 approval-gated external action (may remain here permanently)
```

Promotion requires an approved register change. Demotion is automatic after a
C0/C1 incident, evaluation regression, permission drift, missing owner, expired
policy, or unexercised kill switch.

A-036 binds every registered workflow version to a separate evaluator, explicit
input boundary, case count, result, and promotion record. Repository-local tests
remain pre-production evidence: four accurate independently reviewed cycles in
the protected runtime are required before any candidate can become promotion
eligible, and implementation, policy, model, tool, data, identity, permission,
cost, or incident changes force re-evaluation.

Public brand voice, outreach, spend, child-facing communication, support, legal,
and security workflows may remain approval-gated regardless of accuracy.

## 10. Integration sequence

| Order | Integration | First scope | Write access condition |
| ---: | --- | --- | --- |
| 1 | Public web | Health, metadata, discovery, content drift | None required |
| 2 | Search Console | Read query/index/coverage aggregates | Sitemap submit after approval |
| 3 | Netlify | Read deploy/health/function data | Coordinated release workflow |
| 4 | GitHub | Read company/product changes and create draft handoffs | Existing repo policy and review |
| 5 | Business inboxes | Selected de-identified evaluation set, then labels/drafts | No autonomous send initially |
| 6 | Social accounts | Inventory and read analytics | Per-campaign approval and scoped publisher |
| 7 | Research/CRM | Schema and consented adult/guardian contacts | Approved purpose/retention/rights flow |
| 8 | Calendar/content scheduler | Prepare slots and approval queue | Approved bounded scheduling |
| 9 | Finance/contracts/payments | Aggregate read reports only | Per-action restricted approval; agents do not sign |

Avoid one connector identity with broad access. Use separate credentials for
read, draft, publish, spend, and administration wherever the platform allows.

## 11. Initial automation portfolio

### A-001 Public footprint auditor — active A0

- Fetch canonical pages and discovery files.
- Validate status, content type, metadata, and obvious SPA fallbacks.
- Output findings to stdout/monitoring; no external writes.
- Alert only when severity changes or a major issue persists.

### A-002 Weekly company review — A1 next

- Read approved register and aggregate sources.
- Produce the standard brief with gaps explicitly marked `Not instrumented`.
- Never create metrics, evidence, or decisions that are absent.

### A-005 Customer evidence synthesis — A1 after pilot data

- Accept only human-approved, de-identified evidence records.
- Produce themes with evidence IDs, alternatives, bias, and confidence.
- Human verifies every theme before a handoff.

### Content system — A1 after messaging approval

- Start from approved product proof and claims library.
- Draft channel-native assets and internal citations.
- Evaluate factuality, brand, safety, accessibility, and duplication.
- Kevin approves publication packages.

### Support triage — A0 evaluation only

- Do not connect live inboxes until the safeguarding runbook has named owners,
  SLAs, evaluation results, and a kill switch.

## 12. Build roadmap

### Foundation

- automation registry and workflow schema;
- source/claim library and data-zone map;
- run IDs, audit records, cost fields, and exception taxonomy;
- public-footprint auditor;
- weekly review compiler.

### Learning engine

- research evidence intake and de-identification workflow;
- theme synthesis evaluation;
- Game Development handoff queue;
- identifier-free measurement only if approved.

### Growth engine

- content proof library, draft generation, evaluations, approval queue;
- search, creator, press, and partner monitoring;
- campaign link registry and bounded reporting.

### Operations engine

- support draft mode;
- vendor/access/spend monitoring;
- renewal, risk, and policy review reminders;
- incident and rollback exercises.

The architecture stays tool-agnostic. Mythical owns its schemas, evidence,
decisions, and workflow contracts so a vendor or model can be replaced without
losing the company memory.
