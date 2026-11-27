// The engine, dashboard/model.js: its helpers, its fits, and the decisions drawn from them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import type { SnapshotProtocol } from '../lib/snapshot.ts';
import { M, proto, snap, synth } from './helpers.ts';

const priced = (category: string, n: number, tag: string): SnapshotProtocol[] => Array.from({ length: n }, (_, i) => proto(`${tag}${i}`, { category, tvl_usd: 12e6 + i * 3e6, mcap_usd: 6e6 + i * 1e6, symbol: 'S', gecko_id: 'g' }));

// ---- one run on a synthetic snapshot with a probe for each case that needs a particular shape ----
const base = synth(420, 7);
const probes: SnapshotProtocol[] = [
  ...priced('Prediction Market', 1, 'pm'), ...priced('CDP', 2, 'cdp'), ...priced('RWA', 5, 'rwa'),
  proto('pm-probe', { category: 'Prediction Market' }), proto('cdp-probe', { category: 'CDP' }), proto('bridge-probe', { category: 'Cross Chain Swap' }), proto('rwa-probe', { category: 'RWA' }),
  proto('fall', { change_7d: -20 }), proto('spike', { change_7d: 350 }), proto('young', { listed_at: '2026-11-01' }),
  proto('null7', { change_7d: null }), proto('nodate', { listed_at: null }), proto('curator', { category: 'Risk Curators', tvl_usd: 30e6 }), proto('lend', { category: 'Lending', tvl_usd: 30e6 }),
  proto('nochains', { chains: [] }), proto('foobar', { chains: ['Foobar'] }), proto('multi', { chains: ['Ethereum', 'Base'] }), proto('big', { tvl_usd: 2e9 }),
  proto('gecko-only', { gecko_id: 'g', symbol: null }), proto('cex', { category: 'CEX' }), proto('house', { tvl_usd: 80e6 }),
  proto('lst', { category: 'Liquid Staking', tvl_usd: 90e6 }),
  proto('acme-lend', { name: 'Acme Lend', mcap_usd: 1e6, symbol: 'ACME' }), proto('acme-earn', { name: 'Acme Earn' }), proto('acme-vault', { name: 'Acme Vault', tvl_usd: 70e6 }), proto('ab-one', { name: 'Ab One', mcap_usd: 1e6 }), proto('ab-two', { name: 'Ab Two' }),
  proto('foo-bridge', { category: 'Bridge' }), proto('foo-v2', { name: 'Foo V2' }), proto('wrapped-foo', { name: 'Wrapped Foo' }), proto('binance-foo', { name: 'Binance Foo' }),
];
const world = { ...base, protocols: [...base.protocols, ...probes], watchlist: [...base.watchlist, 'big', 'lst', 'acme-vault', 'ghost-slug'] };
const run = M.run(world);
const row = (slug: string): any => run.rows.find((r: any) => r.slug === slug);

test('helpers: age, token record, derivative products and families', () => {
  assert.equal(M.ageDays('2026-11-14', '2026-11-04'), 10);
  assert.equal(M.ageDays('2026-11-14', '2026-11-20'), 0);
  assert.equal(M.ageDays('2026-11-14', null), null);
  assert.equal(M.ageDays('2026-11-14', 'not a date'), null);
  assert.equal(M.noToken(proto('a')), true);
  for (const over of [{ mcap_usd: 1 }, { gecko_id: 'g' }, { symbol: 'S' }]) assert.equal(M.noToken(proto('a', over)), false);
  for (const category of ['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']) assert.equal(M.derivative(proto('a', { category })), true, category);
  for (const name of ['Foo V2', 'Foo v3', 'Foo 2.0', 'Wrapped Foo', 'Foo Staked', 'My Staking Pool', 'Binance Foo', 'coinbase thing', 'OKX Earn', 'Kraken X']) assert.equal(M.derivative(proto('a', { name })), true, name);
  for (const name of ['Foo', 'Voucher', 'Okay Protocol', 'V2 Capital', 'Unwrapped']) assert.equal(M.derivative(proto('a', { name })), name === 'Unwrapped' ? false : false, name);
  const families: [string | null, string][] = [['Lending', 'lending'], ['CDP', 'stable'], ['Dexs', 'dex'], ['DEX Aggregator', 'dex'], ['Indexes', 'vault'], ['Perps', 'derivatives'], ['RWA', 'rwa'], ['Risk Curators', 'vault'], ['Cross Chain', 'bridge'], ['Prediction Market', 'prediction'], ['Gaming', 'other'], [null, 'other']];
  for (const [category, family] of families) assert.equal(M.family(category), family, String(category));
});

