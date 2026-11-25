# Agent Instructions

Token radar for make.fun's `token-radar-01` bounty: values pre-token DeFi protocols, prices a farm of each as payoff draws, and shows a trader what to do.

## Runtime
Node 22.18+ (`.nvmrc`), TypeScript run as-is by Node, **standard library only**. No `npm install`, no network at runtime.

## Commands
| Task | Command |
|------|---------|
| Build output | `npm start` (writes `out/`; needs the kit's `input/snapshot.json`) |
| Tests, all, with the 100% coverage gate | `npm test` (about 45 s; the browser tests need Chrome, or `CHROME=<path>`) |
| Quick tests, no browser | `npm run test:unit` |
| Two-run byte check | `npm run verify` |
| Conventions | `npm run lint` (rules and reasons: `CONVENTIONS.md`) |
| Syntax check | `node --check dashboard/model.js dashboard/app.js` |

## Layout
- `dashboard/model.js`: the engine. Classic script, sets `RadarModel`. Run by the page AND by `main.ts`: change it in one place.
- `dashboard/app.js`, `app.css`, `index.html`: the page. It reads `../data.js` (written by `main.ts`).
- `main.ts`: entrypoint. Reads `/input/snapshot.json`, writes `/output` (`MAKEFUN_OUTPUT_DIR` overrides).
- `lib/plan.ts`: the farm plan in words, coverage and diligence text. `lib/snapshot.ts`: snapshot parser, gate check.
- `vendor/makefun-board.ts`: house library for `dossier.json`. Do not edit.
- `screenshots/`: three PNGs, 800+px short side, 300 to 350 KB each; retake them after any change to the page.
- `docs/adr/`: decisions. Add one when the model changes.

## Conventions
Full rules, with reasons and the dashboard's size-budget exceptions: `CONVENTIONS.md`. Enable hooks with `git config core.hooksPath .githooks`.
- Deterministic output: no `Date.now()`, no `Math.random()`; a fixed seed and fold order. Two runs must match byte for byte.
- No protocol name is ever special-cased. Values come from snapshot figures only.
- Dashboard source (all files in `dashboard/`) stays under 64,800 bytes in total: the judge reads it from the dossier.
- No network address anywhere in `dashboard/`.
- Never commit `makefun-keypair.json`, `.env`, `input/` or `out/`.
- A change to the model needs a test (`tests/model.test.ts`) and an ADR note; a change to the page needs a step in `tests/ui.test.ts`, which fails if any character of `app.js` or `model.js` never ran.

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: (the agent model's name and attribution byline)
```
Example: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
