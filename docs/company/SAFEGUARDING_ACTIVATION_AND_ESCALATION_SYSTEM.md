# Safeguarding Activation and Escalation System

**Status:** A-039 activation contract ready; human coverage, protected routes,
professional review, exercises, and every external authority remain gated

## Outcome

A-039 converts R-001 from a general warning into a deterministic activation
boundary. It defines the smallest human and technical evidence set Mythical
must have before it promotes free-text intake or connects support, research,
community, review, or social-message automation.

It does not connect an inbox, configure an urgent route, read a case, deliver
an alert, classify a live message, draft or send a response, recruit anyone,
or authorize an external action.

## Current evidence and its limit

A-004 correctly routes all 17 synthetic cases, including all 12 restricted
cases and all Q0 cases, with no send/tool action or prohibited information
request. That is useful regression evidence, not operating proof. The fixture
is small, synthetic, and not sufficient evidence for open-world or
multilingual safety.

The only critical company risk therefore remains open: there is no confirmed
primary, backup, urgent recipient, protected route, geographic boundary,
coverage window, restricted incident system, professional policy review, or
operational exercise.

## Human cell

The minimum safeguarding cell has three explicit responsibilities:

1. a primary accountable person who accepts the role;
2. a backup accountable person who can take over; and
3. an urgent exception recipient, with a separately recoverable protected
   route.

The same person may not be silently copied into all responsibilities. Kevin
records the proposed operating decision in D-012; the named people must accept
their roles and their competence or training must be reviewed. The contract
stores role/person references only. It must not contain phone numbers, route
addresses, credentials, restricted messages, or case content.

## Fail-closed routing

- Q0 always goes to a named human through a protected minimum-detail alert.
- Q1 goes to a named human or the approved specialist path.
- Uncertain cases route upward.
- An agent never makes a mandatory-reporting, legal, law-enforcement, or
  emergency-services decision.
- No substantive restricted response is automated.
- Message bodies and attachments do not enter alert payloads or the shared
  repository.
- If coverage, routes, restricted records, or policy are unavailable, pause
  the affected intake rather than downgrade the case.

## Required proof before a pilot

All sixteen `SG-G*` gates and all ten `SGX-*` exercises in
`automation/safeguarding-activation.json` must pass. They cover accountable
coverage, jurisdictions, response targets, primary/backup route delivery,
route failure, restricted records, payload minimization, professional review,
multilingual ambiguity, malicious input, access revocation, kill, retention,
recovery, and independent review.

Even then, activation requires a separate digest-bound approval for one exact
label-and-alert pilot. That approval must expire automatically and must not
authorize substantive replies, intake promotion, research recruitment, or
broader inbox/community access.

## Kevin input brief

Kevin can provide SGI-001 through SGI-005 without credentials or case data:

1. primary accountable person or role reference and role acceptance;
2. backup accountable person or role reference and role acceptance;
3. urgent route type, protected reference, recipient, and recovery owner—but
   not the route value;
4. initial geographic scope and jurisdictions; and
5. coverage timezone/days/hours, out-of-hours approach, and proposed Q0/Q1
   targets.

Providing these inputs records the decision boundary only. It does not grant
access or authorize configuration, alert delivery, contact, intake promotion,
or execution.

## Commands

```bash
node scripts/company/validate-safeguarding-activation.cjs
node scripts/company/test-safeguarding-activation.cjs
```
