import fs from "node:fs/promises";
import path from "node:path";
import xrpl from "xrpl";
import {
  extractCreditFeatures,
  enhancedPaperRisk
} from "./features.mjs";
import {
  currentOutcome,
  findLoanOrigin,
  isAdverse,
  metricSummary
} from "./devnet50-lib.mjs";

const DISCOVERY_WS =
  process.env.XRPL_DISCOVERY_WS ?? "wss://s.devnet.rippletest.net:51233/";
const HISTORY_WS =
  process.env.XRPL_HISTORY_WS ?? "wss://clio.devnet.rippletest.net:51233/";
const TARGET = Math.min(50, Math.max(1, Number(process.env.XRPL_COHORT_TARGET ?? "50")));
const MAX_DISCOVERY_PAGES = Math.max(
  1,
  Number(process.env.XRPL_DISCOVERY_MAX_PAGES ?? "50")
);
const TX_PAGES = Math.max(1, Number(process.env.XRPL_TX_PAGES ?? "4"));
const CONCURRENCY = Math.min(
  5,
  Math.max(1, Number(process.env.XRPL_COHORT_CONCURRENCY ?? "3"))
);
const BORROWER_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.XRPL_BORROWER_TIMEOUT_MS ?? "20000")
);
const ARTIFACT_DIR = path.resolve("artifacts");

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`TIMEOUT: ${label} exceeded ${ms}ms`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
    ledger_index: entry?.ledger_index ?? tx.ledger_index ?? null,
    timestamp: rippleTimeToIso(tx.date)
  };
}

async function discoverLoans(client) {
  const loans = [];
  const seenBorrowers = new Set();
  let marker;
  let pages = 0;

  do {
    const response = await client.request({
      command: "ledger_data",
      ledger_index: "validated",
      type: "Loan",
      binary: false,
      limit: 256,
      ...(marker ? { marker } : {})
    });

    pages += 1;
    for (const obj of response.result.state ?? []) {
      if (obj?.LedgerEntryType !== "Loan") continue;
      const borrower = obj.Borrower;
      if (!borrower || seenBorrowers.has(borrower)) continue;
      seenBorrowers.add(borrower);
      loans.push(obj);
      if (loans.length >= TARGET) {
        return { loans, pages, complete: false };
      }
    }
    marker = response.result.marker;
  } while (marker && pages < MAX_DISCOVERY_PAGES);

  return { loans, pages, complete: !marker };
}

async function accountTxAll(client, account, options = {}) {
  const all = [];
  let marker;
  let pages = 0;

  do {
    const response = await client.request({
      command: "account_tx",
      account,
      ledger_index_min: options.min ?? -1,
      ledger_index_max: options.max ?? -1,
      forward: options.forward ?? true,
      limit: 200,
      ...(marker ? { marker } : {})
    });
    all.push(...(response.result.transactions ?? []));
    marker = response.result.marker;
    pages += 1;
  } while (marker && pages < (options.maxPages ?? TX_PAGES));

  return {
    transactions: all,
    complete: !marker,
    pages
  };
}

async function accountObjectsAt(client, account, ledgerIndex) {
  const all = [];
  let marker;
  let pages = 0;
  do {
    const response = await client.request({
      command: "account_objects",
      account,
      ledger_index: ledgerIndex,
      limit: 200,
      ...(marker ? { marker } : {})
    });
    all.push(...(response.result.account_objects ?? []));
    marker = response.result.marker;
    pages += 1;
  } while (marker && pages < 5);
  return { objects: all, complete: !marker };
}

async function snapshotAtOrigin(historyClient, loan) {
  const borrower = loan.Borrower;
  const txHistory = await accountTxAll(historyClient, borrower, {
    forward: true,
    maxPages: TX_PAGES
  });
  const loanId = loan.index ?? loan.LedgerIndex;
  const origin = findLoanOrigin(txHistory.transactions, loanId);

  if (!origin?.ledger_index || origin.ledger_index <= 1) {
    return {
      borrower,
      loan_id: loanId,
      status: "ORIGIN_NOT_FOUND",
      origin_search_complete: txHistory.complete,
      origin_search_pages: txHistory.pages
    };
  }

  const t0Ledger = Number(origin.ledger_index) - 1;

  try {
    const [infoResponse, t0Tx, objectsResponse] = await Promise.all([
      historyClient.request({
        command: "account_info",
        account: borrower,
        ledger_index: t0Ledger
      }),
      accountTxAll(historyClient, borrower, {
        forward: false,
        max: t0Ledger,
        maxPages: TX_PAGES
      }),
      accountObjectsAt(historyClient, borrower, t0Ledger)
    ]);

    const accountEvidence = {
      verification: "VERIFIED",
      subject: { address: borrower },
      account: {
        balance_xrp:
          Number(infoResponse.result.account_data.Balance) / 1_000_000,
        owner_count: infoResponse.result.account_data.OwnerCount ?? null,
        flags: infoResponse.result.account_data.Flags ?? null,
        ledger_index: infoResponse.result.ledger_index ?? t0Ledger
      },
      transactions: t0Tx.transactions.map((entry) =>
        normalizeTx(entry, borrower)
      )
    };

    const features = extractCreditFeatures({
      accountEvidence,
      accountLines: [],
      accountObjects: objectsResponse.objects
    });
    const assessment = enhancedPaperRisk(features);
    const outcome = currentOutcome(loan);

    return {
      borrower,
      loan_id: loanId,
      status: "T0_RECONSTRUCTED",
      outcome,
      adverse: isAdverse(outcome),
      origin,
      t0_ledger: t0Ledger,
      t0_coverage: {
        origin_search_complete: txHistory.complete,
        t0_tx_complete: t0Tx.complete,
        t0_objects_complete: objectsResponse.complete
      },
      baseline_activity_score: assessment.baseline_activity_score,
      baseline_risk_score: 100 - assessment.baseline_activity_score,
      enhanced_paper_risk_score: assessment.paper_risk_score,
      enhanced_decision: assessment.decision,
      t0_features: features
    };
  } catch (error) {
    return {
      borrower,
      loan_id: loanId,
      status: "T0_RECONSTRUCTION_FAILED",
      origin,
      t0_ledger: t0Ledger,
      error: error?.message ?? String(error)
    };
  }
}

