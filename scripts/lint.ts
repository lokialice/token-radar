// The rules of CONVENTIONS.md that a script can check, standard library only. Exit code 1 on any breach.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const SKIP = new Set(['.git', 'node_modules', 'out', 'input', 'vendor', 'screenshots', '.makefun']);
const TEXT = new Set(['.ts', '.js', '.css', '.html', '.md', '.json', '.yml']);
const DASHBOARD_BUDGET = 64_800;
const problems: string[] = [];

/** Every text file under `dir`, skipping what is not ours or not text. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name) || name.startsWith('.') && name !== '.github') return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return TEXT.has(extname(name)) ? [path] : [];
  });
}

const check = (ok: boolean, message: string): void => {
  if (!ok) problems.push(message);
};

for (const path of walk(root)) {
  const rel = relative(root, path);
  const text = readFileSync(path, 'utf8');
  text.split('\n').forEach((line, i) => {
    check(!/\t/.test(line), `${rel}:${i + 1} has a tab`);
    check(!/[ \t]+$/.test(line), `${rel}:${i + 1} has trailing whitespace`);
  });
  check(text.endsWith('\n'), `${rel} does not end with a newline`);
  // Output must be a pure function of the snapshot.
  if (/^(main\.ts|lib\/.*\.ts|dashboard\/(model|plan)\.js)$/.test(rel)) {
    check(!/Date\.now|Math\.random|new Date\(/.test(text), `${rel} reads the clock or a random source`);
  }
  if (/^(main\.ts|lib\/.*\.ts)$/.test(rel)) check(!/:\s*any\b|as any\b/.test(text), `${rel} uses any`);
  if (rel.startsWith('dashboard/')) check(!/https?:\/\//i.test(text), `${rel} names a network address`);
}

const dashboard = join(root, 'dashboard');
const bytes = readdirSync(dashboard).reduce((sum, n) => sum + statSync(join(dashboard, n)).size, 0);
check(bytes <= DASHBOARD_BUDGET, `dashboard/ is ${bytes} bytes; the budget is ${DASHBOARD_BUDGET}`);
check(!existsSync(join(root, 'makefun-keypair.json')), 'a keypair file sits in the repository');

if (problems.length > 0) {
  console.error(`lint: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n${problems.slice(0, 40).join('\n')}`);
  process.exit(1);
}
console.log(`lint: ok (dashboard ${bytes} of ${DASHBOARD_BUDGET} bytes)`);
