import fs from "node:fs/promises";
import path from "node:path";
import xrpl from "xrpl";
import {
  buildXrpPayment,
  evaluatePaymentIntent
} from "./policy.mjs";

const SERVER =
  process.env.XRPL_TESTNET_WS ?? "wss://s.altnet.rippletest.net:51233";
const ARTIFACT_DIR = path.resolve("artifacts");
const FACILITATOR_HOST = "xrpl-facilitator-testnet.t54.ai";

async function main() {
  const client = new xrpl.Client(SERVER);
  await client.connect();

  try {
    const payerFund = await client.fundWallet();
    const merchantFund = await client.fundWallet();
    const payer = payerFund.wallet;
    const merchant = merchantFund.wallet;

    const policy = {
      version: "0.1",
      allowed_networks: ["xrpl:testnet"],
      allowed_assets: ["XRP"],
      allowed_merchants: [merchant.address],
      allowed_facilitator_hosts: [FACILITATOR_HOST],
      max_per_tx_drops: "10000",
      review_above_drops: "5000",
      daily_budget_drops: "20000",
      spent_today_drops: "0"
    };

    const allowedIntent = {
      protocol: "x402",
      network: "xrpl:testnet",
      asset: "XRP",
      amount_drops: "1000",
      pay_to: merchant.address,
      facilitator_url: `https://${FACILITATOR_HOST}`,
      source_tag: 20260601,
      resource: "/lab004/resource",
      request_id: "LAB004-ALLOW"
    };

    const blockedIntent = {
      ...allowedIntent,
      amount_drops: "10001",
      request_id: "LAB004-BLOCK"
    };

    const allowDecision = evaluatePaymentIntent(allowedIntent, policy);
    const blockDecision = evaluatePaymentIntent(blockedIntent, policy);

    if (allowDecision.decision !== "ALLOW") {
      throw new Error("Expected allowed intent to pass policy.");
    }
    if (blockDecision.decision !== "BLOCK") {
      throw new Error("Expected over-limit intent to be blocked.");
    }

    const payment = buildXrpPayment({
      payer: payer.address,
      intent: allowedIntent,
      decision: allowDecision
    });

    const simulation = await client.request({
      command: "simulate",
      tx_json: payment
    });

    if (simulation.result.engine_result !== "tesSUCCESS") {
      throw new Error(
        `Simulation failed: ${simulation.result.engine_result}`
      );
    }

    const prepared = await client.autofill(payment);
    const signed = payer.sign(prepared);
    const submitted = await client.submitAndWait(signed.tx_blob);
    const meta = submitted.result.meta;
    const resultCode =
      typeof meta === "object" && meta !== null
        ? meta.TransactionResult ?? null
        : null;

    const txLookup = await client.request({
      command: "tx",
      transaction: signed.hash
    });

    const pass =
      resultCode === "tesSUCCESS" &&
      submitted.result.validated === true &&
      txLookup.result.validated === true &&
      blockDecision.decision === "BLOCK";

    const evidence = {
      schema_version: "0.1",
      lab: "LAB-004",
      network: "XRPL Testnet",
      server: SERVER,
      observed_at: new Date().toISOString(),
      policy: {
        version: policy.version,
        max_per_tx_drops: policy.max_per_tx_drops,
        review_above_drops: policy.review_above_drops,
        daily_budget_drops: policy.daily_budget_drops
      },
      allowed_case: {
        intent_hash: allowDecision.intent_hash,
        decision: allowDecision,
        payer: payer.address,
        merchant: merchant.address,
        simulation: {
          engine_result: simulation.result.engine_result,
          applied: simulation.result.applied ?? null,
          ledger_index: simulation.result.ledger_index ?? null
        },
        transaction: {
          hash: signed.hash,
          result_code: resultCode,
          validated: submitted.result.validated === true,
          lookup_validated: txLookup.result.validated === true
        }
      },
      blocked_case: {
        intent_hash: blockDecision.intent_hash,
        decision: blockDecision,
        submitted: false
      },
      status: pass ? "PASS" : "REVIEW",
      safety: {
        testnet_only: true,
        seeds_persisted: false,
        blocked_intent_submitted: false
      }
    };

    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    const file = path.join(
      ARTIFACT_DIR,
      `lab-004-agentpay-${Date.now()}.json`
    );
    await fs.writeFile(file, JSON.stringify(evidence, null, 2), "utf8");

    console.log("\n=== XRPL LAB-004 AGENTPAY GUARD ===");
    console.log(`Allowed decision: ${allowDecision.decision}`);
    console.log(`Blocked decision: ${blockDecision.decision}`);
    console.log(`Simulation: ${simulation.result.engine_result}`);
    console.log(`TX: ${signed.hash}`);
    console.log(`TX result: ${resultCode}`);
    console.log(`Status: ${evidence.status}`);
    console.log(`Evidence: ${file}`);

    if (!pass) process.exitCode = 2;
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
}

main().catch(async (error) => {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const file = path.join(
    ARTIFACT_DIR,
    `lab-004-agentpay-failed-${Date.now()}.json`
  );
  await fs.writeFile(
    file,
    JSON.stringify({
      schema_version: "0.1",
      lab: "LAB-004",
      status: "FAIL",
      observed_at: new Date().toISOString(),
      error: {
        name: error?.name ?? "Error",
        message: error?.message ?? String(error)
      }
    }, null, 2),
    "utf8"
  );
  console.error(error);
  console.error(`Failure evidence: ${file}`);
  process.exitCode = 1;
});
