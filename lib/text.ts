// The page's static text: the coverage of the inputs, what to check before committing money, the ledger's group
// names and the explanations. The farm plan's steps are code and live in dashboard/plan.js.

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
  { key: 'odds', label: 'Fitted token rate', status: 'derived', note: 'A fit of which protocols record a token today: not a forecast, and it names no date' },
  { key: 'implied_value', label: 'Implied token value', status: 'derived', note: 'TVL times the fitted multiple and the two factors: the value if the record stays as it is, with a low and a high' },
  { key: 'factors', label: 'Growth and age factors', status: 'assumed', note: 'Seven-day growth moves the value by up to 15%, days listed with no token by up to 10%' },
  { key: 'payoff', label: 'Payoff draws', status: 'derived', note: '400 draws a protocol from both models\' own errors; the expectation is cut at the 95th percentile' },
  { key: 'airdrop_share', label: 'Airdrop share of value', status: 'assumed', note: '8% of implied value, split pro rata by TVL: an illustration of scale' },
  { key: 'market', label: 'Shared market factor', status: 'assumed', note: '30% of the value error is one market-wide factor, shared by every protocol\'s draws' },
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
  ['Ranked: early, off the watchlist', 'pre-token protocols the radar adds, of any size'],
  ['Token trades: priced comp', 'the protocols the value model learns from'],
  ['Token recorded: not a priced comp', 'no usable market cap, or a wrapped or versioned product of a parent token'],
  ['Out: exchange', 'a CEX is not a protocol'],
  ['Out: kin of a token that trades', 'no token recorded, but its first name is that of one that has a token'],
  ['Out: bridge, staking, wrapped or versioned', 'a product of a token that trades'],
  ['Out: beyond the row cap', 'pre-token, eligible, not shown'],
];

/** Static explanations the page shows; every number beside them is computed in the page. */
export const PROSE = {
  evid: '<b style="color:var(--text)">implied value = TVL × fitted multiple × growth factor × age factor.</b> It is what the token would be worth if the protocol\'s record stayed as it is; no launch is predicted. Both models are fitted in this browser by model.js. A fitted term stays only if it lowers the held-out error in two different tests. The fitted token rate beside each value is how likely a protocol with these figures is to record a token today: it prices the farm, never the value.',
  honest: 'The low and high on every row are the 25th and 75th percentile of the value model\'s errors. A band stated as 50% should catch about half of the held-out tokens.',
  assumed: 'The growth and age factors, the airdrop share ({share} of token value, split by TVL), the fee and deposit per step, and a 30% market-wide share of the value error are assumptions; the slider above the board moves the share. {missing} of {total} inputs a radar normally weighs are not in the snapshot: revenue, volume, users, a points programme, funding, audits and TVL history. Risk flags are rules on the snapshot\'s figures, not an audit.',
  odds: 'Not a forecast: win and payoff assume a token arrives at this rate and counts this deposit, and the snapshot cannot say when. It does not change the implied value.',
  plan: 'Fees cover gas and the cost of idle capital. They leave out trading fees, borrow interest and bridging funds in. Win assumes a token arrives and counts this deposit.',
  data: 'A screen narrows a list; it does not clear a protocol. Every item above is something this snapshot cannot tell you.',
};
