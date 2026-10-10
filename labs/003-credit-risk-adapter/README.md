# LAB-003 — XRPL Credit Risk Adapter

## Goal

Test whether XRPL public evidence can support a useful borrower-risk layer **without pretending wallet activity is a validated credit score**.

XRPL Lending Protocol relies on off-chain underwriting and risk management. A borrower's `Loan` ledger entries are linked into the borrower's owner directory, so this lab reads public ledger evidence and normalizes it for later risk models.

Official references:
- https://xrpl.org/docs/concepts/tokens/lending-protocol
- https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/loan
- https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_objects

## Pipeline

```
account_info
+ account_tx
+ account_lines
+ account_objects
        ↓
credit evidence features
        ↓
activity-only baseline
        +
verified lending flags
        ↓
NON-PREDICTIVE paper heuristic
        ↓
UNKNOWN / REVIEW / HIGH_RISK
```

## Hard boundary

`paper_risk_score` is **not a credit score**.

Until we have a labeled cohort with observed repayment/default outcomes:
- no predictive claim,
- no approval recommendation,
- no pricing of real credit,
- no real-money lending decision.

A verified defaulted Loan object may produce `HIGH_RISK` because default is an observed ledger fact. An impaired loan may produce `REVIEW`. An active account with no adverse loan evidence remains `UNKNOWN`, not `PASS`.

## Run live Testnet smoke

```bash
cd labs/003-credit-risk-adapter
npm install
XRPL_ACCOUNT=r... npm run collect
```

## Run synthetic logic cohort

```bash
npm run paper
```

The synthetic cohort exists only to verify the rules distinguish:
- sparse evidence,
- active account with no loan outcome,
- current loan,
- impaired loan,
- defaulted loan.

It is **not** evidence of predictive information edge.

## LAB-003 gates

### 3A — Adapter correctness
- unit tests pass,
- live read succeeds,
- Loan flags are interpreted correctly,
- missing evidence stays UNKNOWN.

### 3B — Real paper cohort
Next, collect real public XRPL borrower/loan cases where outcomes can be observed and freeze the scoring rules before evaluating outcomes.

### 3C — Information edge
Compare the enhanced evidence model against the frozen activity-only baseline.

Only 3C can justify a claim of information edge.
