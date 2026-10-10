# LAB-004 — AgentPay Guard Contract v0.1

## Question

Can we prevent an autonomous agent from blindly signing an XRPL payment requirement while preserving a fast machine-payment workflow?

## Threat model

Treat merchant / 402 response fields as untrusted.

The guard must block or review:
- unknown network,
- unknown asset,
- unapproved destination,
- unapproved facilitator,
- invalid SourceTag,
- amount over max-per-transaction,
- daily budget overflow,
- server-declared fields outside the reviewed schema.

## Decisions

- `ALLOW`: may proceed to simulation and signing.
- `REVIEW`: human/policy escalation required; no signing.
- `BLOCK`: prohibited; no signing.

## Signing boundary

Only a transaction generated from an `ALLOW` decision may be passed to the signing layer.

The payment builder must not copy arbitrary fields from the remote requirement.

## Testnet PASS

- small approved intent => ALLOW,
- threshold intent => REVIEW in unit tests,
- over-limit intent => BLOCK,
- unknown fields => BLOCK,
- allowed transaction => `simulate = tesSUCCESS`,
- allowed transaction => validated Testnet payment,
- blocked transaction => never submitted,
- audit artifact contains no seed/private key.

## Product gate

Technical PASS is not monetization.

After LAB-004A, evaluate whether developers or teams need:
- hosted policy API,
- agent spend controls,
- merchant/recipient risk checks,
- multi-agent budgets,
- approval workflows,
- audit / reconciliation.
