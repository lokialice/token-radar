// The farm plan (dashboard/plan.js) and the page's static text (lib/text.ts).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { COVERAGE, DILIGENCE, LEDGER, PROSE } from '../lib/text.ts';
import { M, P } from './helpers.ts';

const input = (category: string | null, over = {}) => ({ name: 'Acme', category, chain: 'Base', tx: 0.08, capital: 100, hold: 45, weeks: 6, carry: 0.49, ...over });

test('every category family gets its own deposit step, in words a farmer can follow', () => {
  const cases: [string | null, RegExp][] = [
    ['Lending', /Supply \$100 of a major stablecoin to Acme on Base/],
    ['Uncollateralized Borrowing', /Supply/],
    ['CDP', /mint a small amount/],
    ['Algo-Stables', /mint a small amount/],
    ['Dexs', /Add \$100 to a pool on Acme on Base.*If it takes no public deposits, swap \$100/],
    ['Liquidity Manager', /to a pool on Acme/],
    ['Derivatives', /as margin on Acme/],
    ['Options', /as margin on Acme/],
    ['RWA', /tokenised yield asset/],
    ['Treasury Bills', /tokenised yield asset/],
    ['Prediction Market', /Fund a Acme account on Base with \$100/],
    ['Risk Curators', /largest Acme vault/],
    ['Yield Aggregator', /largest Acme vault/],
    ['Basis Trading', /largest Acme vault/],
    ['Indexes', /largest Acme vault/],
    ['DEX Aggregator', /to a pool on Acme/],
    ['Bridge', /Bridge \$100 of stablecoin to Base through Acme/],
    ['Cross Chain', /Bridge/],
    ['Restaking', /asset Acme accepts/],
    ['Collateral Markets', /asset Acme accepts/],
    ['Decentralized BTC', /asset Acme accepts/],
    ['Chain', /Move \$100 into Acme by the route its own documentation gives/],
    ['Payments', /Move \$100 into Acme/],
    ['Insurance', /Put \$100 into Acme on Base: join its cover pool/],
    ['Cover Protocol', /premium is spent, not returned/],
    ['Something New', /Deposit \$100 into Acme on Base and use its main feature/],
    [null, /Deposit \$100 into Acme on Base/],
  ];
  for (const [category, expected] of cases) {
    const steps = P.farmSteps(input(category));
    assert.equal(steps.length, 6, `${category}: six steps`);
    assert.match(steps[2].text, expected, String(category));
    for (const s of steps) assert.ok(s.text.length > 20 && s.cost.length > 0 && s.time.length > 0);
  }
});

test('a chain or a payment network is never told to deposit a stablecoin', () => {
  for (const category of ['Chain', 'Payments']) assert.ok(!P.farmSteps(input(category)).some((s: any) => /stablecoin/.test(s.text)), category);
});

test('the check comes before any money moves, and a farm on one of several chains says to confirm it', () => {
  for (const category of ['Lending', 'Dexs', 'RWA', 'Bridge', 'Restaking', 'Chain']) {
    const [first, second] = P.farmSteps(input(category));
    assert.equal(first.fee, 0, category);
    assert.match(second.text, /^Make a wallet/, category);
    assert.ok(!/Confirm it runs/.test(first.text), 'one chain needs no confirmation');
    assert.match(P.farmSteps(input(category, { chains: ['Ethereum', 'Base'] }))[0].text, /Confirm it runs on Base, picked as its cheapest chain\.$/);
  }
  assert.match(P.farmSteps(input('RWA'))[0].text, /eligible and meet the minimum/);
});

