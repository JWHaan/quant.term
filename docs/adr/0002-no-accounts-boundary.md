# ADR-0002: "No accounts" is the default; opt-in sync is in-bounds

- Status: Accepted
- Date: 2026-08-27

## Context

The product's pitch includes "no accounts, no keys" — yet the roadmap's Later
list contained "remote alerts or cross-device sync behind an opt-in
authenticated service". These read as contradictory: either the product never
has accounts, or an authenticated feature redefines what quant.term is. The
tension needed resolving before any auth-shaped work begins, and it shapes how
docs phrase the privacy story.

## Decision

- The terminal is fully functional without an account, forever. No feature in
  the current scope — Monitor, Strategy Lab, alerts, paper trading — may ever
  require one.
- An explicitly **opt-in** authenticated sync (alerts, preferences, paper
  portfolios across devices) is within the product boundary as Later work.
- Sync never touches market-data or replay paths, and the existing non-goal
  stands unchanged: no exchange credentials are ever stored, client-side or
  otherwise.
- Docs should phrase the claim as "accounts never required" rather than "no
  accounts, ever" once sync exists.

## Alternatives considered

- Absolute "never auth": the strongest privacy story and the simplest
  architecture, but closes the door on the most-requested class of convenience
  features (cross-device alerts/portfolio) forever, and pushes users toward
  third-party sync hacks instead.
- Full accounts roadmap: cloud portfolios and server-side strategy storage turn
  a privacy-first browser tool into a hosted platform — new infra, a database,
  a privacy policy, and a fundamentally different product.

## Consequences

- The privacy claim stays credible: the default path never sends identity
  anywhere. The opt-in boundary is the compromise that keeps that claim honest.
- When sync is designed, a follow-up ADR covers the concrete auth provider,
  data model, and deletion story — this ADR only fixes the boundary.
- Any future proposal that makes an account *required* violates this decision
  and needs explicit re-litigation.
