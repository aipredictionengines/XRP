import fs from "node:fs/promises";
import path from "node:path";
import xrpl from "xrpl";

const SERVER_URL =
  process.env.XRPL_TESTNET_WS ?? "wss://s.altnet.rippletest.net:51233";

const PAYMENT_XRP = "1";
const ARTIFACT_DIR = path.resolve("artifacts");

function nowIso() {
  return new Date().toISOString();
}

function sanitizeFundResult(fundResult) {
  return {
    address: fundResult.wallet.address,
    balance: fundResult.balance
  };
}

async function main() {
  const startedAt = nowIso();
  const client = new xrpl.Client(SERVER_URL);

  const evidence = {
    lab: "LAB-001",
    network: "XRPL Testnet",
    server: SERVER_URL,
    started_at: startedAt,
    finished_at: null,
    status: "RUNNING",
    sender: null,
    receiver: null,
    payment: {
      amount_xrp: PAYMENT_XRP,
      hash: null,
      validated: null,
      result_code: null
    },
    transaction_lookup: null,
    error: null
  };

  try {
    console.log(`Connecting to ${SERVER_URL}...`);
    await client.connect();

    console.log("Funding ephemeral sender wallet from Testnet faucet...");
    const senderFund = await client.fundWallet();

    console.log("Funding ephemeral receiver wallet from Testnet faucet...");
    const receiverFund = await client.fundWallet();

    const sender = senderFund.wallet;
    const receiver = receiverFund.wallet;

    evidence.sender = sanitizeFundResult(senderFund);
    evidence.receiver = sanitizeFundResult(receiverFund);

    // IMPORTANT: seed/private key is intentionally never logged or persisted.
    const payment = {
      TransactionType: "Payment",
      Account: sender.address,
      Destination: receiver.address,
      Amount: xrpl.xrpToDrops(PAYMENT_XRP)
    };

    console.log(
      `Submitting ${PAYMENT_XRP} Test XRP: ${sender.address} -> ${receiver.address}`
    );

    const prepared = await client.autofill(payment);
    const signed = sender.sign(prepared);
    const submitResult = await client.submitAndWait(signed.tx_blob);

    evidence.payment.hash = signed.hash;
    evidence.payment.validated = Boolean(submitResult.result.validated);

    const meta = submitResult.result.meta;
    evidence.payment.result_code =
      typeof meta === "object" && meta !== null
        ? meta.TransactionResult ?? null
        : null;

    const lookup = await client.request({
      command: "tx",
      transaction: signed.hash
    });

    evidence.transaction_lookup = {
      hash: lookup.result.hash ?? signed.hash,
      ledger_index: lookup.result.ledger_index ?? null,
      validated: lookup.result.validated ?? null
    };

    const isPass =
      evidence.payment.validated === true &&
      evidence.transaction_lookup.validated === true;

    evidence.status = isPass ? "PASS" : "REVIEW";
    evidence.finished_at = nowIso();

    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    const filename = path.join(
      ARTIFACT_DIR,
      `lab-001-${Date.now()}.json`
    );

    await fs.writeFile(filename, JSON.stringify(evidence, null, 2), "utf8");

    console.log("\n=== XRPL LAB-001 RESULT ===");
    console.log(`Status: ${evidence.status}`);
    console.log(`TX hash: ${signed.hash}`);
    console.log(`Evidence: ${filename}`);

    if (!isPass) {
      process.exitCode = 2;
    }
  } catch (error) {
    evidence.status = "FAIL";
    evidence.finished_at = nowIso();
    evidence.error = {
      name: error?.name ?? "Error",
      message: error?.message ?? String(error)
    };

    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    const filename = path.join(
      ARTIFACT_DIR,
      `lab-001-failed-${Date.now()}.json`
    );
    await fs.writeFile(filename, JSON.stringify(evidence, null, 2), "utf8");

    console.error(error);
    console.error(`Failure evidence: ${filename}`);
    process.exitCode = 1;
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

await main();
