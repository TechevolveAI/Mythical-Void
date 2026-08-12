# Mythical’s answer helper

Status: ready to review with invented messages. It is not approved for real support.

The front-door assistant can now do two separate jobs:

1. sort a message to the right person; and
2. prepare a possible answer when the question is ordinary and the answer is already written in Mythical’s approved source material.

The second job is called “grounded” because the answer must come from a known Mythical source. If the answer is not in the source material, the helper stops and asks a person to handle it.

## Answers it can prepare in rehearsal

- whether an account is needed;
- how local saves work;
- the current price;
- which browser to use;
- family suitability;
- optional Cloud Save; and
- how a parent or guardian can send a creative idea.

Each possible answer names the source article used. The answer is still only a draft for a person to check.

## Cases it refuses

The helper stops for:

- safety or urgent concerns;
- privacy, payment, or legal matters;
- a possible message from a young person;
- personal details in the message;
- an attempt to bypass Mythical’s rules;
- a question with no known answer; and
- any message that is not clearly an invented, cleaned example during rehearsal.

It never copies the original message into its result, invents facts, contacts anyone, or sends anything.

## Evidence so far

There are eight source-linked answer records. All eight pass the plain-language check. Twelve invented examples were tested: six received candidate answers and six were refused. No raw message was kept and no reply was sent. The separate evaluator covers 38 cases and all passed.

## Before real support use

Kevin needs to name the support and knowledge owners, review the eight answers, and approve the exact wording. Safeguarding, privacy, accessibility, and keeping-and-deletion rules still need named owners and review. Connecting an inbox and sending a reply are separate decisions and remain off.

## Files

- Contract: `docs/company/automation/grounded-support-drafting.json`
- Contract shape: `docs/company/automation/grounded-support-drafting.schema.json`
- Drafting engine: `scripts/company/lib/grounded-support-draft.cjs`
- One-message rehearsal runner: `scripts/company/draft-support-reply.cjs`
- Readiness check: `scripts/company/validate-grounded-support-drafting.cjs`
- Independent examples and refusal tests: `scripts/company/test-grounded-support-drafting.cjs`
