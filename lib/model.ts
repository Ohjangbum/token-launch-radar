// The token radar's model, radar-2: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other rankable pre-token protocol in the snapshot: 246 rows in all on this snapshot. A protocol is
// pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed
// into the ranked board.
//
// Implied value follows only from the snapshot's own figures — TVL, seven-day growth, age with no
// token, chain count and category. No protocol name is ever special-cased: the same function scores
// every row, and the penalty below is a rule over category and name shape, not a list of names.
//
//   sizeTerm   = (tvl_usd / 1_000_000) ^ SIZE_EXPONENT        (log-scale size: a 10x bigger TVL is
//                                                               worth ~7x more, not 10x — launches
//                                                               do not scale linearly with deposits)
//   base       = BASE_SCALE x sizeTerm
//   growth     = clamp(change_7d, -50, 100) per cent           (an extreme 7-day print, up or down,
//                                                               is capped: one week is not a trend)
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity   = age curve: <90d rises 0.75 -> 0.90, 90-365d rises 0.90 -> 1.00,
//                365-1095d rises 1.00 -> 1.15, beyond 1095d flat 1.15; unknown age 0.85
//                (a protocol that has run for years with no token has survived; a brand-new one
//                has not yet had to)
//   divers     = chains: 1 -> 0.95, 2 -> 1.00, 3-4 -> 1.03, 5+ -> 1.06
//                (a protocol live on more chains reaches more farmers)
//   penalty    = 0.5 when the protocol looks like a product of a token that already trades:
//                category Bridge / Canonical Bridge / Liquid Staking / Liquid Restaking /
//                Restaked BTC / CEX, or a name carrying a whole word wrapped / staked / staking,
//                or a name beginning with an exchange's name; otherwise 1.0
//   implied    = max(1, round(base x growthMult x maturity x divers x penalty))
//
// A flagged protocol at or above the watchlist floor is not ranked at all: at that size it is
// plainly the trading token's product (WBTC is Bitcoin on Ethereum, Binance staked ETH is ETH in
// a staking product), so it is set aside with its reason instead of ranked as a launch. Below
// the floor a flagged protocol may still rank, halved by the penalty, as an early find — the
// starter ranked below-floor rows the same way. Exchanges and versioned pools never rank.
//
// The constants are the model's, stated in the dashboard and changeable in the model sandbox.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_scale: number;
  size_exponent: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  unknown_age_multiplier: number;
  young_days: number;
  young_floor: number;
  young_top: number;
  mid_days: number;
  mid_top: number;
  mature_days: number;
  mature_top: number;
  product_penalty: number;
}

