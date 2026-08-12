# Restricted Financial Truth and Close System

**Status:** A-040 close contract ready; ownership, restricted sources,
reconciliation, professional review, exercises, and all financial authority gated

## Outcome

A-040 defines the operating bridge between A-022's zero-assumption financial
model and any future finance calculation or integration. It establishes what
must be true before Mythical can call a financial baseline reconciled, calculate
runway or unit economics, publish a forecast, approve spend, or make a
monetization commitment.

The shared repository stores the contract, evidence classes, opaque source
references, status, and approved aggregate outputs only. Cash, revenue,
expense, bank, transaction, invoice, payroll, tax, investor, customer, account,
credential, and recovery values remain in a professionally reviewed restricted
process.

## Current determination

A-022 is valid precisely because it reports no financial baseline: zero of
seven cost drivers have verified prices or actual usage, zero of six
monetization hypotheses are decision-ready, runway is unavailable, financial
systems are disconnected, and all spend/revenue authority is false.

A-040 adds six source classes, twelve baseline evidence classes, eighteen
activation gates, ten exercises, and a four-close operating-history threshold.
Every source, evidence class, role, exercise, gate, and cycle is currently
unconfigured or incomplete. This is a usable intake and assurance boundary,
not a financial readiness claim.

## Separation of duties

The minimum cell requires a finance owner, backup, close preparer, independent
reviewer, accounting/tax reviewer, and exception recipient. The preparer cannot
approve their own close or suppress an unresolved difference. A future read
identity, calculation job, alert route, and any later executor must be
independently revocable.

## Close evidence

The twelve `FB-*` classes cover entity and accounting perimeter; currency and
tax basis; reconciled cash; commitments; recognized and collected revenue;
expense; forward obligations; variable provider costs; tax/payment/platform
obligations; active vendor economics; accepted-output usage; and approved
limits/technical stops.

An opaque source reference proves only where reviewed evidence lives. It does
not prove the value, reconciliation, freshness, or permission to use it. Missing
or stale evidence blocks close and leaves values null rather than zero.

## Exercises and promotion

All ten `FGX-*` exercises must pass. They test stale sources, reconciliation
differences, duplicates, currency/tax/plan drift, provider retry and acceptance
yield, restricted-data leakage, self-review, unauthorized spend, independent
revocation, and recovery/replay controls.

After all eighteen gates, Mythical still needs four consecutive independently
reviewed accurate closes before broader internal automation. Financial writes,
payment execution, price changes, contract/subscription changes, revenue
recognition, and public forecasts remain separately governed external actions.

## Kevin input brief

Kevin can provide FFI-001 through FFI-005 without financial values:

1. finance owner, backup, preparer, reviewer, accounting/tax reviewer, and
   exception-recipient role references;
2. restricted system/process class, administrator, recovery owner, and opaque
   reference approach;
3. entity/reporting perimeter reference, reporting currency, fiscal year, and
   jurisdictions needing professional review;
4. first reconciliation cutoff, close cadence, freeze/staleness rules, and
   available evidence classes; and
5. material vendor/cost categories, limit-decision owner, anomaly approach,
   and technical spend-stop owner—without amounts.

These inputs record D-016 only. They do not authorize access, data import,
calculation, publication, spend, pricing, payment, contracting, revenue, or
execution.

## Commands

```bash
node scripts/company/validate-financial-truth-close.cjs
node scripts/company/test-financial-truth-close.cjs
```
