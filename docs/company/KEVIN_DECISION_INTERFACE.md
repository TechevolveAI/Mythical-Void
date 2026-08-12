# Mythical Kevin Decision Interface

**Status:** Internal review foundation  
**Date:** 11 August 2026  
**Control:** A-025 decision-queue assurance

## 1. Purpose

Agents should absorb operational volume and bring Kevin only material choices,
approvals, and exceptions. The authoritative queue is
[`operations/decision-queue.json`](operations/decision-queue.json), capped at
five active packets.

The queue is not an approval system. It helps Kevin decide; it cannot prove his
identity, authorize an executor, or cause an action. A decision response must be
recorded in the Decision Register, and any external action still needs the
specific protected A-011 approval boundary and its domain controls.

## 2. Queue rules

- The only critical open risk is always represented first.
- No more than five active routine packets are shown.
- Duplicate decisions and priorities are prohibited.
- Every packet links a registered decision, objective action, risks, workflows,
  and evidence.
- Every packet gives one explicit recommendation, at least one alternative,
  the deferral risk, scope/cost boundary, review/expiry condition, and reversal
  path.
- Sensitive financial values, raw customer content, credentials, and restricted
  case material never appear in the queue.
- `decisionIsAuthorization`, `externalActionAuthorized`, and
  `mayExecuteOnResponse` remain false.
- A conversation may communicate intent but is not trusted execution
  authorization.

## 3. Current priority

The five current packets are:

1. safeguarding ownership and coverage;
2. finance ownership and restricted truth source;
3. the first internal autonomous-company operating cell;
4. coordinated RM-001 preview/release ownership;
5. the future trusted external-action approval boundary.

Lower-priority proposed decisions remain in the Decision Register and objective
queue. They have not disappeared; they are suppressed from the active digest
until capacity opens or their materiality rises.

## 4. Response and record boundary

A usable response identifies the decision ID, selected option or explicit
alternative, rationale, owner, reviewers, conditions, and review date. An agent
may draft the Decision Register update, but Kevin or the named decision owner
must confirm it.

After a decision is recorded:

1. update the linked objective action and risk owner/state;
2. generate any required scoped approval request separately;
3. do not execute merely because a decision is approved;
4. remove or replace the packet only after reconciliation confirms that the
   register and queue agree;
5. retain the decision evidence and supersession history.

## 5. Delivery

No authenticated automatic delivery route is configured. A-002 and A-012 can
render the queue during manual internal runs. Automated delivery, reminders,
and escalation require the protected operating cell, named owner/backup,
recipient verification, output minimization, deduplication, retry limits, and a
tested stop path.

