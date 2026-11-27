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

const flagged = [proto('ui-fall', { change_7d: -30, tvl_usd: 22e6 }), proto('ui-young', { listed_at: '2026-11-10', tvl_usd: 23e6 }), proto('ui-dear', { chains: ['Ethereum'], tvl_usd: 24e6 }), proto('ui-nowhere', { chains: [], tvl_usd: 25e6 })];

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

test('a desktop tour: every verdict chip, preset, filter, column sort, row, tab and key', { skip }, async () => {
  await begin('');
  await run(`
    const n = (s) => T.qa(s).length, ranks = () => T.qa('.li .rk').map((c) => +c.textContent), cell = (i) => T.qa('.li td:nth-child(' + i + ')').map((c) => c.textContent);
    if (n('.li') < 100 || n('.chk .ok') !== 6 || n('.chk .bad') !== 0) throw new Error('rows ' + n('.li') + ' ok ' + n('.chk .ok'));
    if (ranks().some((r, i) => r !== i + 1)) throw new Error('the board does not open ranked by implied value');
    if (T.q('#list th[aria-sort=ascending]').textContent.trim() !== '# ▲') throw new Error('the sorted column is not marked');
    for (const k of ['rank', 'name', 'implied', 'tvl', 'g7', 'age', 'odds', 'cost', 'hours', 'win', 'verdict']) { T.click(T.q('[data-sort=' + k + ']')); T.click(T.q('[data-sort=' + k + ']')); }
    T.click(T.q('[data-sort=name]'));
    const names = cell(2).map((t) => t.toLowerCase());
    if (!(names[0] < names[names.length - 1])) throw new Error('names are not A to Z');
    T.click(T.q('[data-sort=rank]'));
    T.click(T.q('[data-sort=rank]'));
    if (ranks()[0] !== n('.li')) throw new Error('a second click does not reverse the order');
    T.click(T.q('[data-sort=rank]'));
    for (const v of ['farm', 'watch', 'skip', 'skip', 'watch', 'farm']) T.click(T.q('[data-v=' + v + ']'));
    T.click(T.q('[data-v=farm]'));
    if (T.q('[data-v=farm]').getAttribute('aria-pressed') !== 'false') throw new Error('the verdict filter did not clear');
    for (const p of ['farm', 'early', 'cheap', 'odds', 'old', 'wl']) { T.click(T.q('[data-p=' + p + ']')); T.click(T.q('[data-p=' + p + ']')); }
    T.input(T.q('#q'), 'zzzz-no-such-protocol');
    if (n('.li') !== 0 || !/No protocol matches/.test(T.q('#list').textContent)) throw new Error('no empty state');
    for (const q of ['proto', '']) T.input(T.q('#q'), q);
    const opts = (id) => [...T.q('#' + id).options].map((o) => o.value);
    for (const id of ['cat', 'chain']) for (const v of [opts(id)[1], '']) T.input(T.q('#' + id), v);
    for (const v of ['s', 'm', 'l', '']) T.input(T.q('#size'), v);
    T.click(T.qa('.li')[4]);
    if (T.qa('.li')[4].getAttribute('aria-selected') !== 'true' || !/#5 of /.test(T.q('#dh').textContent)) throw new Error('the row did not open');
    T.key(T.qa('.li')[1], 'Enter'); T.key(T.qa('.li')[2], ' '); T.key(T.q('.li'), 'x'); T.key(document.body, 'Enter');
    for (const t of ['evidence', 'live', 'board']) T.click(T.q('[data-g=mid] [data-t=' + t + ']'));
    for (const t of ['ov', 'plan', 'data']) T.click(T.q('[data-g=det] [data-t=' + t + ']'));
    if (n('#d-plan .plan tbody tr') !== 7) throw new Error('six steps and their total');
    if (!/leave out trading fees/.test(T.q('#d-plan').textContent)) throw new Error('the plan does not say what it leaves out');
    const total = T.q('#d-plan .sum td:nth-child(3)').textContent;
    if (!T.q('#d-plan .eq').textContent.includes('total cost' + total)) throw new Error('the two totals differ');
    for (const v of [2, 20, 8]) T.input(T.q('#drop'), v);
    T.input(T.q('#drop'), 2); T.click(T.q('#rst'));
    window.__csv = null; const make = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { b.text().then((t) => { window.__csv = t; }); return make(b); };
    T.click(T.q('[data-export]'));
    for (let i = 0; i < 200 && window.__csv === null; i++) await new Promise((ok) => setTimeout(ok, 25));
    const csv = window.__csv;
    for (const want of ["'=SUM(1)", "'+1,", "'-1,", "'@x", '"a,b"', '"q""uote"']) if (!csv.includes(want)) throw new Error('csv lacks ' + want);
    if (!csv.includes('"two\\nlines"')) throw new Error('csv does not quote a newline');
    if (csv.split('\\n')[0].split(',').length !== 22) throw new Error('csv header is not 22 columns');
    T.click(T.q('[data-evid]'));
    if (T.q('[data-g=mid][data-p=evidence]').hidden) throw new Error('the checks button did not open the evidence');
    T.click(T.q('#ftog'));
    T.click(T.q('#ftog'));
    const tip = T.q('[data-tip]');
    for (const [x, y] of [[5, 5], [innerWidth - 2, innerHeight - 2], [300, 300]]) tip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
    document.body.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    document.body.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    tip.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); tip.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  `);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await run(`
    for (const m of ['det', 'list']) T.click(T.q('[data-go=' + m + ']'));
    T.click(T.q('[data-g=mid] [data-t=board]'));
    T.click(T.q('.li'));
    if (T.q('.app').dataset.m !== 'det') throw new Error('a tap on a row does not open the detail on a phone');
    T.click(T.q('[data-go=list]')); T.key(T.q('.li'), 'Enter');
    if (T.q('.app').dataset.m !== 'det') throw new Error('Enter on a row does not open the detail on a phone');
  `);
  await page.send('Emulation.clearDeviceMetricsOverride');
  await run('1');
  await end('the desktop tour');
});

