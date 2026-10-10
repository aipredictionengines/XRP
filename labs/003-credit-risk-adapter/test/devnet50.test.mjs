import test from "node:test";
import assert from "node:assert/strict";
import {
  createdLoanId,
  currentOutcome,
  findLoanOrigin,
  metricSummary
} from "../src/devnet50-lib.mjs";

test("finds LoanSet origin from CreatedNode metadata", () => {
  const entry = {
    ledger_index: 123,
    tx_json: {
      hash: "TX1",
      TransactionType: "LoanSet",
      Account: "rBroker",
      Counterparty: "rBorrower",
      LoanBrokerID: "BROKER"
    },
    meta: {
      AffectedNodes: [{
        CreatedNode: {
          LedgerEntryType: "Loan",
          LedgerIndex: "LOAN1"
        }
      }]
    }
  };

  assert.equal(createdLoanId(entry), "LOAN1");
  assert.deepEqual(findLoanOrigin([entry], "LOAN1"), {
    hash: "TX1",
    ledger_index: 123,
    date: null,
    account: "rBroker",
    counterparty: "rBorrower",
    loan_broker_id: "BROKER"
  });
});

test("current outcome respects default over impairment", () => {
  assert.equal(currentOutcome({ Flags: 0x00010000 }), "DEFAULTED");
  assert.equal(currentOutcome({ Flags: 0x00020000 }), "IMPAIRED");
  assert.equal(currentOutcome({ Flags: 0 }), "ACTIVE_NO_ADVERSE_FLAG");
});

test("metric summary computes top-k adverse recall", () => {
  const rows = [
    { outcome: "DEFAULTED", score: 90 },
    { outcome: "ACTIVE_NO_ADVERSE_FLAG", score: 80 },
    { outcome: "IMPAIRED", score: 70 },
    { outcome: "ACTIVE_NO_ADVERSE_FLAG", score: 10 }
  ];
  const m = metricSummary(rows, "score", 2);
  assert.equal(m.adverse, 2);
  assert.equal(m.adverse_in_top_k, 1);
  assert.equal(m.top_k_adverse_recall, 0.5);
});
