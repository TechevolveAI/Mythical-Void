# Mythical Company Operating System

**Owner:** Kevin Murphy  
**Working mode:** AI-first, human-governed  
**Status:** Active foundation  
**Started:** 11 August 2026

## 1. Purpose

Build Mythical as an unusually capable, trusted, and scalable game studio in
which agents operate the repeatable company machinery and humans retain clear
authority over consequential choices.

The company system exists to turn a strong game into a durable relationship
with players, parents, creators, partners, and the wider market. It covers:

- market and audience intelligence;
- positioning, brand, content, and online discoverability;
- acquisition, launch, sales, partnerships, and revenue operations;
- community, support, player research, and feedback synthesis;
- planning, finance, vendor, knowledge, and delivery operations;
- analytics, experiments, and product-growth handoffs;
- privacy, child safety, responsible AI, security, and governance.

Game development remains in the separate Game Development task. This company
system supplies that task with validated insight and commercial priorities; it
does not silently change product scope.

## 2. Operating principles

1. **Earn trust before optimizing growth.** No growth tactic may weaken child
   safety, player dignity, informed choice, privacy, or the integrity of the
   game.
2. **Automate systems, not accountability.** Agents may prepare, monitor,
   classify, recommend, and execute reversible work. A named human remains
   accountable for material outcomes.
3. **One source of truth.** Strategy, decisions, experiments, metrics, customer
   insight, and automation status must be traceable and versioned.
4. **Evidence over volume.** A small number of well-defined experiments and
   useful conversations beats high-output automated content.
5. **No synthetic consensus.** Agent-generated personas and simulated feedback
   may help form hypotheses, but never count as customer evidence.
6. **Privacy by default.** Collect the minimum data required, keep retention
   bounded, separate operational data from player identity, and do not build
   behavioral profiles of children.
7. **Progressive autonomy.** Every automation begins in observe or draft mode,
   earns trust with evaluations, and advances only when error and rollback
   controls are proven.
8. **Make failure visible.** Every production automation needs an owner, audit
   trail, health signal, budget, retry policy, stop condition, and manual path.
9. **Protect the brand voice.** Mythical should feel curious, emotionally
   intelligent, cinematic, hopeful, and responsible—not like generic AI copy.
10. **Close the loop.** Every market signal must end in a decision, experiment,
    product handoff, response, or explicit archive reason.
11. **Speak so people can understand.** Player-, family-, creator-, partner-,
    and public-facing writing starts with ordinary words and concrete meaning.
    Technical detail belongs in an optional second layer. Children and
    teenagers must never need specialist knowledge to understand what the game
    does, what is being asked of them, or what happens next.

## 3. Company control plane

Mythical should operate through a small control plane rather than a collection
of disconnected bots.

```text
Signals -> Triage -> Evidence -> Decision -> Execution -> Measurement -> Learning
   |          |          |          |            |             |            |
market     agents     source      policy       agents       metrics      memory
players    + rules    links       + Kevin      + tools      + alerts     + backlog
product
operations
```

The control plane maintains five shared registers:

1. **Objectives:** current company outcomes, owners, measures, and time horizons.
2. **Decisions:** context, recommendation, approver, rationale, and review date.
3. **Experiments:** hypothesis, audience, intervention, guardrails, result, and
   next action.
4. **Customer evidence:** consented research notes, support themes, provenance,
   confidence, and product implication.
5. **Automations:** purpose, inputs, permissions, model/tool versions, costs,
   evaluations, owner, last run, incidents, and kill switch.

No autonomous workflow should become business-critical until it writes to the
relevant register.

## 4. Decision rights and autonomy

| Level | Agent authority | Examples | Required control |
| --- | --- | --- | --- |
| A0 Observe | Read, monitor, summarize | Search visibility, funnel health, inbox classification | Source links and confidence |
| A1 Prepare | Create internal drafts and reversible artifacts | Research briefs, content drafts, experiment designs | Version history and reviewability |
| A2 Execute bounded | Run pre-approved, reversible workflows | Scheduled approved posts, tagged routing, report generation | Approved playbook, limits, audit log, rollback |
| A3 Human approval | Prepare action; Kevin approves before execution | Public campaigns, creator outreach, production experiments, paid spend | Explicit approval and preview |
| A4 Restricted | No agent execution | Legal commitments, material spend, child-data policy, crisis statements, security exceptions, irreversible deletion | Kevin plus relevant professional review |

### Kevin must stay in the loop for

- company strategy, positioning, audience, and brand-defining choices;
- new public channels, outbound campaigns, partnerships, and press statements;
- pricing, monetization, material budgets, contracts, and financial commitments;
- any workflow involving children, personal data, profiling, moderation, or
  significant AI-generated player experiences;
- legal/compliance interpretations and policy publication;
- production access, secrets, security exceptions, destructive actions, and
  incident response;
