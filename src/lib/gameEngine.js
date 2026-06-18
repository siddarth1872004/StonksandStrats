// Phase 3 game engine — house rules, speed die, quick mode, AI bots

import { TILES, GROUPS } from '../boardData';

// ── Constants ─────────────────────────────────────────────────────────────────
const STARTING_MONEY = 1500;
const GO_BONUS = 200;
const HOUSE_SUPPLY = 32;
const HOTEL_SUPPLY = 12;
const RAILROAD_IDS = [5, 15, 25, 35];
const UTILITY_IDS = [12, 28];
const RAILROAD_RENT = [25, 50, 100, 200];

// ── Default house rules ───────────────────────────────────────────────────────
export const DEFAULT_HOUSE_RULES = {
  free_parking_jackpot:  false,  // taxes/fines accumulate on Free Parking; landing player collects
  no_rent_in_jail:       false,  // landlord cannot collect rent while in jail
  skip_auction:          false,  // declined buy returns property to bank (no auction)
  double_go_salary:      false,  // landing exactly on GO earns $400 instead of $200
  go_salary:             200,    // GO bonus amount
  starting_cash:         1500,   // starting money
  income_tax_choice:     false,  // income tax = player chooses $200 flat or 10% net worth
  luxury_tax:            75,     // luxury tax tile amount (tile 38)
  unlimited_buildings:   false,  // ignore house/hotel supply limits
  auction_minimum:       1,      // minimum bid at auction
  jail_fine:             50,     // fine to pay out of jail
  bank_errors_favored:   false,  // bank error Community Chest card gives $400 not $200
  turn_timer_enabled:    false,  // host auto-resolves a player's turn after a countdown
  turn_timer_seconds:    60,     // seconds allowed per turn before auto-action
};

// ── Card Decks ────────────────────────────────────────────────────────────────
const CHANCE_CARDS = [
  { text: "Advance to GO. Collect $200.", action: "advance_to", value: 0 },
  { text: "Advance to Trafalgar Square. If you pass GO, collect $200.", action: "advance_to", value: 24 },
  { text: "Advance to Pall Mall. If you pass GO, collect $200.", action: "advance_to", value: 11 },
  { text: "Advance to the nearest Utility. If owned, throw dice and pay 10x. If unowned, you may buy it.", action: "advance_to_nearest_utility" },
  { text: "Advance to the nearest Railroad. If owned, pay twice the rent. If unowned, you may buy it.", action: "advance_to_nearest_railroad" },
  { text: "Advance to the nearest Railroad. If owned, pay twice the rent. If unowned, you may buy it.", action: "advance_to_nearest_railroad" },
  { text: "Your bank stock pays dividends. Collect $50.", action: "collect", value: 50 },
  { text: "Get Out of Jail Free! Keep this card until needed.", action: "get_out_of_jail_free" },
  { text: "Go Back 3 Spaces.", action: "go_back", value: 3 },
  { text: "Go directly to Jail. Do not pass GO, do not collect $200.", action: "go_to_jail" },
  { text: "Make general repairs on all your properties. Pay $25 per house, $100 per hotel.", action: "pay_per_house", value: [25, 100] },
  { text: "Speeding fine. Pay $15.", action: "pay", value: 15 },
  { text: "Take a trip to King's Cross Station. If you pass GO, collect $200.", action: "advance_to", value: 5 },
  { text: "Take a walk down Mayfair. Advance directly there.", action: "advance_to", value: 39 },
  { text: "You have been elected Chairman of the Board. Pay each player $50.", action: "pay_each_player", value: 50 },
  { text: "Your building loan matures. Collect $150.", action: "collect", value: 150 },
];

const COMMUNITY_CHEST_CARDS = [
  { text: "Advance to GO. Collect $200.", action: "advance_to", value: 0 },
  { text: "Bank error in your favor. Collect $200.", action: "collect", value: 200, id: "bank_error" },
  { text: "Doctor's fees. Pay $50.", action: "pay", value: 50 },
  { text: "From sale of stock, you get $50.", action: "collect", value: 50 },
  { text: "Get Out of Jail Free! Keep this card until needed.", action: "get_out_of_jail_free" },
  { text: "Go directly to Jail. Do not pass GO, do not collect $200.", action: "go_to_jail" },
  { text: "Holiday fund matures. Receive $100.", action: "collect", value: 100 },
  { text: "Income tax refund. Collect $20.", action: "collect", value: 20 },
  { text: "It is your birthday! Collect $10 from every player.", action: "collect_from_each_player", value: 10 },
  { text: "Life insurance matures. Collect $100.", action: "collect", value: 100 },
  { text: "Pay hospital fees of $100.", action: "pay", value: 100 },
  { text: "School fees. Pay $50.", action: "pay", value: 50 },
  { text: "Receive $25 consultancy fee.", action: "collect", value: 25 },
  { text: "You are assessed for street repairs. Pay $40 per house, $115 per hotel.", action: "pay_per_house", value: [40, 115] },
  { text: "You have won second prize in a beauty contest. Collect $10.", action: "collect", value: 10 },
  { text: "You inherit $100.", action: "collect", value: 100 },
];

