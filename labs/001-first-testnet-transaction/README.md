# LAB-001 — First XRPL Testnet Transaction

## Objective

Produce the first reproducible XRPL artifact:

```
Connect
→ Fund Testnet Sender
→ Fund Testnet Receiver
→ Send 1 Test XRP
→ Wait for validation
→ Query transaction
→ Export sanitized JSON evidence
→ PASS / FAIL
```

## Safety boundary

- Testnet only.
- No real XRP.
- Wallet seeds/private keys are never written to disk by this lab.
- Generated Testnet wallets are ephemeral.
- Evidence contains public addresses and transaction data only.

## Requirements

- Node.js 20+
- npm
- internet access to XRPL Testnet

## Run

```bash
cd labs/001-first-testnet-transaction
npm install
npm run lab
```

Optional endpoint override:

```bash
XRPL_TESTNET_WS=wss://s.altnet.rippletest.net:51233 npm run lab
```

## PASS definition

The lab passes when:
1. both Testnet accounts are funded,
2. a Payment transaction is validated,
3. the transaction can be queried by hash,
4. a sanitized evidence JSON file is written under `artifacts/`.

## Evidence

The generated file is intentionally ignored by git because each run is unique.  
A later CI-safe fixture can be committed separately after the schema stabilizes.
