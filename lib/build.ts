// The build: snapshot in, the files the grader checks out. main.ts is a thin shell around this so it can be tested.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COVERAGE, DILIGENCE, LEDGER, PROSE, farmSteps, stepText } from './plan.ts';
import { boardIssue, parseSnapshot } from './snapshot.ts';
import { DossierError, buildDossier } from '../vendor/makefun-board.ts';

/** The scorer's own caps: the text cap shapes the dossier's bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

export interface BuildOptions {
  input: string;
  output: string;
  dashboard: string;
  screenshots: string;
}

/** What a build did: the process exit code and the one line to say about it. */
export interface BuildResult {
  code: number;
  message: string;
}

interface EngineRow {
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

interface Engine {
  run: (snapshot: unknown) => { rows: EngineRow[]; total: number };
}

/** --name <value> or --name=value out of the arguments, else the fallback. */
export function argOf(argv: string[], name: string, fallback: string): string {
  const at = argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < argv.length) return argv[at + 1]!;
  const withEquals = argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

/** The options a command line and an environment ask for; `here` is the repository root. */
export function resolveOptions(argv: string[], env: Record<string, string | undefined>, here: string): BuildOptions {
  const input = argOf(argv, 'input', '/input');
  return {
    input: input.endsWith('.json') ? input : join(input, 'snapshot.json'),
    output: argOf(argv, 'output', env.MAKEFUN_OUTPUT_DIR ?? '/output'),
    dashboard: argOf(argv, 'dashboard', join(here, 'dashboard')),
    screenshots: argOf(argv, 'screenshots', join(here, 'screenshots')),
  };
}

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

export async function build(options: BuildOptions): Promise<BuildResult> {
  if (!existsSync(options.input)) {
    return { code: 2, message: `token radar: no snapshot at ${options.input}: pass --input <snapshot.json|directory> or mount the sealed /input` };
  }
  // The engine is a classic script that sets RadarModel on the global object: here, and in the page.
  await import('../dashboard/model.js');
  const engine = (globalThis as unknown as { RadarModel: Engine }).RadarModel;

  let snapshot;
  let run;
  try {
    snapshot = parseSnapshot(readFileSync(options.input, 'utf8'));
    run = engine.run(snapshot);
  } catch (error) {
    if (error instanceof Error) return { code: 2, message: `token radar: ${error.message}` };
    throw error;
  }

  // The plan in words, from the same deposit, gas and hold the engine prices.
  const plans: Record<string, { text: string; cost: string; time: string }[]> = {};
  const board = run.rows.map((r) => {
    const steps = farmSteps({ name: r.name, category: r.category, chain: r.chain, tx: r.tx, capital: r.capital, hold: r.hold, weeks: r.weeks, carry: r.carry });
    plans[r.slug] = steps;
    return { rank: r.rank, slug: r.slug, name: r.name, implied_value_usd: r.implied, farm_steps: steps.map(stepText), value_if_launch_usd: r.ifl, token_odds: r.odds, multiple: r.mult, tvl_usd: r.tvl };
  });
  const issue = boardIssue(board, snapshot);
  if (issue !== null) return { code: 1, message: `token radar: the engine wrote a board the gate refuses: ${issue}` };

  mkdirSync(options.output, { recursive: true });
  writeFileSync(join(options.output, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  // The page's data: the sealed snapshot itself (the page refits both models from it), the plans in words, and the
  // board's implied values, which the page compares with its own so the two runs are checked against each other.
  writeFileSync(
    join(options.output, 'data.js'),
    `window.SNAPSHOT=${JSON.stringify(snapshot)};\nwindow.PLANS=${JSON.stringify(plans)};\nwindow.BOARD=${JSON.stringify(board.map((b) => [b.slug, b.implied_value_usd]))};\nwindow.TEXT=${JSON.stringify({ coverage: COVERAGE, checklists: DILIGENCE, ledger: LEDGER, prose: PROSE })};\n`,
  );

  const files = copyFiles(options.dashboard, join(options.output, 'dashboard'));
  const shots = copyFiles(options.screenshots, join(options.output, 'screenshots'));
  if (shots.length < 3) {
    return { code: 1, message: `token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view` };
  }
  const badName = shots.find((name) => !IMAGE_NAME.test(name));
  if (badName !== undefined) return { code: 1, message: `token radar: screenshots/${badName}: a name is letters, digits and . _ -, 1 to 128 characters` };

  // The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
  try {
    writeFileSync(join(options.output, 'dossier.json'), buildDossier(options.output, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));
  } catch (error) {
    if (error instanceof DossierError) return { code: 1, message: `token radar: the dossier cannot be built: ${error.message}` };
    throw error;
  }
  return { code: 0, message: `token radar: ${run.total} protocols, ${board.length} rows ranked, ${files.length} dashboard files, ${shots.length} screenshots` };
}