test('a farm is priced from its chain, its pool size and its protocol\'s age', () => {
  const p = (over: Partial<SnapshotProtocol>) => M.cost(proto('a', over), null);
  assert.equal(p({ chains: [] }).chain, 'its main chain');
  assert.equal(p({ chains: [] }).tx, 0.6);
  assert.equal(p({ chains: ['Foobar'] }).tx, 0.6);
  assert.deepEqual([p({ chains: ['Ethereum'] }).tx, p({ chains: ['Solana'] }).tx, p({ chains: ['Base Mainnet'] }).tx], [7, 0.01, 0.08]);
  assert.equal(p({ chains: ['Ethereum', 'Base', 'Solana'] }).chain, 'Solana');
  const caps = [1e7, 6e7, 3e8, 2e9].map((tvl_usd) => p({ tvl_usd }).capital);
  assert.deepEqual(caps, [100, 250, 500, 1000]);
  const holds = [null, 30, 200, 900].map((age) => M.cost(proto('a'), age).hold);
  assert.deepEqual(holds, [45, 75, 60, 45]);
  const c = M.cost(proto('a', { chains: ['Base'] }), 900);
  assert.equal(c.weeks, 6);
  assert.ok(Math.abs(c.gas - 0.08 * (8 + 2 * 6)) < 1e-9, 'transfer, deposit, six weekly actions, exit');
  assert.ok(Math.abs(c.carry - 100 * 0.04 * (45 / 365)) < 1e-9);
  assert.ok(Math.abs(c.cost - c.gas - c.carry) < 1e-9);
});

test('the board holds the watchlist and the pre-token protocols the house rule would not set aside', () => {
  const slugs = new Set(run.rows.map((r: any) => r.slug));
  assert.ok(slugs.has('big'));
  for (const s of base.watchlist) assert.ok(slugs.has(s), s);
  assert.ok(slugs.has('house'), 'a pre-token protocol above the floor and off the watchlist is ranked too');
  assert.ok(slugs.has('ab-two'), 'a first word of two letters says nothing');
  for (const s of ['foo-bridge', 'foo-v2', 'wrapped-foo', 'binance-foo', 'cex', 'acme-earn', 'acme-lend', 'gecko-only', 'ghost-slug']) assert.ok(!slugs.has(s), `${s} is not on the board`);
  run.rows.forEach((r: any, i: number) => {
    assert.equal(r.rank, i + 1);
    if (i > 0) assert.ok(r.implied <= run.rows[i - 1].implied);
    assert.ok(Number.isInteger(r.implied) && r.implied >= 1 && r.low <= r.implied && r.implied <= r.high);
  });
});

test('each risk is raised by its own figure, and a hard risk is flagged as hard', () => {
  assert.deepEqual([row('fall').hard, row('spike').hard, row('young').hard, row('null7').hard, row('nodate').hard], [true, true, true, false, false]);
  assert.ok(row('fall').flags.some((f: string) => /TVL fell 20\.0% in seven days/.test(f)));
  assert.ok(row('spike').flags.some((f: string) => /TVL rose 350% in seven days: a deposit spike/.test(f)));
  assert.ok(row('young').flags.some((f: string) => /Only 13 days on DefiLlama/.test(f)));
  assert.ok(row('null7').flags.includes('Seven-day change not reported'));
  assert.ok(row('nodate').flags.includes('Listing date unknown'));
  assert.ok(row('big').flags.includes('A pool this large dilutes each dollar of deposit'));
  assert.deepEqual(row('null7').gaps.includes('change_7d'), true);
  assert.deepEqual(row('nodate').gaps.includes('listed_at'), true);
  assert.equal(row('lend').hard, false);
});