test('the plan states the engine\'s own deposit, fees, hold and carry', () => {
  const steps = P.farmSteps(input('Dexs', { capital: 500, hold: 75, weeks: 11, tx: 7, carry: 6.17 }));
  assert.match(steps[1].text, /send it \$500 plus gas on Base/);
  assert.equal(steps[1].cost, '$14 transfer; the deposit comes back');
  assert.equal(steps[2].cost, '$28 gas to approve and deposit');
  assert.match(steps[3].text, /Every week for 11 weeks/);
  assert.equal(steps[3].cost, '$154 gas, $14 a week');
  assert.equal(steps[0].cost, 'no fee');
  assert.match(steps[4].text, /Keep the deposit in for 75 days in all, weekly actions included/);
  assert.equal(steps[4].cost, '$6.17 if $500 earns nothing (4% a year)');
  assert.equal(steps[4].time, '75 days');
  assert.equal(steps[5].cost, '$14 exit gas; claiming is free');
});

test('fees add up to the engine\'s cost, and hands-on time counts every week', () => {
  for (const [tx, weeks] of [[7, 11], [0.01, 6], [0.6, 9]] as const) {
    const carry = 100 * 0.04 * ((weeks * 7) / 365);
    const steps = P.farmSteps(input('Lending', { tx, weeks, carry }));
    const fees = steps.reduce((s: number, x: any) => s + x.fee, 0);
    assert.ok(Math.abs(fees - (tx * 8 + tx * 2 * weeks + carry)) < 1e-9);
    assert.equal(P.hours(steps), (10 + 20 + 10 * weeks + 5 + 30) / 60);
  }
});

test('a step becomes one string, cut at 600 characters with an ellipsis', () => {
  assert.equal(P.stepText({ text: 'Do it.', cost: '$1', time: '5 min' }), 'Do it. Cost: $1. Time: 5 min.');
  const long = P.stepText({ text: 'x'.repeat(700), cost: '$1', time: '1 min' });
  assert.equal(long.length, 599);
  assert.ok(long.endsWith('...'));
  assert.equal(P.stepText({ text: 'y'.repeat(560), cost: '$1', time: '1 min' }).length, 560 + ' Cost: $1. Time: 1 min.'.length);
});

test('dollar amounts read as cents under ten and as whole dollars above', () => {
  const [, fund] = P.farmSteps(input('Dexs', { capital: 1234, tx: 0.005 }));
  assert.match(fund.text, /\$1,234 plus gas/);
  assert.match(fund.cost, /^\$0\.01 transfer/);
});

test('loaded as a browser script it sets window.RadarPlan and writes the same plan', () => {
  const win: Record<string, any> = {};
  const url = new URL('../dashboard/plan.js', import.meta.url);
  vm.runInNewContext(readFileSync(url, 'utf8'), { window: win }, { filename: url.pathname });
  assert.deepEqual(Object.keys(win.RadarPlan).sort(), Object.keys(P).sort());
  assert.equal(JSON.stringify(win.RadarPlan.farmSteps(input('Dexs'))), JSON.stringify(P.farmSteps(input('Dexs'))));
});

test('the static text is complete: every family has a checklist, the ledger has eight groups', () => {
  const families = ['lending', 'stable', 'dex', 'derivatives', 'rwa', 'vault', 'bridge', 'prediction', 'other'];
  for (const k of families) assert.ok(DILIGENCE[k]!.length >= 3, k);
  for (const category of ['Lending', 'CDP', 'Dexs', 'Derivatives', 'RWA', 'Risk Curators', 'Bridge', 'Prediction Market', 'Anything', null]) assert.ok(DILIGENCE[M.family(category)], String(category));
  assert.equal(LEDGER.length, 8);
  assert.deepEqual(new Set(COVERAGE.map((c) => c.status)), new Set(['observed', 'derived', 'assumed', 'missing']));
  assert.equal(new Set(COVERAGE.map((c) => c.key)).size, COVERAGE.length);
  for (const key of ['evid', 'honest', 'assumed', 'odds', 'plan', 'data']) assert.ok(PROSE[key as keyof typeof PROSE].length > 40, key);
  assert.match(PROSE.assumed, /\{share\}.*\{missing\}.*\{total\}/);
});
