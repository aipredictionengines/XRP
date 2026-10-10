import test from "node:test";
import assert from "node:assert/strict";
import {
  buildXrpPayment,
  evaluatePaymentIntent,
  hashIntent
} from "../src/policy.mjs";

const merchant = "rMerchant";
const baseIntent = {
  protocol: "x402",
  network: "xrpl:testnet",
  asset: "XRP",
  amount_drops: "1000",
  pay_to: merchant,
  facilitator_url: "https://xrpl-facilitator-testnet.t54.ai",
  source_tag: 20260601,
  resource: "/api/data",
  request_id: "REQ-001"
};

const policy = {
  version: "0.1",
  allowed_networks: ["xrpl:testnet"],
  allowed_assets: ["XRP"],
  allowed_merchants: [merchant],
  allowed_facilitator_hosts: ["xrpl-facilitator-testnet.t54.ai"],
  max_per_tx_drops: "10000",
  review_above_drops: "5000",
  daily_budget_drops: "20000",
  spent_today_drops: "0"
};

test("allows a small approved payment", () => {
  const result = evaluatePaymentIntent(baseIntent, policy);
  assert.equal(result.decision, "ALLOW");
  assert.deepEqual(result.reasons, ["POLICY_PASS"]);
});

test("routes a payment above review threshold to REVIEW", () => {
  const result = evaluatePaymentIntent(
    { ...baseIntent, amount_drops: "6000" },
    policy
  );
  assert.equal(result.decision, "REVIEW");
});

test("blocks amount above max-per-transaction", () => {
  const result = evaluatePaymentIntent(
    { ...baseIntent, amount_drops: "10001" },
    policy
  );
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.reasons.includes("MAX_PER_TX_EXCEEDED"));
});

test("blocks daily budget overflow", () => {
  const result = evaluatePaymentIntent(baseIntent, {
    ...policy,
    spent_today_drops: "19500"
  });
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.reasons.includes("DAILY_BUDGET_EXCEEDED"));
});

test("blocks unknown merchant and facilitator", () => {
  const result = evaluatePaymentIntent(
    {
      ...baseIntent,
      pay_to: "rUnknown",
      facilitator_url: "https://evil.example"
    },
    policy
  );
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.reasons.includes("MERCHANT_NOT_ALLOWED"));
  assert.ok(result.reasons.includes("FACILITATOR_NOT_ALLOWED"));
});

test("blocks unreviewed server-declared transaction fields", () => {
  const result = evaluatePaymentIntent(
    { ...baseIntent, SendMax: "999999999" },
    policy
  );
  assert.equal(result.decision, "BLOCK");
  assert.match(result.reasons[0], /UNREVIEWED_FIELDS/);
});

test("invalid SourceTag is blocked", () => {
  const result = evaluatePaymentIntent(
    { ...baseIntent, source_tag: UINT32_OVERFLOW },
    policy
  );
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.reasons.includes("INVALID_SOURCE_TAG"));
});

const UINT32_OVERFLOW = 4_294_967_296;

test("buildXrpPayment uses only approved fields", () => {
  const decision = evaluatePaymentIntent(baseIntent, policy);
  assert.deepEqual(buildXrpPayment({
    payer: "rPayer",
    intent: baseIntent,
    decision
  }), {
    TransactionType: "Payment",
    Account: "rPayer",
    Destination: merchant,
    Amount: "1000",
    SourceTag: 20260601
  });
});

test("cannot build a blocked payment", () => {
  const decision = evaluatePaymentIntent(
    { ...baseIntent, amount_drops: "999999" },
    policy
  );
  assert.throws(
    () => buildXrpPayment({ payer: "rPayer", intent: baseIntent, decision }),
    /without ALLOW/
  );
});

test("intent hash is deterministic", () => {
  assert.equal(
    hashIntent({ b: 2, a: 1 }),
    hashIntent({ a: 1, b: 2 })
  );
});
