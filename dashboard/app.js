// The page. It refits both models in the browser from the sealed snapshot (model.js), writes each farm plan
// (plan.js) and prices it with payoff draws. Nothing here needs a network: data.js holds the snapshot and the
// static text; every figure on screen is computed below from them.
(() => {
'use strict';
const M = RadarModel, P = RadarPlan, S = SNAPSHOT, TX = TEXT, C = M.C, $ = (i) => document.getElementById(i);
const X = M.run(S), R = X.rows, E = X.evidence, mq = matchMedia('(max-width:1100px)');
const st = { sel: null, v: '', pre: '', share: C.share, mid: 'board', det: 'ov', sk: 'rank', up: true };
const usd = (n) => { if (n == null) return 'n/a'; if (n < 0) return '-' + usd(-n); const a = n; return a >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : a >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : a >= 1e4 ? '$' + Math.round(n / 1e3) + 'K' : a >= 100 ? '$' + Math.round(n).toLocaleString('en-US') : '$' + n.toFixed(2); };
const pc = (n) => (n == null ? 'n/a' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'), pct = (x) => Math.floor(x * 100 + 1e-9) + '%';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const VC = { farm: '#55e6b1', watch: '#7ab8ff', skip: '#5d6f7b' }, VL = { farm: 'Farm now', watch: 'Watch', skip: 'Skip' }, RC = { low: 'var(--farm)', medium: 'var(--warn)', high: 'var(--bad)' };
const KIND = { lending: 'lending', stable: 'stablecoin', dex: 'DEX and liquidity', derivatives: 'derivatives', rwa: 'RWA', vault: 'vault', bridge: 'bridge', prediction: 'prediction', other: 'mixed' };
const TL = { size: 'size curve (ln TVL)', family: 'family effect', category: 'category effect', growth: '7-day growth', age: 'years listed', chains: 'chain count' };
const catOf = (r) => r.category || 'Uncategorised';
const by = (s) => R.find((r) => r.slug === s);
function eco() {
for (const r of R) { r.e = M.econ(r, st.share); r.verdict = M.verdict(r, r.e); r.risk = r.hard || r.flags.length > 2 ? 'high' : r.flags.length ? 'medium' : 'low'; }
}
const INK = '#e3f2ed', MUT = '#8aa39e', GRID = '#172b3a', BLUE = '#3d7cc0', cw = () => (mq.matches ? 360 : 520);
const sv = (w, h, l, i) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(l)}">${i}</svg>`;
const tx = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.s || 10}" fill="${o.f || MUT}" text-anchor="${o.a || 'start'}" font-family="ui-monospace,Menlo,monospace">${esc(s)}</text>`;
const box = (t, q, s) => `<div class="cc"><h3>${t}</h3><p class="cq">${q}</p>${s}</div>`;
function cFunnel(r) {
const W = Math.min(cw(), 440), L = W > 400 ? 168 : 150, Rr = 62, rh = 24, v = [r.tvl], N = ['TVL'], SH = { 'Typical multiple': 'multiple', size: 'size curve', family: 'family', category: 'category', growth: 'growth', age: 'years listed', chains: 'chains', 'growth factor': `growth (7d ${pc(r.g7)})`, 'age factor': r.age == null ? 'age unknown' : `age (${r.age} days)` };
for (const b of r.build) { v.push(v[v.length - 1] * b.value); N.push(`x ${SH[b.label]} ${b.value.toFixed(3)}`); }
v.push(r.implied); N.push('= implied value');
let s = ''; v.forEach((x, i) => { const y = 6 + i * rh, w = Math.max(3, (x / v[0]) * (W - L - Rr)), last = i === v.length - 1; s += tx(L - 8, y + 14, N[i], { a: 'end', f: INK }) + `<path d="M${L} ${y + 10}H${L + w - 3}" stroke="${i === 0 ? '#4a6573' : last ? '#55e6b1' : BLUE}" stroke-width="13" stroke-linecap="round"/>` + tx(L + w + 6, y + 14, usd(x), { f: last ? '#55e6b1' : INK, s: 10.5 }) + `<rect x="0" y="${y}" width="${W}" height="${rh}" fill="transparent" data-tip="${esc(N[i] + ': ' + usd(x))}"/>`; });
return `<div class="mini"><h2>From TVL to implied value</h2>${sv(W, v.length * rh + 8, 'Bars showing TVL reduced step by step to the implied value', s)}</div>`;
}
// What a farm at plan size returns, over 400 draws: the 5th, 50th and 95th percentile and the trimmed expectation
function cOut(r) {
const e = r.e, W = Math.min(cw(), 440), L = 14, a = Math.min(e.p5, -r.cost), b = Math.max(e.p95, 0.01), x = (v) => L + ((v - a) / (b - a)) * (W - 2 * L);
const m = [[e.p5, 'worst 5%', '#ff7a6b'], [e.p50, 'median', MUT], [e.ev - r.cost, 'expected', '#55e6b1'], [e.p95, 'best 5%', '#55e6b1']];
const s = `<path d="M${L} 30H${W - L}" stroke="#2a4350" stroke-width="6" stroke-linecap="round"/><path d="M${x(0)} 18V42" stroke="${INK}" stroke-dasharray="2 3"/>` + tx(x(0), 12, 'break-even', { a: 'middle', s: 9 }) + m.map(([v, , c]) => `<circle cx="${x(v).toFixed(1)}" cy="30" r="5" fill="${c}"/>`).join('');
return `<div class="mini"><h2>What a ${usd(r.capital)} farm returns, net of cost</h2>${sv(W, 46, 'Spread of net outcomes over 400 draws', s)}<div class="eq">${m.map(([v, n, c]) => `<span><em><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:5px"></i>${n}</em>${usd(v)}</span>`).join('')}</div><p class="note">Profit in ${pct(e.win)} of 400 draws; no token in ${pct(1 - r.odds)} of them, from the token rate. Cost ${usd(r.cost)}; trimmed expected payoff ${usd(e.ev)}, ${e.moic.toFixed(1)}x.</p></div>`;
}
function detail() {
const r = by(st.sel), e = r.e, h = r.hours.toFixed(1), ch = r.chains.length ? [r.chain, ...r.chains.filter((c) => c !== r.chain)] : [r.chain];
$('dh').innerHTML = `<div class="head"><div style="min-width:0"><div class="nm">${esc(r.name)}</div><div class="mute">#${r.rank} of ${R.length} by value | ${esc(catOf(r))} on ${esc(ch.slice(0, 3).join(', '))}${ch.length > 3 ? ' +' + (ch.length - 3) : ''}${r.onList ? ' <span class="tag hi">watchlist</span>' : ''}</div></div><div style="text-align:right"><span class="verdict v-${r.verdict}">${VL[r.verdict]}</span><div class="stat">win ${pct(e.win)} | ${e.moic.toFixed(1)}x | risk <span style="color:${RC[r.risk]}">${r.risk}</span></div></div></div>`
+ `<div class="big">${usd(r.implied)} <small>implied value if its token launches</small></div><div class="band">P25 ${usd(r.low)} to P75 ${usd(r.high)}, from the model's held-out errors</div>`
+ `<div class="facts">No token recorded | ${r.age == null ? 'listing date unknown' : r.age + ' days listed'} | TVL ${usd(r.tvl)}, ${pc(r.g7)} in 7 days | fitted token rate ${pct(r.odds)} | ${r.peers} priced peers</div>`;
$('d-ov').innerHTML = cFunnel(r) + cOut(r)
+ `<p class="note">Token rate ${pct(r.odds)}: fitted on ${E.odds.terms.map((t) => TL[t]).join(', ')}. Raw count in ${esc(catOf(r))}: ${r.oddsPeers.t} of ${r.oddsPeers.n} record a token. ${TX.prose.odds}</p>`
+ `<h2>Risks</h2>` + (r.flags.length ? `<ul class="tight risk">${r.flags.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p class="note">No risk flag on this row.</p>');
$('d-plan').innerHTML = `<h2>Farm plan: ${usd(r.capital)} on ${esc(r.chain)}</h2><div class="eq"><span><em>total cost</em>${usd(r.cost)}</span><span><em>work</em>${h} h</span><span><em>hold</em>${r.hold} days</span><span><em>exp. payoff</em>${usd(e.ev)}</span><span><em>win</em>${pct(e.win)}</span></div>`
+ `<table class="plan"><thead><tr><th>#</th><th>Step</th><th>Cost</th><th>Time</th></tr></thead><tbody>${r.plan.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.text)}</td><td>${esc(s.cost)}</td><td>${esc(s.time)}</td></tr>`).join('')}<tr class="sum"><td></td><td>Total of the six steps, over ${r.hold} days</td><td>${usd(r.cost)}</td><td>${h} h</td></tr></tbody></table><p class="note">${r.cost >= r.capital ? '<b style="color:var(--bad)">Do not run: fees exceed the deposit.</b> ' : ''}${TX.prose.plan}</p>`;
$('d-data').innerHTML = `<div class="cols"><div><h2>Data coverage</h2><table class="cov"><tbody>${TX.coverage.map((c) => `<tr><td><span class="st st-${c.status}">${c.status}</span></td><td>${esc(c.label)}${r.gaps.includes(c.key) ? ' <span class="tag lo">gap on this row</span>' : ''}<div class="why">${esc(c.note)}</div></td></tr>`).join('')}</tbody></table></div><div><h2>Before you commit money</h2><ol class="tight">${TX.checklists[r.kind].map((t) => `<li>${esc(t)}</li>`).join('')}</ol><p class="note">${TX.prose.data}</p></div></div>`;
}
const PRE = [['farm', 'Farm now', (r) => r.verdict === 'farm'], ['early', 'Early and growing', (r) => r.age != null && r.age < 365 && r.g7 != null && r.g7 > 5], ['cheap', 'Cheap to run', (r) => r.cost <= 3], ['odds', 'Rate 70%+', (r) => r.odds >= 0.7], ['old', 'Long unrewarded', (r) => r.age != null && r.age >= 540], ['wl', 'Watchlist', (r) => r.onList]];
// The board: ranked by implied value until a column header is clicked.
const COL = [['rank', '#'], ['name', 'Protocol'], ['implied', 'Implied value'], ['tvl', 'TVL'], ['g7', 'TVL 7d'], ['age', 'Days, no token'], ['odds', 'Token rate'], ['cost', 'Farm cost'], ['hours', 'Work'], ['win', 'Win'], ['verdict', 'Verdict']], UP = ['rank', 'name', 'cost', 'hours'], VN = { farm: 2, watch: 1, skip: 0 };
const val = (r, k) => (k === 'name' ? r.name.toLowerCase() : k === 'win' ? r.e.win : k === 'verdict' ? VN[r.verdict] : r[k] ?? -1e12);
const order = (x, y) => { const a = val(x, st.sk), b = val(y, st.sk); return (a < b ? -1 : a > b ? 1 : 0) * (st.up ? 1 : -1) || x.rank - y.rank; };
let shown = R;
function list() {
const q = $('q').value.toLowerCase(), c = $('cat').value, ch = $('chain').value, sz = $('size').value, pf = PRE.find((p) => p[0] === st.pre);
shown = R.filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!c || catOf(r) === c) && (!ch || r.chains.includes(ch)) && (!st.v || r.verdict === st.v) && (!pf || pf[2](r)) && (!sz || (sz === 's' ? r.tvl < 5e7 : sz === 'm' ? r.tvl >= 5e7 && r.tvl < 2.5e8 : r.tvl >= 2.5e8))).sort(order);
$('list').innerHTML = `<thead><tr>${COL.map(([k, n]) => `<th${st.sk === k ? ` aria-sort="${st.up ? 'ascending' : 'descending'}"` : ''}><button data-sort="${k}">${n}${st.sk === k ? (st.up ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead><tbody>` + (shown.map((r) => `<tr class="li" data-s="${r.slug}" tabindex="0" aria-selected="${r.slug === st.sel}" aria-label="${esc(r.name)}"><td class="rk">${r.rank}</td><td class="who"><b>${esc(r.name)}</b><small>${esc(catOf(r))} | ${esc(r.chain)}</small></td><td class="n val"><i style="width:${(Math.sqrt(r.implied / R[0].implied) * 100).toFixed(0)}%"></i><span>${usd(r.implied)}</span></td><td class="n">${usd(r.tvl)}</td><td class="n" style="color:${r.g7 == null ? 'var(--mute)' : r.g7 >= 0 ? 'var(--farm)' : 'var(--bad)'}">${pc(r.g7)}</td><td class="n">${r.age ?? 'n/a'}</td><td class="n">${pct(r.odds)}</td><td class="n">${usd(r.cost)}</td><td class="n">${r.hours.toFixed(1)} h</td><td class="n">${pct(r.e.win)}</td><td><span class="verdict v-${r.verdict}">${VL[r.verdict]}</span></td></tr>`).join('') || '<tr><td colspan="11" class="mute">No protocol matches these filters.</td></tr>') + '</tbody>';
$('count').textContent = `${shown.length} of ${R.length} rows`;
sync();
}
function checks() {
const board = new Map(window.BOARD), same = R.filter((r) => board.get(r.slug) === r.implied).length, good = R.filter((r) => Math.abs(r.tvl * r.build.reduce((p, b) => p * b.value, 1) - r.implied) <= Math.max(2, r.implied * 0.005)).length;
const wl = R.filter((r) => r.onList).length, led = E.ledger.reduce((s, c) => s + c, 0), ord = R.every((r, i) => r.rank === i + 1 && (!i || r.implied <= R[i - 1].implied));
const plans = R.filter((r) => Math.abs(r.plan.reduce((s, p) => s + p.fee, 0) - r.cost) < 1e-9 && r.plan.every((p) => P.stepText(p).length >= 20)).length;
return [[same === R.length, `implied values equal board.json's: ${same} of ${R.length}, refitted in this browser`], [good === R.length, `rows recomputed from their own terms: ${good} of ${R.length}`], [ord, `ranks 1 to ${R.length} in order, value never rises`], [plans === R.length, `farm plans whose step fees add up to the cost: ${plans} of ${R.length}`], [wl === S.watchlist.length, `watchlist ranked: ${wl} of ${S.watchlist.length}`], [led === S.protocols.length, `ledger: ${led} of ${S.protocols.length} protocols, each in one group`]];
}
function hdr() {
const n = { farm: 0, watch: 0, skip: 0 }; R.forEach((r) => n[r.verdict]++);
const tot = R.reduce((s, r) => s + r.implied, 0), cat = {}, kc = {}, f = R.filter((r) => r.verdict === 'farm'); let all = 0;
for (const r of R) { const k = catOf(r); cat[k] = (cat[k] || 0) + r.implied; all += r.implied; }
f.forEach((r) => (kc[r.kind] = (kc[r.kind] || 0) + 1));
const tc = Object.keys(cat).sort((a, b) => cat[b] - cat[a])[0], fk = Object.keys(kc).sort((a, b) => kc[b] - kc[a])[0], all6 = checks(), ck = all6.filter((c) => c[0]).length;
$('hud').innerHTML = ['farm', 'watch', 'skip'].map((v) => `<button class="chip" data-v="${v}" aria-pressed="${st.v === v}" style="color:${VC[v]}"><b>${n[v]}</b><span>${VL[v]}</span></button>`).join('') + `<div class="fact"><b>${usd(tot)}</b><span>implied value, all rows</span></div><div class="fact"><b>${X.liveTotal}</b><span>priced tokens, kept off</span></div>`;
$('read').innerHTML = `Ranked by <b>implied value</b>: a token's worth if the protocol's record stays as it is. <b>${f.length} of ${R.length}</b> clear the bar to farm${fk ? ` (largest group: <b>${KIND[fk]}</b>, ${kc[fk]})` : ''}: at least 40% win and twice the cost back, if a token arrives at its fitted rate. <b>${esc(tc)}</b> holds ${Math.round((cat[tc] / all) * 100)}% of the implied value. <button class="btn" data-evid="1" style="padding:0 7px;margin-left:4px">${ck} of ${all6.length} checks pass</button>`;
$('meta').textContent = `SNAPSHOT ${X.asOf} | ${R.length} ROWS | MODEL REFITTED HERE`;
}
function back() {
const B = E.value.back, W = cw(), H = 300, L = 46, Rr = 12, T = 10, Bm = 34, all = B.flatMap((b) => [b.actual, b.model]), lo = Math.floor(Math.log10(Math.min(...all))), hi = Math.ceil(Math.log10(Math.max(...all))), x = (v) => L + ((Math.log10(v) - lo) / (hi - lo)) * (W - L - Rr), y = (v) => H - Bm - ((Math.log10(v) - lo) / (hi - lo)) * (H - T - Bm);
let s = '', inb = 0;
for (let e = lo + 1; e < hi; e++) { const t = 10 ** e; s += `<path d="M${x(t)} ${T}V${H - Bm}M${L} ${y(t)}H${W - Rr}" stroke="${GRID}"/>` + tx(x(t), H - Bm + 13, usd(t), { a: 'middle', s: 9 }) + tx(L - 5, y(t) + 3, usd(t), { a: 'end', s: 9 }); }
const a = 10 ** lo, b = 10 ** hi;
s += `<clipPath id="cb"><rect x="${L}" y="${T}" width="${W - L - Rr}" height="${H - T - Bm}"/></clipPath><g clip-path="url(#cb)" fill="none">${[[1, 0, INK], [3, 1, '#4a6573'], [1 / 3, 1, '#4a6573']].map((k) => `<path d="M${x(a)} ${y(a * k[0])}L${x(b)} ${y(b * k[0])}" stroke="${k[2]}"${k[1] ? ' stroke-dasharray="4 4"' : ''}/>`).join('')}</g>`;
for (const q of B) { const ok = Math.abs(Math.log(q.actual / q.model)) <= Math.log(3); if (ok) inb++; s += `<circle cx="${x(q.model).toFixed(1)}" cy="${y(q.actual).toFixed(1)}" r="3.4" fill="${ok ? '#55e6b1' : BLUE}" fill-opacity=".85" stroke="rgba(0,0,0,0)" stroke-width="10" data-tip="${esc(`${q.name}: model ${usd(q.model)}, market ${usd(q.actual)}`)}"/>`; }
s += tx((W + L) / 2, H - 4, 'model market cap, fitted without the protocol →', { a: 'middle' }) + `<text transform="translate(10 ${H / 2}) rotate(-90)" font-size="10" fill="${MUT}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace">actual market cap →</text>`;
return box('Back-test: model against market', `Each dot is a protocol whose token trades. x is what a model fitted without it predicts, y its real market cap. On the solid line the model is right; between the dashed lines it is within x3. ${inb} of ${B.length} fall inside: the tail is wide, and the largest caps are not priced by TVL at all.`, sv(W, H, 'Scatter of the leave-one-out model market cap against the actual market cap', s));
}
function evid() {
const v = E.value, o = E.odds, x2 = (n) => 'x' + n.toFixed(2), ladder = (base, rungs, h1, h2, f, set = []) => `<table><thead><tr><th>Term, added in order</th><th class="n">${h1}</th><th class="n">${h2}</th><th></th></tr></thead><tbody><tr><td>baseline</td><td class="n">${f(base.loo)}</td><td class="n">${f(base.wf)}</td><td class="mute">to beat</td></tr>${rungs.map((g) => `<tr><td>${TL[g.term]}</td><td class="n">${f(g.loo)}</td><td class="n">${f(g.wf)}</td><td>${g.kept ? '<span class="tag hi">kept</span>' : set.includes(g.term) ? '<span class="tag lo">set as a factor</span>' : '<span class="tag">not kept</span>'}</td></tr>`).join('')}</tbody></table>`;
const cols = ['#55e6b1', '#3d7cc0', '#7ab8ff', '#8aa39e', '#3a4a55', '#3a4a55', '#3a4a55', '#3a4a55'], W = cw(); let x = 0, bar = '';
E.ledger.forEach((c, i) => { const w = (c / S.protocols.length) * W; bar += `<rect x="${x.toFixed(1)}" y="2" width="${Math.max(0, w - 2).toFixed(1)}" height="14" rx="3" fill="${cols[i]}" data-tip="${esc(TX.ledger[i][0] + ': ' + c)}"/>`; x += w; });
const miss = TX.coverage.filter((c) => c.status === 'missing').length;
$('evid').innerHTML = `<div class="chk">${checks().map((c) => `<span class="${c[0] ? 'ok' : 'bad'}">${c[0] ? '✓' : '✗'} ${esc(c[1])}</span>`).join('')}</div>`
+ `<p class="note">${TX.prose.evid}</p>`
+ '<div class="cols">' + box('Value model: error on unseen tokens', `Typical (median) miss on ${v.n} protocols whose token trades; x3 means off by a factor of 3. Final model: ${v.terms.map((t) => TL[t]).join(' + ') || 'flat multiple'} with the fixed growth and age factors, typical miss ${x2(v.final.loo)} leave-one-out and ${x2(v.final.wf)} walk-forward; without the factors ${x2(v.plain.loo)} and ${x2(v.plain.wf)}; a flat median multiple ${x2(v.base.loo)} and ${x2(v.base.wf)}.`, ladder(v.base, v.rungs, 'Leave-one-out', 'Walk-forward', x2, ['growth', 'age']))
+ back() + '</div>'
+ box('Is the printed range honest?', TX.prose.honest, `<table><thead><tr><th>Stated</th><th class="n">Ten-fold</th><th class="n">Walk-forward</th></tr></thead><tbody><tr><td>inside the P25 to P75 band, stated 50%</td><td class="n">${pct(v.cov50.loo)}</td><td class="n">${pct(v.cov50.wf)}</td></tr><tr><td>inside the P10 to P90 band, stated 80%</td><td class="n">${pct(v.cov80.loo)}</td><td class="n">${pct(v.cov80.wf)}</td></tr></tbody></table>`)
+ box('Token rate: does the fit beat the plain base rate?', `Brier score (lower is better) on ${o.n} protocols, ${o.pos} of which record a token. Final model: ${o.terms.map((t) => TL[t]).join(' + ')}.`, ladder(o.base, o.rungs, 'Ten-fold', 'Walk-forward', (n) => n.toFixed(3)))
+ `<div class="cc led"><h3>Ledger: every one of the ${S.protocols.length} protocols in the snapshot, in one group</h3><p class="cq">Nothing is silently dropped.</p><svg viewBox="0 0 ${W} 18" role="img" aria-label="Stacked bar of the ledger groups">${bar}</svg><table><tbody>${E.ledger.map((c, i) => `<tr><td><i style="background:${cols[i]}"></i>${esc(TX.ledger[i][0])}<div class="mute" style="font-size:11.5px;margin-left:15px">${esc(TX.ledger[i][1])}</div></td><td class="n">${c}</td></tr>`).join('')}</tbody></table></div>`
+ box('What is assumed, and what is missing', TX.prose.assumed.replace('{share}', pct(C.share)).replace('{missing}', miss).replace('{total}', TX.coverage.length), '');
}
function live() {
$('live').innerHTML = `<caption>Largest ${X.live.length} of ${X.liveTotal} by market cap</caption><thead><tr><th>Protocol</th><th>Category</th><th class="n">TVL</th><th class="n">Market cap</th><th class="n">Cap/TVL</th></tr></thead><tbody>${X.live.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.category || '')}</td><td class="n">${usd(r.tvl)}</td><td class="n">${usd(r.mcap)}</td><td class="n">${r.x.toFixed(2)}x</td></tr>`).join('')}</tbody>`;
}
const cell = (v) => { if (v == null) return ''; if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) v = "'" + v; v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function exportCsv() {
const rows = [['rank', 'slug', 'name', 'category', 'verdict', 'implied_value_usd', 'low_usd', 'high_usd', 'token_rate', 'tvl_usd', 'change_7d', 'days_listed', 'capital_usd', 'cost_usd', 'hours_of_work', 'chance_of_profit', 'payoff_per_cost', 'expected_edge_usd', 'p5_net_usd', 'p50_net_usd', 'p95_net_usd', 'flags'].join(',')]
.concat(shown.map((r) => [r.rank, r.slug, r.name, r.category, r.verdict, r.implied, r.low, r.high, r.odds, r.tvl, r.g7, r.age, r.capital, r.cost.toFixed(2), r.hours.toFixed(1), r.e.win.toFixed(3), r.e.moic.toFixed(2), r.e.edge.toFixed(2), r.e.p5.toFixed(2), r.e.p50.toFixed(2), r.e.p95.toFixed(2), r.flags.join('; ')].map(cell).join(',')));
const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })); a.download = 'token-radar-' + X.asOf + '.csv'; document.body.appendChild(a); a.click(); a.remove();
}
function sync() { try { const h = [`p=${st.sel}`, `mt=${st.mid}`, `dt=${st.det}`, `s=${st.sk}.${+st.up}`]; if (st.v) h.push('v=' + st.v); if (st.pre) h.push('preset=' + st.pre); if ($('q').value) h.push('q=' + encodeURIComponent($('q').value)); if (st.share !== C.share) h.push('drop=' + Math.round(st.share * 100)); history.replaceState(null, '', '#' + h.join('&')); } catch (e) { } }
function tab(g, t) { st[g] = t; document.querySelectorAll(`[data-g="${g}"] [data-t]`).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === t))); document.querySelectorAll(`[data-g="${g}"][data-p]`).forEach((p) => (p.hidden = p.dataset.p !== t)); sync(); }
const app = document.querySelector('.app'), go = (m) => { app.dataset.m = m; document.querySelectorAll('#nav button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.go === m))); };
const tip = $('tip'), showTip = (el, x, y) => { tip.textContent = el.dataset.tip; tip.hidden = false; tip.style.left = Math.max(4, Math.min(innerWidth - tip.offsetWidth - 8, x + 12)) + 'px'; tip.style.top = Math.max(4, Math.min(innerHeight - tip.offsetHeight - 8, y + 14)) + 'px'; };
document.addEventListener('pointermove', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t, e.clientX, e.clientY); else tip.hidden = true; });
document.addEventListener('focusin', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) { const b = t.getBoundingClientRect(); showTip(t, b.left, b.top); } });
document.addEventListener('focusout', () => (tip.hidden = true));
function select(s) { st.sel = s; detail(); list(); if (mq.matches) go('det'); }
function refresh() { eco(); hdr(); list(); detail(); }
document.addEventListener('click', (e) => {
const t = (sel) => e.target.closest(sel);
let n;
if ((n = t('[data-evid]'))) return tab('mid', 'evidence');
if (t('[data-export]')) return exportCsv();
if ((n = t('[data-go]'))) return go(n.dataset.go);
if ((n = t('.tabs button[data-t]'))) return tab(n.parentNode.dataset.g, n.dataset.t);
if ((n = t('[data-sort]'))) { const k = n.dataset.sort; st.up = st.sk === k ? !st.up : UP.includes(k); st.sk = k; return list(); }
if ((n = t('[data-v]'))) { st.v = st.v === n.dataset.v ? '' : n.dataset.v; hdr(); return list(); }
if ((n = t('[data-p]')) && n.tagName === 'BUTTON') { st.pre = st.pre === n.dataset.p ? '' : n.dataset.p; document.querySelectorAll('#presets button').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.p === st.pre))); return list(); }
if ((n = t('[data-s]'))) select(n.dataset.s);
});
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.s) { e.preventDefault(); select(e.target.dataset.s); } });
['q', 'cat', 'chain', 'size'].forEach((i) => $(i).addEventListener('input', list));
$('ftog').addEventListener('click', () => document.querySelector('.filters').classList.toggle('fopen'));
mq.addEventListener('change', detail);
$('drop').addEventListener('input', () => { st.share = $('drop').value / 100; $('dropv').textContent = $('drop').value + '%'; refresh(); });
$('rst').addEventListener('click', () => { $('drop').value = Math.round(C.share * 100); $('drop').dispatchEvent(new Event('input')); });
const cats = [...new Set(R.map(catOf))].sort(), chs = [...new Set(R.flatMap((r) => r.chains))].sort();
$('cat').innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
$('chain').innerHTML = '<option value="">All chains</option>' + chs.map((c) => `<option>${esc(c)}</option>`).join('');
$('presets').innerHTML = PRE.map((p) => `<button data-p="${p[0]}" aria-pressed="false">${p[1]}</button>`).join('');
const h = location.hash; let m;
if ((m = h.match(/drop=(\d+)/))) { st.share = m[1] / 100; $('drop').value = m[1]; $('dropv').textContent = m[1] + '%'; }
if ((m = h.match(/v=(farm|watch|skip)/))) st.v = m[1];
if ((m = h.match(/preset=(\w+)/))) { st.pre = m[1]; document.querySelectorAll('#presets button').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.p === st.pre))); }
if ((m = h.match(/q=([^&]*)/))) $('q').value = decodeURIComponent(m[1]);
if ((m = h.match(/s=(\w+)\.([01])/)) && COL.some((c) => c[0] === m[1])) { st.sk = m[1]; st.up = m[2] === '1'; }
// A plan depends only on the engine's row, so it is written once; the economics move with the airdrop slider.
for (const r of R) { r.plan = P.farmSteps(r); r.hours = P.hours(r.plan); }
eco();
st.sel = (m = h.match(/p=([\w-]+)/)) && by(m[1]) ? m[1] : R[0].slug;
hdr(); detail(); list(); evid(); live();
if ((m = h.match(/view=(\w+)/))) go(m[1]);
if ((m = h.match(/dt=(\w+)/))) tab('det', m[1]);
if ((m = h.match(/mt=(\w+)/))) tab('mid', m[1]);
})();
