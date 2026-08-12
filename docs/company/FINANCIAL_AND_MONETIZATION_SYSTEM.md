# Financial and Monetization System

**Status:** Foundation; no accounting, banking, billing, payment, invoice, or
spend executor connected  
**Date:** 11 August 2026

## 1. Objective

Give Mythical a reliable view of cash, commitments, cost drivers, runway,
product economics, and monetization choices without inventing numbers or
allowing agents to move money.

The machine-readable financial model is
[`finance/financial-model.json`](finance/financial-model.json). A-022 validates
that unknown actuals remain unknown, forecasts are not presented without a
verified base, future prices are not invented, and all spend/revenue actions
remain unauthorized.

A-040 adds the operating close boundary in
[`automation/financial-truth-close.json`](automation/financial-truth-close.json):
six restricted source classes, twelve baseline evidence classes, eighteen
activation gates, ten exercises, separated close roles, protected metadata
history, and four accurate reviewed closes. It stores no financial actuals and
authorizes no source access, calculation, publication, or execution.

This is an operating framework, not accounting, tax, legal, investment, or
financial advice. Professional review is required against Mythical's actual
entity, jurisdictions, accounts, contracts, and obligations.

## 2. Financial truth hierarchy

Use sources in this order:

1. reconciled bank, payment, payroll, tax, and accounting records;
2. approved contracts, purchase orders, invoices, and provider usage exports;
3. verified vendor price schedules tied to the active account, model, region,
   tax treatment, and date;
4. explicit planning assumptions with owner, source, sensitivity, and expiry;
5. hypotheses clearly separated from actuals.

Repository code, environment-variable names, provider documentation, or a
free-tier label do not prove actual spend. An empty register means unknown—not
zero.

Financial actuals and identifiable banking, tax, payroll, investor, or customer
records must live in a restricted system. The shared repository stores only
approved aggregate operating outputs and model definitions.

## 3. Minimum finance baseline

Before calculating runway:

- legal entity and reporting currency;
- unrestricted cash as of a reconciled date;
- committed liabilities and restricted funds;
- recurring fixed costs;
- trailing variable costs by verified driver;
- payroll/contractor obligations;
- tax/VAT and payment-processor obligations;
- recognized and collected revenue kept distinct;
- owner, close date, source, and reconciliation status.

Use at least three views:

- **cash runway:** unrestricted cash divided by forward net cash burn;
- **committed runway:** cash after committed liabilities divided by burn;
- **stress runway:** conservative revenue/volume/cost assumptions and a named
  response threshold.

Do not calculate a runway number when cash or burn is missing, stale, or
unreconciled.

## 4. Cost architecture

Track costs by player/company outcome, not just invoice line:

| Driver | Useful unit | Required distinction |
| --- | --- | --- |
| Hosting/build/functions | Successful playable loads and production builds | Baseline vs traffic/function variable cost |
| Database/auth/storage | Eligible active feature attempts and stored GB-month | Local-first play vs optional hosted features |
| AI portraits | Requested, successful, accepted, stored, and viewed outputs | Provider call is not accepted player value |
| AI video | Requested, successful, accepted, retained, and viewed outputs | Generation retries/failures can dominate cost |
| Bandwidth/egress | Delivered media and playable loads | Generated-but-unused assets must remain visible |
| Email/support/community | Eligible relationships and resolved cases | Message volume is not customer value |
| Research | Completed eligible sessions and decision-grade evidence | Recruitment/admin/compensation separated |
| Distribution | Qualified play and realized net receipts | Platform reach is not revenue |
| Professional services | Decision/risk served | Legal, privacy, accounting, security, and rights |

For every variable service record price date, unit, model/plan, region,
currency, tax, free allowance, minimum commitment, overage, retry behavior,
abuse ceiling, and kill switch.

## 5. Unit economics

Initial business questions:

- What does it cost to deliver 100 successful game-ready attempts?
- What does each optional generated portrait/video cost per accepted and viewed
  output after failures and storage?
- What support/moderation/research work is created per evidence-bearing cohort?
- What distribution path produces meaningful play or partner learning after
  platform fees, integration, support, and compliance cost?
- Which monetization model preserves the product promise and player trust?

Do not calculate customer acquisition cost, lifetime value, retention revenue,
or payback while Mythical lacks verified spend, customer/revenue attribution,
and a lawful longitudinal measurement model.

## 6. Monetization hypotheses

The current browser release is free to start. Future models remain hypotheses:

1. **Free discovery product** supporting research, audience, brand, and partner
   value without ads or purchases.
2. **Voluntary adult support/donations** where platform, identity, tax, refund,
   and age controls are suitable.
3. **Premium game, expansion, or edition** sold to an adult purchaser with
   clear value, price, refund, entitlement, and platform economics.
4. **Aligned distribution/publishing partnership** with rights, data, ads,
   support, recoup, exclusivity, and exit reviewed.
5. **Technology/content licensing** only when IP boundaries, service burden,
   warranties, data use, training rights, and strategic distraction are clear.
6. **Grants, sponsorship, education, or cultural partnerships** with truthful
   eligibility, reporting, disclosure, and mission fit.

No current model authorizes advertising, behavioral monetization, loot boxes,
pay-to-win mechanics, child purchases, paid acquisition, payment collection,
pricing, contracting, or revenue claims.

## 7. Agent permissions

Agents may:

- ingest approved aggregate exports into a restricted calculation workflow;
- classify costs, reconcile usage/invoices, detect anomalies, and prepare
  scenario sensitivities;
- calculate formulas from verified inputs and label assumptions;
- compare monetization concepts against player trust and business criteria;
- prepare spend/contract/price decision packages;
- alert a named human before thresholds or commitments are reached.

Agents may not:

- access banking, payroll, tax, or payment data without explicit restricted
  authority;
- open or change an account, supplier, payment method, limit, subscription, or
  billing plan;
- approve their own spend, move money, issue refunds, set prices, invoice,
  recognize revenue, file taxes, accept terms, or sign contracts;
- infer missing actuals as zero or silently carry stale prices forward;
- publish revenue, runway, player, customer, valuation, or traction claims.

## 8. Production gates

Before connected finance automation:

- named finance owner and backup;
- verified entity, currency, fiscal/tax basis, and professional review;
- restricted source systems and least-privilege read identities;
- close/reconciliation calendar and immutable source references;
- chart of accounts/cost centers and contract/invoice linkage;
- spend request, approval, separation-of-duties, and revocation controls;
- per-action, daily, monthly, campaign, and vendor limits;
- anomaly thresholds, duplicate-charge/idempotency controls, and kill switch;
- protected audit log and exception owner;
- backup/export/restore and vendor exit;
- four accurate reviewed close/forecast cycles before broader autonomy.

No step in this document authorizes financial execution.
