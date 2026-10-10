import fs from "node:fs/promises";
import path from "node:path";
import xrpl from "xrpl";
import { extractCreditFeatures, enhancedPaperRisk } from "./features.mjs";

const SERVER_URL =
  process.env.XRPL_WS ?? "wss://s.altnet.rippletest.net:51233";
const ACCOUNT = process.env.XRPL_ACCOUNT;
const TX_LIMIT = Number(process.env.XRPL_TX_LIMIT ?? "100");
const ARTIFACT_DIR = path.resolve("artifacts");

function now() {
  return new Date().toISOString();
}

function rippleTimeToIso(seconds) {
  if (seconds === undefined || seconds === null) return null;
  return new Date((Number(seconds) + 946684800) * 1000).toISOString();
}

function normalizeAmount(amount) {
  if (typeof amount === "string") {
    return { type: "XRP", value_xrp: Number(amount) / 1_000_000 };
  }
  if (amount && typeof amount === "object") {
    return {
      type: "ISSUED_CURRENCY",
      currency: amount.currency ?? null,
      issuer: amount.issuer ?? null,
      value: amount.value ?? null
    };
  }
  return { type: "UNKNOWN" };
}

function normalizeTx(entry, subject) {
  const tx = entry?.tx_json ?? entry?.tx ?? {};
  const meta = entry?.meta ?? {};
  let direction = "OTHER";
  if (tx.Account === subject && tx.Destination === subject) direction = "SELF";
  else if (tx.Account === subject) direction = "OUT";
  else if (tx.Destination === subject) direction = "IN";

  return {
    hash: tx.hash ?? entry?.hash ?? null,
    transaction_type: tx.TransactionType ?? null,
    account: tx.Account ?? null,
    destination: tx.Destination ?? null,
    direction,
    amount: normalizeAmount(tx.Amount),
    validated: entry?.validated ?? null,
    result_code:
      typeof meta === "object" && meta !== null
        ? meta.TransactionResult ?? null
        : null,
    timestamp: rippleTimeToIso(tx.date)
  };
}

async function requestAllObjects(client, account) {
  const all = [];
  let marker;
  do {
    const response = await client.request({
      command: "account_objects",
      account,
      ledger_index: "validated",
      limit: 200,
      ...(marker ? { marker } : {})
    });
    all.push(...(response.result.account_objects ?? []));
    marker = response.result.marker;
  } while (marker);
  return all;
}

async function write(payload) {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const file = path.join(
    ARTIFACT_DIR,
    `lab-003-${ACCOUNT ?? "unknown"}-${Date.now()}.json`
  );
  await fs.writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  return file;
}

async function main() {
  if (!ACCOUNT || !xrpl.isValidAddress(ACCOUNT)) {
    throw new Error("XRPL_ACCOUNT must be a valid XRPL address.");
  }
  if (!Number.isInteger(TX_LIMIT) || TX_LIMIT < 1 || TX_LIMIT > 500) {
    throw new Error("XRPL_TX_LIMIT must be an integer from 1 to 500.");
  }

  const client = new xrpl.Client(SERVER_URL);

  try {
    await client.connect();

    const [info, tx, lines, objects] = await Promise.all([
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
      }),
      client.request({
        command: "account_lines",
        account: ACCOUNT,
        ledger_index: "validated",
        limit: 400
      }),
      requestAllObjects(client, ACCOUNT)
    ]);

    const accountEvidence = {
      verification: "VERIFIED",
      subject: { address: ACCOUNT },
      account: {
        balance_xrp: Number(info.result.account_data.Balance) / 1_000_000,
        owner_count: info.result.account_data.OwnerCount ?? null,
        flags: info.result.account_data.Flags ?? null,
        ledger_index: info.result.ledger_index ?? null
      },
      transactions: (tx.result.transactions ?? []).map((entry) =>
        normalizeTx(entry, ACCOUNT)
      )
    };

    const features = extractCreditFeatures({
      accountEvidence,
      accountLines: lines.result.lines ?? [],
      accountObjects: objects
    });

    const assessment = enhancedPaperRisk(features);

    const payload = {
      schema_version: "0.1",
      lab: "LAB-003",
      network: SERVER_URL.includes("altnet") ? "XRPL Testnet" : "XRPL",
      server: SERVER_URL,
      observed_at: now(),
      subject: ACCOUNT,
      evidence: {
        account_info: "VERIFIED",
        account_tx: "VERIFIED",
        account_lines: "VERIFIED",
        account_objects: "VERIFIED"
      },
      features,
      assessment
    };

    const file = await write(payload);

    console.log("\n=== XRPL LAB-003 RESULT ===");
    console.log(`Account: ${ACCOUNT}`);
    console.log(`Transactions: ${features.activity.tx_count}`);
    console.log(`Loan objects: ${features.lending.loan_count}`);
    console.log(`Defaulted loans: ${features.lending.defaulted_loan_count}`);
    console.log(`Impaired loans: ${features.lending.impaired_loan_count}`);
    console.log(`Decision: ${assessment.decision}`);
    console.log(`Evidence: ${file}`);
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
}

main().catch(async (error) => {
  const failure = {
    schema_version: "0.1",
    lab: "LAB-003",
    observed_at: now(),
    subject: ACCOUNT ?? null,
    verification: "FAILED",
    decision: "UNKNOWN",
    error: {
      name: error?.name ?? "Error",
      message: error?.message ?? String(error)
    }
  };
  const file = await write(failure);
  console.error(error);
  console.error(`Failure evidence: ${file}`);
  process.exitCode = 1;
});
