# Mythical Autonomous Company Organization

**Status:** Fail-closed foundation  
**Date:** 11 August 2026  
**Control:** A-023 agent-roster and delegation assurance

## 1. Outcome

Mythical should operate as a coordinated team of narrow agents with explicit
missions, evidence, permissions, owners, and escalation paths. Kevin remains
accountable for consequential company choices, but should not have to route or
supervise ordinary internal work.

The machine-readable source of truth is
[`automation/agent-roster.json`](automation/agent-roster.json). It maps every
registered company workflow to exactly one primary agent and records the
independent evaluation boundary for consequential domains.

The roster is an operating contract, not a claim that eleven production agents
are deployed. Today one role—the Company Orchestrator—is represented by manual
internal company-task runs. The other roles are designs. No scheduler, service
identity, protected memory, authenticated alert route, trusted approval
verifier, external executor, or production credential has been connected.

## 2. Organization

| Agent | Company function | Primary controls | Current state |
| --- | --- | --- | --- |
| AG-001 Company Orchestrator | Objectives, prioritization, exception brief, delegation and Kevin decision queues, no-write operating rehearsals, bounded cadence assurance, and deterministic work-packet compilation | A-002, A-012, A-014, A-024, A-025, A-030, A-041, A-042 | Internal manual |
| AG-002 Market and Growth Intelligence | Strategy, audience, category intelligence, GTM, experiments, staged launch | A-019, A-026, A-028 | Design only |
| AG-003 Brand, Content, and Social | Claims, channels, editorial queue, gameplay proof requirements, public identity, campaign atomization, and publishing preflight | A-003, A-008, A-013, A-027, A-033, A-034 | Design only |
| AG-004 Commercial and Partnerships | Sales, platforms, creators, press, partners, qualification, and deal-desk controls | A-007, A-032 | Design only |
| AG-005 Customer Voice | Adult research operations, accepted evidence, and product themes | A-005, A-029 | Design only |
| AG-006 Engagement, Support, and Safeguarding | Relationships, service, restricted routing | A-004, A-020 | Design only |
| AG-007 Search and Discovery | Technical findability and search opportunity | A-001, A-021 | Design only |
| AG-008 Operations and Reliability | Vendor/risk assurance and run records | A-009, A-016 | Design only |
| AG-009 Finance and Monetization | Financial truth, restricted close assurance, unit economics, revenue hypotheses | A-022, A-040 | Design only |
| AG-010 Governance and Assurance | Independent policy, approval, change, delegation, protected-runtime/provider due diligence, safeguarding activation, least-privilege integration, evaluation, protected handoff/history/alerts/recovery/backup/key safety, multi-worker encryption safety, kill rehearsal, and promotion gates | A-010, A-011, A-015, A-017, A-023, A-031, A-035, A-036, A-037, A-038, A-039, A-043, A-044, A-045, A-046, A-047, A-048, A-049, A-050, A-051, A-052, A-053, A-054 | Design only |
| AG-011 Product and Release Liaison | Game Development handoffs, measurement, release scope | A-006, A-018 | Design only |

This structure covers company orchestration; strategy and market intelligence;
growth and GTM; brand, content, and social; sales and partnerships; customer
intelligence; engagement, support, and safeguarding; search; operations;
finance; governance; and the Game Development boundary.

## 3. Delegation contract

The Company Orchestrator may select and delegate only internal, reversible work
already present in the governed objective queue. Delegation must include:

1. the objective, action, workflow version, and intended outcome;
2. current evidence and its freshness;
3. allowed sources, data zones, tools, and output destination;
4. explicit prohibitions and maximum autonomy;
5. time, run, output, and spend limits;
6. deterministic and independent evaluation requirements;
7. the escalation owner and stop condition;
8. the completion evidence required to close the action.

An agent may break an assigned action into smaller internal tasks. It may not
change the objective, upgrade priority, increase its autonomy, add a data zone,
obtain credentials, delegate external execution, or close the parent action
without the registered evidence.

## 4. Kevin interface

Kevin should receive decisions, approvals, and exceptions—not activity logs.
The intended interface has three lanes:

