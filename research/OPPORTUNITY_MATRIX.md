# Opportunity Matrix v0.1

## 1. XRPL Credit Risk Adapter — P0

**Problem:** lending/credit systems need underwriting, monitoring and explainable risk signals.

**Prototype:** read XRPL account history and produce normalized borrower features for a paper credit portfolio.

**Monetization hypotheses:**
- B2B risk API,
- paid borrower / pool risk report,
- monitoring subscription,
- integration for lending operators.

**Kill condition:** no meaningful XRPL-specific risk features or no buyer/problem evidence.

---

## 2. AgentPay Guard — P0/P1

**Problem:** autonomous agents need payment controls, policy, audit trails and risk gates.

**Prototype:**
```
Payment Request
→ Policy Checks
→ ALLOW / REVIEW / BLOCK
→ XRPL Testnet Payment
→ Receipt / Audit JSON
```

**Monetization hypotheses:**
- developer API,
- hosted policy engine,
- enterprise agent wallet controls,
- transaction monitoring.

**Kill condition:** standard wallet/x402 tooling fully solves the problem without a differentiated control layer.

---

## 3. RWA Risk Passport — P0/P1

**Problem:** tokenized assets need interpretable issuer, control, credential and liquidity evidence.

**Prototype output:**
- asset / issuer identity,
- token standard,
- issuer controls,
- credential / permission requirements,
- liquidity,
- concentration,
- evidence,
- PASS / REVIEW / UNKNOWN.

**Kill condition:** insufficient public evidence or no user willing to consume/pay for interpreted risk.

---

## 4. RLUSD Intelligence — P1

**Problem:** institutional stablecoin use creates treasury, liquidity and counterparty monitoring needs.

**Prototype:** read-only dashboards / API signals before any execution.

**Kill condition:** data is too limited or existing products already satisfy the workflow with no edge.

---

## Shared principle

Every track should reuse a common evidence schema:

```json
{
  "source": "verified source",
  "observed_at": "ISO-8601",
  "subject": "account / asset / pool / transaction",
  "signal": "normalized fact",
  "confidence": "verified | inferred | unknown",
  "evidence": {},
  "decision": "PASS | REVIEW | BLOCK | UNKNOWN"
}
```

Never convert missing evidence into a positive or negative fact.
