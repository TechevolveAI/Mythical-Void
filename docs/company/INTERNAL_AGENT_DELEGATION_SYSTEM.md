# Mythical Internal Agent Delegation System

**Status:** Fail-closed planning foundation  
**Date:** 11 August 2026  
**Control:** A-024 internal delegation planning assurance

## 1. Purpose

A-024 is the bridge from the governed objective queue to the autonomous-company
roster. It produces content-addressed internal work-order drafts only when an
action is explicitly marked `agent_internal` and `ready`.

It does not schedule, invoke, message, publish, deploy, collect, contact, spend,
or mutate external state. A work order is not an approval token and its presence
does not authorize execution.

## 2. Source hierarchy

The planner reads three authoritative sources:

1. [`operations/objectives.json`](operations/objectives.json) determines
   whether work is ready and why it exists.
2. [`automation/registry.json`](automation/registry.json) defines the bounded
   workflow, autonomy, data zones, implementation, and owner.
3. [`automation/agent-roster.json`](automation/agent-roster.json) assigns one
   primary agent and the independent assurance boundary.

Natural-language conversation, an agent suggestion, a generated approval
string, or an unregistered task cannot promote work into this queue.

## 3. Eligibility

An action can become a draft work order only when all of these are true:

- its objective and action are registered and uniquely identified;
- mode is `agent_internal`;
- status is `ready`—not waiting, gated, completed, or inferred ready;
- `externalActionAllowed` is exactly false;
- it references at least one registered automation;
- all referenced workflows have exactly one primary agent;
- the referenced workflows resolve to one primary agent, or AG-001 first
  decomposes the work into narrower registered actions;
- the primary and evaluator agents differ;
- autonomy is no higher than A1 and spend is zero;
- no credential, external executor, or restricted-data access is implied.

The current objective queue contains zero ready internal actions, so the live
A-024 plan correctly produces zero work orders.

A-030 now exercises this planner inside a five-step local operating rehearsal;
see [`INTERNAL_AGENT_SHADOW_RUNTIME.md`](INTERNAL_AGENT_SHADOW_RUNTIME.md). The
rehearsal proves command composition and no-write behavior, but it does not
dispatch a work order or establish independent runtime identities.

## 4. Work-order boundary

Each draft follows
[`automation/delegation-work-order.schema.json`](automation/delegation-work-order.schema.json)
and records:

- objective, action, workflow, primary agent, and evaluator IDs;
- purpose, priority, maximum autonomy, and data zones;
- all source references;
- zero external action and zero spend;
- prohibitions on scope, priority, permissions, credentials, self-approval, and
  evidence-free closure;
- completion evidence required for evaluation;
- a SHA-256 content digest.

Any change to its action, workflow, agent, scope, or constraints creates a new
digest and work-order ID.

## 5. Decomposition

If a ready action resolves to more than one primary agent, A-024 does not choose
one arbitrarily. It returns a blocked item for AG-001 to decompose into smaller
actions with one accountable primary each. Cross-agent collaboration is then a
set of explicit work orders and evidence-linked dependencies, not an invisible
group chat.

## 6. Evaluation and closure

AG-010 is the default evaluator unless AG-010 is the primary agent, in which
case AG-001 provides the independent review boundary. Evaluation must verify:

1. the registered action was answered without scope expansion;
2. only allowlisted sources and data zones were used;
3. deterministic workflow checks passed;
4. claims, privacy, safety, security, cost, and policy gates applicable to the
   work passed;
5. the artifact and provenance are linked;
6. unresolved uncertainty and exceptions remain visible;
7. no prohibited or external action occurred.

Only the objective register can record completion, and it requires explicit
completion evidence. A work-order generator cannot close its own action.

## 7. Promotion path

The initial A-024 state is plan-only. Automated internal dispatch remains false
until D-017 and OA-036/OA-037 establish confirmed ownership, protected minimal
memory and run history, authenticated alert delivery, isolated service
identities, bounded scheduling, retention, backup/restore, independent
evaluation, and tested kill switches.

After that, four shadow cycles compare the proposed delegation against human
routing. Only accurate, complete, low-noise, reversible internal work may be
promoted. External action remains governed separately by A-011 and its domain
controls.

The current A-030 single-process rehearsal is deliberately ineligible for
those four cycles.