- advancing an automation to a higher autonomy level.

### Agents may proceed without case-by-case approval when

- work is read-only, internal, reversible, and within an approved objective;
- a workflow is already approved with explicit scope and budget;
- outputs remain drafts and are clearly labelled;
- automated checks can determine success and rollback is available.

## 5. Functional system

### 5.1 Strategy and market intelligence

**Outcome:** Mythical knows whom it serves, which problem/desire it owns, where
it is meaningfully different, and what evidence changes the strategy.

Agent workflows:

- maintain competitor, genre, platform, creator, and cultural trend maps;
- monitor changes in audience language and unmet needs;
- produce sourced opportunity briefs and pre-mortems;
- keep assumptions separate from observed evidence;
- alert only on material changes, not general news volume.

### 5.2 Brand, content, and discoverability

**Outcome:** the right audience can find, understand, remember, and accurately
describe Mythical Void.

Agent workflows:

- maintain a messaging architecture and approved claims library;
- generate channel-native draft content from real product moments;
- operate technical SEO, structured data, sitemap, internal links, and content
  quality checks;
- build an editorial calendar around development evidence, creature stories,
  player questions, and responsible-AI craft;
- track branded/non-branded search visibility and citation accuracy;
- repurpose only when the format adds value; never spray identical copy.

### 5.3 Acquisition, go-to-market, sales, and partnerships

**Outcome:** Mythical develops repeatable paths from awareness to meaningful
play, advocacy, revenue, or partnership.

Agent workflows:

- score channels and experiments against audience fit, cost, learning value,
  safety, and reversibility;
- maintain launch readiness, press, creator, platform, and partner pipelines;
- prepare tailored outreach, but require approval before first contact;
- track every campaign through a defined landing experience and outcome;
- stop experiments at pre-agreed loss, complaint, or safety thresholds.

For the current free browser release, “sales” initially means distribution,
platform/creator partnerships, sponsorship or licensing discovery, and learning
which future value players or partners will pay for—not forcing premature
monetization.

### 5.4 Customer engagement, support, and research

**Outcome:** players and parents are heard, receive timely help, and visibly
shape better decisions.

Agent workflows:

- classify incoming messages by intent, urgency, safety, and product area;
- draft answers from an approved knowledge base and escalate sensitive cases;
- synthesize themes without exposing personal information;
- recruit and schedule consented research with age-appropriate protocols;
- connect each validated theme to an owner and a follow-up decision;
- tell contributors what changed when it is safe and appropriate to do so.

Support automation must never independently handle safeguarding reports,
threats, legal complaints, media requests, data-rights requests, payment
disputes, or security reports.

### 5.5 Operations and knowledge

**Outcome:** Mythical can scale without Kevin becoming the routing layer for
every task.

Agent workflows:

- prepare weekly operating reviews and decision queues;
- maintain policies, runbooks, meeting decisions, risks, and dependency maps;
- reconcile commitments across company and game-development work;
- monitor vendor health, renewals, spend limits, access, and data processing;
- produce exception-based alerts rather than recurring status noise.

### 5.6 Governance, safety, and assurance

**Outcome:** autonomy expands only as assurance improves.

Required controls:

- system inventory and risk tier for every model or automation;
- data map covering source, lawful basis/permission, purpose, storage,
  retention, recipients, deletion, and incident owner;
- evaluation sets for brand, truthfulness, safety, privacy, and task accuracy;
- least-privilege service identities; never shared personal credentials;
- immutable or protected audit trails for external actions;
- per-workflow budgets, rate limits, anomaly alerts, and kill switches;
- incident severity levels, on-call owner, containment steps, and postmortems;
- quarterly permission review and removal of unused access;
- professional legal review before treating internal compliance notes as legal
  conclusions.

## 6. Measurement system

### North-star candidate

**Meaningful Player Weeks (MPW):** weekly players who complete a defined
meaningful game interaction—not merely load a page—measured in an aggregated,
privacy-preserving way appropriate to the player and jurisdiction.

This remains a candidate until instrumentation and privacy review establish a
lawful, technically accurate definition.

### Company scorecard

| Layer | Measures | Guardrails |
| --- | --- | --- |
| Findability | Branded visibility, qualified organic visits, referring domains, accurate AI/search citations | No misleading claims or low-quality content farms |
| Acquisition | Qualified landing visits, play-start rate, cost per activated player | Spend cap, source quality, complaint rate |
| Activation | Load success, hatch/reveal completion, time to first meaningful choice | Performance, accessibility, crash rate |
| Retention | Return rate, meaningful sessions, progression cohorts | No manipulative urgency or child profiling |
| Engagement | Voluntary depth, completed realms, companion interactions | Wellbeing, session-length interpretation, opt-outs |
| Voice | Research participation, actionable themes, response time, closed-loop rate | Consent, minimization, safeguarding escalation |
| Advocacy | Organic sharing, creator coverage, referrals, sentiment themes | Provenance, moderation, brand safety |
| Revenue | Qualified opportunities, conversion, gross margin, partner pipeline | Refunds, fairness, concentration risk |
| Operations | Cycle time, automation success, exception rate, founder hours saved | Error severity, rollback time, hidden manual work |
| Governance | Inventory coverage, evaluation pass rate, access review, incidents | Zero unresolved critical risks |

