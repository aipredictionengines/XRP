# LAB-003 Experiment Contract v0.1

## Question

Can XRPL-specific lending evidence add useful borrower-risk information beyond a simple wallet-activity baseline?

## Baseline

Activity-only, using:
- transaction count,
- history span,
- unique counterparties,
- validated success rate.

The baseline does **not** inspect Loan objects.

## Enhanced evidence

Adds:
- XRPL Loan object presence,
- default flag,
- impairment flag,
- trust-line count,
- owner-object coverage.

## Outcome hierarchy

1. **Observed default** — Loan object/default event.
2. **Observed impairment** — Loan object impairment.
3. **No adverse evidence observed** — not equivalent to successful repayment.
4. **Unknown** — insufficient or non-comparable evidence.

## Freeze rule

Scoring/rules must be frozen before evaluating a real labeled cohort.

Any later rule change creates a new model version and requires a fresh evaluation.

## What counts as an information edge

The enhanced model must outperform the frozen activity-only baseline on a real labeled cohort using predeclared metrics.

Candidate metrics:
- recall on adverse outcomes,
- false-positive rate,
- precision for REVIEW/HIGH_RISK,
- coverage / UNKNOWN rate.

No metric is considered valid on the synthetic logic cohort.

## Monetization gate

Even if information edge is demonstrated, LAB-003 does not become a product until we identify a credible buyer:
- loan broker/operator,
- lending protocol,
- fund/allocator,
- risk API customer,
- monitoring customer.

Technical edge without buyer evidence = HOLD.