test('a family with few priced peers says so, in the singular and the plural', () => {
  assert.equal(row('pm-probe').peers, 1);
  assert.ok(row('pm-probe').flags.some((f: string) => /Only 1 live-token protocol in its family/.test(f)));
  assert.ok(row('cdp-probe').flags.some((f: string) => /Only 2 live-token protocols in its family/.test(f)));
  assert.ok(row('bridge-probe').flags.some((f: string) => /Only 0 live-token protocols in its family/.test(f)));
  assert.deepEqual(['pm-probe', 'cdp-probe', 'bridge-probe'].map((s) => row(s).gaps.includes('fit')), [true, true, true]);
  assert.equal(row('rwa-probe').peers, 5);
  assert.deepEqual(row('rwa-probe').gaps, []);
});

test('a listing that shares its first word with a traded token is flagged on the watchlist and left off elsewhere', () => {
  assert.ok(row('acme-vault').flags.includes('A listing of the same first name already trades: Acme Lend'));
  assert.equal(row('acme-earn'), undefined);
  assert.ok(!row('lend').flags.some((f: string) => /same first name/.test(f)));
});

test('a farm whose fees reach its deposit is flagged as not worth running', () => {
  const dear = run.rows.filter((r: any) => r.cost >= r.capital), cheap = run.rows.filter((r: any) => r.cost < r.capital);
  assert.ok(dear.length > 0 && cheap.length > 0);
  for (const r of dear) assert.ok(r.flags.includes('Fees exceed the deposit: not worth running'), r.slug);
  for (const r of cheap) assert.ok(!r.flags.some((f: string) => /Fees exceed/.test(f)), r.slug);
});

test('token odds follow the peers\' record and stay within their floor and ceiling', () => {
  // Ridge shrinks a family with no tokens toward the base rate instead of to zero, so the odds are low, not floored.
  assert.ok(row('curator').odds < 0.25 && row('curator').odds > M.C.oddsLo);
  assert.ok(row('curator').flags.some((f: string) => /Fitted token rate is only \d+%/.test(f)));
  assert.ok(row('lend').odds > 0.8);
  assert.ok(!row('lend').flags.some((f: string) => /Fitted token rate is only/.test(f)));
  for (const r of run.rows) assert.ok(r.odds >= M.C.oddsLo && r.odds <= M.C.oddsHi);
});

test('the growth and age factors are bounded, neutral when unknown, and 1.0 at no change and one year', () => {
  assert.deepEqual(M.factors(0, 365), { growth: 1, age: 1 });
  assert.deepEqual(M.factors(null, null), { growth: 1, age: 1 });
  assert.equal(M.factors(10, 365).growth, 1.05);
  assert.equal(M.factors(-20, 365).growth, 0.9);
  assert.deepEqual([M.factors(30, 0).growth, M.factors(4000, 0).growth, M.factors(-90, 0).growth], [1.15, 1.15, 0.85]);
  assert.deepEqual([M.factors(0, 0).age, M.factors(0, 730).age, M.factors(0, 3000).age], [0.9, 1.1, 1.1]);
});

test('implied value is TVL times the multiple, rebuilt from its terms, and the record rate never multiplies it', () => {
  for (const r of run.rows) {
    const product = r.build.reduce((p: number, b: any) => p * b.value, 1);
    assert.ok(Math.abs(r.tvl * product - r.implied) <= Math.max(2, r.implied * 0.005), r.slug);
    assert.ok(Math.abs(r.tvl * r.mult - r.implied) <= Math.max(2, r.implied * 0.005), r.slug);
    assert.deepEqual(r.build.slice(-2).map((b: any) => b.label), ['growth factor', 'age factor']);
    const k = M.factors(r.g7, r.age);
    assert.ok(Math.abs(r.build.at(-2).value - k.growth) < 1e-4 && Math.abs(r.build.at(-1).value - k.age) < 1e-4);
    assert.equal(r.pool.length, M.C.draws);
  }
  assert.equal(row('foobar').tx, 0.6);
  assert.equal(row('nochains').chain, 'its main chain');
  assert.equal(row('multi').chain, 'Base');
});

