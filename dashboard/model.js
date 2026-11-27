// Token Radar's engine. One script, run by the page in the browser and by main.ts in Node.
//   implied value     = TVL x fitted multiple x growth factor x age factor: the token's worth if the
//                       protocol's record stays as it is. No launch is predicted.
//   fitted multiple   = ridge fit of market cap / TVL on protocols whose token trades
//   growth, age       = fixed factors from 7-day TVL change and days listed with no token (our assumption in C:
//                       the priced tokens are too few to fit them)
//   token record rate = how often peers record a token (ridge logistic). It prices the farm, never the value.
//   farm payoff       = 400 draws from both models' own errors, sharing one market factor
// A fitted term stays only if it lowers the held-out error twice: leave-one-out and walk-forward.
(function (g) {
 'use strict';
 const C = { share: 0.08, minPeers: 3, minTvl: 5e6, apr: 0.04, oddsLo: 0.03, oddsHi: 0.97, draws: 400, rho: 0.3, maxEarly: 400, gWeight: 0.5, gCap: 0.3, aWeight: 0.1, aFull: 730 };
 const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
 const quant = (a, qs) => { const s = [...a].sort((x, y) => x - y); return qs.map((q) => { const t = (s.length - 1) * q, i = Math.floor(t); return s[i] + (s[Math.ceil(t)] - s[i]) * (t - i); }); };
 const med = (a) => quant(a, [0.5])[0];
 const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
 const r4 = (x) => Math.round(x * 1e4) / 1e4;
 const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
 const ageDays = (asOf, d) => { if (!d) return null; const a = Date.parse(asOf + 'T00:00:00Z'), b = Date.parse(d + 'T00:00:00Z'); return isFinite(a) && isFinite(b) ? Math.max(0, Math.floor((a - b) / 864e5)) : null; };
 const noToken = (p) => p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
 // A protocol's first word. A listing with no token that shares it with one that trades is likely that token's product.
 const stem = (name) => name.toLowerCase().split(/[^a-z0-9]+/)[0];
 const BAD = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
 const derivative = (p) => BAD.has(p.category) || /\s(?:V\d+(?:\.\d+)?|v\d+(?:\.\d+)?|\d+\.\d+)$/.test(p.name) || /\b(?:wrapped|staked|staking)\b/i.test(p.name) || /^(?:binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)/i.test(p.name);
 const FAM = [['lending', 'lending', 'borrow'], ['stable', 'cdp', 'stablecoin', 'algo'], ['dex', 'dexs', 'dex ', 'amm', 'liquidity'], ['derivatives', 'derivative', 'perp', 'option', 'basis'], ['rwa', 'rwa', 'treasur'], ['vault', 'curator', 'allocator', 'vault', 'yield', 'aggregator', 'farm', 'optimizer', 'index'], ['bridge', 'bridge', 'cross'], ['prediction', 'prediction']];
 const family = (cat) => { const c = (cat || '').toLowerCase(); for (const f of FAM) if (f.slice(1).some((w) => c.includes(w))) return f[0]; return 'other'; };
 // Growth moves the value by 15% at most (a week's change beyond 30% is not a trend). Age moves it by 10% at most:
 // 1.0 at one year listed with no token, rising to two years. An unknown input leaves the value unchanged.
 const factors = (g7, age) => ({ growth: 1 + C.gWeight * clamp((g7 || 0) / 100, -C.gCap, C.gCap), age: age === null ? 1 : 1 - C.aWeight + (2 * C.aWeight * Math.min(age, C.aFull)) / C.aFull });
 const toObs = (p, asOf) => { const a = ageDays(asOf, p.listed_at), k = factors(p.change_7d, a); return { k, f: Math.log(k.growth * k.age), slug: p.slug, lnT: Math.log(Math.max(1, p.tvl_usd)), fam: family(p.category), cat: p.category || 'Uncategorised', g: p.change_7d, age: a === null ? null : a / 365, ch: p.chains.length, listed: p.listed_at, y: p.mcap_usd > 0 && p.tvl_usd >= C.minTvl && p.category !== 'CEX' ? Math.log(p.mcap_usd / p.tvl_usd) : null, tok: noToken(p) ? 0 : 1 }; };
 function inv(a) {
  const n = a.length, m = a.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
   let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
   [m[c], m[p]] = [m[p], m[c]];
   const d = m[c][c]; for (let j = 0; j < 2 * n; j++) m[c][j] /= d;
   for (let r = 0; r < n; r++) if (r !== c) { const f = m[r][c]; if (f) for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[c][j]; }
  }
  return m.map((r) => r.slice(n));
 }
 const gram = (X, pen) => { const p = pen.length, G = Array.from({ length: p }, () => new Array(p).fill(0)); for (const r of X) for (let i = 0; i < p; i++) for (let j = i; j < p; j++) G[i][j] += r[i] * r[j]; for (let i = 0; i < p; i++) { G[i][i] += pen[i]; for (let j = 0; j < i; j++) G[i][j] = G[j][i]; } return G; };
 function ridge(X, y, pen) { const M = inv(gram(X, pen)), xty = pen.map((_, j) => X.reduce((s, r, i) => s + r[j] * y[i], 0)); return { b: M.map((r) => dot(r, xty)), M }; }
 function logistic(X, y, pen) {
  const p = pen.length; let b = new Array(p).fill(0);
  for (let it = 0; it < 30; it++) {
   const pr = X.map((r) => 1 / (1 + Math.exp(-dot(r, b)))), G = Array.from({ length: p }, () => new Array(p).fill(0)), gr = new Array(p).fill(0);
   X.forEach((r, i) => { const w = Math.max(1e-6, pr[i] * (1 - pr[i])); for (let a = 0; a < p; a++) { gr[a] += r[a] * (y[i] - pr[i]); for (let c = a; c < p; c++) G[a][c] += w * r[a] * r[c]; } });
   for (let a = 0; a < p; a++) { G[a][a] += pen[a]; gr[a] -= pen[a] * b[a]; for (let c = 0; c < a; c++) G[a][c] = G[c][a]; }
   const st = inv(G).map((r) => dot(r, gr)); b = b.map((v, i) => v + st[i]);
   if (st.every((s) => Math.abs(s) < 1e-9)) break;
  }
  return b;
 }
 const LADDER = ['size', 'family', 'category', 'growth', 'age', 'chains'], PEN = { size: 0.01, family: 6, category: 16, growth: 1, age: 1, chains: 1 };
 const gc = (v) => (v === null ? 0 : clamp(v, -50, 100) / 100), la = (a, f) => (a === null ? f : Math.log(a + 0.1));
 function design(train, terms) {
  const mT = mean(train.map((o) => o.lnT)), mA = mean(train.filter((o) => o.age !== null).map((o) => la(o.age, 0))), mG = mean(train.map((o) => gc(o.g))), mC = mean(train.map((o) => Math.log(Math.max(1, o.ch))));
  const fams = [...new Set(train.map((o) => o.fam))].sort(), cats = [...new Set(train.map((o) => o.cat))].sort();
  const names = ['intercept'], termOf = ['intercept'], pen = [0], parts = [() => [1]];
  const add = (t, n, f) => { for (const k of n) { names.push(k); termOf.push(t); pen.push(PEN[t]); } parts.push(f); };
  for (const t of terms) {
   if (t === 'size') add(t, ['ln TVL'], (o) => [o.lnT - mT]);
   if (t === 'growth') add(t, ['7-day growth'], (o) => [gc(o.g) - mG]);
   if (t === 'age') add(t, ['ln years listed'], (o) => [la(o.age, mA) - mA]);
   if (t === 'chains') add(t, ['ln chain count'], (o) => [Math.log(Math.max(1, o.ch)) - mC]);
   if (t === 'family') add(t, fams.map((f) => 'family: ' + f), (o) => fams.map((f) => (o.fam === f ? 1 : 0)));
   if (t === 'category') add(t, cats.map((c) => 'category: ' + c), (o) => cats.map((c) => (o.cat === c ? 1 : 0)));
  }
  return { names, termOf, pen, row: (o) => parts.flatMap((f) => f(o)) };
 }
 const miss = (e) => (e.length ? Math.exp(med(e.map(Math.abs))) : Infinity);
 function folds(obs, k) {
  const dated = obs.filter((o) => o.listed).sort((a, b) => (a.listed < b.listed ? -1 : a.listed > b.listed ? 1 : a.slug < b.slug ? -1 : 1)), undated = obs.filter((o) => !o.listed), size = Math.ceil(dated.length / k), out = [];
  for (let b = 1; b < k; b++) out.push({ train: [...dated.slice(0, b * size), ...undated], test: dated.slice(b * size, (b + 1) * size) });
  return out.filter((f) => f.test.length);
 }
 // The fixed factors are taken off the target and put back on every prediction, so the curve is fitted around them.
 // The targets are cut at the 5th and 95th percentile so a few extreme tokens do not steer the fit.
 function fitValue(train, terms) {
  const d = design(train, terms), X = train.map((o) => d.row(o)), y = train.map((o) => o.y - o.f), [lo, hi] = quant(y, [0.05, 0.95]), yc = y.map((v) => clamp(v, lo, hi)), { b, M } = ridge(X, yc, d.pen);
  const loo = X.map((r, i) => { const h = dot(r, M.map((m) => dot(m, r))); return y[i] - (yc[i] - (yc[i] - dot(r, b)) / (1 - h)); });
  return { d, b, loo, at: (o) => dot(d.row(o), b) + o.f };
 }
 function valueScores(obs, terms) {
  const f = fitValue(obs, terms), wf = [];
  for (const { train, test } of folds(obs, 5)) { const m = fitValue(train, terms); for (const o of test) wf.push(o.y - m.at(o)); }
  return { loo: miss(f.loo), wf: miss(wf) };
 }
 function cover(obs, terms, w) {
  const lo = (1 - w) / 2, hit = (train, test) => { const m = fitValue(train, terms), [a, b] = quant(m.loo, [lo, 1 - lo]); return test.map((o) => { const e = o.y - m.at(o); return e >= a && e <= b ? 1 : 0; }); }, t = [], wf = [];
  for (let f = 0; f < 10; f++) t.push(...hit(obs.filter((_, i) => i % 10 !== f), obs.filter((_, i) => i % 10 === f)));
  for (const { train, test } of folds(obs, 5)) wf.push(...hit(train, test));
  return { loo: mean(t), wf: mean(wf) };
 }
 // Forward selection: a term stays only if it lowers BOTH held-out scores by at least one per cent.
 function select(obs, score, base) {
  let cur = base; const kept = [], rungs = [];
  for (const t of LADDER) { const s = score(obs, [...kept, t]), ok = s.loo < cur.loo * 0.99 && s.wf < cur.wf * 0.99; rungs.push({ term: t, loo: s.loo, wf: s.wf, kept: ok }); if (ok) { kept.push(t); cur = s; } }
  return { terms: kept, base, rungs, final: cur };
 }
 function oddsScores(obs, terms) {
  const fit = (train) => { const d = design(train, terms), b = logistic(train.map((o) => d.row(o)), train.map((o) => o.tok), d.pen); return (o) => 1 / (1 + Math.exp(-dot(d.row(o), b))); }, cv = [], wf = [];
  for (let f = 0; f < 10; f++) { const p = fit(obs.filter((_, i) => i % 10 !== f)); for (const o of obs.filter((_, i) => i % 10 === f)) cv.push((p(o) - o.tok) ** 2); }
  for (const { train, test } of folds(obs, 5)) { const p = fit(train); for (const o of test) wf.push((p(o) - o.tok) ** 2); }
  return { loo: mean(cv), wf: mean(wf) };
 }
 const TX = { ethereum: 700, bitcoin: 400, tron: 120, cardano: 15, binance: 15, bsc: 15, arbitrum: 12, avalanche: 10, blast: 10, base: 8, optimism: 8, ink: 6, unichain: 6, berachain: 6, scroll: 20, linea: 15, polygon: 5, mantle: 5, monad: 4, sonic: 3, plasma: 3, hyperliquid: 3, fantom: 3, solana: 1, sui: 2, aptos: 2, ton: 2, near: 2 };
 const tx = (c) => { const k = c.toLowerCase(); for (const n in TX) if (k.startsWith(n)) return TX[n] / 100; return 0.6; };
 function cost(p, age) {
  const chain = p.chains.length ? p.chains.reduce((b, c) => (tx(c) < tx(b) ? c : b)) : 'its main chain', t = tx(chain), tvl = p.tvl_usd;
  const capital = tvl < 5e7 ? 100 : tvl < 2.5e8 ? 250 : tvl < 1e9 ? 500 : 1000, hold = age === null ? 45 : age < 120 ? 75 : age < 365 ? 60 : 45, weeks = Math.max(1, Math.round(hold / 7));
  // Fees: send the funds, approve and deposit, a weekly action, exit. plan.js lists the same ones step by step.
  const gas = t * 8 + t * 2 * weeks, carry = capital * C.apr * (hold / 365);
  return { chain, tx: t, capital, hold, weeks, gas, carry, cost: gas + carry };
 }
 // A farm's payoff is drawn from the value model's own held-out errors; a share (rho) is one market factor.
 const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
 const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
 // The outcome of a farm at airdrop share k. The mean is cut at the 95th percentile: a few huge draws would
 // otherwise be the whole expectation, so ev is a trimmed expectation, and the page says so.
 function econ(r, k) {
  const n = r.pool.length, v = Float64Array.from(r.pool, (x) => x * k).sort(), cut = v[Math.floor(n * 0.95)]; let s = 0, w = 0;
  for (let j = 0; j < n; j++) { s += Math.min(v[j], cut); if (v[j] > r.cost) w++; }
  const ev = s / n;
  return { ev, edge: ev - r.cost, moic: ev / r.cost, win: w / n, p5: v[Math.floor(n * 0.05)] - r.cost, p50: v[n >> 1] - r.cost, p95: cut - r.cost };
 }
 const verdict = (r, e) => (!r.hard && r.peers >= C.minPeers && e.win >= 0.4 && e.moic >= 2 ? 'farm' : e.edge > 0 || e.win >= 0.25 ? 'watch' : 'skip');
 function run(snap) {
  const asOf = snap.as_of, onList = new Set(snap.watchlist), pairs = snap.protocols.filter((p) => !derivative(p)).map((p) => ({ p, o: toObs(p, asOf) })), all = pairs.map((x) => x.o), live = all.filter((o) => o.y !== null);
  if (live.length < 20) throw new Error('only ' + live.length + ' priced tokens: too few to fit a value model');
  const flat = { loo: miss(live.map((o, i) => o.y - med(live.filter((_, j) => j !== i).map((q) => q.y)))), wf: miss(folds(live, 5).flatMap((f) => f.test.map((o) => o.y - med(f.train.map((q) => q.y))))) };
  const sv = select(live, valueScores, flat), plain = valueScores(live.map((o) => ({ ...o, f: 0 })), sv.terms), vf = fitValue(live, sv.terms), [q25, q75] = quant(vf.loo, [0.25, 0.75]);
  const rate = (xs) => mean(xs.map((o) => o.tok));
  const bcv = []; for (let f = 0; f < 10; f++) { const r = rate(all.filter((_, i) => i % 10 !== f)); for (const o of all.filter((_, i) => i % 10 === f)) bcv.push((r - o.tok) ** 2); }
  const bwf = []; for (const { train, test } of folds(all, 5)) for (const o of test) bwf.push((rate(train) - o.tok) ** 2);
  const so = select(all, oddsScores, { loo: mean(bcv), wf: mean(bwf) }), od = design(all, so.terms), ob = logistic(all.map((o) => od.row(o)), all.map((o) => o.tok), od.pen), oddsAt = (o) => clamp(1 / (1 + Math.exp(-dot(od.row(o), ob))), C.oddsLo, C.oddsHi);
  const names = new Map(pairs.map((x) => [x.p.slug, x.p.name])), fams = {}, cats = {};
  for (const o of all) { (fams[o.fam] = fams[o.fam] || []).push(o); const c = (cats[o.cat] = cats[o.cat] || { n: 0, t: 0 }); c.n++; c.t += o.tok; }
  const bySlug = new Map(snap.protocols.map((p) => [p.slug, p])), chosen = new Map();
  const traded = new Map(snap.protocols.filter((p) => !noToken(p)).map((p) => [stem(p.name), p.name])), kin = (p) => (stem(p.name).length > 2 ? traded.get(stem(p.name)) : undefined);
  for (const s of snap.watchlist) if (bySlug.has(s)) chosen.set(s, bySlug.get(s));
  snap.protocols.filter((p) => !chosen.has(p.slug) && noToken(p) && !derivative(p) && !kin(p)).sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1)).slice(0, C.maxEarly).forEach((p) => chosen.set(p.slug, p));
  const resid = vf.loo, sd = Math.sqrt(mean(resid.map((e) => (e - mean(resid)) ** 2))), rr = rng(20261114), zs = Array.from({ length: C.draws }, () => Math.sqrt(-2 * Math.log(1 - rr())) * Math.cos(2 * Math.PI * rr()));
  const rows = [...chosen.values()].map((p) => {
   const o = toObs(p, asOf), age = ageDays(asOf, p.listed_at), mult = Math.exp(vf.at(o)), odds = oddsAt(o), implied = Math.max(1, Math.round(p.tvl_usd * mult)), c = cost(p, age), u = rng(hash(p.slug));
   const parts = new Map(), xr = vf.d.row(o); vf.d.termOf.forEach((t, i) => parts.set(t, (parts.get(t) || 0) + xr[i] * vf.b[i]));
   const fam = fams[o.fam] || [], peers = fam.filter((q) => q.y !== null).length, cat = cats[o.cat] || { n: 0, t: 0 };
   const pool = new Float64Array(C.draws);
   for (let j = 0; j < C.draws; j++) { const e = resid[Math.floor(u() * resid.length)] * Math.sqrt(1 - C.rho) + sd * Math.sqrt(C.rho) * zs[j]; pool[j] = u() < odds ? implied * Math.exp(e) * (c.capital / p.tvl_usd) : 0; }
   const flags = [], hard = (p.change_7d !== null && (p.change_7d <= -15 || p.change_7d >= 300)) || (age !== null && age < 45);
   if (p.change_7d !== null && p.change_7d <= -15) flags.push('TVL fell ' + Math.abs(p.change_7d).toFixed(1) + '% in seven days');
   if (p.change_7d !== null && p.change_7d >= 300) flags.push('TVL rose ' + p.change_7d.toFixed(0) + '% in seven days: a deposit spike, not a trend');
   if (age !== null && age < 45) flags.push('Only ' + age + ' days on DefiLlama: too early to read a record');
   if (peers < C.minPeers) flags.push('Only ' + peers + ' live-token protocol' + (peers === 1 ? '' : 's') + ' in its family: the value rests on the size curve alone');
   if (odds < 0.25) flags.push('Fitted token rate is only ' + Math.floor(odds * 100) + '%');
   if (kin(p)) flags.push('A listing of the same first name already trades: ' + kin(p));
   if (c.cost >= c.capital) flags.push('Fees exceed the deposit: not worth running');
   if (p.tvl_usd >= 1e9) flags.push('A pool this large dilutes each dollar of deposit');
   if (p.change_7d === null) flags.push('Seven-day change not reported');
   if (age === null) flags.push('Listing date unknown');
   return { slug: p.slug, name: p.name, category: p.category, chains: p.chains, kind: o.fam, tvl: p.tvl_usd, g7: p.change_7d, listed: p.listed_at, age, onList: onList.has(p.slug), mult: r4(mult), odds: r4(odds), implied, low: Math.max(1, Math.round(implied * Math.exp(q25))), high: Math.round(implied * Math.exp(q75)), oddsPeers: cat,
    build: [{ label: 'Typical multiple', value: r4(Math.exp(parts.get('intercept'))) }, ...sv.terms.map((t) => ({ label: t, value: r4(Math.exp(parts.get(t))) })), { label: 'growth factor', value: r4(o.k.growth) }, { label: 'age factor', value: r4(o.k.age) }], peers, gaps: [p.change_7d === null ? 'change_7d' : '', age === null ? 'listed_at' : '', peers < C.minPeers ? 'fit' : ''].filter(Boolean),
    capital: c.capital, hold: c.hold, weeks: c.weeks, chain: c.chain, tx: c.tx, gas: c.gas, carry: c.carry, cost: c.cost, hard, flags, pool };
  }).sort((a, b) => b.implied - a.implied || (a.slug < b.slug ? -1 : 1)).map((r, i) => ({ ...r, rank: i + 1 }));
  const liveRows = snap.protocols.filter((p) => p.mcap_usd > 0 && p.category !== 'CEX').sort((a, b) => b.mcap_usd - a.mcap_usd || (a.slug < b.slug ? -1 : 1)), total = liveRows.length;
  const ranked = new Set(rows.map((r) => r.slug)), n = [0, 0, 0, 0, 0, 0, 0, 0], inFit = new Set(live.map((o) => o.slug));
  for (const p of snap.protocols) { if (ranked.has(p.slug)) n[onList.has(p.slug) ? 0 : 1]++; else if (!noToken(p)) n[inFit.has(p.slug) ? 2 : 3]++; else if (p.category === 'CEX') n[4]++; else if (derivative(p)) n[6]++; else if (kin(p)) n[5]++; else n[7]++; }
  return { rows, total: snap.protocols.length, asOf, q: [q25, q75], terms: sv.terms, evidence: {
   value: { n: live.length, terms: sv.terms, base: sv.base, final: sv.final, plain, rungs: sv.rungs, cov50: cover(live, sv.terms, 0.5), cov80: cover(live, sv.terms, 0.8), coef: vf.d.names.map((nm, i) => ({ name: nm, value: r4(vf.b[i]) })), back: live.map((o, i) => ({ slug: o.slug, name: names.get(o.slug), actual: Math.round(Math.exp(o.lnT + o.y)), model: Math.round(Math.exp(o.lnT + o.y - vf.loo[i])) })) },
   odds: { n: all.length, pos: all.reduce((s, o) => s + o.tok, 0), terms: so.terms, base: so.base, final: so.final, rungs: so.rungs },
   ledger: n },
   live: liveRows.slice(0, 40).map((p) => ({ slug: p.slug, name: p.name, category: p.category, tvl: p.tvl_usd, mcap: p.mcap_usd, x: r4(p.mcap_usd / Math.max(1, p.tvl_usd)), g7: p.change_7d })), liveTotal: total, globalMultiple: r4(med(live.map((o) => Math.exp(o.y)))) };
 }
 g.RadarModel = { C, run, econ, verdict, cost, factors, family, derivative, noToken, ageDays };
})(typeof window !== 'undefined' ? window : globalThis);
