import fs from "node:fs/promises";
import path from "node:path";
import xrpl from "xrpl";

const SERVER_URL = process.env.XRPL_WS ?? "wss://xrplcluster.com/";
const MAX_PAGES = Number(process.env.XRPL_DISCOVERY_MAX_PAGES ?? "20");
const LIMIT = Number(process.env.XRPL_DISCOVERY_LIMIT ?? "256");
const ARTIFACT_DIR = path.resolve("artifacts");

const LOAN_DEFAULT_FLAG = 0x00010000;
const LOAN_IMPAIRED_FLAG = 0x00020000;

function parseIntSafe(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function normalizeLoan(obj) {
  const flags = Number(obj?.Flags ?? 0);
  return {
    index: obj?.index ?? obj?.LedgerIndex ?? null,
    borrower: obj?.Borrower ?? null,
    loan_broker_id: obj?.LoanBrokerID ?? null,
    flags,
    defaulted: (flags & LOAN_DEFAULT_FLAG) !== 0,
    impaired: (flags & LOAN_IMPAIRED_FLAG) !== 0,
    payment_remaining: obj?.PaymentRemaining ?? null,
    principal_outstanding: obj?.PrincipalOutstanding ?? null,
    total_value_outstanding: obj?.TotalValueOutstanding ?? null,
    next_payment_due_date: obj?.NextPaymentDueDate ?? null
  };
}

function firstFeature(result) {
  const entries = Object.entries(result ?? {});
  if (entries.length === 0) return null;
  const [id, value] = entries[0];
  return {
    id,
    name: value?.name ?? null,
    enabled: value?.enabled ?? null,
    supported: value?.supported ?? null
  };
}

async function readFeature(client, name) {
  try {
    const response = await client.request({
      command: "feature",
      feature: name
    });
    return {
      requested: name,
      status: "VERIFIED",
      feature: firstFeature(response.result)
    };
  } catch (error) {
    return {
      requested: name,
      status: "UNKNOWN",
      error: error?.message ?? String(error)
    };
  }
}

async function write(payload) {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const file = path.join(
    ARTIFACT_DIR,
    `lab-003b-loan-discovery-${Date.now()}.json`
  );
  await fs.writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  return file;
}

async function main() {
  const maxPages = parseIntSafe(MAX_PAGES, 20);
  const limit = Math.min(256, parseIntSafe(LIMIT, 256));
  const client = new xrpl.Client(SERVER_URL);

  const loans = [];
  let marker;
  let pagesScanned = 0;
  let ledgerHash = null;
  let ledgerIndex = null;

  try {
    await client.connect();

    const lendingProtocol = await readFeature(client, "LendingProtocol");
    const lendingProtocolV11 = await readFeature(client, "LendingProtocolV1_1");

    const protocolEnabled =
      lendingProtocol.feature?.enabled === true ||
      lendingProtocolV11.feature?.enabled === true;

    const baseProtocolVerifiedDisabled =
      lendingProtocol.status === "VERIFIED" &&
      lendingProtocol.feature?.enabled === false;

    if (!baseProtocolVerifiedDisabled) {
      do {
        const response = await client.request({
          command: "ledger_data",
          ledger_index: "validated",
          type: "Loan",
          binary: false,
          limit,
          ...(marker ? { marker } : {})
        });

        pagesScanned += 1;
        ledgerHash = response.result.ledger_hash ?? ledgerHash;
        ledgerIndex = response.result.ledger_index ?? ledgerIndex;

        for (const entry of response.result.state ?? []) {
          if (entry?.LedgerEntryType === "Loan") {
            loans.push(normalizeLoan(entry));
          }
        }

        marker = response.result.marker;
      } while (marker && pagesScanned < maxPages);
    }

    const borrowers = [...new Set(loans.map((x) => x.borrower).filter(Boolean))];

    const complete = baseProtocolVerifiedDisabled ? true : !marker;

    let status;
    if (baseProtocolVerifiedDisabled) {
      status = "PROTOCOL_DISABLED_NO_ONLEDGER_COHORT";
    } else if (loans.length > 0) {
      status = "CANDIDATES_FOUND";
    } else if (complete) {
      status = "COMPLETE_ZERO_LOANS";
    } else {
      status = "INCOMPLETE_NO_CONCLUSION";
    }

    const payload = {
      schema_version: "0.2",
      lab: "LAB-003B",
      source: "XRPL feature + ledger_data(type=Loan)",
      server: SERVER_URL,
      observed_at: new Date().toISOString(),
      amendment_status: {
        lending_protocol: lendingProtocol,
        lending_protocol_v1_1: lendingProtocolV11,
        any_lending_feature_enabled: protocolEnabled
      },
      ledger_hash: ledgerHash,
      ledger_index: ledgerIndex,
      scan: {
        pages_scanned: pagesScanned,
        page_limit: limit,
        max_pages: maxPages,
        complete,
        continuation_marker_present: Boolean(marker),
        skipped_because_base_protocol_disabled: baseProtocolVerifiedDisabled
      },
      status,
      counts: {
        loans_found: loans.length,
        unique_borrowers: borrowers.length,
        defaulted_loans: loans.filter((x) => x.defaulted).length,
        impaired_loans: loans.filter((x) => x.impaired).length
      },
      borrowers,
      loans,
      interpretation:
        baseProtocolVerifiedDisabled
          ? "The server reports the base LendingProtocol amendment disabled on the validated Mainnet ledger, so current on-ledger Loan entries are not an available real cohort source."
          : complete
            ? "The filtered ledger scan reached the end of pagination."
            : "The scan stopped at the configured page bound. Zero loans does not mean zero loans exist."
    };

    const file = await write(payload);

    console.log("\n=== XRPL LAB-003B DISCOVERY ===");
    console.log(`LendingProtocol: ${lendingProtocol.feature?.enabled ?? "UNKNOWN"}`);
    console.log(`LendingProtocolV1_1: ${lendingProtocolV11.feature?.enabled ?? "UNKNOWN"}`);
    console.log(`Status: ${status}`);
    console.log(`Pages scanned: ${pagesScanned}`);
    console.log(`Complete: ${complete}`);
    console.log(`Loans found: ${loans.length}`);
    console.log(`Unique borrowers: ${borrowers.length}`);
    console.log(`Defaulted: ${payload.counts.defaulted_loans}`);
    console.log(`Impaired: ${payload.counts.impaired_loans}`);
    console.log(`Evidence: ${file}`);
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
}

main().catch(async (error) => {
  const payload = {
    schema_version: "0.2",
    lab: "LAB-003B",
    observed_at: new Date().toISOString(),
    status: "FAILED",
    interpretation: "Discovery failed; no conclusion may be drawn.",
    error: {
      name: error?.name ?? "Error",
      message: error?.message ?? String(error)
    }
  };
  const file = await write(payload);
  console.error(error);
  console.error(`Failure evidence: ${file}`);
  process.exitCode = 1;
});