test('deep links restore the view: a protocol, tabs, filters, search, scenario and sort', { skip }, async () => {
  await visit(`#p=${slugs[10]}&mt=evidence&dt=plan&v=watch&preset=odds&q=proto&drop=15&s=tvl.0&view=det`, `
    if (T.q('#dropv').textContent !== '15%') throw new Error('drop not restored');
    if (T.q('.app').dataset.m !== 'det') throw new Error('view not restored');
    if (!T.q('[data-g=mid] [data-t=evidence]').getAttribute('aria-selected').includes('true')) throw new Error('tab not restored');
    if (!T.q('[data-v=watch]').getAttribute('aria-pressed').includes('true')) throw new Error('verdict not restored');
    if (T.q('#q').value !== 'proto') throw new Error('search not restored');
    if (T.q('#list th[aria-sort=descending]').textContent.trim() !== 'TVL ▼') throw new Error('sort not restored');
  `);
  await visit('#s=nothing.1', `if (T.q('#list th[aria-sort]').textContent.trim() !== '# ▲') throw new Error('an unknown column changed the sort');`);
  await visit('#p=ui-fall&dt=ov', `if (!T.qa('#d-ov .risk li').length) throw new Error('a protocol with a risk flag shows none');`);
  await visit('#p=ui-young', `if (!/days on DefiLlama/.test(T.q('#d-ov').textContent)) throw new Error('no young flag');`);
  await visit('#p=ui-dear&dt=plan', `if (!/Do not run: fees exceed the deposit/.test(T.q('#d-plan').textContent)) throw new Error('a farm that costs more than its deposit is not stopped');`);
  await visit('#p=ui-nowhere', `if (!/on its main chain/.test(T.q('#dh').textContent)) throw new Error('a protocol with no chain');`);
  await visit('#p=not-a-protocol&mt=evidence&dt=data&view=det&preset=farm', `if (!/#1 of /.test(T.q('#dh').textContent)) throw new Error('an unknown protocol should open rank 1');`);
  await visit('#drop=2&v=skip&mt=live&dt=ov&view=list');
});

test('a phone-sized page draws its own charts', { skip }, async () => {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await visit('#view=det', `
    T.click(T.q('[data-g=mid] [data-t=evidence]'));
    if (!T.q('#evid svg') || !T.q('#d-ov svg')) throw new Error('no chart');
  `);
  await page.send('Emulation.clearDeviceMetricsOverride');
});

test('the real snapshot draws 192 rows, all six self-checks pass, and the page agrees with board.json', { skip: skip || !existsSync(join(root, 'input/snapshot.json')) && 'no input/snapshot.json' }, async () => {
  const real = tmp();
  const result = await build({ input: join(root, 'input/snapshot.json'), output: real, dashboard: join(root, 'dashboard'), screenshots: join(root, 'screenshots') });
  assert.equal(result.code, 0);
  page.problems.length = 0;
  await page.open(`file://${real}/dashboard/index.html`);
  assert.equal(await page.eval('document.querySelectorAll(".li").length'), 192);
  assert.equal(await page.eval('document.querySelectorAll(".chk .ok").length'), 6);
  assert.equal(await page.eval('document.querySelectorAll(".chk .bad").length'), 0);
  assert.equal(await page.eval('document.querySelector("[data-v=farm] b").textContent'), '13');
  page.collectProblems();
  assert.deepEqual(page.problems, []);
  await page.coverage();
});

test('the characters of the page\'s own scripts that ran', { skip }, () => {
  const report: string[] = [];
  for (const name of ['model.js', 'plan.js', 'app.js']) {
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
