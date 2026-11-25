// The page, driven in a real Chrome: every filter, tab, slider, deep link, viewport and tooltip, with the characters of
// dashboard/app.js and model.js that ran counted. Skipped where no Chrome is installed (set CHROME to point at one).
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { build } from '../lib/build.ts';
import { Browser, Page, findChrome } from './cdp.ts';
import { proto, synth } from './helpers.ts';

const root = new URL('..', import.meta.url).pathname;
const chrome = findChrome();
const tmp = (): string => mkdtempSync(join(tmpdir(), 'radar-ui-'));

/** Names a spreadsheet or a CSV reader could misread, on small pre-token protocols so they are on the board. */
const nasty = ['=SUM(1)', '+1', '-1', '@x', 'a,b', 'q"uote', 'two\nlines', 'tab\tname'].map((name, i) => proto(`nasty${i}`, { name, tvl_usd: 30e6 + i * 1e5 }));

const flagged = [proto('ui-fall', { change_7d: -30, tvl_usd: 22e6 }), proto('ui-young', { listed_at: '2026-11-10', tvl_usd: 23e6 })];

let browser: Browser;
let page: Page;
let out: string;
let slugs: string[];
const seen = new Map<string, Uint8Array>();
const merge = (cov: Map<string, Uint8Array>): void => {
  for (const [name, ran] of cov) {
    const prev = seen.get(name) ?? new Uint8Array(ran.length);
    const next = prev.length >= ran.length ? prev : Uint8Array.from({ length: ran.length }, (_, i) => prev[i] ?? 0);
    ran.forEach((v, i) => (next[i] = (next[i] ?? 0) | v));
    seen.set(name, next);
  }
};
const url = (hash = ''): string => `file://${out}/dashboard/index.html${hash}`;
const T = `window.__t = { click: (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })), input: (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, key: (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })), q: (s) => document.querySelector(s), qa: (s) => [...document.querySelectorAll(s)] }; 1`;

/** Open a hash and put the test helpers in the page. */
async function begin(hash: string): Promise<void> {
  page.problems.length = 0;
  await page.open(url(hash));
  await page.eval(T);
}
/** Run a script in the page, then let its timers settle. */
async function run(script: string): Promise<void> {
  await page.eval(`(async () => { const T = window.__t; ${script} })()`);
  await page.eval('new Promise((ok) => setTimeout(ok, 30))');
}
/** Check nothing threw, and add what ran to the tally. */
async function end(hash: string): Promise<void> {
  page.collectProblems();
  assert.deepEqual(page.problems, [], `the page threw at ${hash}`);
  merge(await page.coverage());
}
/** Open a hash, run a script, finish. */
async function visit(hash: string, script = '1'): Promise<void> {
  await begin(hash);
  await run(script);
  await end(hash);
}

before(async () => {
  if (chrome === undefined) return;
  const input = join(tmp(), 'snapshot.json');
  const world = synth(420, 7);
  writeFileSync(input, JSON.stringify({ ...world, protocols: [...world.protocols, ...nasty, ...flagged] }));
  out = tmp();
  const result = await build({ input, output: out, dashboard: join(root, 'dashboard'), screenshots: join(root, 'screenshots') });
  assert.equal(result.code, 0, result.message);
  slugs = JSON.parse(readFileSync(join(out, 'board.json'), 'utf8')).rows.map((r: { slug: string }) => r.slug);
  browser = await Browser.launch(chrome);
  await browser.send('Browser.setDownloadBehavior', { behavior: 'deny' });
  page = await browser.page();
});
after(() => browser?.close());

const skip = chrome === undefined ? 'no Chrome found' : false;

