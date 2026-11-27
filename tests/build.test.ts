// The build: every way it can refuse, and the files it writes when it does not.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { argOf, build, resolveOptions } from '../lib/build.ts';
import { proto, snap, synth } from './helpers.ts';

const root = new URL('..', import.meta.url).pathname;
const tmp = (): string => mkdtempSync(join(tmpdir(), 'radar-test-'));
const write = (obj: unknown): string => {
  const file = join(tmp(), 'snapshot.json');
  writeFileSync(file, JSON.stringify(obj));
  return file;
};
const shots = (n: number, extra: (dir: string) => void = () => {}): string => {
  const dir = tmp();
  readdirSync(join(root, 'screenshots')).slice(0, n).forEach((f) => copyFileSync(join(root, 'screenshots', f), join(dir, f)));
  extra(dir);
  return dir;
};
const opts = (over: Partial<Parameters<typeof build>[0]> = {}) => ({ input: write(synth(420, 7)), output: tmp(), dashboard: join(root, 'dashboard'), screenshots: shots(3), ...over });

test('options come from the command line, then the environment, then the grader\'s paths', () => {
  assert.equal(argOf(['--a', 'x'], 'a', 'd'), 'x');
  assert.equal(argOf(['--a=y'], 'a', 'd'), 'y');
  assert.equal(argOf(['--a'], 'a', 'd'), 'd');
  assert.equal(argOf([], 'a', 'd'), 'd');
  assert.deepEqual(resolveOptions([], {}, '/r'), { input: '/input/snapshot.json', output: '/output', dashboard: '/r/dashboard', screenshots: '/r/screenshots' });
  assert.deepEqual(resolveOptions(['--input', 'in.json'], { MAKEFUN_OUTPUT_DIR: 'out' }, '/r'), { input: 'in.json', output: 'out', dashboard: '/r/dashboard', screenshots: '/r/screenshots' });
  assert.equal(resolveOptions(['--input=somedir'], {}, '/r').input, 'somedir/snapshot.json');
  assert.equal(resolveOptions(['--output', 'o', '--dashboard', 'd', '--screenshots', 's'], { MAKEFUN_OUTPUT_DIR: 'ignored' }, '/r').output, 'o');
});

test('a good build writes the board, the page\'s data, the dashboard, the screenshots and the dossier', async () => {
  const o = opts({ dashboard: (() => { const d = tmp(); for (const f of readdirSync(join(root, 'dashboard'))) copyFileSync(join(root, 'dashboard', f), join(d, f)); writeFileSync(join(d, '.hidden'), 'x'); mkdirSync(join(d, 'sub')); return d; })(), screenshots: shots(3, (d) => writeFileSync(join(d, '.dot.png'), 'x')) });
  const result = await build(o);
  assert.equal(result.code, 0);
  assert.match(result.message, /^token radar: \d+ protocols, \d+ rows ranked, 5 dashboard files, 3 screenshots$/);
  assert.deepEqual(readdirSync(o.output).sort(), ['board.json', 'dashboard', 'data.js', 'dossier.json', 'screenshots']);
  assert.deepEqual(readdirSync(join(o.output, 'dashboard')).sort(), ['app.css', 'app.js', 'index.html', 'model.js', 'plan.js']);
  assert.equal(readdirSync(join(o.output, 'screenshots')).length, 3);
  const board = JSON.parse(readFileSync(join(o.output, 'board.json'), 'utf8')).rows;
  assert.ok(board.length >= 100);
  assert.deepEqual(Object.keys(board[0]).sort(), ['change_7d', 'days_listed', 'farm_steps', 'implied_value_usd', 'multiple', 'name', 'rank', 'slug', 'token_record_rate', 'tvl_usd']);
  const data = readFileSync(join(o.output, 'data.js'), 'utf8');
  assert.match(board[0].farm_steps[1], /Cost: \$[\d.,]+ transfer; the deposit comes back\. Time: 10 min\.$/);
  for (const key of ['SNAPSHOT', 'BOARD', 'TEXT']) assert.ok(data.includes(`window.${key}=`), key);
  assert.ok(JSON.parse(readFileSync(join(o.output, 'dossier.json'), 'utf8')).text.includes('g.RadarModel'));
});

test('a build refuses with the right exit code: no snapshot, a broken one, too few tokens, a board the gate refuses', async () => {
  const missing = await build(opts({ input: join(tmp(), 'nope.json') }));
  assert.deepEqual([missing.code, /no snapshot at/.test(missing.message)], [2, true]);
  const broken = join(tmp(), 'broken.json');
  writeFileSync(broken, '{nope');
  const bad = await build(opts({ input: broken }));
  assert.deepEqual([bad.code, /not JSON/.test(bad.message)], [2, true]);
  const few = await build(opts({ input: write(snap(Array.from({ length: 30 }, (_, i) => proto(`x${i}`)))) }));
  assert.deepEqual([few.code, /too few to fit/.test(few.message)], [2, true]);
  const priced = Array.from({ length: 30 }, (_, i) => proto(`t${i}`, { tvl_usd: 1e7 + i * 1e6, mcap_usd: 5e6 + i * 1e6, symbol: 'S' }));
  const small = await build(opts({ input: write(snap([...priced, ...Array.from({ length: 20 }, (_, i) => proto(`e${i}`))])) }));
  assert.deepEqual([small.code, /gate refuses: the board has \d+ rows/.test(small.message)], [1, true]);
});

test('a build without three whole screenshots with plain names is refused', async () => {
  for (const [n, words] of [[0, '0 images'], [1, '1 image:'], [2, '2 images']] as const) {
    const r = await build(opts({ screenshots: shots(n) }));
    assert.equal(r.code, 1);
    assert.ok(r.message.includes(`holds ${words}`), r.message);
  }
  assert.equal((await build(opts({ screenshots: join(tmp(), 'absent') }))).code, 1);
  const named = await build(opts({ screenshots: shots(3, (d) => copyFileSync(join(d, readdirSync(d)[0]!), join(d, 'bad name.png'))) }));
  assert.deepEqual([named.code, /bad name\.png: a name is letters/.test(named.message)], [1, true]);
});

test('a dossier that cannot be built is a refusal; any other failure is not swallowed', async () => {
  const notPng = await build(opts({ screenshots: shots(3, (d) => writeFileSync(join(d, 'broken.png'), 'not an image')) }));
  assert.deepEqual([notPng.code, /dossier cannot be built/.test(notPng.message)], [1, true]);
  const out = tmp();
  mkdirSync(join(out, 'dossier.json'));
  await assert.rejects(build(opts({ output: out })), /EISDIR/);
  assert.ok(existsSync(join(out, 'board.json')));
});

test('a non-error thrown by the engine is rethrown, an error is reported', async () => {
  const model = (globalThis as unknown as { RadarModel: { run: unknown } }).RadarModel;
  const real = model.run;
  try {
    model.run = () => {
      throw 'plain string';
    };
    await assert.rejects(build(opts()), (e) => e === 'plain string');
    model.run = () => {
      throw new Error('engine fell over');
    };
    const r = await build(opts());
    assert.deepEqual([r.code, r.message], [2, 'token radar: engine fell over']);
  } finally {
    model.run = real;
  }
});
