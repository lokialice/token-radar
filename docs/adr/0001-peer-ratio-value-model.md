# ADR 0001: value a pre-token protocol by its category's live peers

Status: superseded by ADR 0002 (its constants were assumed, not fitted).

## Context
The bounty asks what a protocol's token would be worth if its record stayed as it is. The snapshot holds ten
fields per protocol and no price for a token that does not exist. Any answer is the entry's own claim, so it
must follow from the snapshot and be easy to audit.

## Decision
`implied = TVL x peer_ratio x launch_discount x growth_factor x tenure_factor`

- `peer_ratio`: median market cap / TVL of protocols in the same category whose token already trades, shrunk
  toward the whole market's median by `n / (n + 5)` when a category has few live peers.
- `launch_discount` 0.55: a new token has less float and trades under mature peers.
- `growth_factor` `1 + 0.5 tanh(change_7d / 35)`: bounded, so one week's spike moves a value by at most 50%.
- `tenure_factor` `0.75 + 0.25 (1 - exp(-age / 540 days))`: a longer record with no token is a firmer claim.
- Low and high values use the peers' 25th and 75th percentile ratios; confidence grades come from peer count.

## Consequences
- No protocol name is special-cased, so the same function scores every row and the board can be audited.
- Categories with no live peers fall back to the market median and are graded low confidence on the page.
- The airdrop figure per $1,000 assumes 8% of implied value is distributed pro rata to TVL. It is an
  illustration of scale, not a forecast.
- Protocols whose token trades are shown apart with the market's own value and never ranked on the board.
