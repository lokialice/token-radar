import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SnapshotError, boardIssue, parseSnapshot } from '../lib/snapshot.ts';
import { proto, snap } from './helpers.ts';

const good = { as_of: '2026-11-14', source: 'x', floor_usd: 5e7, watchlist: ['a'], protocols: [{ slug: 'a', name: 'A', category: 'Dexs', chains: ['Base'], tvl_usd: 1, change_7d: 2, mcap_usd: 3, listed_at: '2025-01-01', gecko_id: 'g', symbol: 'S' }] };
const parse = (o: unknown): ReturnType<typeof parseSnapshot> => parseSnapshot(JSON.stringify(o));

test('a well-formed snapshot parses, field by field', () => {
  const s = parse(good);
  assert.deepEqual(s.protocols[0], good.protocols[0]);
  assert.equal(s.source, 'x');
  assert.deepEqual(s.watchlist, ['a']);
});

test('a snapshot that is not the sealed shape is refused with a SnapshotError', () => {
  const refuses = (text: string, words: RegExp): void => assert.throws(() => parseSnapshot(text), (e) => e instanceof SnapshotError && e.name === 'SnapshotError' && words.test(e.message));
  refuses('not json', /not JSON/);
  refuses('[1]', /not an object/);
  refuses('null', /not an object/);
  refuses('7', /not an object/);
  refuses(JSON.stringify({ ...good, as_of: '14-11-2026' }), /as_of/);
  refuses(JSON.stringify({ ...good, as_of: 20261114 }), /as_of/);
  refuses(JSON.stringify({ ...good, floor_usd: 'big' }), /floor_usd/);
  refuses(JSON.stringify({ ...good, floor_usd: 0 }), /floor_usd/);
  refuses(JSON.stringify({ ...good, protocols: {} }), /protocols or watchlist/);
  refuses(JSON.stringify({ ...good, watchlist: 'a' }), /protocols or watchlist/);
  refuses(JSON.stringify({ ...good, protocols: [5] }), /protocol 0/);
  refuses(JSON.stringify({ ...good, protocols: [{ ...good.protocols[0], slug: 7 }] }), /protocol 0/);
  refuses(JSON.stringify({ ...good, protocols: [{ ...good.protocols[0], name: null }] }), /protocol 0/);
  refuses(JSON.stringify({ ...good, protocols: [{ ...good.protocols[0], tvl_usd: '9' }] }), /protocol 0/);
});

test('optional fields of the wrong type are read as absent, never invented', () => {
  const s = parse({ ...good, source: 5, watchlist: ['a', 3, null], protocols: [{ slug: 'a', name: 'A', tvl_usd: 1, category: 4, chains: 'Base', change_7d: 'x', mcap_usd: '3', listed_at: 20250101, gecko_id: 9, symbol: {} }] });
  assert.equal(s.source, '');
  assert.deepEqual(s.watchlist, ['a']);
  assert.deepEqual(s.protocols[0], { slug: 'a', name: 'A', category: null, chains: [], tvl_usd: 1, change_7d: null, mcap_usd: null, listed_at: null, gecko_id: null, symbol: null });
  assert.deepEqual(parse({ ...good, protocols: [{ ...good.protocols[0], chains: ['Base', 4, 'OP'] }] }).protocols[0]!.chains, ['Base', 'OP']);
});

const step = 'x'.repeat(25);
const rows = (n: number, over: (i: number) => Record<string, unknown> = () => ({})) => Array.from({ length: n }, (_, i) => ({ rank: i + 1, slug: `p${i}`, name: `P${i}`, implied_value_usd: 1000 - i, farm_steps: [step, step, step], ...over(i) }));
const world = snap(Array.from({ length: 120 }, (_, i) => proto(`p${i}`)), ['p0', 'p1']);

test('the gate check names the first thing wrong with a board, and passes a good one', () => {
  assert.equal(boardIssue(rows(120), world), null);
  assert.match(boardIssue(rows(99), world)!, /needs 100/);
  assert.match(boardIssue(rows(120).slice(1), { ...world, watchlist: ['p0', 'p1'] })!, /misses 1 watchlist slugs: p0/);
  assert.match(boardIssue(rows(120, (i) => (i === 5 ? { slug: 'ghost' } : {})), world)!, /ghost is not a protocol/);
  assert.match(boardIssue(rows(120, (i) => (i === 4 ? { rank: 9 } : {})), world)!, /row 5 has rank 9/);
  assert.match(boardIssue(rows(120, (i) => (i === 3 ? { implied_value_usd: 5000 } : {})), world)!, /row 4 outranks row 3/);
  assert.match(boardIssue(rows(120, (i) => (i === 2 ? { implied_value_usd: 997.5 } : {})), world)!, /implied value/);
  assert.match(boardIssue(rows(120, (i) => (i === 119 ? { implied_value_usd: 0 } : {})), world)!, /implied value 0/);
  assert.match(boardIssue(rows(120, (i) => (i === 6 ? { farm_steps: [step, step] } : {})), world)!, /2 farm steps/);
  assert.match(boardIssue(rows(120, (i) => (i === 6 ? { farm_steps: Array(13).fill(step) } : {})), world)!, /13 farm steps/);
  assert.match(boardIssue(rows(120, (i) => (i === 7 ? { farm_steps: [step, step, 'short'] } : {})), world)!, /step of 5 characters/);
  assert.match(boardIssue(rows(120, (i) => (i === 7 ? { farm_steps: [step, step, 'y'.repeat(601)] } : {})), world)!, /step of 601 characters/);
  assert.match(boardIssue(rows(120, () => ({ implied_value_usd: 500 })), world)!, /shares one implied value/);
});