// ── Utility helpers ───────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Unbiased 1–6 from crypto when available (rejection sampling), else Math.random.
function d6() {
  const g = (typeof globalThis !== 'undefined') ? globalThis : {};
  const c = g.crypto;
  if (c && c.getRandomValues) {
    const buf = new Uint8Array(1);
    let v;
    do { c.getRandomValues(buf); v = buf[0]; } while (v >= 252); // 252 = 6*42, drop bias
    return (v % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
}
function roll() { return d6(); }
function rollSpeedDie() { return d6(); }

// structuredClone is ~2-4x faster than JSON round-tripping and is called on nearly
// every action; fall back to JSON for very old runtimes.
function deepClone(s) {
  return typeof structuredClone === 'function' ? structuredClone(s) : JSON.parse(JSON.stringify(s));
}

function hr(state) { return { ...DEFAULT_HOUSE_RULES, ...(state.house_rules || {}) }; }

// ── Initial State ─────────────────────────────────────────────────────────────
export function createInitialState(houseRules = {}, gameMode = 'classic', quickModeRounds = 30) {
  const houses = {};
  TILES.forEach(t => { if (t.type === 'property') houses[t.id] = 0; });

  return {
    players: [],
    order: [],
    current: 0,
    owner: {},
    houses,
    mortgaged: [],
    dice: [1, 1],
    dice_roll_id: 0,          // increments every roll so identical values still animate
    speed_die: null,          // null | { face: 1-6, type: 'move'|'bus'|'mr_monopoly' }
    speed_die_choice: null,   // for bus phase: [die1_total, die2_total] options
    doubles_streak: 0,
    extra_roll: false,
    can_buy: null,
    phase: 'lobby',
    pending_payment: null,    // { amount, toPid, reason, toJackpot } — shown as a PAY box
    pending_trade: null,
    auction: null,
    log: [],
    winner: null,
    debtor_id: null,
    debt_creditor_id: null,
    restore_phase: null,
    net_worth_history: {},
    chat_log: [],             // [{ name, text, color, ts }] — player chat, separate from event log
    turn_deadline: null,      // epoch ms set by host when turn timer is enabled
    round_counter: 0,
    free_parking_pot: 0,
    chance_deck: shuffle([...Array(16).keys()]),
    community_deck: shuffle([...Array(16).keys()]),
    _deferred_move_steps: null,
    house_rules: { ...DEFAULT_HOUSE_RULES, ...houseRules },
    game_mode: gameMode,
    quick_mode_rounds: quickModeRounds,
    speed_die_unlocked: {},   // playerId -> boolean: has passed GO since game start
  };
}

// ── Pure mutator helpers ──────────────────────────────────────────────────────
function addLog(state, msg) {
  state.log = [...state.log, msg];
  if (state.log.length > 100) state.log = state.log.slice(-100);
}

function getPlayer(state, pid) { return state.players.find(p => p.id === pid) || null; }

function getCurrentPlayerId(state) {
  if (!state.order.length) return null;
  return state.order[state.current];
}

function getRemainingHouses(state) {
  if (hr(state).unlimited_buildings) return 999;
  const used = Object.entries(state.houses).reduce((s, [, v]) => s + (v < 5 ? v : 0), 0);
  return Math.max(0, HOUSE_SUPPLY - used);
}

function getRemainingHotels(state) {
  if (hr(state).unlimited_buildings) return 999;
  const used = Object.values(state.houses).filter(v => v === 5).length;
  return Math.max(0, HOTEL_SUPPLY - used);
}

export function calcNetWorth(state, pid) {
  const p = getPlayer(state, pid);
  if (!p || p.bankrupt) return 0;
  let val = p.money;
  for (const propId of p.properties) {
    const tile = TILES.find(t => t.id === propId);
    if (!tile) continue;
    val += state.mortgaged.includes(propId) ? tile.mortgage : tile.price;
    const hc = state.houses[propId] || 0;
    if (hc > 0) {
      const costPerLevel = tile.houseCost || 0;
      val += Math.floor(hc * costPerLevel * 0.5);
    }
  }
  return val;
}

function recordNetWorths(state) {
  for (const p of state.players) {
    if (!state.net_worth_history[p.id]) state.net_worth_history[p.id] = [];
    state.net_worth_history[p.id] = [...state.net_worth_history[p.id], calcNetWorth(state, p.id)];
  }
}

// ── Payment system ────────────────────────────────────────────────────────────
// toJackpot=true means this payment should feed the free parking pot (taxes/fines only)
function payAmount(state, fromPid, toPid, amount, toJackpot = false) {
  if (amount <= 0) return state;
  const s = deepClone(state);

  if (fromPid === null) {
    const to = getPlayer(s, toPid);
    if (to) to.money += amount;
    return s;
  }

  const from = getPlayer(s, fromPid);
  from.money -= amount;

  if (toPid !== null) {
    const to = getPlayer(s, toPid);
    to.money += amount;
    addLog(s, `${from.name} paid $${amount} to ${to.name}.`);
  } else if (toJackpot && hr(s).free_parking_jackpot) {
    s.free_parking_pot = (s.free_parking_pot || 0) + amount;
    addLog(s, `${from.name} paid $${amount} to the Bank. ($${s.free_parking_pot} in Free Parking pot)`);
  } else {
    addLog(s, `${from.name} paid $${amount} to the Bank.`);
  }

  if (from.money < 0 && s.phase !== 'debt') {
    s.restore_phase = s.phase;
    s.phase = 'debt';
    s.debtor_id = fromPid;
    s.debt_creditor_id = toPid;
    addLog(s, `ALERT: ${from.name} is in debt! Must raise $${-from.money}.`);
  }

  return s;
}

// ── Rent calculator ───────────────────────────────────────────────────────────
function calcRent(state, tileId) {
  const tile = TILES.find(t => t.id === tileId);
  if (!tile) return 0;
  const ownerId = state.owner[tileId];
  if (state.mortgaged.includes(tileId)) return 0;

  const owner = getPlayer(state, ownerId);
  if (owner && owner.in_jail && hr(state).no_rent_in_jail) return 0;

  if (tile.type === 'property') {
    const hc = state.houses[tileId] || 0;
    if (hc === 0) {
      const grp = tile.group;
      const allOwned = GROUPS[grp]?.every(sid => state.owner[sid] === ownerId && !state.mortgaged.includes(sid));
      return allOwned ? tile.rent[0] * 2 : tile.rent[0];
    }
    return tile.rent[hc];
  }

  if (tile.type === 'railroad') {
    const count = RAILROAD_IDS.filter(rid => state.owner[rid] === ownerId && !state.mortgaged.includes(rid)).length;
    return RAILROAD_RENT[Math.max(0, count - 1)];
  }

  if (tile.type === 'utility') {
    const count = UTILITY_IDS.filter(uid => state.owner[uid] === ownerId && !state.mortgaged.includes(uid)).length;
    const factor = count === 1 ? 4 : 10;
    const diceSum = (state.dice[0] + state.dice[1]) + (state.speed_die?.type === 'move' ? state.speed_die.face : 0);
    return factor * diceSum;
  }

  return 0;
}

// ── Land effect ───────────────────────────────────────────────────────────────
function applyLand(state, pid, tileId) {
  let s = deepClone(state);
  const tile = TILES.find(t => t.id === tileId);
  const ttype = tile?.type;
  const p = getPlayer(s, pid);

  if (['property', 'railroad', 'utility'].includes(ttype)) {
    if (s.owner[tileId] === undefined || s.owner[tileId] === null) {
      s.can_buy = tileId;
      s.phase = 'buy_decision';
    } else {
      const ownerId = s.owner[tileId];
      if (ownerId === pid) {
        s.phase = 'post_roll';
      } else {
        const owner = getPlayer(s, ownerId);
        if (!owner.bankrupt && !s.mortgaged.includes(tileId)) {
          const rent = calcRent(s, tileId);
          if (rent > 0) {
            addLog(s, `${p.name} owes $${rent} rent to ${owner.name} for ${tile.name}.`);
            s.pending_payment = { amount: rent, toPid: ownerId, reason: `Rent · ${tile.name}`, toJackpot: false };
            s.phase = 'payment';
          } else {
            s.phase = 'post_roll';
          }
        } else if (s.mortgaged.includes(tileId)) {
          addLog(s, `${tile.name} is mortgaged. No rent owed.`);
          s.phase = 'post_roll';
        } else {
          s.phase = 'post_roll';
        }
      }
    }
  } else if (ttype === 'tax') {
    const taxAmt = tileId === 4
      ? (hr(s).income_tax_choice ? Math.min(200, Math.floor(calcNetWorth(s, pid) * 0.1)) : 200)
      : (hr(s).luxury_tax ?? tile.price);
    addLog(s, `${p.name} landed on ${tile.name} and owes $${taxAmt}.`);
    s.pending_payment = { amount: taxAmt, toPid: null, reason: tile.name, toJackpot: true };
    s.phase = 'payment';
  } else if (ttype === 'go_to_jail') {
    addLog(s, `${p.name} landed on Go To Jail!`);
    getPlayer(s, pid).position = 10;
    getPlayer(s, pid).in_jail = true;
    getPlayer(s, pid).jail_turns = 0;
    s.doubles_streak = 0; s.extra_roll = false;
    s.phase = 'post_roll';
  } else if (ttype === 'free_parking') {
    if (hr(s).free_parking_jackpot && s.free_parking_pot > 0) {
      addLog(s, `${p.name} landed on Free Parking and collected the $${s.free_parking_pot} pot!`);
      p.money += s.free_parking_pot;
      s.free_parking_pot = 0;
    } else {
      addLog(s, `${p.name} landed on Free Parking. Nothing happens.`);
    }
    s.phase = 'post_roll';
  } else if (ttype === 'chance') {
    s = applyCard(s, pid, 'chance');
  } else if (ttype === 'community_chest') {
    s = applyCard(s, pid, 'community_chest');
  } else {
    s.phase = 'post_roll';
  }

  return s;
}

// ── Card effects ──────────────────────────────────────────────────────────────
function applyCard(state, pid, deckType) {
  let s = deepClone(state);
  const p = getPlayer(s, pid);
  const rules = hr(s);

  let cardIdx, card;
  if (deckType === 'chance') {
    cardIdx = s.chance_deck[0];
    s.chance_deck = s.chance_deck.slice(1);
    card = CHANCE_CARDS[cardIdx];
    addLog(s, `${p.name} drew Chance: '${card.text}'`);
    if (card.action !== 'get_out_of_jail_free') s.chance_deck = [...s.chance_deck, cardIdx];
  } else {
    cardIdx = s.community_deck[0];
    s.community_deck = s.community_deck.slice(1);
    card = COMMUNITY_CHEST_CARDS[cardIdx];
    addLog(s, `${p.name} drew Community Chest: '${card.text}'`);
    if (card.action !== 'get_out_of_jail_free') s.community_deck = [...s.community_deck, cardIdx];
  }

  const { action } = card;
  let value = card.value;
  // Bank error house rule: doubles the $200 payout
  if (card.id === 'bank_error' && rules.bank_errors_favored) value = 400;

  const currentP = getPlayer(s, pid);

  if (action === 'advance_to') {
    const dest = value;
    const oldPos = currentP.position;
    currentP.position = dest;
    addLog(s, `${currentP.name} advanced to ${TILES.find(t => t.id === dest)?.name}.`);
    if (dest === 10) {
      currentP.in_jail = true; currentP.jail_turns = 0;
      s.doubles_streak = 0; s.extra_roll = false; s.phase = 'post_roll';
    } else {
      if (dest < oldPos) {
        const goBonus = rules.go_salary ?? GO_BONUS;
        currentP.money += goBonus;
        addLog(s, `${currentP.name} passed GO and collected $${goBonus}.`);
        s.speed_die_unlocked = { ...s.speed_die_unlocked, [pid]: true };
      }
      s = applyLand(s, pid, dest);
    }
  } else if (action === 'advance_to_nearest_railroad') {
    const oldPos = currentP.position;
    const nearestRR = RAILROAD_IDS.reduce((best, rid) => {
      const dist = (rid - oldPos + 40) % 40;
      return dist < best.dist ? { id: rid, dist } : best;
    }, { id: RAILROAD_IDS[0], dist: 999 }).id;
    currentP.position = nearestRR;
    addLog(s, `${currentP.name} advanced to nearest Railroad.`);
    if (nearestRR < oldPos) {
      const goBonus = rules.go_salary ?? GO_BONUS;
      currentP.money += goBonus;
      addLog(s, `${currentP.name} passed GO.`);
      s.speed_die_unlocked = { ...s.speed_die_unlocked, [pid]: true };
    }
    if (s.owner[nearestRR] === undefined) {
      s.can_buy = nearestRR; s.phase = 'buy_decision';
    } else if (s.owner[nearestRR] !== pid) {
      const owner = getPlayer(s, s.owner[nearestRR]);
      if (!owner.bankrupt && !s.mortgaged.includes(nearestRR)) {
        const rrCount = RAILROAD_IDS.filter(rid => s.owner[rid] === owner.id && !s.mortgaged.includes(rid)).length;
        const rent = 2 * RAILROAD_RENT[Math.max(0, rrCount - 1)];
        addLog(s, `${currentP.name} owes double rent $${rent}.`);
        s = payAmount(s, pid, owner.id, rent);
      }
      if (s.phase !== 'debt') s.phase = 'post_roll';
    } else { s.phase = 'post_roll'; }
  } else if (action === 'advance_to_nearest_utility') {
    const oldPos = currentP.position;
    const nearestUT = UTILITY_IDS.reduce((best, uid) => {
      const dist = (uid - oldPos + 40) % 40;
      return dist < best.dist ? { id: uid, dist } : best;
    }, { id: UTILITY_IDS[0], dist: 999 }).id;
    currentP.position = nearestUT;
    addLog(s, `${currentP.name} advanced to nearest Utility.`);
    if (nearestUT < oldPos) {
      const goBonus = rules.go_salary ?? GO_BONUS;
      currentP.money += goBonus;
      s.speed_die_unlocked = { ...s.speed_die_unlocked, [pid]: true };
    }
    if (s.owner[nearestUT] === undefined) {
      s.can_buy = nearestUT; s.phase = 'buy_decision';
    } else if (s.owner[nearestUT] !== pid) {
      const owner = getPlayer(s, s.owner[nearestUT]);
      if (!owner.bankrupt && !s.mortgaged.includes(nearestUT)) {
        const rent = 10 * (s.dice[0] + s.dice[1]);
        addLog(s, `${currentP.name} owes 10x utility rent $${rent}.`);
        s = payAmount(s, pid, owner.id, rent);
      }
      if (s.phase !== 'debt') s.phase = 'post_roll';
    } else { s.phase = 'post_roll'; }
  } else if (action === 'go_back') {
    const dest = (currentP.position - value + 40) % 40;
    currentP.position = dest;
    addLog(s, `${currentP.name} went back to ${TILES.find(t => t.id === dest)?.name}.`);
    s = applyLand(s, pid, dest);
  } else if (action === 'go_to_jail') {
    currentP.position = 10; currentP.in_jail = true; currentP.jail_turns = 0;
    s.doubles_streak = 0; s.extra_roll = false; s.phase = 'post_roll';
  } else if (action === 'collect') {
    currentP.money += value;
    addLog(s, `${currentP.name} collected $${value}.`);
    s.phase = 'post_roll';
  } else if (action === 'pay') {
    s = payAmount(s, pid, null, value, true);
    if (s.phase !== 'debt') s.phase = 'post_roll';
  } else if (action === 'pay_per_house') {
    const [perH, perHotel] = value;
    let hCount = 0, htCount = 0;
    for (const propId of currentP.properties) {
      const hc = s.houses[propId] || 0;
      if (hc === 5) htCount++; else hCount += hc;
    }
    const fee = hCount * perH + htCount * perHotel;
    addLog(s, `${currentP.name} assessed repairs: ${hCount} houses, ${htCount} hotels. Total: $${fee}.`);
    s = payAmount(s, pid, null, fee, true);
    if (s.phase !== 'debt') s.phase = 'post_roll';
  } else if (action === 'pay_each_player') {
    const opponents = s.players.filter(o => !o.bankrupt && o.id !== pid);
    addLog(s, `${currentP.name} pays $${value} to every active player.`);
    for (const opp of opponents) {
      s = payAmount(s, pid, opp.id, value);
      if (s.phase === 'debt') break;
    }
    if (s.phase !== 'debt') s.phase = 'post_roll';
  } else if (action === 'collect_from_each_player') {
    const opponents = s.players.filter(o => !o.bankrupt && o.id !== pid);
    addLog(s, `${currentP.name} collects $${value} from every active player.`);
    for (const opp of opponents) s = payAmount(s, opp.id, pid, value);
    if (s.phase !== 'debt') s.phase = 'post_roll';
  } else if (action === 'get_out_of_jail_free') {
    currentP.jail_cards = (currentP.jail_cards || 0) + 1;
    addLog(s, `${currentP.name} received a Get Out of Jail Free card.`);
    s.phase = 'post_roll';
  }

  return s;
}

// ── Debt resolution ───────────────────────────────────────────────────────────
function checkDebtResolved(state) {
  let s = deepClone(state);
  if (s.phase !== 'debt' || !s.debtor_id) return s;
  const debtor = getPlayer(s, s.debtor_id);
  if (debtor.money >= 0) {
    addLog(s, `${debtor.name} resolved their debt.`);
    s.phase = s.restore_phase;
    s.debtor_id = null; s.debt_creditor_id = null; s.restore_phase = null;
    if (s._deferred_move_steps !== null) {
      const steps = s._deferred_move_steps;
      s._deferred_move_steps = null;
      s = movePlayer(s, debtor.id, steps);
    }
  }
  return s;
}

// ── Move player ───────────────────────────────────────────────────────────────
function movePlayer(state, pid, steps) {
  let s = deepClone(state);
  const p = getPlayer(s, pid);
  const oldPos = p.position;
  const newPos = (oldPos + steps) % 40;
  p.position = newPos;
  const tile = TILES.find(t => t.id === newPos);
  addLog(s, `${p.name} moved to ${tile?.name ?? newPos}.`);

  if (newPos < oldPos && steps > 0) {
    const rules = hr(s);
    const bonus = (rules.double_go_salary && newPos === 0) ? (rules.go_salary ?? GO_BONUS) * 2 : (rules.go_salary ?? GO_BONUS);
    p.money += bonus;
    addLog(s, `${p.name} passed${newPos === 0 ? ' and landed on' : ''} GO. Collected $${bonus}.`);
    s.speed_die_unlocked = { ...s.speed_die_unlocked, [pid]: true };
  }

  s = applyLand(s, pid, newPos);
  return s;
}

// ── Advance turn (checks quick mode) ─────────────────────────────────────────
function advanceTurn(state) {
  let s = deepClone(state);
  let isNewRound = false;
  while (true) {
    s.current = (s.current + 1) % s.order.length;
    if (s.current === 0) isNewRound = true;
    const pid = s.order[s.current];
    if (!getPlayer(s, pid).bankrupt) break;
  }
  if (isNewRound) {
    s.round_counter += 1;
    recordNetWorths(s);
    // Quick mode end condition
    if (s.game_mode === 'quick' && s.round_counter >= s.quick_mode_rounds) {
      const active = s.players.filter(p => !p.bankrupt);
      const winner = active.reduce((best, p) =>
        calcNetWorth(s, p.id) > calcNetWorth(s, best.id) ? p : best, active[0]);
      s.phase = 'game_over';
      s.winner = winner.id;
      addLog(s, `QUICK MODE: ${s.round_counter} rounds completed. ${winner.name} wins with net worth $${calcNetWorth(s, winner.id)}!`);
      return s;
    }
  }
  s.doubles_streak = 0; s.extra_roll = false;
  const p = getPlayer(s, getCurrentPlayerId(s));
  addLog(s, `It is now ${p.name}'s turn.`);
  return s;
}

// ── Speed Die helpers ─────────────────────────────────────────────────────────
function getSpeedDieFaceType(face) {
  if (face <= 3) return 'move';
  if (face <= 5) return 'bus';
  return 'mr_monopoly';
}

// Mr. Monopoly: move to nearest unowned property (or nearest owned if all owned)
function mrMonopolyMove(state, pid) {
  let s = deepClone(state);
  const p = getPlayer(s, pid);
  const pos = p.position;
  const buyable = [1, 3, 5, 6, 8, 9, 11, 12, 13, 14, 15, 16, 18, 19, 21, 23, 24, 25, 26, 27, 28, 29, 31, 32, 34, 35, 37, 39];
  const unowned = buyable.filter(id => s.owner[id] === undefined);
  const pool = unowned.length > 0 ? unowned : buyable;
  const dest = pool.reduce((best, id) => {
    const dist = (id - pos + 40) % 40 || 40;
    return dist < best.dist ? { id, dist } : best;
  }, { id: pool[0], dist: 999 }).id;
  const steps = (dest - pos + 40) % 40;
  addLog(s, `${p.name} activates Mr. Monopoly — advances to ${TILES.find(t => t.id === dest)?.name}.`);
  s = movePlayer(s, pid, steps);
  return s;
}

// ── Public action handlers ────────────────────────────────────────────────────

export function addPlayer(state, { id, name, token_shape, token_color, token, slot, seat_index, is_bot, difficulty }) {
  if (state.phase !== 'lobby') return { state, error: 'Game already in progress.' };
  if (state.players.length >= 6) return { state, error: 'Lobby is full.' };

  const shape = token_shape || token || 'car';
  const color = token_color || '#38bdf8';
  const startingCash = hr(state).starting_cash ?? STARTING_MONEY;

  const player = {
    id,
    name,
    token: shape,      // keep backward-compat token field
    token_shape: shape,
    token_color: color,
    slot: seat_index ?? slot ?? state.players.length,
    position: 0,
    money: startingCash,
    properties: [],
    in_jail: false,
    jail_turns: 0,
    jail_cards: 0,
    bankrupt: false,
    is_bot: is_bot ?? false,
    difficulty: is_bot ? (difficulty || 'normal') : null,
  };

  const s = deepClone(state);
  s.players = [...s.players, player];
  if (!s.net_worth_history[id]) s.net_worth_history[id] = [startingCash];
  addLog(s, `${name} joined.`);
  return { state: s };
}

export function startGame(state) {
  if (state.phase !== 'lobby') return { state, error: 'Not in lobby.' };
  if (state.players.length < 2) return { state, error: 'Need at least 2 players.' };

  const s = deepClone(state);
  s.order = shuffle(s.players.map(p => p.id));
  s.current = 0;
  s.phase = 'turn';
  recordNetWorths(s);
  const names = s.order.map(id => getPlayer(s, id).name).join(', ');
  addLog(s, `Game started! Turn order: ${names}.`);
  addLog(s, `It is ${getPlayer(s, getCurrentPlayerId(s)).name}'s turn.`);
  return { state: s };
}

export function rollDice(state, { playerId }) {
  if (state.phase !== 'turn') return { state, error: 'Not in turn phase.' };
  if (playerId !== getCurrentPlayerId(state)) return { state, error: 'Not your turn.' };

  let s = deepClone(state);
  const d1 = roll(), d2 = roll();
  s.dice = [d1, d2];
  s.dice_roll_id = (s.dice_roll_id || 0) + 1;
  const isDouble = d1 === d2;
  const p = getPlayer(s, playerId);

  // Speed die
  let speedFace = null, speedType = null;
  const useSpeedDie = (s.game_mode === 'speed_die' || s.game_mode === 'quick') && !!s.speed_die_unlocked[playerId];
  if (useSpeedDie && !p.in_jail) {
    speedFace = rollSpeedDie();
    speedType = getSpeedDieFaceType(speedFace);
    s.speed_die = { face: speedFace, type: speedType };
    addLog(s, `${p.name} rolled ${d1}+${d2} (Total: ${d1+d2}) and Speed Die: ${speedFace} [${speedType.toUpperCase()}]`);
  } else {
    s.speed_die = null;
    addLog(s, `${p.name} rolled ${d1} and ${d2} (Total: ${d1+d2}).`);
  }

  const sum = d1 + d2;

  if (p.in_jail) {
    if (isDouble) {
      p.in_jail = false; p.jail_turns = 0;
      addLog(s, `${p.name} rolled doubles and left Jail!`);
      s.extra_roll = false; s.doubles_streak = 0;
      s = movePlayer(s, playerId, sum);
    } else {
      p.jail_turns = (p.jail_turns || 0) + 1;
      addLog(s, `${p.name} failed doubles in Jail (Turn ${p.jail_turns}/3).`);
      if (p.jail_turns >= 3) {
        const fine = hr(s).jail_fine ?? 50;
        addLog(s, `${p.name} must pay $${fine} fine to leave Jail.`);
        s = payAmount(s, playerId, null, fine, false);
        getPlayer(s, playerId).in_jail = false;
        getPlayer(s, playerId).jail_turns = 0;
        if (s.phase === 'debt') s._deferred_move_steps = sum;
        else s = movePlayer(s, playerId, sum);
      } else {
        s.phase = 'post_roll';
      }
    }
  } else {
    if (isDouble) {
      s.doubles_streak = (s.doubles_streak || 0) + 1;
      if (s.doubles_streak === 3) {
        addLog(s, `Doubles #3 in a row — ${p.name} is sent to Jail!`);
        getPlayer(s, playerId).position = 10;
        getPlayer(s, playerId).in_jail = true;
        getPlayer(s, playerId).jail_turns = 0;
        s.doubles_streak = 0; s.extra_roll = false; s.phase = 'post_roll';
        return { state: s };
      } else {
        addLog(s, s.doubles_streak === 1
          ? `Doubles #1! ${p.name} rolls again.`
          : `Doubles #2! ${p.name} rolls again — a 3rd means Jail!`);
        s.extra_roll = true;
      }
    } else {
      s.extra_roll = false; s.doubles_streak = 0;
    }

    if (speedType === 'bus') {
      // Player chooses: move by d1 alone, d2 alone, or d1+d2
      s.speed_die_choice = [d1, d2, d1 + d2];
      s.phase = 'speed_bus';
      addLog(s, `${p.name} got BUS on Speed Die. Choose: move ${d1}, ${d2}, or ${d1+d2}.`);
    } else if (speedType === 'mr_monopoly') {
      s = movePlayer(s, playerId, sum);
      if (!['debt', 'buy_decision', 'auction'].includes(s.phase)) {
        s = mrMonopolyMove(s, playerId);
      }
    } else {
      const totalMove = speedType === 'move' ? sum + speedFace : sum;
      s = movePlayer(s, playerId, totalMove);
    }
  }

  return { state: s };
}

// Player chooses movement distance during speed_bus phase
export function chooseBusRoute(state, { playerId, steps }) {
  if (state.phase !== 'speed_bus') return { state, error: 'Not in speed_bus phase.' };
  if (playerId !== getCurrentPlayerId(state)) return { state, error: 'Not your turn.' };
  if (!state.speed_die_choice?.includes(steps)) return { state, error: 'Invalid bus route choice.' };

  let s = deepClone(state);
  s.speed_die_choice = null;
  addLog(s, `${getPlayer(s, playerId).name} chose to move ${steps} steps.`);
  s = movePlayer(s, playerId, steps);
  return { state: s };
}

export function buyProperty(state, { playerId }) {
  if (state.phase !== 'buy_decision') return { state, error: 'Not in buy_decision phase.' };
  if (playerId !== getCurrentPlayerId(state)) return { state, error: 'Not your turn.' };

  const s = deepClone(state);
  const tileId = s.can_buy;
  const tile = TILES.find(t => t.id === tileId);
  const p = getPlayer(s, playerId);

  // Can't afford it → reject the buy outright. Buying never triggers an auction;
  // the player must explicitly choose AUCTION or PASS instead.
  if (p.money < tile.price) {
    return { state, error: `Not enough cash to buy ${tile.name} ($${tile.price.toLocaleString()}).` };
  }

  p.money -= tile.price;
  s.owner[tileId] = playerId;
  p.properties = [...p.properties, tileId];
  addLog(s, `${p.name} bought ${tile.name} for $${tile.price}.`);
  s.can_buy = null; s.phase = 'post_roll';
  return { state: s };
}

// Player confirms a queued rent/tax payment (the "PAY" box).
export function confirmPayment(state, { playerId }) {
  if (state.phase !== 'payment' || !state.pending_payment) return { state, error: 'No payment due.' };
  if (playerId !== getCurrentPlayerId(state)) return { state, error: 'Not your payment.' };

  let s = deepClone(state);
  const pp = s.pending_payment;
  s.pending_payment = null;
  s.phase = 'post_roll'; // target once paid (payAmount flips to 'debt' if it can't be covered)
  s = payAmount(s, playerId, pp.toPid, pp.amount, pp.toJackpot);
  return { state: s };
}

export function declineBuy(state, { playerId, auction }) {
  if (state.phase !== 'buy_decision') return { state, error: 'Not in buy_decision phase.' };
  if (playerId !== getCurrentPlayerId(state)) return { state, error: 'Not your turn.' };

  const s = deepClone(state);
  const tileId = s.can_buy;
  const p = getPlayer(s, playerId);

  // Explicit player choice (PASS vs AUCTION buttons) wins; absent a choice,
  // fall back to the skip_auction house rule.
  const goAuction = auction === true ? true : auction === false ? false : !hr(s).skip_auction;

  if (!goAuction) {
    addLog(s, `${p.name} passed on ${TILES.find(t => t.id === tileId)?.name}. Property returned to bank.`);
    s.can_buy = null; s.phase = 'post_roll';
    return { state: s };
  }

  addLog(s, `${p.name} sent ${TILES.find(t => t.id === tileId)?.name} to auction!`);
  return startAuction(s, tileId, playerId);
}

function startAuction(state, tileId, originalPid) {
  const s = deepClone(state);
  const currIdx = s.order.indexOf(originalPid);
  const bidders = [];
  for (let i = 1; i <= s.order.length; i++) {
    const cid = s.order[(currIdx + i) % s.order.length];
    if (!getPlayer(s, cid).bankrupt) bidders.push(cid);
  }
  const minBid = (hr(s).auction_minimum ?? 1);
  s.auction = {
    tile: tileId,
    current_bid: minBid - 1,
    current_bidder: null,
    order: [...bidders],
    active: [...bidders],
    turn_idx: 0,
  };
  s.can_buy = null; s.phase = 'auction';
  addLog(s, `Auction started for ${TILES.find(t => t.id === tileId)?.name}. Opening bid: $${minBid}.`);
  return { state: s };
}

export function auctionBid(state, { playerId, amount }) {
  if (state.phase !== 'auction' || !state.auction) return { state, error: 'No auction in progress.' };
  const { active, turn_idx } = state.auction;
  if (active[turn_idx] !== playerId) return { state, error: 'Not your auction turn.' };
  const p = getPlayer(state, playerId);
  if (amount <= state.auction.current_bid || amount > p.money) return { state, error: 'Invalid bid amount.' };

  const s = deepClone(state);
  s.auction.current_bid = amount;
  s.auction.current_bidder = playerId;
  addLog(s, `${p.name} bid $${amount}.`);
  s.auction.turn_idx = (turn_idx + 1) % active.length;
  return { state: s };
}

export function auctionPass(state, { playerId }) {
  if (state.phase !== 'auction' || !state.auction) return { state, error: 'No auction in progress.' };
  const { active, turn_idx } = state.auction;
  if (active[turn_idx] !== playerId) return { state, error: 'Not your auction turn.' };

  let s = deepClone(state);
  addLog(s, `${getPlayer(s, playerId).name} passed.`);
  s.auction.active = s.auction.active.filter(id => id !== playerId);

  if (s.auction.active.length === 0) {
    s = endAuction(s, null, 0);
  } else if (s.auction.active.length === 1 && s.auction.current_bidder !== null) {
    s = endAuction(s, s.auction.current_bidder, s.auction.current_bid);
  } else {
    s.auction.turn_idx = turn_idx % s.auction.active.length;
  }
  return { state: s };
}

function endAuction(state, winnerPid, finalBid) {
  const s = deepClone(state);
  const tile = TILES.find(t => t.id === s.auction.tile);
  if (winnerPid !== null) {
    const winner = getPlayer(s, winnerPid);
    winner.money -= finalBid;
    s.owner[s.auction.tile] = winnerPid;
    winner.properties = [...winner.properties, s.auction.tile];
    addLog(s, `Auction: ${winner.name} won ${tile.name} for $${finalBid}!`);
  } else {
    addLog(s, `Auction: Nobody purchased ${tile.name}.`);
  }
  s.auction = null; s.phase = 'post_roll';
  return s;
}

export function payJailFine(state, { playerId }) {
  if (state.phase !== 'turn') return { state, error: 'Not in turn phase.' };
  if (playerId !== getCurrentPlayerId(state)) return { state, error: 'Not your turn.' };
  const p = getPlayer(state, playerId);
  const fine = hr(state).jail_fine ?? 50;
  if (!p.in_jail || p.money < fine) return { state, error: 'Cannot pay jail fine.' };

  let s = payAmount(state, playerId, null, fine, false);
  getPlayer(s, playerId).in_jail = false;
  getPlayer(s, playerId).jail_turns = 0;
  addLog(s, `${p.name} paid $${fine} fine to leave Jail.`);
  return { state: s };
}

export function redeemJailCard(state, { playerId }) {
  if (state.phase !== 'turn') return { state, error: 'Not in turn phase.' };
  if (playerId !== getCurrentPlayerId(state)) return { state, error: 'Not your turn.' };
  const p = getPlayer(state, playerId);
  if (!p.in_jail || !p.jail_cards) return { state, error: 'No jail card to use.' };

  const s = deepClone(state);
  getPlayer(s, playerId).jail_cards -= 1;
  getPlayer(s, playerId).in_jail = false;
  getPlayer(s, playerId).jail_turns = 0;
  addLog(s, `${getPlayer(s, playerId).name} used a Get Out of Jail Free card.`);
  s.chance_deck = [...s.chance_deck, 7];
  return { state: s };
}

export function buildHouse(state, { playerId, tileId }) {
  const tile = TILES.find(t => t.id === tileId);
  if (!tile || tile.type !== 'property') return { state, error: 'Not a property.' };
  if (state.owner[tileId] !== playerId) return { state, error: 'Not your property.' };
  if (state.mortgaged.includes(tileId)) return { state, error: 'Property is mortgaged.' };

  const grp = tile.group;
  if (!GROUPS[grp]?.every(sid => state.owner[sid] === playerId && !state.mortgaged.includes(sid))) {
    return { state, error: 'You must own the full color group.' };
  }

  const currH = state.houses[tileId] || 0;
  if (currH >= 5) return { state, error: 'Already has hotel.' };

  const s = deepClone(state);

  if (currH === 4) {
    if (getRemainingHotels(s) < 1) return { state, error: 'Bank out of hotels.' };
  } else {
    if (getRemainingHouses(s) < 1) return { state, error: 'Bank out of houses.' };
  }

  for (const sid of GROUPS[grp]) {
    if ((s.houses[sid] || 0) < currH) return { state, error: 'Must build evenly.' };
  }

  const p = getPlayer(s, playerId);
  if (p.money < tile.houseCost) return { state, error: 'Not enough money.' };

  p.money -= tile.houseCost;
  s.houses[tileId] = currH + 1;
  addLog(s, `${p.name} built ${currH === 4 ? 'a HOTEL' : `house ${currH + 1}`} on ${tile.name} for $${tile.houseCost}.`);
  return { state: checkDebtResolved(s) };
}

export function sellHouse(state, { playerId, tileId }) {
  const tile = TILES.find(t => t.id === tileId);
  if (!tile || tile.type !== 'property') return { state, error: 'Not a property.' };
  if (state.owner[tileId] !== playerId) return { state, error: 'Not your property.' };

  const currH = state.houses[tileId] || 0;
  if (currH <= 0) return { state, error: 'No houses to sell.' };
  if (currH === 5 && getRemainingHouses(state) < 4) return { state, error: 'Bank lacks 4 houses to downgrade hotel.' };

  const grp = tile.group;
  for (const sid of (GROUPS[grp] || [])) {
    if ((state.houses[sid] || 0) > currH) return { state, error: 'Must sell evenly.' };
  }

  const s = deepClone(state);
  const refund = Math.floor(tile.houseCost / 2);
  getPlayer(s, playerId).money += refund;
  s.houses[tileId] = currH - 1;
  addLog(s, `${getPlayer(s, playerId).name} sold ${currH === 5 ? 'hotel' : 'house'} on ${tile.name} (refund $${refund}).`);
  return { state: checkDebtResolved(s) };
}

export function mortgageProperty(state, { playerId, tileId }) {
  const tile = TILES.find(t => t.id === tileId);
  if (!tile) return { state, error: 'Tile not found.' };
  if (state.owner[tileId] !== playerId) return { state, error: 'Not your property.' };
  if (state.mortgaged.includes(tileId)) return { state, error: 'Already mortgaged.' };

  const grp = tile.group;
  if (grp && GROUPS[grp]) {
    for (const sid of GROUPS[grp]) {
      if ((state.houses[sid] || 0) > 0) return { state, error: 'Must sell all houses first.' };
    }
  }

  const s = deepClone(state);
  getPlayer(s, playerId).money += tile.mortgage;
  s.mortgaged = [...s.mortgaged, tileId];
  addLog(s, `${getPlayer(s, playerId).name} mortgaged ${tile.name} for $${tile.mortgage}.`);
  return { state: checkDebtResolved(s) };
}

export function unmortgageProperty(state, { playerId, tileId }) {
  const tile = TILES.find(t => t.id === tileId);
  if (!tile) return { state, error: 'Tile not found.' };
  if (state.owner[tileId] !== playerId) return { state, error: 'Not your property.' };
  if (!state.mortgaged.includes(tileId)) return { state, error: 'Not mortgaged.' };

  const cost = Math.floor(tile.mortgage * 1.1);
  if (getPlayer(state, playerId).money < cost) return { state, error: 'Not enough money.' };

  const s = deepClone(state);
  getPlayer(s, playerId).money -= cost;
  s.mortgaged = s.mortgaged.filter(id => id !== tileId);
  addLog(s, `${getPlayer(s, playerId).name} unmortgaged ${tile.name} for $${cost}.`);
  return { state: s };
}

export function declareBankruptcy(state, { playerId }) {
  if (state.phase !== 'debt' || state.debtor_id !== playerId) return { state, error: 'Not in debt phase.' };

  let s = deepClone(state);
  const debtor = getPlayer(s, playerId);
  debtor.bankrupt = true;
  addLog(s, `${debtor.name} declared BANKRUPTCY!`);

  if (s.debt_creditor_id !== null) {
    const creditor = getPlayer(s, s.debt_creditor_id);
    addLog(s, `All properties transferred to ${creditor.name}.`);
    for (const tid of [...debtor.properties]) {
      s.houses[tid] = 0;
      s.owner[tid] = creditor.id;
      creditor.properties = [...creditor.properties, tid];
    }
    creditor.money += Math.max(0, debtor.money);
  } else {
    addLog(s, `All properties of ${debtor.name} returned to Bank.`);
    for (const tid of [...debtor.properties]) {
      s.houses[tid] = 0;
      delete s.owner[tid];
      s.mortgaged = s.mortgaged.filter(id => id !== tid);
    }
  }
  debtor.money = 0;
  debtor.properties = [];
  debtor.jail_cards = 0;

  const active = s.players.filter(p => !p.bankrupt);
  if (active.length === 1) {
    s.phase = 'game_over';
    s.winner = active[0].id;
    recordNetWorths(s);
    addLog(s, `GAME OVER. ${active[0].name} wins!`);
  } else {
    s.phase = 'turn';
    s.debtor_id = null; s.debt_creditor_id = null; s.restore_phase = null;
    s = advanceTurn(s);
  }
  return { state: s };
}

export function endTurn(state, { playerId }) {
  if (['debt', 'auction', 'payment'].includes(state.phase)) return { state, error: 'Cannot end turn.' };
  if (playerId !== getCurrentPlayerId(state)) return { state, error: 'Not your turn.' };

  let s = deepClone(state);

  if (s.phase === 'buy_decision') {
    const result = declineBuy(s, { playerId });
    if (result.error) return result;
    s = result.state;
  }

  if (s.extra_roll) {
    addLog(s, `${getPlayer(s, playerId).name} gets an extra roll for doubles!`);
    s.extra_roll = false; s.phase = 'turn';
  } else {
    s = advanceTurn(s);
    if (s.phase !== 'game_over') s.phase = 'turn';
  }
  return { state: s };
}

export function proposeTrade(state, { fromId, toId, offer }) {
  // A counter-offer is a new proposal from the current target back to the
  // current proposer — it's allowed to replace the pending trade.
  let isCounter = false;
  if (state.pending_trade) {
    const pt = state.pending_trade;
    isCounter = pt.to === fromId && pt.from === toId;
    if (!isCounter) return { state, error: 'Trade already pending.' };
  }
  if (fromId === toId) return { state, error: 'Cannot trade with yourself.' };
  const from = getPlayer(state, fromId);
  const to = getPlayer(state, toId);
  if (!from || !to || from.bankrupt || to.bankrupt) return { state, error: 'Invalid players.' };
  if (from.money < (offer.from_money || 0)) return { state, error: 'Insufficient funds.' };
  if (to.money < (offer.to_money || 0)) return { state, error: 'Recipient has insufficient funds.' };

  const s = deepClone(state);
  s.pending_trade = { from: fromId, to: toId, offer };
  addLog(s, isCounter ? `${from.name} sent ${to.name} a counter-offer.` : `${from.name} proposed a trade to ${to.name}.`);
  return { state: s };
}

export function respondTrade(state, { playerId, accept }) {
  if (!state.pending_trade) return { state, error: 'No pending trade.' };
  if (playerId !== state.pending_trade.to) return { state, error: 'Not the trade target.' };

  const s = deepClone(state);
  const { from: fromId, to: toId, offer } = s.pending_trade;
  const from = getPlayer(s, fromId);
  const to = getPlayer(s, toId);

  if (accept) {
    for (const tid of (offer.from_properties || [])) {
      s.owner[tid] = toId;
      from.properties = from.properties.filter(id => id !== tid);
      to.properties = [...to.properties, tid];
    }
    for (const tid of (offer.to_properties || [])) {
      s.owner[tid] = fromId;
      to.properties = to.properties.filter(id => id !== tid);
      from.properties = [...from.properties, tid];
    }
    const fm = offer.from_money || 0, tm = offer.to_money || 0;
    from.money = from.money - fm + tm;
    to.money = to.money - tm + fm;
    const fc = offer.from_cards || 0, tc = offer.to_cards || 0;
    from.jail_cards = (from.jail_cards || 0) - fc + tc;
    to.jail_cards = (to.jail_cards || 0) - tc + fc;
    addLog(s, `Trade accepted between ${from.name} and ${to.name}.`);
  } else {
    addLog(s, `${to.name} rejected the trade.`);
  }
  s.pending_trade = null;
  return { state: s };
}

export function cancelTrade(state, { playerId }) {
  if (!state.pending_trade || state.pending_trade.from !== playerId) return { state, error: 'No trade to cancel.' };
  const s = deepClone(state);
  addLog(s, `${getPlayer(s, playerId).name} withdrew the trade proposal.`);
  s.pending_trade = null;
  return { state: s };
}

// ── AI Decision Engine ────────────────────────────────────────────────────────
// Tunable strategy profiles per difficulty. Higher tiers buy/build more aggressively,
// bid higher at auction, and spend to escape jail when they own developable property.
const AI_PROFILES = {
  easy:   { buyNwFrac: 0.18, reserve: 250, auctionFrac: 0.6,  bidStep: 10, maxHouses: 2, buildCostMult: 4,   buildMinNw: 2200, jailPay: 'never' },
  normal: { buyNwFrac: 0.30, reserve: 120, auctionFrac: 0.85, bidStep: 10, maxHouses: 4, buildCostMult: 2,   buildMinNw: 1500, jailPay: 'afford' },
  hard:   { buyNwFrac: 0.50, reserve: 80,  auctionFrac: 1.1,  bidStep: 15, maxHouses: 5, buildCostMult: 1.5, buildMinNw: 1100, jailPay: 'strategic' },
};

function aiProfile(bot) { return AI_PROFILES[bot?.difficulty] || AI_PROFILES.normal; }

// Does the bot own at least one complete, build-eligible color group?
function botHasMonopoly(state, botId) {
  return Object.keys(GROUPS).some(grp =>
    GROUPS[grp].every(sid => state.owner[sid] === botId && !state.mortgaged.includes(sid)));
}

// Returns { type, payload } for the host to dispatch, or null if no action needed.
export function getAIDecision(state, botId) {
  const bot = getPlayer(state, botId);
  if (!bot || bot.bankrupt) return null;
  const phase = state.phase;
  const isCurrentPlayer = getCurrentPlayerId(state) === botId;
  const prof = aiProfile(bot);

  // Respond to a trade offer aimed at this bot — can arrive on any player's turn.
  if (state.pending_trade && state.pending_trade.to === botId) {
    const offer = state.pending_trade.offer || {};
    const val = (tids) => (tids || []).reduce((sum, tid) => {
      const t = TILES.find(x => x.id === tid);
      if (!t) return sum;
      return sum + (state.mortgaged.includes(tid) ? t.mortgage : t.price);
    }, 0);
    const receives = (offer.from_money || 0) + val(offer.from_properties) + (offer.from_cards || 0) * 50;
    const gives = (offer.to_money || 0) + val(offer.to_properties) + (offer.to_cards || 0) * 50;
    const affordable = bot.money >= (offer.to_money || 0);
    // hard bots accept slightly unfavorable deals (to complete groups); easy are strict.
    const threshold = prof.maxHouses >= 5 ? -40 : prof.maxHouses >= 4 ? 0 : 30;
    const accept = affordable && (receives - gives) >= threshold;
    return { type: 'respond_trade', payload: { playerId: botId, accept } };
  }

  if (phase === 'turn' && isCurrentPlayer) {
    if (bot.in_jail) {
      const fine = hr(state).jail_fine ?? 50;
      // Strategic bots leave jail early only when they have property to develop;
      // otherwise jail is a safe place to sit while opponents pay rent.
      const wantOut =
        prof.jailPay === 'afford' ? bot.money >= fine :
        prof.jailPay === 'strategic' ? (bot.money >= fine + prof.reserve && botHasMonopoly(state, botId)) :
        false;
      if (bot.jail_cards > 0 && (wantOut || prof.jailPay === 'strategic')) {
        return { type: 'use_jail_card', payload: { playerId: botId } };
      }
      if (wantOut) return { type: 'pay_jail_fine', payload: { playerId: botId } };
    }
    return { type: 'roll_dice', payload: { playerId: botId } };
  }

  if (phase === 'speed_bus' && isCurrentPlayer) {
    const choices = state.speed_die_choice || [];
    const maxMove = Math.max(...choices);
    return { type: 'choose_bus_route', payload: { playerId: botId, steps: maxMove } };
  }

  if (phase === 'payment' && isCurrentPlayer) {
    return { type: 'confirm_payment', payload: { playerId: botId } };
  }

  if (phase === 'buy_decision' && isCurrentPlayer) {
    const tileId = state.can_buy;
    const tile = TILES.find(t => t.id === tileId);
    const nw = calcNetWorth(state, botId);
    const grp = tile?.group;
    const completesGroup = grp && GROUPS[grp] &&
      GROUPS[grp].filter(sid => sid !== tileId).every(sid => state.owner[sid] === botId);
    // Railroads/utilities are reliably valuable; hard bots grab them readily.
    const strategicType = (tile?.type === 'railroad' || tile?.type === 'utility') && prof.maxHouses >= 4;
    const affordable = tile && bot.money - tile.price >= prof.reserve;
    const shouldBuy = affordable && (completesGroup || strategicType || tile.price <= nw * prof.buyNwFrac);
    return { type: shouldBuy ? 'buy_property' : 'decline_buy', payload: { playerId: botId } };
  }

  if (phase === 'auction' && state.auction) {
    const { active, turn_idx, current_bid } = state.auction;
    if (active[turn_idx] !== botId) return null;
    const tile = TILES.find(t => t.id === state.auction.tile);
    const grp = tile?.group;
    const completesGroup = grp && GROUPS[grp] &&
      GROUPS[grp].filter(sid => sid !== state.auction.tile).every(sid => state.owner[sid] === botId);
    const valueFrac = completesGroup ? prof.auctionFrac + 0.3 : prof.auctionFrac;
    const maxWilling = tile ? Math.min(bot.money - Math.floor(prof.reserve / 2), Math.floor(tile.price * valueFrac)) : 0;
    if (current_bid + prof.bidStep <= maxWilling) {
      return { type: 'auction_bid', payload: { playerId: botId, amount: current_bid + prof.bidStep } };
    }
    return { type: 'auction_pass', payload: { playerId: botId } };
  }

  if (phase === 'debt' && state.debtor_id === botId) {
    // Raise cash least-painfully: sell houses, then mortgage, then bankruptcy.
    for (const propId of bot.properties) {
      if ((state.houses[propId] || 0) > 0) {
        return { type: 'sell_house', payload: { playerId: botId, tileId: propId } };
      }
    }
    for (const propId of bot.properties) {
      if (!state.mortgaged.includes(propId)) {
        return { type: 'mortgage', payload: { playerId: botId, tileId: propId } };
      }
    }
    return { type: 'declare_bankruptcy', payload: { playerId: botId } };
  }

  if (phase === 'post_roll' && isCurrentPlayer) {
    const nw = calcNetWorth(state, botId);
    if (nw > prof.buildMinNw) {
      // Build on the lowest-developed property of an owned group first (keeps even-build),
      // up to this profile's cap, while preserving a cash reserve.
      let bestTile = null, bestH = 99;
      for (const propId of bot.properties) {
        const tile = TILES.find(t => t.id === propId);
        if (!tile || tile.type !== 'property' || state.mortgaged.includes(propId)) continue;
        const grp = tile.group;
        if (!GROUPS[grp]?.every(sid => state.owner[sid] === botId && !state.mortgaged.includes(sid))) continue;
        const currH = state.houses[propId] || 0;
        if (currH >= prof.maxHouses) continue;
        if (bot.money - tile.houseCost < prof.reserve) continue;
        if (bot.money < tile.houseCost * prof.buildCostMult) continue;
        if (currH < bestH) { bestH = currH; bestTile = propId; }
      }
      if (bestTile !== null) return { type: 'build_house', payload: { playerId: botId, tileId: bestTile } };
    }
    return { type: 'end_turn', payload: { playerId: botId } };
  }

  return null;
}

// ── Main action dispatcher ────────────────────────────────────────────────────
export function applyAction(state, action) {
  const { type, payload } = action;
  switch (type) {
    case 'add_player':          return addPlayer(state, payload);
    case 'start_game':          return startGame(state, payload);
    case 'roll_dice':           return rollDice(state, payload);
    case 'choose_bus_route':    return chooseBusRoute(state, payload);
    case 'buy_property':        return buyProperty(state, payload);
    case 'confirm_payment':     return confirmPayment(state, payload);
    case 'decline_buy':         return declineBuy(state, payload);
    case 'auction_bid':         return auctionBid(state, payload);
    case 'auction_pass':        return auctionPass(state, payload);
    case 'pay_jail_fine':       return payJailFine(state, payload);
    case 'use_jail_card':       return redeemJailCard(state, payload);
    case 'build_house':         return buildHouse(state, payload);
    case 'sell_house':          return sellHouse(state, payload);
    case 'mortgage':            return mortgageProperty(state, payload);
    case 'unmortgage':          return unmortgageProperty(state, payload);
    case 'declare_bankruptcy':  return declareBankruptcy(state, payload);
    case 'end_turn':            return endTurn(state, payload);
    case 'propose_trade':       return proposeTrade(state, payload);
    case 'respond_trade':       return respondTrade(state, payload);
    case 'cancel_trade':        return cancelTrade(state, payload);
    case 'chat': {
      const s = deepClone(state);
      const entry = { name: payload.name, text: payload.text, color: payload.color || null, ts: Date.now() };
      s.chat_log = [...(s.chat_log || []), entry];
      if (s.chat_log.length > 100) s.chat_log = s.chat_log.slice(-100);
      return { state: s };
    }
    default: return { state, error: `Unknown action: ${type}` };
  }
}

export function forceEndGame(state) {
  const s = deepClone(state);
  const active = s.players.filter(p => !p.bankrupt);
  const ranked = active.sort((a, b) => calcNetWorth(s, b.id) - calcNetWorth(s, a.id));
  const winner = ranked[0] ?? s.players[0];
  s.phase = 'game_over';
  s.winner = winner.id;
  addLog(s, `HOST ENDED GAME. ${winner.name} wins with net worth $${calcNetWorth(s, winner.id)}!`);
  return s;
}
