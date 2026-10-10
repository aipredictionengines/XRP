# LAB-003B — Real Cohort Discovery Plan

## Goal

Find real public XRPL `Loan` objects and borrower addresses, then freeze a cohort before evaluating adverse outcomes.

## Why this exists

LAB-003A proved adapter correctness, not predictive value.

A real cohort requires actual ledger evidence. The XRP Ledger `ledger_data` API supports filtering state entries by ledger-entry type, including `Loan`.

## Discovery rules

1. Use validated ledger state only.
2. Filter for `Loan` entries.
3. Record borrower, loan ID, flags and observable repayment fields.
4. Never infer absence from a bounded partial scan.
5. Store whether pagination completed.
6. Deduplicate borrowers.
7. Do not change v0.1 scoring rules after outcomes are inspected.

## Cohort labels

Where evidence supports it:
- `DEFAULTED` — verified default flag.
- `IMPAIRED` — verified impairment flag.
- `ACTIVE_NO_ADVERSE_FLAG` — active Loan object without those flags.
- `UNKNOWN` — insufficient evidence.

`ACTIVE_NO_ADVERSE_FLAG` is **not** the same as repaid successfully.

## Target cohort

Initial target: up to 50 real public borrower/loan observations if the network contains enough discoverable cases.

If fewer exist, use the full discoverable set and report the limitation rather than fabricating sample size.

## Freeze point

For each borrower at T0:
- save evidence snapshot,
- save baseline score,
- save enhanced v0.1 result,
- freeze decision.

Only after freezing do we evaluate later outcome changes.

## Gate

LAB-003B PASS means:
- real candidates discovered, or
- a complete scan establishes the available population is too small/zero.

A partial scan with zero results is **not PASS/FAIL**; it is `INCOMPLETE`.
