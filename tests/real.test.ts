// Tests of the engine (dashboard/model.js), the board the gate takes, and the dashboard's source budget.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { farmSteps, stepText } from '../lib/plan.ts';
import { boardIssue, parseSnapshot } from '../lib/snapshot.ts';

const snapshotFile = new URL('../input/snapshot.json', import.meta.url);
if (!existsSync(snapshotFile)) {
  console.log('tests: no input/snapshot.json (the kit\'s sealed snapshot is not committed): skipped');
  process.exit(0);
}
await import('../dashboard/model.js');
const M = (globalThis as unknown as { RadarModel: any }).RadarModel;
const snapshot = parseSnapshot(readFileSync(snapshotFile, 'utf8'));
const run = M.run(snapshot);

test('the engine is deterministic: two runs agree, draws included', () => {
  const again = M.run(snapshot);
  const key = (r: any) => JSON.stringify([r.slug, r.implied, r.odds, r.mult, Array.from(r.pool.slice(0, 50))]);
  assert.deepEqual(again.rows.map(key), run.rows.map(key));
  assert.deepEqual(again.evidence.value.final, run.evidence.value.final);
});

test('the board is one the gate takes, and every watchlist protocol is on it', () => {
  const rows = run.rows.map((r: any) => ({ rank: r.rank, slug: r.slug, name: r.name, implied_value_usd: r.implied, farm_steps: farmSteps({ name: r.name, category: r.category, chain: r.chain, tx: r.tx, capital: r.capital, hold: r.hold, weeks: r.weeks, carry: r.carry }).map(stepText) }));
  assert.equal(boardIssue(rows, snapshot), null);
  const slugs = new Set(rows.map((r: any) => r.slug));
  for (const s of snapshot.watchlist) assert.ok(slugs.has(s), `${s} is missing`);
  assert.ok(rows.length - snapshot.watchlist.length >= 60, 'at least 60 rows outside the watchlist');
});

test('implied value is the value if it launches times the odds, and ranks never rise', () => {
  run.rows.forEach((r: any, i: number) => {
    assert.ok(Math.abs(r.ifl * r.odds - r.implied) <= Math.max(2, r.implied * 0.002), r.slug);
    if (i > 0) assert.ok(r.implied <= run.rows[i - 1].implied);
  });
});

test('a term is kept only when both held-out tests improve', () => {
  for (const model of [run.evidence.value, run.evidence.odds]) {
    let cur = model.base;
    for (const g of model.rungs) {
      if (g.kept) {
        assert.ok(g.loo < cur.loo * 0.99 && g.wf < cur.wf * 0.99, g.term);
        cur = g;
      }
    }
  }
});

test('the ledger accounts for every protocol exactly once', () => {
  assert.equal(run.evidence.ledger.reduce((s: number, c: number) => s + c, 0), snapshot.protocols.length);
});

test('a bigger airdrop share never lowers a payoff', () => {
  const r = run.rows[10];
  assert.ok(M.econ(r, 0.16).ev >= M.econ(r, 0.08).ev);
});

test('the dashboard names no network address and stays inside the judge\'s source budget', () => {
  const dir = new URL('../dashboard/', import.meta.url);
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const text = readFileSync(new URL(name, dir), 'utf8');
    assert.ok(!/https?:\/\//i.test(text), `${name} names a network address`);
    bytes += statSync(new URL(name, dir)).size;
  }
  assert.ok(bytes <= 64_800, `the dashboard is ${bytes} bytes; the dossier's text holds 65,536 with its headers`);
});