test('two protocols alike but for growth, or for days listed, differ by exactly that factor', () => {
  const twins = { ...world, protocols: [...world.protocols, proto('slow', { change_7d: -10 }), proto('quick', { change_7d: 10 }), proto('new', { listed_at: '2026-09-14' }), proto('old', { listed_at: '2024-11-14' })] };
  const r = M.run(twins), v = (slug: string): any => r.rows.find((x: any) => x.slug === slug);
  assert.ok(Math.abs(v('quick').implied / v('slow').implied - 1.05 / 0.95) < 1e-4);
  assert.ok(Math.abs(v('old').implied / v('new').implied - M.factors(0, v('old').age).age / M.factors(0, v('new').age).age) < 1e-4);
  assert.ok(v('quick').implied > v('slow').implied && v('old').implied > v('new').implied, 'more growth and a longer record never lower the value');
});

test('the held-out error is reported with the fixed factors and without them', () => {
  const v = run.evidence.value;
  assert.ok(v.plain.loo > 1 && v.plain.wf > 1);
  assert.notDeepEqual(v.plain, v.final);
});

test('the ledger puts every protocol in exactly one group', () => {
  const ledger = run.evidence.ledger as number[];
  assert.equal(ledger.reduce((s, c) => s + c, 0), world.protocols.length);
  assert.ok(ledger[0] >= 1 && ledger[1] >= 100);
  assert.ok(ledger[2] >= 20, 'priced comps');
  assert.ok(ledger[3] >= 1, 'a token recorded, no cap');
  assert.equal(ledger[4], 1, 'the exchange');
  assert.equal(ledger[5], 1, 'kin of a token that trades');
  assert.ok(ledger[6] >= 4, 'derivative products');
  assert.equal(ledger[7], 0);
});

test('the fits recover the structure that was built in, and keep a term only when both tests agree', () => {
  const v = run.evidence.value;
  // The size curve is what was built in, so it is the first term kept. A 1% margin can let a pure-noise term slip in
  // (here chains does), which is why the rule below is checked as a rule, not as a list of names.
  assert.equal(v.terms[0], 'size');
  assert.ok(v.final.loo < v.base.loo && v.final.wf < v.base.wf);
  const size = v.coef.find((c: any) => c.name === 'ln TVL');
  assert.ok(size.value < -0.15 && size.value > -0.45, `size slope ${size.value} should sit near -0.3`);
  for (const model of [v, run.evidence.odds]) {
    let cur = model.base;
    for (const g of model.rungs) {
      assert.equal(g.kept, g.loo < cur.loo * 0.99 && g.wf < cur.wf * 0.99, g.term);
      if (g.kept) cur = g;
    }
  }
  assert.ok(run.evidence.odds.terms.includes('family') || run.evidence.odds.terms.includes('category'), 'odds find the family effect');
  assert.ok(run.evidence.odds.final.loo < run.evidence.odds.base.loo);
  assert.ok(v.cov50.loo > 0.35 && v.cov50.loo < 0.65 && v.cov80.loo > 0.65 && v.cov80.loo < 0.95);
  assert.equal(v.back.length, v.n);
  assert.ok(v.back.every((b: any) => b.actual > 0 && b.model > 0 && typeof b.name === 'string'));
  assert.equal(run.evidence.odds.pos > 0 && run.evidence.odds.pos < run.evidence.odds.n, true);
});

test('the largest live tokens are listed apart, by market cap', () => {
  assert.equal(run.live.length, 40);
  assert.equal(run.liveTotal >= 40, true);
  run.live.forEach((l: any, i: number) => {
    if (i > 0) assert.ok(l.mcap <= run.live[i - 1].mcap);
    assert.ok(Math.abs(l.x - l.mcap / l.tvl) < 1e-3);
  });
  assert.ok(run.globalMultiple > 0);
});

test('the engine runs twice to the same board, the same draws and the same evidence', () => {
  const again = M.run(world);
  assert.deepEqual(again.rows.map((r: any) => [r.slug, r.implied, r.odds, Array.from(r.pool)]), run.rows.map((r: any) => [r.slug, r.implied, r.odds, Array.from(r.pool)]));
  assert.deepEqual(again.evidence, run.evidence);
});

