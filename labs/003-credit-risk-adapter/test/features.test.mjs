import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCreditFeatures,
  baselineActivityScore,
  enhancedPaperRisk
} from "../src/features.mjs";

const subject = "rSubject";

function baseEvidence(transactions = []) {
  return {
    verification: "VERIFIED",
    subject: { address: subject },
    account: { balance_xrp: 10, owner_count: 0 },
    transactions
  };
}

test("loan default flag creates a verified high-risk signal", () => {
  const features = extractCreditFeatures({
    accountEvidence: baseEvidence(),
    accountObjects: [{
      LedgerEntryType: "Loan",
      Flags: 0x00010000,
      Borrower: subject
    }]
  });

  const assessment = enhancedPaperRisk(features);
  assert.equal(features.lending.defaulted_loan_count, 1);
  assert.equal(assessment.decision, "HIGH_RISK");
  assert.match(assessment.reason, /default flag/i);
});

test("loan impairment creates REVIEW rather than invented default", () => {
  const features = extractCreditFeatures({
    accountEvidence: baseEvidence(),
    accountObjects: [{
      LedgerEntryType: "Loan",
      Flags: 0x00020000,
      Borrower: subject
    }]
  });

  const assessment = enhancedPaperRisk(features);
  assert.equal(features.lending.defaulted_loan_count, 0);
  assert.equal(features.lending.impaired_loan_count, 1);
  assert.equal(assessment.decision, "REVIEW");
});

test("no lending outcome evidence remains UNKNOWN", () => {
  const txs = Array.from({ length: 30 }, (_, i) => ({
    account: subject,
    destination: `rOther${i}`,
    direction: "OUT",
    amount: { type: "XRP", value_xrp: 1 },
    validated: true,
    result_code: "tesSUCCESS",
    timestamp: new Date(Date.UTC(2026, 0, 1 + i * 7)).toISOString()
  }));

  const features = extractCreditFeatures({
    accountEvidence: baseEvidence(txs)
  });
  const assessment = enhancedPaperRisk(features);

  assert.ok(baselineActivityScore(features) > 0);
  assert.equal(assessment.decision, "UNKNOWN");
  assert.match(assessment.warning, /not a credit score/i);
});

test("unique counterparties are deduplicated", () => {
  const txs = [
    {
      account: subject,
      destination: "rA",
      direction: "OUT",
      amount: { type: "XRP", value_xrp: 1 },
      validated: true,
      result_code: "tesSUCCESS",
      timestamp: "2026-01-01T00:00:00.000Z"
    },
    {
      account: subject,
      destination: "rA",
      direction: "OUT",
      amount: { type: "XRP", value_xrp: 1 },
      validated: true,
      result_code: "tesSUCCESS",
      timestamp: "2026-02-01T00:00:00.000Z"
    }
  ];
  const features = extractCreditFeatures({
    accountEvidence: baseEvidence(txs)
  });
  assert.equal(features.activity.unique_counterparties, 1);
});
