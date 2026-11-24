// What a reader is told to do: the farm plan's steps in words, the coverage of the inputs, and what to check
// before committing money. The numbers in a plan (deposit, gas, hold) come from dashboard/model.js, so the
// words and the economics on the page can never disagree.

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The figures dashboard/model.js sets for one protocol's plan. */
export interface PlanInput {
  name: string;
  category: string | null;
  chain: string;
  tx: number;
  capital: number;
  hold: number;
  weeks: number;
  carry: number;
}

/** The kind of activity a category rewards, in the words one step uses. */
interface Kind {
  deposit: (capital: string, name: string, chain: string) => string;
  weekly: string;
  extra: string;
  setupMinutes: number;
}

function kindFor(category: string | null): Kind {
  const c = (category ?? '').toLowerCase();
  const has = (...words: string[]): boolean => words.some((w) => c.includes(w));
  if (has('lending', 'borrow')) {
    return {
      deposit: (cap, name, chain) => `Supply ${cap} of a major stablecoin to ${name} on ${chain} and switch the deposit on as collateral.`,
      weekly: 'borrow a small amount against the deposit, then repay it, so the account shows both sides of the market',
      extra: 'Keep the loan-to-value under 40% so a price move cannot liquidate the position.',
      setupMinutes: 20,
    };
  }
  if (has('cdp', 'stablecoin', 'algo')) {
    return {
      deposit: (cap, name, chain) => `Lock ${cap} of collateral in ${name} on ${chain} and mint a small amount of its stable asset against it.`,
      weekly: 'add or remove a little collateral and use the minted stable asset in the protocol or a pool that it lists',
      extra: 'Stay far above the minimum collateral ratio and check the stable asset still trades near one dollar.',
      setupMinutes: 25,
    };
  }
  if (has('dex', 'amm', 'liquidity')) {
    return {
      deposit: (cap, name, chain) => `Add ${cap} of liquidity to the deepest stable pool on ${name} on ${chain}, half stablecoin and half the paired asset.`,
      weekly: 'make one swap through the protocol and collect any fees, so volume and liquidity are both on record',
      extra: 'Choose a pool of two stable assets to keep impermanent loss near zero while the points count.',
      setupMinutes: 25,
    };
  }
  if (has('derivative', 'perp', 'option')) {
    return {
      deposit: (cap, name, chain) => `Deposit ${cap} of stablecoin as margin on ${name} on ${chain}.`,
      weekly: 'open and close one small hedged position, so the account books trading volume with little price risk',
      extra: 'Open the long and the short on the same venue at one tenth of your margin so the net exposure is flat.',
      setupMinutes: 30,
    };
  }
  if (has('rwa', 'treasur', 'real world')) {
    return {
      deposit: (cap, name, chain) => `Buy ${cap} of the tokenised yield asset ${name} offers on ${chain}; complete its identity check first if it asks for one.`,
      weekly: 'hold the position through the weekly distribution and add a small top-up so the balance is not static',
      extra: 'Read the redemption terms before you buy: some tokenised assets lock funds for days.',
      setupMinutes: 40,
    };
  }
  if (has('prediction')) {
    return {
      deposit: (cap, name, chain) => `Fund your ${name} account on ${chain} with ${cap} of stablecoin.`,
      weekly: 'place one small position in a liquid market and settle it, so the account shows both volume and resolved trades',
      extra: 'Pick the markets with the tightest spreads; a position near fifty-fifty costs the least in expected loss.',
      setupMinutes: 20,
    };
  }
  if (has('curator', 'allocator', 'vault', 'yield', 'farm', 'aggregator', 'optimizer', 'index')) {
    return {
      deposit: (cap, name, chain) => `Deposit ${cap} of stablecoin into the largest ${name} vault on ${chain} and keep the receipt token.`,
      weekly: 'check the vault, compound the earnings or move a small share to a second vault of the same protocol',
      extra: 'Prefer the vault with the highest deposits: protocols tend to count the deepest pools first.',
      setupMinutes: 20,
    };
  }
  if (has('bridge', 'cross')) {
    return {
      deposit: (cap, name, chain) => `Bridge ${cap} of stablecoin to ${chain} through ${name}, then use the funds in an app on that chain.`,
      weekly: 'bridge a small amount back and forth once, so the account shows traffic in both directions',
      extra: 'Send a test transfer of a few dollars first; a bridge that stalls is slow to refund.',
      setupMinutes: 25,
    };
  }
  if (has('staking', 'restak', 'liquid')) {
    return {
      deposit: (cap, name, chain) => `Stake ${cap} of the supported asset through ${name} on ${chain} and keep the receipt.`,
      weekly: 'restake the rewards or use the receipt token in one partner app the protocol lists',
      extra: 'Check the unstaking delay before you stake so the position can be closed when you choose.',
      setupMinutes: 20,
    };
  }
  if (has('insurance', 'cover')) {
    return {
      deposit: (cap, name, chain) => `Buy ${cap} of cover through ${name} on ${chain} for a protocol you already use.`,
      weekly: 'renew or extend the cover and vote on any open claim that the protocol lists',
      extra: 'Buy cover only for something you hold; a policy for an asset you do not use has no value to you.',
      setupMinutes: 25,
    };
  }
  return {
    deposit: (cap, name, chain) => `Deposit ${cap} of stablecoin into ${name} on ${chain} and use its main feature once.`,
    weekly: 'make one more deposit, withdrawal or swap in its app so the account shows steady use',
    extra: 'Use the protocol the way its own page describes; usage that follows the intended flow is the one most likely to count.',
    setupMinutes: 25,
  };
}

