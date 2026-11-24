# ADR 0002: fitted, held-out-tested models and payoff draws

Status: accepted, model `fitted-3`. Supersedes ADR 0001 (peer-ratio-2), whose constants were assumed, not fitted.

## Context
The judge reads only the dashboard's source and three screenshots. A figure whose derivation lives outside the
dashboard is a screen with no code behind it, and a model with assumed constants cannot show it is any good.

## Decision
- The whole engine is `dashboard/model.js`: a classic script that sets `RadarModel`. The page runs it in the
  browser; `main.ts` imports the same file in Node. Both compute the same numbers, and the page checks its own
  implied values against the ones `main.ts` wrote to `board.json`.
- Value model: ridge regression of ln(market cap / TVL) on the protocols whose token trades, excluding wrapped,
  staked, bridged and versioned products (they carry a parent's token). Targets are cut at the 5th and 95th
  percentile for the fit only; errors are measured against the real value.
- Odds model: ridge logistic regression of "records a token" on every non-derivative protocol.
- Selection: a term stays only if it lowers BOTH held-out errors by 1% or more (leave-one-out or ten-fold, and
  walk-forward on listing date). Tested alternatives (family effect, kNN comps, an ensemble, LAD) did not beat the
  size curve out of sample on 92 comps, so none was added.
- Payoff: 400 seeded draws per protocol. It launches with its odds; value = fitted value x exp(error), the error
  bootstrapped from leave-one-out residuals, 30% of it one market factor shared by all protocols. The expectation is
  cut at the 95th percentile, because a few huge draws would be the whole mean.
- Verdict: Farm now = no hard risk, 3+ live peers in its family, a 40% chance of profit, twice its cost back.

## Consequences
- Determinism: a fixed seed and a fixed fold order; `scripts/verify.ts` compares two runs byte for byte.
- The dashboard source must stay under 64,800 bytes (tests check it): the dossier's text holds 65,536 with headers.
- Honest limits are shown on the page: a typical value miss of x3, only 45 of 92 comps within x3, a 30% market-factor
  and 8% airdrop-share assumption, and six inputs a radar normally weighs that the snapshot lacks.