async function main() {
  const discovery = new xrpl.Client(DISCOVERY_WS);
  const history = new xrpl.Client(HISTORY_WS);

  await discovery.connect();
  await history.connect();

  try {
    const found = await discoverLoans(discovery);
    const rows = [];

    for (let offset = 0; offset < found.loans.length; offset += CONCURRENCY) {
      const batch = found.loans.slice(offset, offset + CONCURRENCY);
      const batchRows = await Promise.all(
        batch.map(async (loan) => {
          try {
            return await withTimeout(
              snapshotAtOrigin(history, loan),
              BORROWER_TIMEOUT_MS,
              loan.Borrower ?? loan.index ?? "borrower"
            );
          } catch (error) {
            return {
              borrower: loan.Borrower ?? null,
              loan_id: loan.index ?? loan.LedgerIndex ?? null,
              status: "T0_RECONSTRUCTION_TIMEOUT",
              error: error?.message ?? String(error)
            };
          }
        })
      );

      for (const row of batchRows) {
        rows.push(row);
        console.log(
          `[${rows.length}/${found.loans.length}] ${row.borrower}: ${row.status}`
        );
      }
    }

    const reconstructed = rows.filter((r) => r.status === "T0_RECONSTRUCTED");
    const adverse = reconstructed.filter((r) => r.adverse);

    const baselineMetrics = metricSummary(
      reconstructed,
      "baseline_risk_score",
      10
    );
    const enhancedMetrics = metricSummary(
      reconstructed,
      "enhanced_paper_risk_score",
      10
    );

    const result = {
      schema_version: "0.1",
      experiment: "DEVNET_50_RETROSPECTIVE_T0",
      observed_at: new Date().toISOString(),
      environment: "XRPL Devnet",
      discovery_server: DISCOVERY_WS,
      history_server: HISTORY_WS,
      target: TARGET,
      discovery: {
        loans_selected: found.loans.length,
        pages_scanned: found.pages,
        complete: found.complete
      },
      cohort: {
        reconstructed: reconstructed.length,
        origin_not_found: rows.filter((r) => r.status === "ORIGIN_NOT_FOUND").length,
        reconstruction_failed: rows.filter(
          (r) => r.status === "T0_RECONSTRUCTION_FAILED"
        ).length,
        reconstruction_timeout: rows.filter(
          (r) => r.status === "T0_RECONSTRUCTION_TIMEOUT"
        ).length,
        adverse_outcomes: adverse.length,
        defaulted: reconstructed.filter((r) => r.outcome === "DEFAULTED").length,
        impaired: reconstructed.filter((r) => r.outcome === "IMPAIRED").length
      },
      metrics: {
        baseline: baselineMetrics,
        enhanced: enhancedMetrics
      },
      information_edge_gate: {
        passed: false,
        reason:
          "Devnet retrospective evidence is a technical benchmark with survivorship bias and too little real economic outcome evidence to establish production predictive edge."
      },
      limitations: [
        "Devnet behavior is not real economic borrower behavior.",
        "Only currently discoverable Loan objects are sampled; repaid/deleted loans may be absent.",
        "Current loan state is used only as outcome label; T0 features are reconstructed from pre-origination ledger state.",
        "Transaction/history pagination may be incomplete and is recorded per row.",
        "No production credit decision is authorized by this experiment."
      ],
      rows
    };

    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    const file = path.join(
      ARTIFACT_DIR,
      `lab-003c-devnet50-${Date.now()}.json`
    );
    await fs.writeFile(file, JSON.stringify(result, null, 2), "utf8");

    console.log("\n=== DEVNET 50 RESULT ===");
    console.log(`Selected: ${found.loans.length}`);
    console.log(`T0 reconstructed: ${reconstructed.length}`);
    console.log(`Adverse outcomes: ${adverse.length}`);
    console.log(
      `Baseline top-10 adverse recall: ${baselineMetrics.top_k_adverse_recall}`
    );
    console.log(
      `Enhanced top-10 adverse recall: ${enhancedMetrics.top_k_adverse_recall}`
    );
    console.log("Information edge gate: NOT PASSED");
    console.log(`Evidence: ${file}`);

    if (found.loans.length < Math.min(TARGET, 10)) {
      process.exitCode = 2;
    }
  } finally {
    if (discovery.isConnected()) await discovery.disconnect();
    if (history.isConnected()) await history.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
