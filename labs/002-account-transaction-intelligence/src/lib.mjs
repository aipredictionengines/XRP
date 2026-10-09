export const RIPPLE_EPOCH_OFFSET_SECONDS = 946684800;

export function rippleTimeToIso(seconds) {
  if (seconds === undefined || seconds === null) return null;
  const unixMs = (Number(seconds) + RIPPLE_EPOCH_OFFSET_SECONDS) * 1000;
  if (!Number.isFinite(unixMs)) return null;
  return new Date(unixMs).toISOString();
}

export function dropsToXrp(drops) {
  if (drops === undefined || drops === null) return null;
  const n = Number(drops);
  if (!Number.isFinite(n)) return null;
  return n / 1_000_000;
}

export function normalizeAmount(amount) {
  if (typeof amount === "string") {
    return {
      type: "XRP",
      drops: amount,
      value_xrp: dropsToXrp(amount)
    };
  }

  if (amount && typeof amount === "object") {
    return {
      type: "ISSUED_CURRENCY",
      currency: amount.currency ?? null,
      issuer: amount.issuer ?? null,
      value: amount.value ?? null
    };
  }

  return {
    type: "UNKNOWN",
    raw: amount ?? null
  };
}

export function normalizeTxEntry(entry, subjectAccount) {
  const tx = entry?.tx_json ?? entry?.tx ?? {};
  const meta = entry?.meta ?? {};
  const account = tx.Account ?? null;
  const destination = tx.Destination ?? null;

  let direction = "OTHER";
  if (account === subjectAccount && destination === subjectAccount) direction = "SELF";
  else if (account === subjectAccount) direction = "OUT";
  else if (destination === subjectAccount) direction = "IN";

  return {
    hash: tx.hash ?? entry?.hash ?? null,
    transaction_type: tx.TransactionType ?? null,
    account,
    destination,
    direction,
    amount: normalizeAmount(tx.Amount),
    fee_drops: tx.Fee ?? null,
    sequence: tx.Sequence ?? null,
    ledger_index: entry?.ledger_index ?? tx.ledger_index ?? null,
    validated: entry?.validated ?? null,
    result_code:
      typeof meta === "object" && meta !== null
        ? meta.TransactionResult ?? null
        : null,
    timestamp: rippleTimeToIso(tx.date)
  };
}

export function buildEvidence({
  address,
  server,
  accountInfo,
  txEntries,
  observedAt
}) {
  const data = accountInfo?.account_data ?? {};
  const transactions = (txEntries ?? []).map((entry) =>
    normalizeTxEntry(entry, address)
  );

  const unknown = [];
  if (data.Balance === undefined) unknown.push("balance");
  if (data.Sequence === undefined) unknown.push("sequence");
  if (data.OwnerCount === undefined) unknown.push("owner_count");

  return {
    schema_version: "0.1",
    source: "XRPL RPC",
    network: "XRPL Testnet",
    server,
    observed_at: observedAt,
    subject: {
      type: "XRPL_ACCOUNT",
      address
    },
    verification: "VERIFIED",
    account: {
      balance_drops: data.Balance ?? null,
      balance_xrp: dropsToXrp(data.Balance),
      sequence: data.Sequence ?? null,
      owner_count: data.OwnerCount ?? null,
      flags: data.Flags ?? null,
      ledger_index: accountInfo?.ledger_index ?? null
    },
    transaction_summary: {
      returned: transactions.length,
      incoming: transactions.filter((x) => x.direction === "IN").length,
      outgoing: transactions.filter((x) => x.direction === "OUT").length,
      self: transactions.filter((x) => x.direction === "SELF").length,
      other: transactions.filter((x) => x.direction === "OTHER").length
    },
    transactions,
    unknown_fields: unknown,
    decision: "UNKNOWN",
    decision_reason:
      "LAB-002 reports verified account evidence only; risk classification is intentionally deferred."
  };
}