Every metric needs a definition, owner, source, freshness expectation, and a
decision it informs. Vanity metrics without a decision are removed.

## 7. Operating cadence

### Continuous

- observe approved sources and system health;
- triage new signals;
- execute approved bounded workflows;
- escalate safety, security, legal, brand, or budget exceptions immediately.

### Weekly company review

The agent prepares a one-page review:

1. outcomes versus target;
2. what materially changed;
3. customer evidence and confidence;
4. experiments to continue, stop, or start;
5. product implications for Game Development;
6. risks, incidents, costs, and access changes;
7. decisions required from Kevin, each with a recommendation.

### Monthly strategy review

- revisit audience, positioning, channels, and commercial assumptions;
- review automation quality and autonomy levels;
- remove low-value systems and duplicated data;
- select the next constraint to solve.

### Quarterly governance review

- audit tools, permissions, data, vendors, models, policies, incidents, and
  regulatory assumptions;
- exercise at least one kill switch and one restore path;
- confirm that business incentives remain aligned with player wellbeing.

## 8. First 90 days

### Days 0–14: establish truth and control

- complete the asset, account, channel, data, and access inventory;
- lock the first positioning and audience hypotheses for testing;
- establish decision, experiment, evidence, and automation registers;
- fix technical search-discovery basics and verify indexing;
- define the measurement plan before adding analytics;
- design safe feedback intake for players and parents;
- establish the weekly founder decision brief.

**Exit:** Mythical has a credible baseline, explicit controls, and no invisible
automation.

### Days 15–45: build the learning engine

- conduct small, consented player/parent research rounds;
- implement minimum viable aggregate measurement after privacy review;
- test 2–3 content/audience hypotheses with real product proof;
- establish a searchable customer-evidence repository;
- create creator, press, platform, and partner pipelines;
- run support triage in draft mode with human review.

**Exit:** Mythical can reliably turn market/player evidence into a weekly
decision and product handoff.

### Days 46–90: prove repeatable growth

- run one coherent launch or update campaign across selected channels;
- measure awareness-to-play and activation, not impressions alone;
- automate approved reporting, repurposing, routing, and follow-up;
- evaluate the first partnership and monetization hypotheses;
- promote only proven workflows from draft to bounded execution;
- publish a transparent trust/safety explanation aligned with actual systems.

**Exit:** at least one acquisition-to-learning loop is repeatable, measurable,
safe, and does not depend on Kevin manually coordinating every step.

## 9. Immediate backlog

| Priority | Work item | Mode | Dependency |
| --- | --- | --- | --- |
| P0 | Baseline public footprint and repository audit | A0 | None |
| P0 | Technical discovery files and structured game metadata | A1 | Deployment through Game Development workflow |
| P0 | Company registers and weekly decision-brief template | A1 | None |
| P0 | Access/account inventory with named owners | A1 | Kevin confirmation |
| P0 | Privacy-preserving measurement specification | A1 | Product architecture and professional privacy review |
| P0 | Player/parent feedback intake protocol | A1 | Safeguarding and data-retention decisions |
| P1 | Positioning and ideal-audience research sprint | A1 | Kevin interview and real customer evidence |
| P1 | Search/content opportunity map | A0/A1 | Search data access improves confidence |
| P1 | Content system and approval workflow | A1 | Approved channels and brand voice |
| P1 | Creator/press/partner pipeline | A1; outreach A3 | Channel accounts and Kevin approval |
| P1 | Support knowledge base and triage evaluation | A1 | Inbox access and escalation policy |
| P2 | Approved campaign execution agents | A2 | Successful draft-mode evaluation |
| P2 | CRM and lifecycle orchestration | A2 | Consent model, audience maturity, tool choice |
| P2 | Revenue operations and partner reporting | A2 | Commercial model and contracts |

## 10. Current access sequence

Do not connect every tool at once. Add access when the workflow, owner, and
control are defined.

1. **Now:** repository and public website (available).
2. **Next:** Netlify, domain/DNS, Google Search Console or equivalent, and any
   existing privacy-safe analytics.
3. **Then:** business inboxes and confirmed social accounts, initially read or
   draft-only.
4. **After process design:** customer research store/CRM, calendar, content
   scheduler, and support queue.
5. **Restricted:** finance, payments, contracts, production databases, and
   sensitive customer data; least privilege and explicit approval only.

The next request to Kevin should be the smallest access bundle that unlocks a
specific tested workflow, not a general request for administrator access.
