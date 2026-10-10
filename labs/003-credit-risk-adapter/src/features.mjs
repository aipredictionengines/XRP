const LOAN_DEFAULT_FLAG = 0x00010000;
const LOAN_IMPAIRED_FLAG = 0x00020000;

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumXrp(transactions, direction) {
  return transactions
    .filter((tx) => tx.direction === direction && tx.amount?.type === "XRP")
    .reduce((sum, tx) => sum + (n(tx.amount?.value_xrp) ?? 0), 0);
}

function counterparties(transactions, subject) {
  const out = new Set();
  for (const tx of transactions) {
    if (tx.account && tx.account !== subject) out.add(tx.account);
    if (tx.destination && tx.destination !== subject) out.add(tx.destination);
  }
  return [...out];
}

function activitySpanDays(transactions) {
  const times = transactions
    .map((tx) => tx.timestamp ? Date.parse(tx.timestamp) : NaN)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (times.length < 2) return 0;
  return (times.at(-1) - times[0]) / 86_400_000;
}

function loanStatus(loan) {
  const flags = n(loan?.Flags) ?? 0;
  return {
    ledger_index: loan?.LedgerIndex ?? loan?.index ?? null,
    borrower: loan?.Borrower ?? null,
    defaulted: (flags & LOAN_DEFAULT_FLAG) !== 0,
    impaired: (flags & LOAN_IMPAIRED_FLAG) !== 0,
    payments_remaining: n(loan?.PaymentRemaining),
    next_payment_due_date: loan?.NextPaymentDueDate ?? null,
    principal_outstanding: loan?.PrincipalOutstanding ?? null,
    total_value_outstanding: loan?.TotalValueOutstanding ?? null,
    loan_broker_id: loan?.LoanBrokerID ?? null
  };
}

export function extractCreditFeatures({
  accountEvidence,
  accountLines = [],
  accountObjects = []
}) {
  const txs = accountEvidence?.transactions ?? [];
  const address = accountEvidence?.subject?.address ?? null;
  const validated = txs.filter((tx) => tx.validated === true);
  const successes = validated.filter((tx) => tx.result_code === "tesSUCCESS");
  const loans = accountObjects
    .filter((obj) => obj?.LedgerEntryType === "Loan")
    .map(loanStatus);

  return {
    schema_version: "0.1",
    subject: address,
    evidence_quality: {
      account_verified: accountEvidence?.verification === "VERIFIED",
      transaction_sample_size: txs.length,
      validated_transaction_count: validated.length,
      trustline_count: accountLines.length,
      owned_object_count: accountObjects.length,
      loan_object_count: loans.length
    },
    activity: {
      tx_count: txs.length,
      validated_success_rate:
        validated.length > 0 ? successes.length / validated.length : null,
      activity_span_days: activitySpanDays(txs),
      unique_counterparties: counterparties(txs, address).length,
      xrp_in: sumXrp(txs, "IN"),
      xrp_out: sumXrp(txs, "OUT")
    },
    balance: {
      xrp: n(accountEvidence?.account?.balance_xrp),
      owner_count: n(accountEvidence?.account?.owner_count)
    },
    lending: {
      loan_count: loans.length,
      defaulted_loan_count: loans.filter((x) => x.defaulted).length,
      impaired_loan_count: loans.filter((x) => x.impaired).length,
      loans
    }
  };
}

export function baselineActivityScore(features) {
  const a = features.activity;
  let score = 0;

  if (a.tx_count >= 5) score += 20;
  if (a.tx_count >= 25) score += 15;
  if (a.activity_span_days >= 30) score += 20;
  if (a.activity_span_days >= 180) score += 10;
  if (a.unique_counterparties >= 5) score += 15;
  if (a.unique_counterparties >= 20) score += 10;
  if (a.validated_success_rate !== null && a.validated_success_rate >= 0.95) {
    score += 10;
  }

  return Math.min(100, score);
}

export function enhancedPaperRisk(features) {
  const baseline = baselineActivityScore(features);
  const lending = features.lending;
  const evidenceCount =
    features.evidence_quality.transaction_sample_size +
    features.evidence_quality.trustline_count +
    features.evidence_quality.loan_object_count;

  const flags = [];

  if (!features.evidence_quality.account_verified) {
    flags.push("ACCOUNT_NOT_VERIFIED");
  }
  if (features.activity.tx_count < 5) {
    flags.push("SPARSE_TRANSACTION_HISTORY");
  }
  if (lending.impaired_loan_count > 0) {
    flags.push("IMPAIRED_LOAN_PRESENT");
  }
  if (lending.defaulted_loan_count > 0) {
    flags.push("DEFAULTED_LOAN_PRESENT");
  }

  let paperRiskScore = 50 - baseline * 0.25;
  paperRiskScore += lending.impaired_loan_count * 20;
  paperRiskScore += lending.defaulted_loan_count * 40;
  paperRiskScore = Math.max(0, Math.min(100, Math.round(paperRiskScore)));

  let decision = "UNKNOWN";
  let reason = "No validated outcome model exists yet.";

  if (lending.defaulted_loan_count > 0) {
    decision = "HIGH_RISK";
    reason = "Verified XRPL Loan object has the default flag set.";
  } else if (lending.impaired_loan_count > 0) {
    decision = "REVIEW";
    reason = "Verified XRPL Loan object has the impaired flag set.";
  } else if (evidenceCount < 5 || features.activity.tx_count < 5) {
    decision = "UNKNOWN";
    reason = "Insufficient public evidence for a borrower-level decision.";
  }

  return {
    model_type: "NON_PREDICTIVE_PAPER_HEURISTIC",
    model_version: "0.1",
    baseline_activity_score: baseline,
    paper_risk_score: paperRiskScore,
    flags,
    decision,
    reason,
    warning:
      "This is not a credit score and is not validated to predict repayment or default."
  };
}
