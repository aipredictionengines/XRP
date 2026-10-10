# LAB-003B — XRPL Lending Network Probe

**Observed:** 2026-10-10  
**Workflow run:** `38020844789`

## Mainnet

- `LendingProtocol`: disabled
- `LendingProtocolV1_1`: disabled
- current on-ledger Loan cohort source: unavailable

## Testnet

- `LendingProtocol`: disabled
- `LendingProtocolV1_1`: disabled
- current on-ledger Loan cohort source: unavailable
- artifact ID: `11658670779`
- artifact SHA-256: `704f0c5757112cc602ed7a59951f7d02f6a3359137da2f150341acadd24270f8`

## Devnet

- `LendingProtocol`: enabled
- `LendingProtocolV1_1`: enabled
- bounded scan pages: 30
- scan complete: no
- Loan objects found: **56**
- unique borrowers found: **56**
- defaulted Loan objects: **1**
- impaired Loan objects: **1**
- artifact ID: `11658361007`
- artifact SHA-256: `1184d692357f97131a53c87874ab453efdcf6a77687fb10174b1b15fe9a5a0de`

## Decision

Use Devnet as the next **technical cohort environment**.

Do not call this a production credit cohort:
- Devnet activity is not real economic borrower behavior.
- current default/impaired state cannot be used as both model input and outcome label.
- the next experiment must reconstruct evidence at loan origination (T0), freeze the baseline/enhanced decision, and evaluate later state separately.

Working name for the next experiment: **DEVNET 50 — Retrospective T0 Cohort**.
