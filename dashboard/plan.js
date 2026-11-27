// The farm plan: six steps a protocol, each with an action, a fee and a time. Run by the page and by main.ts,
// from the deposit, chain fee and holding period model.js sets, so the words and the totals cannot disagree.
(function (g) {
 'use strict';
 const usd = (n) => (n < 10 ? '$' + n.toFixed(2) : '$' + Math.round(n).toLocaleString('en-US'));
 // One entry per kind of activity, first match on the category wins: [words in the category, deposit step
 // ($c deposit, $n protocol, $h chain), weekly action, care to take, minutes to set up]
 const KINDS = [
  [/lending|borrow/, 'Supply $c of a major stablecoin to $n on $h and switch it on as collateral.', 'borrow a small amount against the deposit and repay it, so both sides of the market are on record', 'Keep the loan-to-value under 40% so a price move cannot liquidate you.', 20],
  [/cdp|stablecoin|algo/, 'Lock $c of collateral in $n on $h and mint a small amount of its stable asset.', 'adjust the collateral a little and use the minted asset in a pool the protocol lists', 'Stay far above the minimum collateral ratio and check the stable asset still trades near one dollar.', 25],
  [/\bdex|amm|liquidity/, 'Add $c to a pool on $n on $h, a stable pair if it has one. If it takes no public deposits, swap $c through it instead.', 'make one swap through the protocol and collect any fees', 'Check which pool earns rewards: a volatile pair can lose value while you wait.', 25],
  [/derivative|perp|option/, 'Deposit $c of stablecoin as margin on $n on $h.', 'open and close one small hedged position, booking volume with little price risk', 'Keep long and short equal, each a tenth of the margin, so net exposure is flat.', 30],
  [/rwa|treasur|real world/, 'Buy $c of the tokenised yield asset $n offers on $h, after any identity check it asks for.', 'hold through the weekly distribution and top the balance up by a small amount', 'Check that you are eligible and meet the minimum, and read the redemption terms: some serve institutions only.', 40],
  [/prediction/, 'Fund a $n account on $h with $c of stablecoin.', 'take one small position in a liquid market and let it settle', 'Pick the tightest spreads: they cost the least in expected loss.', 20],
  [/curator|allocator|vault|yield|farm|aggregator|optimizer|index|basis/, 'Deposit $c of stablecoin into the largest $n vault on $h and keep the receipt token.', 'check the vault, compound the earnings or move a small share to a second vault', 'Prefer the vault with the highest deposits and read what it lends or farms into.', 20],
  [/bridge|cross/, 'Bridge $c of stablecoin to $h through $n and use it in one app there.', 'bridge a small amount back and forth once, so both directions are on record', 'Send a few dollars as a test first: a stalled bridge refunds slowly.', 25],
  [/staking|restak|liquid|collateral|btc/, 'Deposit $c of the asset $n accepts on $h and keep the receipt token.', 'claim or re-deposit the rewards, or use the receipt token in one partner app', 'Check the withdrawal delay first, so you can leave when you choose.', 20],
  [/chain|payment/, 'Move $c into $n by the route its own documentation gives.', 'send one small payment or use one app on it', 'Use only software the project publishes, and test with a few dollars.', 30],
  [/insurance|cover/, 'Put $c into $n on $h: join its cover pool, or buy cover you need (a premium is spent, not returned).', 'check the position or vote on an open claim', 'Read what a claim can take from the pool, or what a policy pays, before you join.', 25],
  [/^/, 'Deposit $c into $n on $h and use its main feature once.', 'make one more deposit, withdrawal or swap in its app', 'Follow the flow its own documentation describes.', 25],
 ];
 // r: one row of model.js, or the same fields. `fee` is dollars spent (carry is yield forgone); `min` is hands-on time.
 function farmSteps(r) {
  const [, deposit, weekly, care, setup] = KINDS.find((k) => k[0].test((r.category || '').toLowerCase()));
  const move = r.tx * 2, fill = { c: usd(r.capital), n: r.name, h: r.chain };
  const step = (text, fee, why, min, time) => ({ text, fee, cost: fee ? usd(fee) + ' ' + why : why, min, time: time || min + ' min' });
  // The check comes first: nothing is sent before it. A protocol on several chains is farmed on the cheapest.
  const check = r.chains && r.chains.length > 1 ? ` Confirm it runs on ${r.chain}, picked as its cheapest chain.` : '';
  return [
   step(care + check, 0, 'no fee', 5),
   step(`Make a wallet for this protocol alone, send it ${fill.c} plus gas on ${r.chain}, and keep the seed phrase offline.`, move, 'transfer; the deposit comes back', 10),
   step(deposit.replace(/\$([cnh])/g, (m, k) => fill[k]), r.tx * 4, 'gas to approve and deposit', setup),
   step(`Every week for ${r.weeks} weeks, ${weekly}.`, move * r.weeks, `gas, ${usd(move)} a week`, 10 * r.weeks, '10 min a week'),
   step(`Keep the deposit in for ${r.hold} days in all, weekly actions included. Do not withdraw if a token is announced.`, r.carry, `if ${fill.c} earns nothing (4% a year)`, 0, r.hold + ' days'),
   step('Claim only from a link the protocol publishes, then withdraw and log every date and transaction.', move, 'exit gas; claiming is free', 30),
  ];
 }
 // The one string board.json carries for a step.
 const stepText = (s) => { const t = `${s.text} Cost: ${s.cost}. Time: ${s.time}.`; return t.length > 600 ? t.slice(0, 596) + '...' : t; };
 const hours = (steps) => steps.reduce((a, s) => a + s.min, 0) / 60;
 g.RadarPlan = { farmSteps, stepText, hours };
})(typeof window !== 'undefined' ? window : globalThis);
