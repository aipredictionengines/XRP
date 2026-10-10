export const DEFAULT_FLAG = 0x00010000;
export const IMPAIRED_FLAG = 0x00020000;

export function currentOutcome(loan) {
  const flags = Number(loan?.Flags ?? loan?.flags ?? 0);
  if ((flags & DEFAULT_FLAG) !== 0 || loan?.defaulted === true) return "DEFAULTED";
  if ((flags & IMPAIRED_FLAG) !== 0 || loan?.impaired === true) return "IMPAIRED";
  return "ACTIVE_NO_ADVERSE_FLAG";
}

export function isAdverse(outcome) {
  return outcome === "DEFAULTED" || outcome === "IMPAIRED";
}

export function createdLoanId(entry) {
  const nodes = entry?.meta?.AffectedNodes ?? [];
  for (const wrapper of nodes) {
    const node = wrapper?.CreatedNode;
    if (node?.LedgerEntryType === "Loan" && node?.LedgerIndex) {
      return node.LedgerIndex;
    }
  }
  return null;
}

export function findLoanOrigin(entries, loanId) {
  for (const entry of entries ?? []) {
    const tx = entry?.tx_json ?? entry?.tx ?? {};
    if (tx.TransactionType !== "LoanSet") continue;
    if (createdLoanId(entry) === loanId) {
      return {
        hash: tx.hash ?? entry?.hash ?? null,
        ledger_index: entry?.ledger_index ?? tx.ledger_index ?? null,
        date: tx.date ?? null,
        account: tx.Account ?? null,
        counterparty: tx.Counterparty ?? null,
        loan_broker_id: tx.LoanBrokerID ?? null
      };
    }
  }
  return null;
}

export function metricSummary(rows, scoreKey, topK = 10) {
  const usable = rows.filter((r) => Number.isFinite(r?.[scoreKey]));
  const adverse = usable.filter((r) => isAdverse(r.outcome));
  const nonAdverse = usable.filter((r) => !isAdverse(r.outcome));

  const mean = (items) =>
    items.length
      ? items.reduce((s, r) => s + Number(r[scoreKey]), 0) / items.length
      : null;

  const ranked = [...usable].sort(
    (a, b) => Number(b[scoreKey]) - Number(a[scoreKey])
  );
  const top = ranked.slice(0, Math.min(topK, ranked.length));
  const adverseInTop = top.filter((r) => isAdverse(r.outcome)).length;

  return {
    score_key: scoreKey,
    usable: usable.length,
    adverse: adverse.length,
    non_adverse: nonAdverse.length,
    mean_adverse: mean(adverse),
    mean_non_adverse: mean(nonAdverse),
    top_k: Math.min(topK, ranked.length),
    adverse_in_top_k: adverseInTop,
    top_k_adverse_recall:
      adverse.length > 0 ? adverseInTop / adverse.length : null
  };
}

export async function binarySearchFirstTrue(low, high, predicate) {
  let lo = Number(low);
  let hi = Number(high);

  if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo > hi) {
    throw new Error("Invalid binary-search bounds.");
  }

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (await predicate(mid)) hi = mid;
    else lo = mid + 1;
  }

  return (await predicate(lo)) ? lo : null;
}
