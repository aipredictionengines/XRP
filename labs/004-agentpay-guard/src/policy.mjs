import crypto from "node:crypto";

const UINT32_MAX = 4_294_967_295;
const ALLOWED_INTENT_KEYS = new Set([
  "protocol",
  "network",
  "asset",
  "amount_drops",
  "pay_to",
  "facilitator_url",
  "source_tag",
  "resource",
  "request_id"
]);

function parseDrops(value) {
  const s = String(value ?? "");
  if (!/^[1-9][0-9]*$/.test(s)) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

function host(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function validSourceTag(value) {
  if (value === undefined || value === null) return true;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= UINT32_MAX;
}

export function hashIntent(intent) {
  const keys = Object.keys(intent).sort();
  const canonical = JSON.stringify(
    Object.fromEntries(keys.map((key) => [key, intent[key]]))
  );
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function evaluatePaymentIntent(intent, policy) {
  const reasons = [];
  const unknownKeys = Object.keys(intent).filter(
    (key) => !ALLOWED_INTENT_KEYS.has(key)
  );

  if (unknownKeys.length) {
    return {
      decision: "BLOCK",
      reasons: [`UNREVIEWED_FIELDS:${unknownKeys.sort().join(",")}`],
      intent_hash: hashIntent(intent)
    };
  }

  const amount = parseDrops(intent.amount_drops);
  if (!amount) reasons.push("INVALID_AMOUNT");
  if (!policy.allowed_networks?.includes(intent.network)) {
    reasons.push("NETWORK_NOT_ALLOWED");
  }
  if (!policy.allowed_assets?.includes(intent.asset)) {
    reasons.push("ASSET_NOT_ALLOWED");
  }
  if (!policy.allowed_merchants?.includes(intent.pay_to)) {
    reasons.push("MERCHANT_NOT_ALLOWED");
  }

  const facilitatorHost = host(intent.facilitator_url);
  if (
    !facilitatorHost ||
    !policy.allowed_facilitator_hosts?.includes(facilitatorHost)
  ) {
    reasons.push("FACILITATOR_NOT_ALLOWED");
  }

  if (!validSourceTag(intent.source_tag)) {
    reasons.push("INVALID_SOURCE_TAG");
  }

  if (reasons.length) {
    return {
      decision: "BLOCK",
      reasons,
      intent_hash: hashIntent(intent)
    };
  }

  const maxPerTx = parseDrops(policy.max_per_tx_drops);
  const reviewAbove = parseDrops(policy.review_above_drops);
  const dailyBudget = parseDrops(policy.daily_budget_drops);
  const spentToday = BigInt(String(policy.spent_today_drops ?? "0"));

  if (!maxPerTx || !reviewAbove || !dailyBudget) {
    return {
      decision: "BLOCK",
      reasons: ["INVALID_POLICY_LIMITS"],
      intent_hash: hashIntent(intent)
    };
  }

  if (amount > maxPerTx) reasons.push("MAX_PER_TX_EXCEEDED");
  if (spentToday + amount > dailyBudget) reasons.push("DAILY_BUDGET_EXCEEDED");

  if (reasons.length) {
    return {
      decision: "BLOCK",
      reasons,
      intent_hash: hashIntent(intent)
    };
  }

  if (amount > reviewAbove) {
    return {
      decision: "REVIEW",
      reasons: ["HUMAN_REVIEW_THRESHOLD_EXCEEDED"],
      intent_hash: hashIntent(intent),
      normalized: {
        amount_drops: amount.toString(),
        facilitator_host: facilitatorHost
      }
    };
  }

  return {
    decision: "ALLOW",
    reasons: ["POLICY_PASS"],
    intent_hash: hashIntent(intent),
    normalized: {
      amount_drops: amount.toString(),
      facilitator_host: facilitatorHost
    }
  };
}

export function buildXrpPayment({ payer, intent, decision }) {
  if (decision?.decision !== "ALLOW") {
    throw new Error("Payment cannot be constructed without ALLOW.");
  }

  const tx = {
    TransactionType: "Payment",
    Account: payer,
    Destination: intent.pay_to,
    Amount: decision.normalized.amount_drops
  };

  if (intent.source_tag !== undefined && intent.source_tag !== null) {
    tx.SourceTag = Number(intent.source_tag);
  }

  return tx;
}