test('a desktop tour: every verdict chip, preset, filter, sort, row, tile and key', { skip }, async () => {
  await begin('');
  await run(`
    const n = (s) => T.qa(s).length;
    if (n('.li') < 100 || n('.chk .ok') !== 5 || n('.chk .bad') !== 0) throw new Error('rows ' + n('.li') + ' ok ' + n('.chk .ok'));
    for (const v of ['farm', 'watch', 'skip', 'skip', 'watch', 'farm']) T.click(T.q('[data-v=' + v + ']'));
    T.click(T.q('[data-v=farm]'));
    if (T.q('[data-v=farm]').getAttribute('aria-pressed') !== 'false') throw new Error('the verdict filter did not clear');
    for (const p of ['farm', 'early', 'cheap', 'odds', 'old', 'wl']) { T.click(T.q('[data-p=' + p + ']')); T.click(T.q('[data-p=' + p + ']')); }
    for (const q of ['proto', 'zzzz-no-such-protocol', '']) T.input(T.q('#q'), q);
    if (!T.q('#list').textContent.length) throw new Error('no list');
    const opts = (id) => [...T.q('#' + id).options].map((o) => o.value);
    for (const id of ['cat', 'chain']) for (const v of [opts(id)[1], '']) T.input(T.q('#' + id), v);
    for (const v of ['s', 'm', 'l', '']) T.input(T.q('#size'), v);
    for (const v of opts('sortk')) T.input(T.q('#sortk'), v);
    T.input(T.q('#sortk'), 'edge');
    T.click(T.q('.li'));
    T.key(T.q('.li'), 'Enter'); T.key(T.q('#tree .dot'), ' '); T.key(T.q('.li'), 'x');
    T.click(T.q('#tree .dot'));
    for (const t of ['tree', 'basket', 'evidence', 'live']) T.click(T.q('[data-g=mid] [data-t=' + t + ']'));
    T.click(T.q('[data-g=mid] [data-t=basket]'));
    for (const [id, v] of [['bn', 3], ['bn', 12], ['bm', 10], ['bm', 1], ['bn', 8]]) T.input(T.q('#' + id), v);
    if (!T.q('#basket table')) throw new Error('no basket');
    for (const t of ['ov', 'plan', 'data']) T.click(T.q('[data-g=det] [data-t=' + t + ']'));
    for (const v of [2, 20, 8]) T.input(T.q('#drop'), v);
    T.input(T.q('#drop'), 2); T.click(T.q('#rst'));
    T.click(T.q('[data-g=mid] [data-t=basket]'));
    T.input(T.q('#drop'), 2);
    window.__csv = null; const make = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { b.text().then((t) => { window.__csv = t; }); return make(b); };
    T.click(T.q('[data-export]'));
    await new Promise((ok) => setTimeout(ok, 2300));
    const csv = window.__csv;
    for (const want of ["'=SUM(1)", "'+1,", "'-1,", "'@x", '"a,b"', '"q""uote"']) if (!csv.includes(want)) throw new Error('csv lacks ' + want);
    if (!csv.includes('"two\\nlines"')) throw new Error('csv does not quote a newline');
    if (csv.split('\\n')[0].split(',').length !== 21) throw new Error('csv header is not 21 columns');
    if (!T.q('#toast').hidden) throw new Error('the toast did not hide');
    T.click(T.q('[data-evid]'));
    T.click(T.q('#ftog'));
    T.click(T.q('#ftog'));
    const tip = T.q('[data-tip]');
    for (const [x, y] of [[5, 5], [innerWidth - 2, innerHeight - 2], [300, 300]]) tip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
    document.body.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    document.body.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    const dot = T.q('.dot'); dot.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); dot.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    T.input(T.q('#drop'), 8);
  `);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await run(`for (const m of ['mid', 'det', 'list']) T.click(T.q('[data-go=' + m + ']')); T.click(T.q('.li')); T.click(T.q('[data-go=mid]')); T.click(T.q('#tree .dot')); T.click(T.q('#selbar [data-go]'));`);
  await page.send('Emulation.clearDeviceMetricsOverride');
  await run('1');
  await end('the desktop tour');
});

