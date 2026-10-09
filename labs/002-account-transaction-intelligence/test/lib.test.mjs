import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEvidence,
  normalizeAmount,
  normalizeTxEntry,
  rippleTimeToIso
} from "../src/lib.mjs";

test("normalizes XRP drops without inventing precision", () => {
  assert.deepEqual(normalizeAmount("1000000"), {
    type: "XRP",
    drops: "1000000",
    value_xrp: 1
  });
});

test("normalizes issued currency amount", () => {
  assert.deepEqual(
    normalizeAmount({
      currency: "USD",
      issuer: "rIssuer",
      value: "12.34"
    }),
    {
      type: "ISSUED_CURRENCY",
      currency: "USD",
      issuer: "rIssuer",
      value: "12.34"
    }
  );
});

test("classifies outgoing transaction relative to subject account", () => {
  const item = normalizeTxEntry(
    {
      tx_json: {
        hash: "ABC",
        TransactionType: "Payment",
        Account: "rSubject",
        Destination: "rOther",
        Amount: "1000000",
        Fee: "12",
        Sequence: 1,
        date: 0
      },
      meta: { TransactionResult: "tesSUCCESS" },
      ledger_index: 123,
      validated: true
    },
    "rSubject"
  );

  assert.equal(item.direction, "OUT");
  assert.equal(item.amount.value_xrp, 1);
  assert.equal(item.result_code, "tesSUCCESS");
  assert.equal(item.timestamp, "2000-01-01T00:00:00.000Z");
});

test("buildEvidence keeps risk decision UNKNOWN in LAB-002", () => {
  const evidence = buildEvidence({
    address: "rSubject",
    server: "wss://example",
    observedAt: "2026-10-09T00:00:00.000Z",
    accountInfo: {
      ledger_index: 123,
      account_data: {
        Balance: "2500000",
        Sequence: 2,
        OwnerCount: 0,
        Flags: 0
      }
    },
    txEntries: []
  });

  assert.equal(evidence.verification, "VERIFIED");
  assert.equal(evidence.account.balance_xrp, 2.5);
  assert.equal(evidence.decision, "UNKNOWN");
  assert.deepEqual(evidence.unknown_fields, []);
});

test("ripple epoch conversion is deterministic", () => {
  assert.equal(rippleTimeToIso(0), "2000-01-01T00:00:00.000Z");
});