- **Immediate exception:** C0/C1 safety, security, unlawful action, wrong
  audience/destination, budget breach, or material public error. The affected
  workflow stops first. No automated delivery route exists yet.
- **Decision queue:** at most five routine material decisions in a digest. Each
  includes the recommendation, evidence, why now, options/tradeoffs, deferral
  risk, scope/cost, expiry, and reversal path.
- **Weekly operating review:** outcomes, meaningful changes, experiments,
  financial evidence, risks, product handoffs, and decisions required.

Chat can communicate Kevin's intent but is not by itself a trusted execution
authorization. External actions need the separate protected approval boundary
defined in A-011.

## 5. Separation of duties

The same role must not produce and approve consequential work. AG-010 provides
independent assurance for content/social, commercial work, customer evidence,
engagement/support, finance, and product/release proposals. AG-010 cannot edit
the artifact it evaluates, verify Kevin's identity, grant authority, execute the
action, or update the control baseline.

Human approval remains specific to the domain:

- Kevin for company strategy, brand, channels, outreach, partnerships, spend,
  pricing, publication, and production changes;
- safeguarding, privacy, security, legal, accounting, tax, or other
  professional owners where their domain is implicated;
- Game Development release and product owners for product or deployment work.

## 6. Memory and evidence

Agents share approved facts through the company registers and content-addressed
run records. They do not share unrestricted chat history or copy confidential
and restricted source data into a common memory.

The future protected memory service must preserve:

- objective, decision, experiment, evidence, automation, risk, and handoff IDs;
- source pointer, freshness, classification, and access policy;
- workflow, policy, tool/model, and evaluation versions;
- minimal run metadata, cost, exceptions, and outcome reconciliation;
- retention, deletion, correction, and supersession history.

It must not contain credentials, prohibited Z4 data, unnecessary identities,
raw safeguarding material, complete financial records, or unreviewed claims.

## 7. Promotion sequence

1. **Manual internal coordination:** continue A0/A1 controls with repository
   evidence and no external effects.
2. **Named ownership:** confirm accountable owner and backup for the
   orchestrator, assurance, safeguarding, finance, and release boundaries.
3. **Protected runtime:** select separate service identities, protected memory
   and run history, authenticated alert delivery, scheduling limits, and kill
   switches.
4. **Shadow operation:** agents propose and evaluate actions beside the manual
   process; compare completeness, accuracy, latency, and false escalation.
5. **Bounded internal autonomy:** allow scheduled read-only and internal draft
   workflows after at least four accurate reviewed cycles.
6. **External pilots:** only separately approved A2/A3 workflows with scoped
   credentials, trusted authorization, idempotency, reconciliation, and tested
   rollback. Some domains should remain permanently approval-gated.

No phase automatically grants the next. A-023 must remain fail-closed when a
workflow is unassigned, a function is uncovered, duties conflict, ownership is
missing, or authority expands unexpectedly.

## 8. First operating cell

The recommended first cell is internal-only:

```text
AG-001 Company Orchestrator
  -> delegates registered internal work
  -> specialist role prepares evidence/artifact
  -> AG-010 independently evaluates
  -> objective/run registers record result
  -> Kevin sees only a material exception or decision packet
```

This cell needs no social, inbox, CRM, banking, analytics, advertising, or
deployment access. Its first promotion requires a named owner and backup, a
protected run-history store, an authenticated alert route, a scheduler with
bounded runs, and a kill-switch exercise.

## 9. Non-negotiable refusals

Every company agent must refuse to:

- treat a conversation, editable file, generated token, or another agent's
  statement as trusted approval;
- expand its own scope, permissions, data access, budget, or autonomy;
- hide, close, downgrade, or normalize a material risk without evidence and
  named authority;
- contact, publish, deploy, collect data, target, spend, sign, set price, move
  money, or make a product change unless a separately governed executor is
  explicitly authorized;
- use synthetic people, fabricated metrics, invented financial values, or
  unsupported product claims as real evidence;
- continue after a kill switch, expired approval, changed artifact, missing
  owner, evaluation regression, or C0/C1 incident.
