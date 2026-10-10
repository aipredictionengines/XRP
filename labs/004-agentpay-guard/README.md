# LAB-004 — AgentPay Guard

## Purpose

Put a deterministic policy gate between an untrusted machine-payment request and an XRPL signature.

```
402 / payment requirement
        ↓
Normalize untrusted intent
        ↓
Policy
  - network
  - asset
  - merchant
  - facilitator
  - max per tx
  - daily budget
  - review threshold
  - allowed transaction fields
        ↓
BLOCK / REVIEW / ALLOW
        ↓
simulate
        ↓
sign + submit only if ALLOW
        ↓
audit evidence
```

## Why

X402 lets agents pay for HTTP services with XRP or RLUSD. The remote service controls parts of the payment requirement, so the requirement must be treated as untrusted input.

LAB-004 does **not** implement a production X402 client yet. It validates the safety boundary first.

## Live Testnet gate

The workflow:
1. creates ephemeral payer and merchant Testnet wallets,
2. evaluates one allowed XRP intent,
3. evaluates one over-limit blocked intent,
4. simulates only the allowed Payment,
5. signs and submits only the allowed Payment,
6. verifies the transaction,
7. records JSON audit evidence,
8. verifies the blocked intent was never submitted.

No seed/private key is persisted.

## Next

LAB-004B can integrate the real `x402-xrpl` facilitator/receipt flow after the policy boundary is proven.
