// Test support: a seeded synthetic snapshot with known structure, and a loader for the engine.
import type { Snapshot, SnapshotProtocol } from '../lib/snapshot.ts';

await import('../dashboard/model.js');

/** The engine the page and main.ts run. */
export const M = (globalThis as unknown as { RadarModel: any }).RadarModel;

/** A small seeded generator, so a test snapshot is the same every run. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FLOOR = 50_000_000;

/** One protocol with every field present; override what a test cares about. */
export function proto(slug: string, over: Partial<SnapshotProtocol> = {}): SnapshotProtocol {
  return { slug, name: slug.toUpperCase(), category: 'Dexs', chains: ['Ethereum'], tvl_usd: 20_000_000, change_7d: 1.5, mcap_usd: null, listed_at: '2025-01-15', gecko_id: null, symbol: null, ...over };
}

export const snap = (protocols: SnapshotProtocol[], watchlist: string[] = [], floor = FLOOR): Snapshot => ({ as_of: '2026-11-14', source: 'test', floor_usd: floor, protocols, watchlist });

const CHAINS = [['Ethereum'], ['Base', 'Arbitrum'], ['Solana'], ['Polygon', 'Optimism', 'Ethereum'], ['Foobar Chain'], []];
const CATS: [string, number][] = [['Lending', 1], ['Dexs', 0.5], ['Yield', 0.45], ['Derivatives', 0.6], ['Risk Curators', 0], ['Basis Trading', 0.5]];

/**
 * A synthetic snapshot of `n` protocols. Token holders' market cap follows ln(mcap/TVL) = 0.2 - 0.3 (ln TVL - 17) plus
 * noise, so the value model has a size curve to find; Risk Curators never record a token and Lending nearly always does,
 * so the odds model has a family effect to find. Tests append probes for the cases that need a specific shape.
 */
export function synth(n = 420, seed = 7, over: { undated?: boolean } = {}): Snapshot {
  const r = seeded(seed);
  const protocols: SnapshotProtocol[] = [];
  const watchlist: string[] = [];
  for (let i = 0; i < n; i++) {
    const [category, tokenRate] = CATS[Math.floor(r() * CATS.length)]!;
    const tvl = Math.round(5e6 * Math.exp(r() * 5.2));
    const token = r() < tokenRate;
    const capped = token && r() < 0.8;
    const mcap = capped ? Math.round(tvl * Math.exp(0.2 - 0.3 * (Math.log(tvl) - 17) + (r() - 0.5) * 2)) : null;
    const day = Math.floor(r() * 1400);
    protocols.push(
      proto(`p${i}`, {
        name: `Proto ${i}`,
        category,
        chains: CHAINS[Math.floor(r() * CHAINS.length)]!,
        tvl_usd: tvl,
        change_7d: r() < 0.06 ? null : Math.round((r() * 70 - 25) * 100) / 100,
        mcap_usd: mcap,
        listed_at: over.undated || r() < 0.08 ? null : new Date(Date.UTC(2022, 11, 1) + day * 86_400_000).toISOString().slice(0, 10),
        gecko_id: token && !capped ? `g${i}` : null,
        symbol: token ? `S${i}` : null,
      }),
    );
    if (!token && tvl >= FLOOR && r() < 0.6) watchlist.push(`p${i}`);
  }
  return snap(protocols, watchlist);
}