test('deep links restore the view: a protocol, tabs, filters, search, scenario and basket', { skip }, async () => {
  await visit(`#p=${slugs[10]}&mt=basket&dt=plan&v=watch&preset=odds&q=proto&drop=15&bn=5&view=mid`, `
    if (T.q('#dropv').textContent !== '15%') throw new Error('drop not restored');
    if (T.q('.app').dataset.m !== 'mid') throw new Error('view not restored');
    if (!T.q('[data-g=mid] [data-t=basket]').getAttribute('aria-selected').includes('true')) throw new Error('tab not restored');
    if (!T.q('[data-v=watch]').getAttribute('aria-pressed').includes('true')) throw new Error('verdict not restored');
    if (T.q('#q').value !== 'proto') throw new Error('search not restored');
  `);
  await visit('#p=ui-fall&dt=ov', `if (!T.qa('#d-ov .risk li').length) throw new Error('a protocol with a risk flag shows none');`);
  await visit('#p=ui-young', `if (!/days on DefiLlama/.test(T.q('#d-ov').textContent)) throw new Error('no young flag');`);
  await visit('#p=not-a-protocol&mt=evidence&dt=data&view=det&preset=farm');
  await visit('#drop=2&v=skip&mt=live&dt=ov&view=list');
  await visit('#preset=early&bn=4&mt=basket');
  await visit(`#p=${slugs[3]}&q=${encodeURIComponent('=SUM')}`, `
    T.click(T.q('[data-export]'));
    const names = ['=SUM(1)', '+1', '-1', '@x', 'a,b', 'q"uote', 'two\\nlines'];
    if (!names.length) throw new Error('unreachable');
  `);
});

test('a phone-sized page draws its own treemap and charts', { skip }, async () => {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await visit('#view=det&mt=basket', `
    T.click(T.q('[data-g=mid] [data-t=evidence]'));
    if (!T.q('#evid svg')) throw new Error('no evidence chart');
  `);
  await page.send('Emulation.clearDeviceMetricsOverride');
});

test('the real snapshot draws 178 rows, all five self-checks pass, and the page agrees with board.json', { skip: skip || !existsSync(join(root, 'input/snapshot.json')) && 'no input/snapshot.json' }, async () => {
  const real = tmp();
  const result = await build({ input: join(root, 'input/snapshot.json'), output: real, dashboard: join(root, 'dashboard'), screenshots: join(root, 'screenshots') });
  assert.equal(result.code, 0);
  page.problems.length = 0;
  await page.open(`file://${real}/dashboard/index.html`);
  assert.equal(await page.eval('document.querySelectorAll(".li").length'), 178);
  assert.equal(await page.eval('document.querySelectorAll(".chk .ok").length'), 5);
  assert.equal(await page.eval('document.querySelectorAll(".chk .bad").length'), 0);
  assert.equal(await page.eval('document.querySelector("[data-v=farm] b").textContent'), '14');
  page.collectProblems();
  assert.deepEqual(page.problems, []);
  await page.coverage();
});

test('the characters of the page\'s own scripts that ran', { skip }, () => {
  const report: string[] = [];
  for (const name of ['model.js', 'app.js']) {
    const text = readFileSync(join(root, 'dashboard', name), 'utf8');
    const ran = seen.get(name)!;
    let code = 0;
    let missed = 0;
    const holes: [number, number][] = [];
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i]!)) continue;
      code++;
      if (!ran[i]) {
        missed++;
        const last = holes[holes.length - 1];
        if (last && i - last[1] < 4) last[1] = i + 1;
        else holes.push([i, i + 1]);
      }
    }
    const share = ((code - missed) / code) * 100;
    report.push(`${name}: ${share.toFixed(2)}% of ${code} characters ran`);
    for (const [a, b] of holes.slice(0, 60)) report.push(`  not run (line ${text.slice(0, a).split('\n').length}): ${text.slice(a, Math.min(b, a + 110)).replace(/\s+/g, ' ')}`);
  }
  console.log(report.join('\n'));
  assert.deepEqual(report.filter((l) => l.startsWith('  not run')), [], 'every character of the page\'s scripts should have run in the tour');
});
