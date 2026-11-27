# ADR 0003: rank by the value the record implies, with growth and age as stated factors

Status: accepted, model `fitted-4`. Amends ADR 0002: what is ranked, and how growth and age enter.

## Context
- The bounty asks what a token would be worth if the protocol's record stayed as it is, and says it does not
  predict whether or when one is issued. ADR 0002 ranked `value if it launches x token odds`, which mixes in
  that prediction.
- The task names TVL, seven-day growth and days with no token as the figures the value follows from. ADR 0002
  kept TVL only: on 92 priced tokens a fitted growth slope is -0.47 (standard error 2.19) and a fitted age
  slope is 0.01 (0.26), so neither can be set from this data.
- Under ADR 0002 faster growth lowered a row's value through the odds, and age showed nowhere.

## Decision
- `implied = TVL x fitted multiple x growth factor x age factor`.
- Growth factor `1 + 0.5 x change_7d`, the change cut to +/-30%: 0.85 to 1.15. Unknown change: 1.
- Age factor `0.9 + 0.2 x min(days, 730) / 730`: 0.9 at listing, 1.0 at one year, 1.1 from two years.
  Unknown date: 1.
- Both are assumptions, held in `C` (`gWeight`, `gCap`, `aWeight`, `aFull`). They enter the value fit as a fixed
  offset: the size curve is fitted around them, so they do not shift the level.
- The token record rate (the former "odds") is shown beside the value and prices the farm draws and verdicts. It
  no longer multiplies the value.
- The farm plan moved from `lib/` to `dashboard/plan.js`, so the judge reads it and the page writes it from the
  engine's own figures. Its six fees add up to the cost the board shows; ADR 0002's cost left the first transfer out.
- The page leads with a sortable board ranked by implied value. The basket view and the treemap are gone, to
  make room for the plan inside the source budget.

- Fixed: the category `Indexes` was read as a DEX, because its name contains `dex`.

## Which rows are ranked
- Every watchlist protocol, then every other protocol with no token recorded that is not a derivative product,
  of any size. ADR 0002 also left out those above the floor and off the watchlist: 20 protocols, the largest
  with $2.76B of TVL.
- One rule replaces that cut: a listing whose first word (three letters or more) is that of a protocol with a
  token is left off, and flagged when the watchlist requires it. It stands in for DefiLlama's parent record,
  which the snapshot does not carry. It reads names generically; no protocol is named in the code. It can err
  both ways: two unrelated projects may share a first word, and a product may be named unlike its parent.
- 192 rows on the sealed snapshot.

## What the page now says about its own limits
- The token rate is a fit, not a category count; both are shown. Win and payoff assume a token arrives at that
  rate and counts the deposit; the snapshot cannot say when.
- A plan's fees leave out trading fees, borrow interest and bridging in. A farm whose fees reach its deposit is
  flagged as not worth running.
- A plan's check comes before any money moves.

## Evidence and limits
- Held-out typical miss on 92 comps, with the factors: x3.07 leave-one-out, x2.60 walk-forward. Without them:
  x3.03 and x2.75. The page computes and prints both pairs.
- Seven settings of the two weights were measured before these were picked. The differences are noise at this
  sample size: the factors are NOT claimed to improve accuracy, only to cost none that these tests can see.
- A longer record and a growing pool raising a value is a judgment, not a finding.

## Tried and not adopted
Extra features, population weighting and nearest-neighbour blends were tried against the same two tests, with a
nested check. None cleared it (best nested leave-one-out gain 4.2%, bar 5%; bootstrap support 0.83, bar 0.90).
