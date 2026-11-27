# Conventions

How code is written, tested and committed in this repository. `AGENTS.md` is the short version for agents;
this is the reasoning. Rules that a script can check are checked by `npm run lint` and the git hooks.

## Principles
- **Readability first.** Code is read more than it is written: intention-revealing names, small functions, comments
  that say why, never what.
- **KISS, YAGNI.** The simplest model that survives a held-out test. A term, option or feature is added only when
  a test shows it earns its place: the value model keeps the one term that did, and ADR 0002 records the ones that did not.
- **DRY across environments.** The engine exists once, in `dashboard/model.js`, and runs in the browser and in Node.
  Never copy its logic into `lib/` or `main.ts`.
- **Determinism is a feature.** Output is a pure function of the snapshot: a fixed seed, a fixed fold order,
  stable sorts with a slug tie-break, no clock, no `Math.random()`. Two runs match byte for byte (`npm run verify`).

## Language and runtime
- Node 22.18+, TypeScript run as-is (type stripping), **standard library only**. No install step, no network at runtime.
- `dashboard/` is plain browser JavaScript with no build step and no network address (CSS, HTML and scripts alike).
- TypeScript is not type-checked by a tool here: write types as if it were. No `any` in `lib/` or `main.ts`; use
  `unknown` and narrow. `interface` for shapes, `type` for unions; export only what another module uses.
- Immutability by default: `const`, no mutation of arguments. The one deliberate exception is the page annotating
  its own rows with `e` (economics) and `verdict` in `eco()`, because every view reads them; it is the only writer.

## Naming
- Files: `kebab-case` or single words (`model.js`, `snapshot.ts`). Tests end in `.test.ts`. ADRs are `NNNN-title.md`.
- Functions are verbs (`fitValue`, `farmSteps`, `parseSnapshot`); values and types are nouns (`Snapshot`, `Rung`).
- Booleans read as questions (`derivative`, `hard`, `kept`). Units go in the name: `tvl_usd`, `hold` (days), `tx` (USD).
- A named constant beats a magic number: tune in `C` (`dashboard/model.js`) or a top-level `const`, with a comment saying why.
- Snapshot and `board.json` fields keep the snapshot's `snake_case`; everything internal is `camelCase`.

## Functions and structure
- A function does one thing at one level of abstraction. Aim for under 30 lines; split before 50. Early returns over nesting.
- At most three parameters; beyond that pass an object.
- Errors are exceptions with a message that names the cause and the fix (`SnapshotError`); never return a sentinel for failure.
  The page never swallows an error silently: where it ignores one (history, clipboard) a comment says why.
- Order a file top-down: public entry first, helpers below, constants at the top.

## The dashboard exception
The judge reads `dashboard/` from the dossier, whose text holds 65,536 bytes with its headers, so all files together
stay under **64,800 bytes** (checked by `npm run lint`). That budget wins over style where they clash: indentation is
dropped in `app.js`, one space in `model.js`, and some functions run past 50 lines (`detail`, `evid`).
Do not "fix" them with more bytes; shorten text, move static prose to `lib/text.ts` (`PROSE`) or delete a feature.
Known debt: those long functions, and a few repeated inline styles.

## Comments and documentation
- Comment the why: an assumption, a trade-off, a trap. A comment that restates the line is deleted.
- A decision that changes the model or the layout gets an ADR in `docs/adr/`; a superseded ADR is marked, not deleted.
- Every number the page shows is computed in the page from the snapshot, or is static text from `data.js`. Never a bare literal.

## Tests
- Node's built-in runner, `npm test`, fails below **100% line, branch and function coverage** of `lib/`, `dashboard/model.js` and `dashboard/plan.js`.
  `npm run test:unit` is the quick suite without a browser; it is what the pre-commit hook runs.
- The page (`dashboard/app.js`) is driven in a real Chrome over the DevTools protocol (`tests/ui.test.ts`, no dependency
  installed); the test fails if any character of `app.js`, `model.js` or `plan.js` never ran. Set `CHROME` to point at a browser.
- `main.ts` and `scripts/` are tested as the processes they are (`tests/cli.test.ts`): exit codes, output, each lint rule.
- Data: engine tests run on a seeded synthetic snapshot with known structure and probes for each rule
  (`tests/helpers.ts`); `tests/real.test.ts` and one browser test run on the sealed snapshot. The snapshot is not
  committed, so those skip without `input/snapshot.json`.
- Name a test for the behaviour; arrange, act, assert; one behaviour per test; tests are independent and need no network.
- A change to `dashboard/model.js` or `plan.js` needs a test. 100% coverage proves every line ran, not that every case is right:
  assert the figure, the flag text and the boundary, not only that a branch was reached.

## Git
- **Trunk-based.** `main` always builds and passes `npm test`. Work on short-lived branches (`feat/`, `fix/`,
  `refactor/`, `chore/`, `docs/`) merged within days; delete them after.
- **Atomic commits**, about 100 lines, one logical change; refactors and behaviour changes are separate commits.
- **Messages:** `<type>: <imperative summary>` under 72 characters, then a body saying why.
  Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`. AI-written commits end with the
  `Co-Authored-By:` line named in `AGENTS.md`.
- Never commit keys, `.env`, `input/` or `out/`; `.gitignore` covers them and `npm run lint` refuses a keypair file.
- Hooks: `git config core.hooksPath .githooks` turns on `pre-commit` (lint and tests) and `commit-msg` (the format above).

## Review checklist
- [ ] The behaviour is tested and `npm test`, `npm run lint` and `npm run verify` pass.
- [ ] No name, list or constant tied to one protocol; every figure comes from the snapshot.
- [ ] Dashboard size is still under budget; screenshots retaken if the page changed.
- [ ] An ADR note if the model or layout changed; the commit message explains why.
