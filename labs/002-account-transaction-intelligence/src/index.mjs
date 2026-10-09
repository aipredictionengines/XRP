import fs from "node:fs/promises";
import path from "node:path";
import xrpl from "xrpl";
import { buildEvidence } from "./lib.mjs";

const SERVER_URL =
  process.env.XRPL_TESTNET_WS ?? "wss://s.altnet.rippletest.net:51233";
const ACCOUNT = process.env.XRPL_ACCOUNT;
const TX_LIMIT = Number(process.env.XRPL_TX_LIMIT ?? "25");
const ARTIFACT_DIR = path.resolve("artifacts");

function isoNow() {
  return new Date().toISOString();
}

async function writeArtifact(name, payload) {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const file = path.join(ARTIFACT_DIR, name);
  await fs.writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  return file;
}

async function main() {
  if (!ACCOUNT) {
    throw new Error("XRPL_ACCOUNT is required.");
  }
  if (!xrpl.isValidAddress(ACCOUNT)) {
    throw new Error("XRPL_ACCOUNT is not a valid XRPL address.");
  }
  if (!Number.isInteger(TX_LIMIT) || TX_LIMIT < 1 || TX_LIMIT > 200) {
    throw new Error("XRPL_TX_LIMIT must be an integer from 1 to 200.");
  }

  const client = new xrpl.Client(SERVER_URL);

  try {
    console.log(`Connecting to ${SERVER_URL}...`);
    await client.connect();

    const [accountInfoResponse, accountTxResponse] = await Promise.all([
      client.request({
        command: "account_info",
        account: ACCOUNT,
        ledger_index: "validated"
      }),
      client.request({
        command: "account_tx",
        account: ACCOUNT,
        ledger_index_min: -1,
        ledger_index_max: -1,
        forward: false,
        limit: TX_LIMIT
      })
    ]);

    const evidence = buildEvidence({
      address: ACCOUNT,
      server: SERVER_URL,
      accountInfo: accountInfoResponse.result,
      txEntries: accountTxResponse.result.transactions,
      observedAt: isoNow()
    });

    const file = await writeArtifact(
      `lab-002-${ACCOUNT}-${Date.now()}.json`,
      evidence
    );

    console.log("\n=== XRPL LAB-002 RESULT ===");
    console.log("Verification: VERIFIED");
    console.log(`Account: ${ACCOUNT}`);
    console.log(`Transactions returned: ${evidence.transaction_summary.returned}`);
    console.log(`Decision: ${evidence.decision}`);
    console.log(`Evidence: ${file}`);
  } catch (error) {
    const failure = {
      schema_version: "0.1",
      source: "XRPL RPC",
      network: "XRPL Testnet",
      server: SERVER_URL,
      observed_at: isoNow(),
      subject: {
        type: "XRPL_ACCOUNT",
        address: ACCOUNT ?? null
      },
      verification: "FAILED",
      decision: "UNKNOWN",
      error: {
        name: error?.name ?? "Error",
        message: error?.message ?? String(error)
      }
    };

    const file = await writeArtifact(
      `lab-002-failed-${Date.now()}.json`,
      failure
    );
    console.error(error);
    console.error(`Failure evidence: ${file}`);
    process.exitCode = 1;
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

await main();
