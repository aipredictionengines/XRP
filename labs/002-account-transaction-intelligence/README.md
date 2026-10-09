# LAB-002 — Account & Transaction Intelligence

## Objective

Turn a public XRPL account into normalized, machine-readable evidence without making a risk claim.

```
XRPL account
→ account_info
→ account_tx
→ normalization
→ VERIFIED evidence
→ decision = UNKNOWN
```

This is intentionally read-only and is the base layer for later Credit Risk and Risk Passport experiments.

## Safety / interpretation boundary

- XRPL Testnet only for the lab.
- No signing and no private keys.
- A successful data fetch does **not** mean an account is safe.
- Missing evidence stays missing.
- LAB-002 always keeps risk decision as `UNKNOWN`.

## Run

```bash
cd labs/002-account-transaction-intelligence
npm install
XRPL_ACCOUNT=r... npm run lab
```

Optional:

```bash
XRPL_TX_LIMIT=50 XRPL_ACCOUNT=r... npm run lab
```

## PASS

- account_info succeeds
- account_tx succeeds
- evidence is normalized
- tests pass
- live Testnet evidence is uploaded by GitHub Actions