export const MODEL: ModelConstants = {
  base_scale: 600_000,
  size_exponent: 0.85,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  unknown_age_multiplier: 0.85,
  young_days: 90,
  young_floor: 0.75,
  young_top: 0.9,
  mid_days: 365,
  mid_top: 1.0,
  mature_days: 1095,
  mature_top: 1.15,
  product_penalty: 0.5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    size_term: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    diversification_multiplier: number;
    penalty_multiplier: number;
    penalty_reason: string | null;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  watchlist: boolean;
  size_term: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  diversification_multiplier: number;
  penalty_multiplier: number;
  penalty_reason: string | null;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** A pre-token protocol set aside from the ranked board, with the reason it was not ranked. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  reason: string;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  set_aside_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  set_aside: SetAsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The maturity multiplier for an age in days, or null age: the age curve, in one place. */
export function maturityMultiplier(age: number | null, model: ModelConstants): number {
  if (age === null) return model.unknown_age_multiplier;
  if (age < model.young_days) return model.young_floor + (age / model.young_days) * (model.young_top - model.young_floor);
  if (age < model.mid_days) return model.young_top + ((age - model.young_days) / (model.mid_days - model.young_days)) * (model.mid_top - model.young_top);
  if (age < model.mature_days) return model.mid_top + ((age - model.mid_days) / (model.mature_days - model.mid_days)) * (model.mature_top - model.mid_top);
  return model.mature_top;
}

/** The diversification multiplier for a chain count. */
export function diversificationMultiplier(chainCount: number): number {
  if (chainCount <= 1) return 0.95;
  if (chainCount === 2) return 1.0;
  if (chainCount <= 4) return 1.03;
  return 1.06;
}

/** Categories that read as a product of a token that already trades. */
const PRODUCT_CATEGORIES = new Set(['bridge', 'canonical bridge', 'liquid staking', 'liquid restaking', 'restaked btc', 'cex']);

/** A whole word wrapped, staked or staking in a name. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchange names a protocol name may begin with. */
const EXCHANGES = ['binance', 'coinbase', 'bybit', 'kraken', 'bitget', 'okx', 'bitfinex', 'gemini'];

/**
 * Why a protocol carries the product penalty, or null: a rule over its category and the shape of
 * its name, never a list of names. A protocol that is itself a wrapped, staked or bridged product
 * of a token that already trades is not a fresh launch, so its implied value is halved.
 */
export function penaltyReason(p: SnapshotProtocol): string | null {
  const category = (p.category ?? '').toLowerCase();
  if (PRODUCT_CATEGORIES.has(category)) return `category ${p.category} reads as a product of a token that already trades`;
  if (WRAPPED_WORD.test(p.name)) return 'name carries a whole word wrapped, staked or staking';
  const lower = p.name.toLowerCase();
  for (const ex of EXCHANGES) {
    if (lower === ex || lower.startsWith(`${ex} `)) return `name begins with the exchange name ${p.name.split(' ')[0]}`;
  }
  return null;
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): {
  implied: number;
  sizeTerm: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  diversMult: number;
  penaltyMult: number;
  penaltyReason: string | null;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const maturityMult = maturityMultiplier(age, model);
  const diversMult = diversificationMultiplier(protocol.chains.length);
  const reason = penaltyReason(protocol);
  const penaltyMult = reason === null ? 1 : model.product_penalty;
  const sizeTerm = Math.pow(Math.max(protocol.tvl_usd, 1) / 1_000_000, model.size_exponent);
  const implied = Math.max(1, Math.round(model.base_scale * sizeTerm * growthMult * maturityMult * diversMult * penaltyMult));
  return { implied, sizeTerm, growthPct, growthMult, maturityMult, diversMult, penaltyMult, penaltyReason: reason, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool,
 * and not a flagged product of a trading token at or above the floor (see the header: those are set
 * aside instead). Below the floor a flagged protocol may rank, halved by the penalty. */
export function isRankable(p: SnapshotProtocol, floorUsd: number): boolean {
  if (!isPreToken(p) || p.category === 'CEX' || VERSIONED.test(p.name)) return false;
  const reason = penaltyReason(p);
  return reason === null || p.tvl_usd < floorUsd;
}

/** Why a pre-token protocol was set aside from the ranked board, or null when it ranks. */
export function setAsideReason(p: SnapshotProtocol, floorUsd: number): string | null {
  if (!isPreToken(p)) return null;
  if (p.category === 'CEX') return 'an exchange: its token would be an exchange token, not a protocol launch';
  if (VERSIONED.test(p.name)) return 'a versioned pool of another protocol';
  const reason = penaltyReason(p);
  if (reason !== null && p.tvl_usd >= floorUsd) return `${reason}, at $${p.tvl_usd.toLocaleString('en-US')} of TVL`;
  return null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol in the snapshot, watchlist or not,
  // above or below the floor. Never a replacement for a watchlist row: a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p, snapshot.floor_usd)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      size_term: round4(s.v.sizeTerm),
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      diversification_multiplier: round4(s.v.diversMult),
      penalty_multiplier: round4(s.v.penaltyMult),
      penalty_reason: s.v.penaltyReason,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The second chain a protocol names, or null. */
function secondChainOf(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names, and it never claims a points programme the snapshot does not record: the snapshot carries
 * no airdrop flag, so step 6 tells the reader to check the protocol's own published links and to
 * treat any other site promising a claim as a scam until the protocol says otherwise.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const secondStep =
    second !== null
      ? {
          text: `Use ${p.name} on ${second} as well, with $${Math.max(25, Math.floor(capital / 2))} of the same position, so the wallet shows activity on two of its ${p.chains.length} chains.`,
          cost: `$${Math.max(25, Math.floor(capital / 2))} of capital and about $4 of gas`,
          time: '15 minutes to set up',
        }
      : {
          text: `Make a second, different action inside ${p.name} on ${chain}, such as a swap or a deposit of another asset, so the wallet shows more than one interaction type.`,
          cost: 'about $2 of gas',
          time: '10 minutes',
        };
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    secondStep,
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page from a link the protocol itself publishes, and claim only there. This snapshot records no points programme for ${p.name}, so treat any other site promising one as a scam until the protocol says otherwise.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates, the chains and every transaction hash in a farm log, and plan the unwind in two steps so you are never forced to exit in one trade.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The pre-token protocols set aside from the ranked board, biggest TVL first, each with its reason. */
export function setAsideRows(snapshot: Snapshot): SetAsideRow[] {
  return snapshot.protocols
    .map((p) => ({ p, reason: setAsideReason(p, snapshot.floor_usd) }))
    .filter((x): x is { p: SnapshotProtocol; reason: string } => x.reason !== null)
    .sort((a, b) => b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0))
    .map(({ p, reason }) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      reason,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    watchlist: watchlist.has(row.slug),
    size_term: row.model.size_term,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    diversification_multiplier: row.model.diversification_multiplier,
    penalty_multiplier: row.model.penalty_multiplier,
    penalty_reason: row.model.penalty_reason,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const setAside = setAsideRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    set_aside_size: setAside.length,
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
    set_aside: setAside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