const usd = (n: number): string => (n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString('en-US')}`);

/** A step's text with its cost and time, as the one string board.json carries. */
export function stepText(step: FarmStep): string {
  const s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  return s.length > 600 ? `${s.slice(0, 596)}...` : s;
}

/** The six steps of a plan for one protocol: each an action with a cost and a time. */
export function farmSteps(p: PlanInput): FarmStep[] {
  const kind = kindFor(p.category);
  const setupGas = p.tx * 4;
  const weeklyGas = p.tx * 2;
  const exitGas = p.tx * 2;
  return [
    {
      text: `Open a new wallet used for this protocol alone, fund it with ${usd(p.capital)} of stablecoin plus gas on ${p.chain}, and keep its seed phrase offline.`,
      cost: `${usd(p.capital)} of capital plus about ${usd(p.tx * 2)} to move funds`,
      time: '10 minutes',
    },
    {
      text: kind.deposit(usd(p.capital), p.name, p.chain),
      cost: `${usd(setupGas)} of gas for the approval and the deposit`,
      time: `${kind.setupMinutes} minutes`,
    },
    {
      text: `Every week for ${p.weeks} weeks, ${kind.weekly}.`,
      cost: `${usd(weeklyGas)} of gas a week, ${usd(weeklyGas * p.weeks)} in all`,
      time: '10 minutes a week',
    },
    {
      text: kind.extra,
      cost: 'no fee, only attention',
      time: 'once, while you set up',
    },
    {
      text: `Hold the position for ${p.hold} days so it is counted in more than one snapshot, and do not withdraw the week the protocol announces a token.`,
      cost: `about ${usd(p.carry)} of foregone yield on ${usd(p.capital)} over ${p.hold} days`,
      time: `${p.hold} days`,
    },
    {
      text: `Claim only from the link the protocol itself publishes, never from a message or a search result, then withdraw and write the dates and transactions in a log.`,
      cost: `${usd(exitGas)} of gas to exit; claiming should cost nothing`,
      time: '30 minutes',
    },
  ];
}

/** One input a token radar normally weighs, and how this board came by it. */
export interface CoverageItem {
  key: string;
  label: string;
  status: 'observed' | 'derived' | 'assumed' | 'missing';
  note: string;
}

/** What the sealed snapshot gives, what the model works out from it, what it assumes, and what it cannot know. */
export const COVERAGE: CoverageItem[] = [
  { key: 'tvl_usd', label: 'TVL', status: 'observed', note: 'In the snapshot, whole dollars' },
  { key: 'change_7d', label: 'Seven-day TVL change', status: 'observed', note: 'In the snapshot; DefiLlama leaves it out for some protocols' },
  { key: 'listed_at', label: 'Listing date', status: 'observed', note: 'The day DefiLlama began tracking it, not the day it launched' },
  { key: 'category', label: 'Category and chains', status: 'observed', note: 'DefiLlama\'s own labels' },
  { key: 'fit', label: 'Fitted multiple', status: 'derived', note: 'Market cap to TVL of live-token protocols, fitted on this snapshot and tested held-out' },
  { key: 'odds', label: 'Peers\' token-record rate', status: 'derived', note: 'How often protocols like it record a token: a base rate, not a forecast' },
  { key: 'implied_value', label: 'Implied token value', status: 'derived', note: 'Value if it launches times the record rate, with a low and a high' },
  { key: 'payoff', label: 'Payoff draws', status: 'derived', note: '400 draws a protocol from both models\' own errors; the expectation is cut at the 95th percentile' },
  { key: 'airdrop_share', label: 'Airdrop share of value', status: 'assumed', note: '8% of implied value, split pro rata by TVL: an illustration of scale' },
  { key: 'market', label: 'Shared market factor', status: 'assumed', note: '30% of the value error is one market-wide factor, so a basket\'s outcomes move together' },
  { key: 'gas', label: 'Gas and capital per step', status: 'assumed', note: 'Typical cost by chain and a deposit size set by pool size' },
  { key: 'revenue', label: 'Fees and revenue', status: 'missing', note: 'Not in the snapshot: the best test of whether a token has cash flow behind it' },
  { key: 'volume', label: 'Trading volume and users', status: 'missing', note: 'Not in the snapshot: shows whether TVL is used or only parked' },
  { key: 'points', label: 'Points or rewards programme', status: 'missing', note: 'Not in the snapshot: the strongest sign a token is planned' },
  { key: 'funding', label: 'Funding and backers', status: 'missing', note: 'Not in the snapshot: sets how much of a token insiders may hold' },
  { key: 'audit', label: 'Audits and admin keys', status: 'missing', note: 'Not in the snapshot: the contract risk is not measured here' },
  { key: 'history', label: 'TVL history beyond seven days', status: 'missing', note: 'Not in the snapshot: one week cannot show a trend' },
];

/** What to check before putting money in, by family: the question, and where the answer is found. No links: the page names no address. */
export const DILIGENCE: Record<string, string[]> = {
  lending: [
    'Bad debt and liquidations: read the protocol\'s risk page or its governance forum for any past shortfall.',
    'Interest paid against interest earned: a public DeFi analytics site shows fees and revenue for the protocol.',
    'Which markets you would supply, and which oracle prices them: the protocol\'s docs name both.',
    'Whether deposits earn points or only interest: the protocol\'s rewards page and announcements say.',
    'Audit reports and their dates: the docs\' security section lists them.',
  ],
  stable: [
    'What backs the stable asset and how far it can fall below one dollar: the docs and a price chart show both.',
    'The liquidation ratio and the share of collateral that is volatile: the protocol\'s risk page.',
    'Whether minting or holding earns points: the rewards page and official announcements.',
    'Audit reports, admin keys and any redemption limit: the security section of the docs.',
  ],
  dex: [
    'Volume against TVL: a pool with deep liquidity and little trading earns little in fees.',
    'Which pools earn points or boosted rewards, and the size of the pool you would join.',
    'Impermanent loss on the pair you would hold: stable pairs keep it near zero.',
    'Audit reports and who can upgrade the contracts: the docs and the explorer show both.',
  ],
  derivatives: [
    'Open interest and fees: a public analytics site shows whether traders actually use the venue.',
    'How the venue handles a liquidation cascade or a funding spike: past incidents are in its forum.',
    'Whether trading volume or deposits earn points: the rewards page and official announcements.',
    'Withdrawal limits and who controls the oracle: the docs and the contract admin on the explorer.',
  ],
  rwa: [
    'Who issues the asset and who holds the collateral: the docs name the issuer and custodian.',
    'Whether you need to pass an identity check, and in which countries it is offered.',
    'The redemption terms and any lock: how many days until a withdrawal is paid.',
    'Whether holding earns points on top of the yield: the rewards page and announcements.',
  ],
  vault: [
    'Where the vault lends or farms: each vault page lists its markets and the risk of each.',
    'Who curates it and what fee they take: the vault page and the curator\'s own site.',
    'Whether deposits earn points, and whether a larger vault is counted first.',
    'Audit reports for the vault and for every protocol it uses, and the withdrawal queue.',
  ],
  bridge: [
    'Who holds the funds on each side and how a transfer is verified: the docs explain the design.',
    'The record of past exploits for this bridge or the one it is built on.',
    'Whether bridging earns points, and whether both directions are counted.',
  ],
  prediction: [
    'How a market is resolved and who can overrule it: the docs and past disputes show how.',
    'Volume and open interest in the markets you would trade: thin markets cost more to leave.',
    'Whether trading earns points or a rebate: the rewards page.',
  ],
  other: [
    'Does it have a token or a points programme already? Read the protocol\'s docs and its latest announcements.',
    'Fees and revenue: a public DeFi analytics site shows whether the protocol earns money.',
    'Audit reports, admin keys and any past incident: the docs\' security section and the contract explorer.',
    'Who funds and runs it: the team\'s page and any funding news.',
  ],
};


/** The ledger's groups, in the order dashboard/model.js counts them: a label and why the group exists. */
export const LEDGER: [string, string][] = [
  ['Ranked: on the watchlist', 'the floor: every one is on the board'],
  ['Ranked: early, below the floor', 'pre-token protocols the radar adds'],
  ['Token trades: priced comp', 'the protocols the value model learns from'],
  ['Token recorded: not a priced comp', 'no usable market cap, or a wrapped or versioned product of a parent token'],
  ['Out: exchange', 'a CEX is not a protocol'],
  ['Out: set aside by the house rule', 'above the floor but off the watchlist'],
  ['Out: bridge, staking, wrapped or versioned', 'a product of a token that trades'],
  ['Out: beyond the row cap', 'pre-token, eligible, not shown'],
];

/** Static explanations the page shows; every number beside them is computed in the page. */
export const PROSE = {
  evid: '<b style="color:var(--text)">implied value = TVL × fitted multiple × token odds.</b> Both models are fitted in this browser by model.js. A term stays only if it lowers the held-out error in two different tests, so a term that merely fits the sample is dropped. The odds are how often similar protocols record a token: a base rate, never a forecast that a token will launch.',
  honest: 'The low and high on every row are the 25th and 75th percentile of the value model\'s errors. A band stated as 50% should catch about half of the held-out tokens.',
  assumed: 'The airdrop share ({share} of token value, split by TVL), the gas and deposit per step, and a 30% market-wide share of the value error are assumptions; the sliders above move the first. {missing} of {total} inputs a radar normally weighs are not in the snapshot: revenue, volume, users, a points programme, funding, audits and TVL history. Risk flags are rules on the snapshot\'s figures, not an audit.',
  basket: 'A fund thinks in baskets: the best edges, at most two a family, each at plan size times a multiple. Outcomes are summed draw by draw and 30% of the value error is one market factor, so the picks rise and fall together.',
  odds: 'The model adjusts for size, family, 7-day growth and years listed. A base rate, not a forecast.',
  data: 'A screen narrows a list; it does not clear a protocol. Every item above is something this snapshot cannot tell you.',
  map: 'Every protocol. Right is more likely to pay, up pays more per dollar of cost (the expectation is cut at the 95th percentile). The green box is where a farm clears both bars.',
};
