# LAB-003C — DEVNET 50 Retrospective T0 Contract

## Purpose

Use up to 50 real on-ledger XRPL Devnet Loan objects to test whether the Credit Risk Adapter can reconstruct borrower evidence at loan origination without outcome leakage.

This is a **technical benchmark**, not a production credit study.

## Selection

- source: current validated XRPL Devnet Loan objects,
- one Loan per unique borrower,
- first 50 discovered under deterministic ledger pagination,
- no manual cherry-picking by outcome.

## T0

For each selected Loan:

1. search the borrower's historical `account_tx`;
2. find the `LoanSet` transaction whose metadata created the matching Loan ledger object;
3. define T0 as ledger `LoanSet.ledger_index - 1`;
4. retrieve borrower evidence at/before T0;
5. run frozen v0.1 baseline and enhanced heuristic.

The current loan default/impaired state is never included in T0 features.

## Outcome

Current observable state:
- DEFAULTED,
- IMPAIRED,
- ACTIVE_NO_ADVERSE_FLAG.

ACTIVE_NO_ADVERSE_FLAG is not equivalent to successful repayment.

## Metrics

Descriptive only:
- T0 reconstruction coverage,
- adverse outcome count,
- mean risk score by current outcome group,
- top-10 adverse recall for baseline vs enhanced heuristic.

## Automatic no-claim rule

`information_edge_gate.passed` remains false in this experiment regardless of metrics.

Reasons:
- Devnet is not real economic behavior,
- current-object sampling has survivorship bias,
- adverse sample size may be very small,
- deleted/repaid loans may be absent.

The experiment may justify better engineering or a future Mainnet study, but not a production underwriting claim.
