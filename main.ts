// Token radar for make.fun's token-radar-01 (Node 22, standard library only).
//
// Reads the sealed snapshot (/input/snapshot.json, or --input), runs the engine in dashboard/model.js (the same
// file the page runs in the browser), writes the ranked board to /output/board.json, the dashboard's data to
// /output/data.js, copies dashboard/ and screenshots/ to /output, and last writes /output/dossier.json with the
// house library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COVERAGE, DILIGENCE, LEDGER, PROSE, farmSteps, stepText } from './lib/plan.ts';
import { boardIssue, parseSnapshot } from './lib/snapshot.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the dossier's bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// The engine is a classic script that sets RadarModel on the global object: here, and in the page.
await import('./dashboard/model.js');
const M = (globalThis as unknown as { RadarModel: { run: (s: unknown) => Run } }).RadarModel;

interface Run {
  rows: Row[];
  total: number;
}
interface Row {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chain: string;
  tx: number;
  capital: number;
  hold: number;
  weeks: number;
  carry: number;
  implied: number;
  ifl: number;
  odds: number;
  mult: number;
  tvl: number;
}

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const run = M.run(snapshot);

// The plan in words, from the same deposit, gas and hold the engine prices.
const plans: Record<string, { text: string; cost: string; time: string }[]> = {};
const board = run.rows.map((r) => {
  const steps = farmSteps({ name: r.name, category: r.category, chain: r.chain, tx: r.tx, capital: r.capital, hold: r.hold, weeks: r.weeks, carry: r.carry });
  plans[r.slug] = steps;
  return {
    rank: r.rank,
    slug: r.slug,
    name: r.name,
    implied_value_usd: r.implied,
    farm_steps: steps.map(stepText),
    value_if_launch_usd: r.ifl,
    token_odds: r.odds,
    multiple: r.mult,
    tvl_usd: r.tvl,
  };
});

const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the engine wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
// The page's data: the sealed snapshot itself (the page refits both models from it), the plans in words, and the
// board's implied values, which the page compares with its own so the two runs are checked against each other.
writeFileSync(
  join(out, 'data.js'),
  `window.SNAPSHOT=${JSON.stringify(snapshot)};\nwindow.PLANS=${JSON.stringify(plans)};\nwindow.BOARD=${JSON.stringify(board.map((b) => [b.slug, b.implied_value_usd]))};\nwindow.TEXT=${JSON.stringify({ coverage: COVERAGE, checklists: DILIGENCE, ledger: LEDGER, prose: PROSE })};\n`,
);

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const files = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(`token radar: ${run.total} protocols, ${board.length} rows ranked, ${files.length} dashboard files, ${shots.length} screenshots\n`);
