# XRPL Lab — Master Plan v0.1

**Status:** INCUBATION / LEARNING  
**Operating rule:** multi-track research, single small experiment at a time.  
**Mainnet capital:** none until an explicit approval gate is passed.

## Goal

Build enough verified XRPL capability to decide, from evidence, whether XRPL deserves a future active BUILD slot.

We do not build for a grant. We learn, produce evidence, test a real problem, then evaluate:
1. user demand,
2. monetization,
3. ecosystem support / grants,
4. strategic fit with existing Web3 systems.

## Priority tracks — October 2026 onward

| Track | Priority | Initial product hypothesis |
|---|---:|---|
| XRPL Lending / Credit | P0 | Credit Risk Adapter / borrower intelligence |
| AI / Agentic Finance | P0/P1 | AgentPay Guard / policy-controlled payments |
| RWA / Tokenization | P0/P1 | Asset / issuer Risk Passport |
| RLUSD / Stablecoin Rails | P1 | Treasury & flow intelligence |
| Permissioned / Compliant DeFi | P1 | Credential / access / risk evidence layer |
| Privacy / ZK / Confidential Assets | Research | Monitor only until a concrete use case appears |

## Workflow

```
RESEARCH
  ↓
BUILD SPEC
  ↓
TESTNET EXPERIMENT
  ↓
VERIFY / QA
  ↓
EVIDENCE ARTIFACT
  ↓
PRODUCT / MONETIZATION REVIEW
  ↓
GO / HOLD / STOP
```

## Lab sequence

### LAB-001 — First Testnet Transaction
Environment → funded Testnet wallets → payment → validation → JSON evidence.

### LAB-002 — Account & Transaction Intelligence
Read-only account inspection, balances, transaction history, flags, UNKNOWN handling.

### LAB-003 — Credit Risk Adapter
Map XRPL lending/borrower signals into the existing multi-protocol risk model.

### LAB-004 — AgentPay Guard
Payment request → policy → ALLOW/REVIEW/BLOCK → Testnet payment → receipt.

### LAB-005 — RWA / MPT Risk Passport
Issuer controls, metadata, credentials, transfer restrictions, liquidity and evidence.

### LAB-006 — RLUSD Intelligence
Flows, liquidity, markets, mint/burn or issuer-level signals where public data supports them.

## Approval gates

**Gate A — Learning PASS**  
We can independently connect, fund Testnet accounts, submit, validate and query ledger data.

**Gate B — Prototype PASS**  
At least one reproducible Testnet prototype produces machine-readable evidence.

**Gate C — Problem PASS**  
The prototype addresses a real user/business problem rather than only demonstrating technology.

**Gate D — Monetization Signal**  
At least one credible path exists: paying user, pilot, grant, hackathon, partner or B2B integration.

**Gate E — Activation**  
Only after A–D do we consider moving XRPL from INCUBATION to ACTIVE BUILD.

If C or D fails: **HOLD — knowledge retained.**

## Architecture rule

Build adapters, not islands.

```
XRPL
  ↓
Protocol / Data Adapter
  ↓
Shared Risk + Decision + Agent layer
  ↓
Product surfaces
```

The target is eventually multi-chain, multi-protocol and multi-asset where technically and economically justified.
