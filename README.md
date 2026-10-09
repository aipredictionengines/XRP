# XRP / XRPL Lab

A research-and-build workspace for XRP Ledger opportunities.

**Current status:** 🟡 INCUBATION / LEARNING  
**Operating model:** multi-track research, small verified experiments, evidence before activation.

## Current priorities

1. **XRPL Lending / Credit — P0**
   - Credit Risk Adapter
   - borrower / account intelligence
   - paper credit portfolio integration

2. **AI / Agentic Finance — P0/P1**
   - AgentPay Guard
   - policy-controlled payments
   - ALLOW / REVIEW / BLOCK + audit trail

3. **RWA / Tokenization — P0/P1**
   - issuer / asset Risk Passport
   - controls, credentials, liquidity, evidence

4. **RLUSD / Stablecoin Rails — P1**
   - treasury / flow / liquidity intelligence

5. **Permissioned / Compliant DeFi — P1**
   - credentials and access-risk evidence

6. **Privacy / Confidential Assets — Research**
   - monitor until a concrete use case appears

## Repository map

```
docs/
  MASTER_PLAN.md
  TRENDS_OCT_2026_TO_JAN_2027.md

research/
  OPPORTUNITY_MATRIX.md

labs/
  001-first-testnet-transaction/
```

## First executable gate

**LAB-001 — First XRPL Testnet Transaction**

```
Connect
→ Fund ephemeral Testnet sender
→ Fund ephemeral Testnet receiver
→ Send 1 Test XRP
→ Wait for validation
→ Query TX
→ Export sanitized JSON evidence
```

Run locally:

```bash
cd labs/001-first-testnet-transaction
npm install
npm run lab
```

No seed or private key is written to disk.

## Decision rule

```
LEARN
→ TESTNET
→ VERIFY
→ PROBLEM
→ MONETIZATION SIGNAL
→ ACTIVE BUILD or HOLD
```

We do not allocate a main BUILD slot merely because the ecosystem is interesting. XRPL earns more resources only after verified technical progress and external demand.