test('a snapshot with too few priced tokens is refused, and one with no listing dates still runs', () => {
  assert.throws(() => M.run(snap(Array.from({ length: 30 }, (_, i) => proto(`x${i}`)))), /only 0 priced tokens/);
  const undated = M.run(synth(140, 3, { undated: true }));
  assert.ok(undated.rows.length > 0);
  assert.equal(undated.evidence.value.terms.length, 0, 'with no dates the walk-forward test is empty, so no term can be kept');
  assert.equal(undated.evidence.value.base.wf, Infinity);
});

test('rows beyond the row cap are counted, not silently dropped', () => {
  const small = Array.from({ length: 440 }, (_, i) => proto(`s${i}`, { tvl_usd: 5e6 + i * 1e4 }));
  const r = M.run(snap([...priced('Dexs', 40, 't'), ...small, proto('nocat', { category: null, tvl_usd: 49e6 })], []));
  assert.equal(r.rows.length, M.C.maxEarly);
  assert.equal(r.evidence.ledger[7], 41);
  assert.equal((r.evidence.ledger as number[]).reduce((s, c) => s + c, 0), 481);
  assert.equal(r.rows.find((x: any) => x.slug === 'nocat').category, null, 'a protocol with no category is ranked, and read as uncategorised');
});

// ---- the payoff and the verdict, on rows built by hand so every figure is known ----
const hand = (over: Record<string, unknown> = {}): any => ({ slug: 'h', cost: 2, pool: Float64Array.from({ length: 400 }, (_, i) => i), ...over });

test('a payoff is cut at its 95th percentile, and scales with the airdrop share', () => {
  const e = M.econ(hand({ cost: 100 }), 1);
  assert.equal(e.win, 299 / 400);
  assert.equal(e.p5, -80);
  assert.equal(e.p50, 100);
  assert.equal(e.p95, 280);
  assert.equal(e.ev, 79_610 / 400);
  assert.equal(e.edge, 79_610 / 400 - 100);
  assert.equal(e.moic, 79_610 / 400 / 100);
  assert.ok(M.econ(hand({ cost: 100 }), 2).ev > e.ev);
  assert.equal(M.econ(hand({ cost: 100 }), 0).win, 0);
});

test('the verdict needs a 40% chance, twice the cost back, no hard risk and three live peers to say farm', () => {
  const v = (r: object, e: object): string => M.verdict({ hard: false, peers: 3, ...r }, { win: 0.4, moic: 2, edge: 1, ...e });
  assert.equal(v({}, {}), 'farm');
  assert.equal(v({ hard: true }, {}), 'watch');
  assert.equal(v({ peers: 2 }, {}), 'watch');
  assert.equal(v({}, { win: 0.39 }), 'watch');
  assert.equal(v({}, { moic: 1.99 }), 'watch');
  assert.equal(v({}, { win: 0.1, moic: 0.5, edge: 0.01 }), 'watch');
  assert.equal(v({}, { win: 0.25, moic: 0.5, edge: -1 }), 'watch');
  assert.equal(v({}, { win: 0.24, moic: 0.5, edge: -1 }), 'skip');
  assert.equal(v({}, { win: 0.1, moic: 0.5, edge: 0 }), 'skip');
});

test('loaded as a browser script it sets window.RadarModel and computes the same board', () => {
  const win: Record<string, any> = {};
  vm.runInNewContext(readFileSync(new URL('../dashboard/model.js', import.meta.url), 'utf8'), { window: win }, { filename: new URL('../dashboard/model.js', import.meta.url).pathname });
  assert.deepEqual(Object.keys(win.RadarModel).sort(), Object.keys(M).sort());
  const small = synth(160, 11);
  const board = (engine: any): string => JSON.stringify(engine.run(small).rows.map((r: any) => [r.slug, r.implied, r.odds]));
  assert.equal(board(win.RadarModel), board(M));
});

test('a watchlist protocol that is a derivative, with a family and a category nobody else has, is still ranked', () => {
  assert.ok(row('lst'));
  assert.equal(row('lst').peers, 0);
  assert.deepEqual(row('lst').oddsPeers, { n: 0, t: 0 });
});
