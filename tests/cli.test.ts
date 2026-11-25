// main.ts and the scripts, run as the processes they are: exit codes, output and the rules the lint enforces.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { synth } from './helpers.ts';

const root = new URL('..', import.meta.url).pathname;
const tmp = (): string => mkdtempSync(join(tmpdir(), 'radar-cli-'));
const node = (args: string[], cwd = root, env: Record<string, string> = {}) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });

test('main.ts reads the snapshot and writes the grader\'s files, exiting 0', () => {
  const dir = tmp();
  const input = join(dir, 'snapshot.json');
  writeFileSync(input, JSON.stringify(synth(420, 7)));
  const out = join(dir, 'out');
  const r = node(['main.ts', '--input', input], root, { MAKEFUN_OUTPUT_DIR: out });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^token radar: \d+ protocols, \d+ rows ranked, 4 dashboard files, 3 screenshots\n$/);
  assert.deepEqual(readdirSync(out).sort(), ['board.json', 'dashboard', 'data.js', 'dossier.json', 'screenshots']);
});

test('main.ts says what is wrong and exits non-zero when it cannot build', () => {
  const missing = node(['main.ts', '--input', join(tmp(), 'nope.json'), '--output', tmp()]);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /no snapshot at/);
  const bad = join(tmp(), 'bad.json');
  writeFileSync(bad, '{');
  const notJson = node(['main.ts', '--input', bad, '--output', tmp()]);
  assert.equal(notJson.status, 2);
  assert.match(notJson.stderr, /not JSON/);
  const noShots = node(['main.ts', '--input', join(tmp(), 'x.json'), '--output', tmp(), '--screenshots', tmp()]);
  assert.equal(noShots.status, 2, 'the missing snapshot is reported before the screenshots are looked at');
});

/** A throw-away repository the lint can be pointed at: its script, a dashboard and a clean main.ts. */
function tree(): string {
  const dir = tmp();
  for (const d of ['scripts', 'dashboard', 'lib']) mkdirSync(join(dir, d));
  copyFileSync(join(root, 'scripts/lint.ts'), join(dir, 'scripts/lint.ts'));
  writeFileSync(join(dir, 'dashboard/app.js'), 'const x = 1;\n');
  writeFileSync(join(dir, 'main.ts'), 'export const a = 1;\n');
  return dir;
}
const lint = (dir: string) => node(['scripts/lint.ts'], dir);

test('the lint passes a clean tree and names each rule it enforces', () => {
  const ok = tree();
  assert.equal(lint(ok).status, 0);
  assert.match(lint(ok).stdout, /lint: ok \(dashboard \d+ of 64800 bytes\)/);
  const breaches: [string, string, RegExp][] = [
    ['main.ts', 'const a = 1;\t\n', /has a tab/],
    ['main.ts', 'const a = 1;  \n', /trailing whitespace/],
    ['main.ts', 'const a = 1;', /does not end with a newline/],
    ['main.ts', 'const t = Date.now();\n', /reads the clock or a random source/],
    ['lib/x.ts', 'const r = Math.random();\n', /reads the clock or a random source/],
    ['lib/x.ts', 'const v: any = 1;\n', /uses any/],
    ['lib/x.ts', 'const v = x as any;\n', /uses any/],
    ['dashboard/app.js', 'fetch("https://example.com");\n', /names a network address/],
    ['dashboard/model.js', 'const t = new Date();\n', /reads the clock or a random source/],
    ['dashboard/big.js', `const x = "${'a'.repeat(65_000)}";\n`, /the budget is 64800/],
    ['makefun-keypair.json', '[]\n', /a keypair file sits in the repository/],
  ];
  for (const [file, text, expected] of breaches) {
    const dir = tree();
    writeFileSync(join(dir, file), text);
    const r = lint(dir);
    assert.equal(r.status, 1, file);
    assert.match(r.stderr, expected, file);
  }
  const several = tree();
  writeFileSync(join(several, 'main.ts'), 'const a = 1;\t \n');
  assert.match(lint(several).stderr, /lint: 2 problems/);
  const one = tree();
  writeFileSync(join(one, 'main.ts'), 'const a = 1; \n');
  assert.match(lint(one).stderr, /lint: 1 problem\n/);
  const skipped = tree();
  mkdirSync(join(skipped, 'out'));
  writeFileSync(join(skipped, 'out/junk.ts'), 'bad\t\n');
  mkdirSync(join(skipped, '.github'));
  writeFileSync(join(skipped, '.github/ci.yml'), 'a: 1\t\n');
  assert.match(lint(skipped).stderr, /\.github\/ci\.yml:1 has a tab/, 'the .github folder is checked');
  assert.ok(!/out\/junk/.test(lint(skipped).stderr), 'build output is not');
});

test('the repository itself passes its own lint, and its two runs match byte for byte', { skip: !existsSync(join(root, 'input/snapshot.json')) && 'no input/snapshot.json' }, () => {
  const l = node(['scripts/lint.ts']);
  assert.equal(l.status, 0, l.stderr);
  const v = node(['scripts/verify.ts']);
  assert.equal(v.status, 0, v.stderr);
  assert.match(v.stdout, /verify: two runs wrote the same 10 files, byte for byte/);
  assert.ok(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('npm run lint'));
});
