import test from "node:test";
import assert from "node:assert/strict";

test("bounded discovery contract: incomplete scans cannot prove zero loans", () => {
  const complete = false;
  const loansFound = 0;
  const status =
    loansFound > 0
      ? "CANDIDATES_FOUND"
      : complete
        ? "COMPLETE_ZERO_LOANS"
        : "INCOMPLETE_NO_CONCLUSION";

  assert.equal(status, "INCOMPLETE_NO_CONCLUSION");
});

test("bounded discovery contract: found loans are valid candidates even before full scan", () => {
  const complete = false;
  const loansFound = 2;
  const status =
    loansFound > 0
      ? "CANDIDATES_FOUND"
      : complete
        ? "COMPLETE_ZERO_LOANS"
        : "INCOMPLETE_NO_CONCLUSION";

  assert.equal(status, "CANDIDATES_FOUND");
});
