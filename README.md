# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/lokialice/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/lokialice/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar. From one sealed DefiLlama snapshot it values the protocols that record no token, says how likely it is that similar protocols do record one, prices a small farm of each as 400 payoff draws, and shows a trader or a fund what to do: which farms clear the bar, a basket of them, and the evidence for every number. The models are refitted and tested held-out in the browser by `dashboard/model.js`, the same file `main.ts` runs in Node, so the page and `board.json` agree byte for byte.

## Run it

```sh
mkdir -p out && node main.ts --input input/snapshot.json --output out
node --test tests/engine.test.ts   # needs the kit's input/snapshot.json
node scripts/verify.ts             # two runs, every byte compared
```

Open `out/dashboard/index.html`: it reads `../data.js` and needs no network.

## How it decides

- **Value if it launches** = TVL x a fitted multiple (ridge on the protocols whose token trades).
- **Token odds** = how often protocols like it record a token (ridge logistic on every protocol): a base rate, never a forecast.
- **Implied value** = value if it launches x odds, with a low and high from the value model's own errors.
- A term enters a model only if it lowers the held-out error in two tests: leave-one-out and walk-forward. On this snapshot only the size curve earns a place in the value model, with a typical miss of x3.0, so the page says the tail is wide.
- **Verdicts** come from 400 payoff draws per protocol (the token launches with its odds; its value is the fitted value times a draw from the model's errors, 30% of it one market factor): Farm now needs a 40% chance of profit and twice the cost back.

See `docs/adr/` for the decisions and `AGENTS.md` for the layout.

---

<sub>Entered on [make.fun](https://make.fun/?ref=expdvskd&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
