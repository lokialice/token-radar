# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/lokialice/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/lokialice/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar. From one sealed DefiLlama snapshot it ranks the protocols that record no token (leaving off a listing that shares its first name with one that has a token) by what a token would be worth if their record stayed as it is, writes a six-step farm plan for each with its fees and hours, prices that farm as 400 payoff draws, and shows the evidence behind every number. The models are refitted and tested held-out in the browser by `dashboard/model.js`, the same file `main.ts` runs in Node, so the page and `board.json` agree byte for byte.

## Run it

```sh
npm start          # node main.ts --input input/snapshot.json --output out (needs the kit's snapshot)
npm test           # tests and the coverage gate
npm run verify     # two runs, every byte compared
```

Open `out/dashboard/index.html`: it reads `../data.js` and needs no network.

## How it decides

- **Implied value** = TVL x fitted multiple x growth factor x age factor, with a low and high from the value model's own errors. No launch is predicted.
- **Fitted multiple**: ridge on the protocols whose token trades. A fitted term stays only if it lowers the held-out error in two tests, leave-one-out and walk-forward; only the size curve does.
- **Growth and age factors** are assumptions (at most 15% and 10% either way): 92 priced tokens cannot set them. Typical miss x3.07 / x2.60 with them, x3.03 / x2.75 without, so the page says the tail is wide.
- **Token rate**: a ridge logistic fit of which protocols record a token. Not a forecast and it names no date; it prices the farm and never the value.
- **Farm plan** (`dashboard/plan.js`): six steps by category, each with a fee and a time; the fees add up to the row's cost.
- **Verdicts** come from 400 payoff draws per protocol (a token appears at the fitted rate; its worth is the implied value times a draw from the model's errors, 30% of it one market factor): Farm now needs a 40% chance of profit and twice the cost back.

## Tests and coverage

`npm test` runs 58 tests (about 45 s) and fails below 100% coverage of the engine, the farm plan and `lib/`.

| Code | Measured by | Result |
|------|-------------|--------|
| `dashboard/model.js`, `dashboard/plan.js`, `lib/*.ts` | Node's coverage, on a seeded synthetic snapshot and the sealed one | 100% lines, 100% branches, 100% functions |
| `dashboard/app.js` | Chrome over the DevTools protocol, a scripted tour of every filter, column sort, tab, slider, link, viewport and tooltip | 100% of characters ran, or the test fails |
| `main.ts`, `scripts/` | Run as processes: exit codes, output, each lint rule | behaviour tested, no line count |

100% coverage shows every line ran, not that every case is right: the tests also assert the figures, flag texts and
boundaries. The browser tests need Chrome (`CHROME=<path>` to point at one) and the sealed snapshot is not committed,
so the tests that use it skip without `input/snapshot.json`. `npm run test:unit` is the quick suite without a browser.

See `docs/adr/` for the decisions and `AGENTS.md` for the layout.

---

<sub>Entered on [make.fun](https://make.fun/?ref=expdvskd&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
