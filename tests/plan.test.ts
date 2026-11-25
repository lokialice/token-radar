import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COVERAGE, DILIGENCE, LEDGER, PROSE, farmSteps, stepText } from '../lib/plan.ts';
import { M } from './helpers.ts';

const input = (category: string | null, over = {}) => ({ name: 'Acme', category, chain: 'Base', tx: 0.08, capital: 100, hold: 45, weeks: 6, carry: 0.49, ...over });

test('every category family gets its own deposit step, in words a farmer can follow', () => {
  const cases: [string | null, RegExp][] = [
    ['Lending', /Supply \$100 of a major stablecoin to Acme on Base/],
    ['Uncollateralized Borrowing', /Supply/],
    ['CDP', /mint a small amount/],
    ['Algo-Stables', /mint a small amount/],
    ['Dexs', /Add \$100 of liquidity/],
    ['Liquidity Manager', /Add \$100 of liquidity/],
    ['Derivatives', /as margin on Acme/],
    ['Options', /as margin on Acme/],
    ['RWA', /tokenised yield asset/],
    ['Treasury Bills', /tokenised yield asset/],
    ['Prediction Market', /Fund your Acme account/],
    ['Risk Curators', /largest Acme vault/],
    ['Yield Aggregator', /largest Acme vault/],
    ['Bridge', /Bridge \$100 of stablecoin to Base through Acme/],
    ['Cross Chain', /Bridge/],
    ['Liquid Staking', /Stake \$100/],
    ['Restaking', /Stake/],
    ['Insurance', /Buy \$100 of cover/],
    ['Cover Protocol', /Buy \$100 of cover/],
    ['Something New', /Deposit \$100 of stablecoin into Acme/],
    [null, /Deposit \$100 of stablecoin into Acme/],
  ];
  for (const [category, expected] of cases) {
    const steps = farmSteps(input(category));
    assert.equal(steps.length, 6, `${category}: six steps`);
    assert.match(steps[1]!.text, expected, String(category));
    for (const s of steps) assert.ok(s.text.length > 20 && s.cost.length > 0 && s.time.length > 0);
  }
});

test('the plan states the engine\'s own deposit, gas, hold and carry', () => {
  const steps = farmSteps(input('Dexs', { capital: 500, hold: 75, weeks: 11, tx: 7, carry: 6.17 }));
  assert.match(steps[0]!.text, /\$500 of stablecoin plus gas on Base/);
  assert.match(steps[1]!.cost, /\$28 of gas/);
  assert.match(steps[2]!.text, /Every week for 11 weeks/);
  assert.match(steps[2]!.cost, /\$14 of gas a week, \$154 in all/);
  assert.match(steps[4]!.text, /Hold the position for 75 days/);
  assert.match(steps[4]!.cost, /\$6\.17 of foregone yield on \$500 over 75 days/);
  assert.match(steps[5]!.cost, /\$14 of gas to exit/);
});

test('a step becomes one string, cut at 600 characters with an ellipsis', () => {
  assert.equal(stepText({ text: 'Do it.', cost: '$1', time: '5 minutes' }), 'Do it. Cost: $1. Time: 5 minutes.');
  const long = stepText({ text: 'x'.repeat(700), cost: '$1', time: '1 minute' });
  assert.equal(long.length, 599);
  assert.ok(long.endsWith('...'));
  assert.equal(stepText({ text: 'y'.repeat(560), cost: '$1', time: '1 minute' }).length, 560 + ' Cost: $1. Time: 1 minute.'.length);
});

test('dollar amounts read as cents under ten and as whole dollars above', () => {
  const [first] = farmSteps(input('Dexs', { capital: 1234, tx: 0.005 }));
  assert.match(first!.text, /\$1,234 of stablecoin/);
  assert.match(first!.cost, /about \$0\.01 to move funds/);
});

test('the static text is complete: every family has a checklist, the ledger has eight groups', () => {
  const families = new Set(['lending', 'stable', 'dex', 'derivatives', 'rwa', 'vault', 'bridge', 'prediction', 'other'].map((k) => k));
  for (const k of families) assert.ok(DILIGENCE[k]!.length >= 3, k);
  for (const category of ['Lending', 'CDP', 'Dexs', 'Derivatives', 'RWA', 'Risk Curators', 'Bridge', 'Prediction Market', 'Anything', null]) assert.ok(DILIGENCE[M.family(category)], String(category));
  assert.equal(LEDGER.length, 8);
  assert.deepEqual(new Set(COVERAGE.map((c) => c.status)), new Set(['observed', 'derived', 'assumed', 'missing']));
  assert.equal(new Set(COVERAGE.map((c) => c.key)).size, COVERAGE.length);
  for (const key of ['evid', 'honest', 'assumed', 'basket', 'odds', 'data']) assert.ok(PROSE[key as keyof typeof PROSE].length > 40, key);
  assert.match(PROSE.assumed, /\{share\}.*\{missing\}.*\{total\}/);
});
