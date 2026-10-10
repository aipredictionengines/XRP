import {
  extractCreditFeatures,
  enhancedPaperRisk
} from "./features.mjs";

const subject = "rPaperBorrower";

function tx({
  from = subject,
  to = "rCounterparty",
  result = "tesSUCCESS",
  daysAgo = 1,
  amount = 1
} = {}) {
  return {
    account: from,
    destination: to,
    direction: from === subject ? "OUT" : "IN",
    amount: { type: "XRP", value_xrp: amount },
    validated: true,
    result_code: result,
    timestamp: new Date(Date.now() - daysAgo * 86_400_000).toISOString()
  };
}

function makeEvidence(transactions) {
  return {
    verification: "VERIFIED",
    subject: { address: subject },
    account: { balance_xrp: 100, owner_count: 0 },
    transactions
  };
}

function loan(flags = 0) {
  return {
    LedgerEntryType: "Loan",
    LedgerIndex: `LOAN-${flags}`,
    Flags: flags,
    Borrower: subject,
    PaymentRemaining: 6,
    PrincipalOutstanding: "1000",
    TotalValueOutstanding: "1100",
    LoanBrokerID: "BROKER"
  };
}

const activeHistory = Array.from({ length: 30 }, (_, i) =>
  tx({ to: `rCP${i % 10}`, daysAgo: 200 - i * 6 })
);

const cohort = [
  {
    id: "PAPER-001-SPARSE",
    expected: "UNKNOWN",
    evidence: makeEvidence([tx()])
  },
  {
    id: "PAPER-002-ACTIVE-NO-LOAN",
    expected: "UNKNOWN",
    evidence: makeEvidence(activeHistory)
  },
  {
    id: "PAPER-003-CURRENT-LOAN",
    expected: "UNKNOWN",
    evidence: makeEvidence(activeHistory),
    objects: [loan(0)]
  },
  {
    id: "PAPER-004-IMPAIRED",
    expected: "REVIEW",
    evidence: makeEvidence(activeHistory),
    objects: [loan(0x00020000)]
  },
  {
    id: "PAPER-005-DEFAULT",
    expected: "HIGH_RISK",
    evidence: makeEvidence(activeHistory),
    objects: [loan(0x00010000)]
  }
];

const results = cohort.map((item) => {
  const features = extractCreditFeatures({
    accountEvidence: item.evidence,
    accountObjects: item.objects ?? [],
    accountLines: []
  });
  const assessment = enhancedPaperRisk(features);
  return {
    id: item.id,
    expected: item.expected,
    baseline_activity_score: assessment.baseline_activity_score,
    paper_risk_score: assessment.paper_risk_score,
    decision: assessment.decision,
    pass: assessment.decision === item.expected,
    loan_count: features.lending.loan_count,
    defaulted: features.lending.defaulted_loan_count,
    impaired: features.lending.impaired_loan_count
  };
});

const passed = results.filter((r) => r.pass).length;
console.log(JSON.stringify({
  cohort_type: "SYNTHETIC_LOGIC_VALIDATION",
  warning:
    "This cohort validates deterministic rule behavior only. It does not establish predictive credit performance.",
  cases: results.length,
  passed,
  all_pass: passed === results.length,
  results
}, null, 2));

if (passed !== results.length) process.exitCode = 1;
