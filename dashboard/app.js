// The page. It refits both models in the browser from the sealed snapshot (model.js), prices every farm with
// payoff draws, and draws what it finds. Nothing here needs a network: data.js holds the snapshot and the
// plans in words; every figure on screen is computed below from them.
(() => {
'use strict';
const M = RadarModel, S = SNAPSHOT, PL = PLANS, TX = TEXT, C = M.C, $ = (i) => document.getElementById(i);
const X = M.run(S), R = X.rows, E = X.evidence, mq = matchMedia('(max-width:1100px)');
const st = { sel: null, v: '', pre: '', share: C.share, mid: 'tree', det: 'ov', bn: 8, bm: 1 };
const usd = (n) => { if (n == null) return 'n/a'; const a = Math.abs(n); return a >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : a >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : a >= 1e4 ? '$' + Math.round(n / 1e3) + 'K' : a >= 100 ? '$' + Math.round(n).toLocaleString('en-US') : '$' + n.toFixed(2); };
const pc = (n) => (n == null ? 'n/a' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'), pct = (x) => Math.round(x * 100) + '%';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const VC = { farm: '#55e6b1', watch: '#7ab8ff', skip: '#5d6f7b' }, VL = { farm: 'Farm now', watch: 'Watch', skip: 'Skip' }, RC = { low: 'var(--farm)', medium: 'var(--warn)', high: 'var(--bad)' };
const KIND = { lending: 'lending', stable: 'stablecoin', dex: 'DEX', derivatives: 'derivatives', rwa: 'RWA', vault: 'vault', bridge: 'bridge', prediction: 'prediction', other: 'mixed' };
const TL = { size: 'size curve (ln TVL)', family: 'family effect', category: 'category effect', growth: '7-day growth', age: 'years listed', chains: 'chain count' };
const by = (s) => R.find((r) => r.slug === s), cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '.' : s);
function eco() {
for (const r of R) { r.e = M.econ(r, st.share); r.verdict = M.verdict(r, r.e); r.risk = r.hard || r.flags.length > 2 ? 'high' : r.flags.length ? 'medium' : 'low'; }
}
const INK = '#e3f2ed', MUT = '#8aa39e', GRID = '#172b3a', BLUE = '#3d7cc0', cw = () => (mq.matches ? 360 : 520);
const sv = (w, h, l, i) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(l)}">${i}</svg>`;
const tx = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.s || 10}" fill="${o.f || MUT}" text-anchor="${o.a || 'start'}" font-family="ui-monospace,Menlo,monospace">${esc(s)}</text>`;
const dm = (r, x, y, rad) => `<circle class="dot${r.slug === st.sel ? ' sel' : ''}" data-s="${r.slug}" data-tip="${esc(`${r.name}: ${VL[r.verdict]}, win ${pct(r.e.win)}, ${r.e.moic.toFixed(1)}x, ${usd(r.implied)}`)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" fill="${VC[r.verdict]}" fill-opacity="${r.verdict === 'skip' ? 0.5 : 0.92}" stroke="rgba(0,0,0,0)" stroke-width="12" tabindex="0" role="button" aria-label="${esc(r.name)}, ${VL[r.verdict]}"/>`;
const box = (t, q, s) => `<div class="cc"><h3>${t}</h3><p class="cq">${q}</p>${s}</div>`;
const key = () => '<div class="key"><span><i style="background:#55e6b1"></i>Farm now</span><span><i style="background:#7ab8ff"></i>Watch</span><span><i style="background:#5d6f7b"></i>Skip</span></div>';
// Squarified treemap: tiles close to square, each with an area proportional to .v
function squarify(items, x, y, w, h) {
const out = [], sc = (w * h) / items.reduce((s, i) => s + i.v, 0); let q = items.map((i) => ({ i, a: i.v * sc }));
const worst = (row, s) => { const mx = Math.max(...row), mn = Math.min(...row), sm = row.reduce((a, b) => a + b, 0); return Math.max((s * s * mx) / (sm * sm), (sm * sm) / (s * s * mn)); };
while (q.length && w > 0 && h > 0) {
const side = Math.min(w, h); let row = [], k = 0;
while (k < q.length) { const t = [...row, q[k].a]; if (row.length && worst(t, side) > worst(row, side)) break; row = t; k++; }
const th = row.reduce((a, b) => a + b, 0) / side; let pos = 0;
for (let j = 0; j < k; j++) { const len = q[j].a / th; out.push(w >= h ? { i: q[j].i, x, y: y + pos, w: th, h: len } : { i: q[j].i, x: x + pos, y, w: len, h: th }); pos += len; }
if (w >= h) { x += th; w -= th; } else { y += th; h -= th; }
q = q.slice(k);
}
return out;
}
function cTree() {
const W = cw(), H = mq.matches ? 500 : 560, g = {}; let s = '';
for (const r of R) { const k = r.category || 'Uncategorised'; (g[k] = g[k] || { k, v: 0, items: [] }).v += r.implied; g[k].items.push({ v: r.implied, r }); }
for (const b of squarify(Object.values(g).sort((a, c) => c.v - a.v), 0, 0, W, H)) {
const top = b.h > 40 && b.w > 74 ? 13 : 0;
s += `<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" fill="#0a1522" stroke="#2a4350"/>`;
if (top) s += tx(b.x + 4, b.y + 10, cut(b.i.k, Math.floor(b.w / 6)), { s: 9 });
if (b.w < 5 || b.h - top < 5) continue;
for (const c of squarify(b.i.items.sort((p, q) => q.v - p.v), b.x + 2, b.y + 2 + top, b.w - 4, b.h - 4 - top)) {
const r = c.i.r, fill = r.verdict === 'farm' ? '#55e6b1' : r.verdict === 'watch' ? '#3d7cc0' : '#3a4a55', op = r.verdict === 'farm' ? 0.95 : 0.35 + 0.6 * Math.min(1, r.e.win / 0.5);
s += `<rect class="dot" data-s="${r.slug}" data-tip="${esc(`${r.name}: ${VL[r.verdict]}, ${usd(r.implied)}, win ${pct(r.e.win)}`)}" x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" width="${Math.max(0, c.w).toFixed(1)}" height="${Math.max(0, c.h).toFixed(1)}" fill="${fill}" fill-opacity="${op.toFixed(2)}" stroke="#08121f" stroke-width="1.4" tabindex="0" role="button" aria-label="${esc(r.name)}"/>`;
if (c.w > 56 && c.h > 28) { const d = r.verdict === 'farm' ? '#06121c' : INK; s += tx(c.x + 5, c.y + 13, cut(r.name, Math.floor(c.w / 6.4)), { f: d, s: 10.5 }) + tx(c.x + 5, c.y + 26, usd(r.implied), { f: d, s: 9.5 }); }
}
}
return sv(W, H, 'Treemap of implied value: one tile per protocol, grouped by category', s);
}
function cFunnel(r) {
const W = Math.min(cw(), 440), L = W > 400 ? 128 : 112, Rr = 62, rh = 24, v = [r.tvl], N = ['TVL'], SH = { 'Typical multiple': 'multiple', size: 'size curve', family: 'family', category: 'category', growth: 'growth', age: 'years listed', chains: 'chains' };
for (const b of r.build) { v.push(v[v.length - 1] * b.value); N.push(`x ${SH[b.label] || b.label} ${b.value.toFixed(2)}`); }
v.push(r.implied); N.push(`x token odds ${pct(r.odds)}`);
let s = ''; v.forEach((x, i) => { const y = 6 + i * rh, w = Math.max(3, (x / v[0]) * (W - L - Rr)), last = i === v.length - 1; s += tx(L - 8, y + 14, N[i], { a: 'end', f: INK }) + `<path d="M${L} ${y + 10}H${L + w - 3}" stroke="${i === 0 ? '#4a6573' : last ? '#55e6b1' : BLUE}" stroke-width="13" stroke-linecap="round"/>` + tx(L + w + 6, y + 14, usd(x), { f: last ? '#55e6b1' : INK, s: 10.5 }) + `<rect x="0" y="${y}" width="${W}" height="${rh}" fill="transparent" data-tip="${esc(N[i] + ': ' + usd(x))}"/>`; });
return `<div class="mini"><h2>From TVL to implied value</h2>${sv(W, v.length * rh + 8, 'Bars showing TVL reduced step by step to the implied value', s)}</div>`;
}
// What a farm at plan size returns, over 400 draws: the 5th, 50th and 95th percentile and the trimmed expectation
function cOut(r) {
const e = r.e, W = Math.min(cw(), 440), L = 14, a = Math.min(e.p5, -r.cost), b = Math.max(e.p95, 0.01), x = (v) => L + ((v - a) / (b - a)) * (W - 2 * L);
const m = [[e.p5, 'worst 5%', '#ff7a6b'], [e.p50, 'median', MUT], [e.ev - r.cost, 'expected', '#55e6b1'], [e.p95, 'best 5%', '#55e6b1']], o = (v) => (v < 0 ? '-' : '') + usd(Math.abs(v));
const s = `<path d="M${L} 30H${W - L}" stroke="#2a4350" stroke-width="6" stroke-linecap="round"/><path d="M${x(0)} 18V42" stroke="${INK}" stroke-dasharray="2 3"/>` + tx(x(0), 12, 'break-even', { a: 'middle', s: 9 }) + m.map(([v, , c]) => `<circle cx="${x(v).toFixed(1)}" cy="30" r="5" fill="${c}"/>`).join('');
return `<div class="mini"><h2>What a ${usd(r.capital)} farm returns, net of cost</h2>${sv(W, 46, 'Spread of net outcomes over 400 draws', s)}<div class="eq">${m.map(([v, n, c]) => `<span><em><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:5px"></i>${n}</em>${o(v)}</span>`).join('')}</div><p class="mute" style="font-size:12px;margin:0">Profit in ${pct(e.win)} of 400 draws; the token never launches in ${pct(1 - r.odds)}. Cost ${usd(r.cost)}; trimmed expected payoff ${usd(e.ev)}, ${e.moic.toFixed(1)}x.</p></div>`;
}
function detail() {
const r = by(st.sel), e = r.e, pos = Math.max(0, Math.min(100, ((r.implied - r.low) / (r.high - r.low || 1)) * 100)), P = PL[r.slug];
$('dh').innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div style="min-width:0"><div class="nm">${esc(r.name)}</div><div class="mute" style="font-size:12px">#${r.rank} by value | ${esc(r.category || 'Uncategorised')} on ${esc(r.chains.slice(0, 3).join(', '))}${r.chains.length > 3 ? ' +' + (r.chains.length - 3) : ''}${r.onList ? ' <span class="tag hi">watchlist</span>' : ''}</div></div><div style="text-align:right"><span class="verdict v-${r.verdict}">${VL[r.verdict]}</span><div class="mute" style="font:600 12px var(--mono);margin-top:3px">win ${pct(e.win)} | ${e.moic.toFixed(1)}x | risk <span style="color:${RC[r.risk]}">${r.risk}</span></div></div></div>`
+ `<div class="big" style="margin-top:8px">${usd(r.implied)}</div><div class="range"><i></i><u style="left:${pos}%"></u></div><div class="sub" style="margin-bottom:8px"><span>low ${usd(r.low)}</span><span>odds ${pct(r.odds)}, ${r.conf} confidence</span><span>high ${usd(r.high)}</span></div>`;
$('d-ov').innerHTML = cFunnel(r) + cOut(r)
+ `<p class="mute" style="font-size:12px;margin:0 0 12px">Odds: ${r.oddsPeers.t} of ${r.oddsPeers.n} protocols in ${esc(r.category || 'its category')} record a token. ${TX.prose.odds}</p>`
+ `<h2>Risks</h2>` + (r.flags.length ? `<ul class="tight risk">${r.flags.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p class="mute" style="margin:0;font-size:13px">No risk flag on this row.</p>');
$('d-plan').innerHTML = `<h2>${usd(r.capital)} on ${esc(r.chain)} for ${r.hold} days</h2><table class="plan"><thead><tr><th>#</th><th>Step</th><th>Cost</th><th>Time</th></tr></thead><tbody>${P.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.text)}</td><td>${esc(s.cost)}</td><td>${esc(s.time)}</td></tr>`).join('')}</tbody></table>`
+ `<div class="eq" style="margin-top:10px"><span><em>total cost</em>${usd(r.cost)}</span><span><em>expected payoff</em>${usd(e.ev)}</span><span><em>chance of profit</em>${pct(e.win)}</span><span><em>payoff per $ of cost</em>${e.moic.toFixed(1)}x</span><span><em>worst 5%</em>${e.p5 < 0 ? '-' : ''}${usd(Math.abs(e.p5))}</span></div>`;
$('d-data').innerHTML = `<div class="cols"><div><h2>Data coverage</h2><table class="cov"><tbody>${TX.coverage.map((c) => `<tr><td><span class="st st-${c.status}">${c.status}</span></td><td>${esc(c.label)}${r.gaps.includes(c.key) ? ' <span class="tag lo">gap on this row</span>' : ''}<div class="mute" style="font-size:11.5px">${esc(c.note)}</div></td></tr>`).join('')}</tbody></table></div><div><h2>Before you commit money</h2><ol class="tight">${TX.checklists[r.kind].map((t) => `<li>${esc(t)}</li>`).join('')}</ol><p class="mute" style="font-size:12px;margin:10px 0 0">${TX.prose.data}</p></div></div>`;
}
const PRE = [['farm', 'Farm now', (r) => r.verdict === 'farm'], ['early', 'Early and growing', (r) => r.age != null && r.age < 365 && r.g7 != null && r.g7 > 5], ['cheap', 'Cheap to run', (r) => r.cost <= 3], ['odds', 'High odds', (r) => r.odds >= 0.7], ['old', 'Long unrewarded', (r) => r.age != null && r.age >= 540], ['wl', 'Watchlist', (r) => r.onList]];
let shown = R;
function list() {
const q = $('q').value.toLowerCase(), c = $('cat').value, ch = $('chain').value, sz = $('size').value, k = $('sortk').value, pf = PRE.find((p) => p[0] === st.pre);
shown = R.filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!c || (r.category || 'Uncategorised') === c) && (!ch || r.chains.includes(ch)) && (!st.v || r.verdict === st.v) && (!pf || pf[2](r)) && (!sz || (sz === 's' ? r.tvl < 5e7 : sz === 'm' ? r.tvl >= 5e7 && r.tvl < 2.5e8 : r.tvl >= 2.5e8)));
const f = (r) => (k === 'edge' ? r.e.edge : k === 'win' ? r.e.win : k === 'moic' ? r.e.moic : k === 'rank' ? -r.rank : k === 'g7' ? (r.g7 == null ? -1e12 : r.g7) : r.tvl);
shown = [...shown].sort((a, b) => f(b) - f(a));
$('list').innerHTML = shown.map((r) => `<div class="li${r.slug === st.sel ? ' sel' : ''}" data-s="${r.slug}" tabindex="0" role="button" aria-label="${esc(r.name)}"><span class="rk">${r.rank}</span><div style="min-width:0"><b>${esc(r.name)}</b><small>${esc(r.category || 'Uncategorised')} | ${usd(r.tvl)} | <span style="color:${r.g7 == null ? 'var(--mute)' : r.g7 >= 0 ? 'var(--farm)' : 'var(--bad)'}">${pc(r.g7)}</span></small></div><div class="vl"><span class="verdict v-${r.verdict}">${VL[r.verdict]} ${pct(r.e.win)}</span><small>${usd(r.implied)} | ${r.e.moic.toFixed(1)}x | <span style="color:${RC[r.risk]}">${r.risk}</span></small></div></div>`).join('') || '<p class="mute">No protocol matches these filters.</p>';
$('count').innerHTML = `${shown.length} of ${R.length} rows <button class="btn" data-export="1" style="float:right;padding:1px 8px">Export CSV</button>`;
sync();
}
function checks() {
const board = new Map(window.BOARD), same = R.filter((r) => board.get(r.slug) === r.implied).length, good = R.filter((r) => Math.abs(r.tvl * r.build.reduce((p, b) => p * b.value, 1) - r.ifl) <= Math.max(2, r.ifl * 0.005) && Math.abs(r.ifl * r.odds - r.implied) <= Math.max(2, r.implied * 0.002)).length;
const wl = R.filter((r) => r.onList).length, led = E.ledger.reduce((s, c) => s + c, 0), ord = R.every((r, i) => r.rank === i + 1 && (!i || r.implied <= R[i - 1].implied));
return [[same === R.length, `implied values equal board.json's: ${same} of ${R.length}, refitted in this browser`], [good === R.length, `rows recomputed from their own terms: ${good} of ${R.length}`], [ord, `ranks 1 to ${R.length} in order, value never rises`], [wl === S.watchlist.length, `watchlist ranked: ${wl} of ${S.watchlist.length}`], [led === S.protocols.length, `ledger: ${led} of ${S.protocols.length} protocols, each in one group`]];
}
function hdr() {
const n = { farm: 0, watch: 0, skip: 0 }; R.forEach((r) => n[r.verdict]++);
const tot = R.reduce((s, r) => s + r.implied, 0), cat = {}, kc = {}, f = R.filter((r) => r.verdict === 'farm'); let all = 0;
for (const r of R) { const k = r.category || 'Uncategorised'; cat[k] = (cat[k] || 0) + r.implied; all += r.implied; }
f.forEach((r) => (kc[r.kind] = (kc[r.kind] || 0) + 1));
const tc = Object.keys(cat).sort((a, b) => cat[b] - cat[a])[0], fk = Object.keys(kc).sort((a, b) => kc[b] - kc[a])[0], low = R.filter((r) => r.peers < C.minPeers).length, ck = checks().filter((c) => c[0]).length;
$('hud').innerHTML = ['farm', 'watch', 'skip'].map((v) => `<button class="chip" data-v="${v}" aria-pressed="${st.v === v}" style="color:${VC[v]}"><b>${n[v]}</b><span>${VL[v]}</span></button>`).join('') + `<div class="fact"><b>${usd(tot)}</b><span>implied value, all rows</span></div><div class="fact"><b>${X.globalMultiple.toFixed(2)}x</b><span>market cap / TVL, ${X.liveTotal} live</span></div>`;
$('read').innerHTML = `<b>${f.length} of ${R.length}</b> protocols clear the bar to farm${fk ? `, most of them <b>${KIND[fk]}</b>` : ''}: at least a 40% chance of profit and twice their cost back. <b>${esc(tc)}</b> holds ${Math.round((cat[tc] / all) * 100)}% of the implied value, yet <b>${Math.round((low / R.length) * 100)}%</b> of rows rest on fewer than three live peers. <button class="btn" data-evid="1" style="padding:0 7px;margin-left:4px">${ck} of 5 checks pass</button>`;
$('meta').textContent = `SNAPSHOT ${X.asOf} | ${R.length} ROWS | MODEL REFITTED HERE`;
}
function basket() {
const b = M.basket(R, st.share, st.bn, st.bm), N = b.net.length, s = Float64Array.from(b.net).sort(), lo = s[Math.floor(N * 0.01)], hi = s[Math.floor(N * 0.9)], W = cw(), H = 130, bins = new Array(24).fill(0);
for (const v of b.net) bins[Math.max(0, Math.min(23, Math.floor(((v - lo) / (hi - lo || 1)) * 24)))]++;
const mx = Math.max(...bins), bw = (W - 20) / 24; let g = '';
bins.forEach((n, i) => { const v = lo + ((i + 0.5) / 24) * (hi - lo), h = (n / mx) * 90; g += `<rect x="${(10 + i * bw).toFixed(1)}" y="${(100 - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${v < 0 ? '#ff7a6b' : '#55e6b1'}" fill-opacity=".85" data-tip="${esc(`${n} of ${N} draws near ${v < 0 ? '-' : ''}${usd(Math.abs(v))}`)}"/>`; });
g += `<path d="M${10 + ((0 - lo) / (hi - lo || 1)) * (W - 20)} 6V104" stroke="${INK}" stroke-dasharray="2 3"/>` + tx(10, 122, usd(lo), { s: 9 }) + tx(W - 10, 122, usd(hi) + ' and above', { a: 'end', s: 9 }) + tx(W / 2, 122, 'net outcome, 400 draws', { a: 'middle', s: 9 });
const o = (v) => `${v < 0 ? '-' : ''}${usd(Math.abs(v))}`;
$('basket').innerHTML = `<p class="mute" style="font-size:12.5px;margin:0 0 10px">${TX.prose.basket}</p><div class="scn" style="padding:0 0 8px;border:0">Positions <input type="range" id="bn" min="3" max="12" value="${st.bn}" aria-label="Positions in the basket"><b>${st.bn}</b> Size <input type="range" id="bm" min="1" max="10" value="${st.bm}" aria-label="Position size multiple"><b>${st.bm}x</b></div>`
+ `<div class="eq"><span><em>capital</em>${usd(b.cap)}</span><span><em>expected, trimmed</em>${o(b.ev)}</span><span><em>chance of a loss</em>${pct(b.loss)}</span><span><em>worst 5%</em>${o(b.p5)}</span><span><em>median</em>${o(b.p50)}</span><span><em>best 5% starts at</em>${o(b.p95)}</span></div>`
+ box('Outcome of the basket', 'Red is a loss. The median is usually a small gain or loss; the expectation lives in the right tail.', sv(W, H, 'Histogram of the basket net outcome over 400 draws', g))
+ `<table><thead><tr><th>Position</th><th class="n">Capital</th><th class="n">Win</th><th class="n">Payoff/cost</th></tr></thead><tbody>${b.pick.map((r) => `<tr class="row" data-s="${r.slug}" style="cursor:pointer"><td>${esc(r.name)}<div class="mute" style="font-size:11.5px">${KIND[r.kind]}</div></td><td class="n">${usd(r.capital * st.bm)}</td><td class="n">${pct(r.e.win)}</td><td class="n">${r.e.moic.toFixed(1)}x</td></tr>`).join('') || '<tr><td colspan="4" class="mute">No protocol clears the bar at these settings.</td></tr>'}</tbody></table>`;
['bn', 'bm'].forEach((i) => $(i).addEventListener('input', () => { st.bn = +$('bn').value; st.bm = +$('bm').value; basket(); sync(); }));
}
function back() {
const B = E.value.back, W = cw(), H = 300, L = 46, Rr = 12, T = 10, Bm = 34, all = B.flatMap((b) => [b.actual, b.model]), lo = Math.floor(Math.log10(Math.min(...all))), hi = Math.ceil(Math.log10(Math.max(...all))), x = (v) => L + ((Math.log10(v) - lo) / (hi - lo)) * (W - L - Rr), y = (v) => H - Bm - ((Math.log10(v) - lo) / (hi - lo)) * (H - T - Bm);
let s = '', inb = 0;
for (let e = lo + 1; e < hi; e++) { const t = 10 ** e; s += `<path d="M${x(t)} ${T}V${H - Bm}M${L} ${y(t)}H${W - Rr}" stroke="${GRID}"/>` + tx(x(t), H - Bm + 13, usd(t), { a: 'middle', s: 9 }) + tx(L - 5, y(t) + 3, usd(t), { a: 'end', s: 9 }); }
const a = 10 ** lo, b = 10 ** hi;
s += `<clipPath id="cb"><rect x="${L}" y="${T}" width="${W - L - Rr}" height="${H - T - Bm}"/></clipPath><g clip-path="url(#cb)" fill="none">${[[1, 0, INK], [3, 1, '#4a6573'], [1 / 3, 1, '#4a6573']].map((k) => `<path d="M${x(a)} ${y(a * k[0])}L${x(b)} ${y(b * k[0])}" stroke="${k[2]}"${k[1] ? ' stroke-dasharray="4 4"' : ''}/>`).join('')}</g>`;
for (const q of B) { const ok = Math.abs(Math.log(q.actual / q.model)) <= Math.log(3); if (ok) inb++; s += `<circle cx="${x(q.model).toFixed(1)}" cy="${y(q.actual).toFixed(1)}" r="3.4" fill="${ok ? '#55e6b1' : BLUE}" fill-opacity=".85" stroke="rgba(0,0,0,0)" stroke-width="10" data-tip="${esc(`${q.name}: model ${usd(q.model)}, market ${usd(q.actual)}`)}"/>`; }
s += tx((W + L) / 2, H - 4, 'model market cap, fitted without the protocol →', { a: 'middle' }) + `<text transform="translate(10 ${H / 2}) rotate(-90)" font-size="10" fill="${MUT}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace">actual market cap →</text>`;
return box('Back-test: the model against the market', `Each dot is a protocol whose token trades. x is what a model fitted without it predicts, y its real market cap. On the solid line the model is right; between the dashed lines it is within x3. ${inb} of ${B.length} fall inside: the tail is wide, and the largest caps are not priced by TVL at all.`, sv(W, H, 'Scatter of the leave-one-out model market cap against the actual market cap', s));
}
function evid() {
const v = E.value, o = E.odds, ladder = (base, rungs, h1, h2, f) => `<table><thead><tr><th>Term, added in order</th><th class="n">${h1}</th><th class="n">${h2}</th><th></th></tr></thead><tbody><tr><td>baseline</td><td class="n">${f(base.loo)}</td><td class="n">${f(base.wf)}</td><td class="mute">to beat</td></tr>${rungs.map((g) => `<tr><td>${TL[g.term]}</td><td class="n">${f(g.loo)}</td><td class="n">${f(g.wf)}</td><td>${g.kept ? '<span class="tag hi">kept</span>' : '<span class="tag">not kept</span>'}</td></tr>`).join('')}</tbody></table>`;
const cols = ['#55e6b1', '#3d7cc0', '#7ab8ff', '#8aa39e', '#3a4a55', '#3a4a55', '#3a4a55', '#3a4a55'], W = cw(); let x = 0, bar = '';
E.ledger.forEach((c, i) => { const w = (c / S.protocols.length) * W; bar += `<rect x="${x.toFixed(1)}" y="2" width="${Math.max(0, w - 2).toFixed(1)}" height="14" rx="3" fill="${cols[i]}" data-tip="${esc(TX.ledger[i][0] + ': ' + c)}"/>`; x += w; });
const miss = TX.coverage.filter((c) => c.status === 'missing').length;
$('evid').innerHTML = `<div class="chk">${checks().map((c) => `<span class="${c[0] ? 'ok' : 'bad'}">${c[0] ? '✓' : '✗'} ${esc(c[1])}</span>`).join('')}</div>`
+ `<p class="mute" style="font-size:12.5px;margin:0 0 12px">${TX.prose.evid}</p>`
+ box('Value model: how far off is it on tokens it has not seen?', `Typical (median) miss on ${v.n} protocols whose token trades; x3 means off by a factor of 3. Final model: ${v.terms.map((t) => TL[t]).join(' + ') || 'flat multiple'}, typical miss x${v.final.loo.toFixed(2)} leave-one-out and x${v.final.wf.toFixed(2)} walk-forward, against x${v.base.loo.toFixed(2)} and x${v.base.wf.toFixed(2)} for a flat median multiple.`, ladder(v.base, v.rungs, 'Leave-one-out', 'Walk-forward', (n) => 'x' + n.toFixed(2)))
+ back()
+ box('Is the printed range honest?', TX.prose.honest, `<table><thead><tr><th>Stated</th><th class="n">Ten-fold</th><th class="n">Walk-forward</th></tr></thead><tbody><tr><td>inside the P25 to P75 band, stated 50%</td><td class="n">${pct(v.cov50.loo)}</td><td class="n">${pct(v.cov50.wf)}</td></tr><tr><td>inside the P10 to P90 band, stated 80%</td><td class="n">${pct(v.cov80.loo)}</td><td class="n">${pct(v.cov80.wf)}</td></tr></tbody></table>`)
+ box('Token odds: do they beat the base rate?', `Brier score (lower is better) on ${o.n} protocols, ${o.pos} of which record a token. Final model: ${o.terms.map((t) => TL[t]).join(' + ')}.`, ladder(o.base, o.rungs, 'Ten-fold', 'Walk-forward', (n) => n.toFixed(3)))
+ `<div class="cc led"><h3>Ledger: every one of the ${S.protocols.length} protocols in the snapshot, in one group</h3><p class="cq">Nothing is silently dropped.</p><svg viewBox="0 0 ${W} 18" role="img" aria-label="Stacked bar of the ledger groups">${bar}</svg><table><tbody>${E.ledger.map((c, i) => `<tr><td><i style="background:${cols[i]}"></i>${esc(TX.ledger[i][0])}<div class="mute" style="font-size:11.5px;margin-left:15px">${esc(TX.ledger[i][1])}</div></td><td class="n">${c}</td></tr>`).join('')}</tbody></table></div>`
+ box('What is assumed, and what is missing', TX.prose.assumed.replace('{share}', pct(C.share)).replace('{missing}', miss).replace('{total}', TX.coverage.length), '');
}
function live() {
$('live').innerHTML = `<thead><tr><th>Protocol</th><th>Category</th><th class="n">TVL</th><th class="n">Market cap</th><th class="n">Cap/TVL</th></tr></thead><tbody>${X.live.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.category || '')}</td><td class="n">${usd(r.tvl)}</td><td class="n">${usd(r.mcap)}</td><td class="n">${r.x.toFixed(2)}x</td></tr>`).join('')}</tbody>`;
}
function views() { $('tree').innerHTML = cTree(); }
const toast = (m) => { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 1800); };
const cell = (v) => { if (v == null) return ''; if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) v = "'" + v; v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function exportCsv() {
const rows = [['rank', 'slug', 'name', 'category', 'verdict', 'implied_value_usd', 'low_usd', 'high_usd', 'token_odds', 'tvl_usd', 'change_7d', 'age_days', 'capital_usd', 'cost_usd', 'chance_of_profit', 'payoff_per_cost', 'expected_edge_usd', 'p5_net_usd', 'p50_net_usd', 'p95_net_usd', 'flags'].join(',')]
.concat(shown.map((r) => [r.rank, r.slug, r.name, r.category, r.verdict, r.implied, r.low, r.high, r.odds, r.tvl, r.g7, r.age, r.capital, r.cost.toFixed(2), r.e.win.toFixed(3), r.e.moic.toFixed(2), r.e.edge.toFixed(2), r.e.p5.toFixed(2), r.e.p50.toFixed(2), r.e.p95.toFixed(2), r.flags.join('; ')].map(cell).join(',')));
const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })); a.download = 'token-radar-' + X.asOf + '.csv'; document.body.appendChild(a); a.click(); a.remove(); toast('Exported ' + shown.length + ' rows');
}
function sync() { try { const h = [`p=${st.sel}`, `mt=${st.mid}`, `dt=${st.det}`]; if (st.v) h.push('v=' + st.v); if (st.pre) h.push('preset=' + st.pre); if ($('q').value) h.push('q=' + encodeURIComponent($('q').value)); if (st.share !== C.share) h.push('drop=' + Math.round(st.share * 100)); history.replaceState(null, '', '#' + h.join('&')); } catch (e) { } }
function tab(g, t) { st[g] = t; document.querySelectorAll(`[data-g="${g}"] [data-t]`).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === t))); document.querySelectorAll(`[data-g="${g}"][data-p]`).forEach((p) => (p.hidden = p.dataset.p !== t)); sync(); }
const app = document.querySelector('.app'), go = (m) => { app.dataset.m = m; document.querySelectorAll('#nav button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.go === m))); };
const sb = () => { const r = by(st.sel); $('selbar').innerHTML = `<div><b>${esc(r.name)}</b><small>${VL[r.verdict]} | win ${pct(r.e.win)} | ${usd(r.implied)}</small></div><button class="btn" data-go="det">Open detail</button>`; };
const tip = $('tip'), showTip = (el, x, y) => { tip.textContent = el.dataset.tip; tip.hidden = false; tip.style.left = Math.max(4, Math.min(innerWidth - tip.offsetWidth - 8, x + 12)) + 'px'; tip.style.top = Math.max(4, Math.min(innerHeight - tip.offsetHeight - 8, y + 14)) + 'px'; };
document.addEventListener('pointermove', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t, e.clientX, e.clientY); else tip.hidden = true; });
document.addEventListener('focusin', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) { const b = t.getBoundingClientRect(); showTip(t, b.left, b.top); } });
document.addEventListener('focusout', () => (tip.hidden = true));
function select(s) { st.sel = s; detail(); list(); sb(); document.querySelectorAll('.dot').forEach((c) => c.classList.toggle('sel', c.dataset.s === s)); }
function refresh() { eco(); hdr(); list(); detail(); views(); if (st.mid === 'basket') basket(); sb(); }
document.addEventListener('click', (e) => {
const t = (sel) => e.target.closest(sel);
let n;
if ((n = t('[data-evid]'))) return tab('mid', 'evidence');
if (t('[data-export]')) return exportCsv();
if ((n = t('[data-go]'))) return go(n.dataset.go);
if ((n = t('.tabs button[data-t]'))) { tab(n.parentNode.dataset.g, n.dataset.t); if (n.dataset.t === 'basket') basket(); return; }
if ((n = t('[data-v]'))) { st.v = st.v === n.dataset.v ? '' : n.dataset.v; hdr(); return list(); }
if ((n = t('[data-p]')) && n.tagName === 'BUTTON') { st.pre = st.pre === n.dataset.p ? '' : n.dataset.p; document.querySelectorAll('#presets button').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.p === st.pre))); return list(); }
if ((n = t('[data-s]'))) { select(n.dataset.s); if (mq.matches && !n.classList.contains('dot')) go('det'); }
});
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.s) { e.preventDefault(); select(e.target.dataset.s); } });
['q', 'cat', 'chain', 'size', 'sortk'].forEach((i) => $(i).addEventListener('input', list));
$('ftog').addEventListener('click', () => document.querySelector('.filters').classList.toggle('fopen'));
mq.addEventListener('change', () => { views(); detail(); });
$('drop').addEventListener('input', () => { st.share = $('drop').value / 100; $('dropv').textContent = $('drop').value + '%'; refresh(); });
$('rst').addEventListener('click', () => { $('drop').value = Math.round(C.share * 100); $('drop').dispatchEvent(new Event('input')); });
const cats = [...new Set(R.map((r) => r.category || 'Uncategorised'))].sort(), chs = [...new Set(R.flatMap((r) => r.chains))].sort();
$('cat').innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
$('chain').innerHTML = '<option value="">All chains</option>' + chs.map((c) => `<option>${esc(c)}</option>`).join('');
$('presets').innerHTML = PRE.map((p) => `<button data-p="${p[0]}" aria-pressed="false">${p[1]}</button>`).join('');
const h = location.hash; let m;
if ((m = h.match(/drop=(\d+)/))) { st.share = m[1] / 100; $('drop').value = m[1]; $('dropv').textContent = m[1] + '%'; }
if ((m = h.match(/v=(farm|watch|skip)/))) st.v = m[1];
if ((m = h.match(/preset=(\w+)/))) { st.pre = m[1]; document.querySelectorAll('#presets button').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.p === st.pre))); }
if ((m = h.match(/q=([^&]*)/))) $('q').value = decodeURIComponent(m[1]);
eco();
st.sel = (m = h.match(/p=([\w-]+)/)) && by(m[1]) ? m[1] : (R.find((r) => r.verdict === 'farm') || R[0]).slug;
hdr(); detail(); list(); views(); evid(); live(); sb();
if ((m = h.match(/view=(\w+)/))) go(m[1]);
if ((m = h.match(/dt=(\w+)/))) tab('det', m[1]);
if ((m = h.match(/mt=(\w+)/))) { tab('mid', m[1]); if (m[1] === 'basket') basket(); }
if ((m = h.match(/bn=(\d+)/))) st.bn = +m[1];
})();
