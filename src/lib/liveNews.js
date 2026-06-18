import { TILES } from "../boardData";

const tileName = (id) => TILES.find((t) => t.id === id)?.name || "";
// Tag bots clearly so it's always obvious when the CPU is acting vs. you.
const tag = (p) => (p ? (p.is_bot ? `${p.name} (CPU)` : p.name) : "—");

/* One descriptive line of "live news" for the board centre / 3D overlay.
   Bot turns are narrated ("Aria (CPU) is sizing up Mayfair"); your turns are
   phrased as actionable prompts ("buy it for $X?"). Resting phases surface the
   most recent log event. */
export function liveNewsLine(s, busy) {
  if (!s) return "";
  const curId = s.order?.[s.current];
  const cur = s.players?.find((p) => p.id === curId);
  const isBot = !!cur?.is_bot;
  const name = tag(cur);
  const latest = (s.log || []).slice(-1)[0];

  if (busy) return isBot ? `${name} is rolling…` : `${name} is rolling the dice…`;

  if (s.winner != null || s.phase === "game_over") {
    const w = s.players?.find((p) => p.id === s.winner);
    return `${tag(w) === "—" ? "Someone" : tag(w)} wins the game!`;
  }
  if (s.pending_trade) {
    const f = s.players?.find((p) => p.id === s.pending_trade.from);
    const t = s.players?.find((p) => p.id === s.pending_trade.to);
    return `${tag(f)} offered a trade to ${tag(t)}`;
  }

  switch (s.phase) {
    case "buy_decision": {
      const tile = TILES.find((t) => t.id === s.can_buy);
      const price = `$${tile?.price?.toLocaleString()}`;
      return isBot
        ? `${name} is deciding on ${tile?.name} (${price})…`
        : `${name} landed on ${tile?.name} — buy it for ${price}?`;
    }
    case "payment": {
      const pp = s.pending_payment;
      const to = pp?.toPid ? tag(s.players?.find((p) => p.id === pp.toPid)) : "the Bank";
      return `${name} owes $${(pp?.amount || 0).toLocaleString()} to ${to}${pp?.reason ? ` (${pp.reason})` : ""}`;
    }
    case "auction": {
      const a = s.auction;
      const tile = TILES.find((t) => t.id === a?.tile);
      const bidder = a?.current_bidder ? tag(s.players?.find((p) => p.id === a.current_bidder)) : null;
      const onClock = a?.active?.[a?.turn_idx] ? tag(s.players?.find((p) => p.id === a.active[a.turn_idx])) : null;
      const head = bidder ? `high bid $${a.current_bid} by ${bidder}` : "no bids yet";
      return `Auction — ${tile?.name}: ${head}${onClock ? ` · ${onClock} to act` : ""}`;
    }
    case "debt": {
      const d = s.players?.find((p) => p.id === s.debtor_id);
      return `${tag(d)} must raise $${Math.max(0, -(d?.money || 0)).toLocaleString()} or go bankrupt`;
    }
    case "speed_bus":
      return isBot ? `${name} is taking the Bus…` : `${name} caught the Bus — choose how far to ride`;
    case "post_roll":
    case "turn":
    default:
      // Doubles take priority — make the bonus roll (and the 3-in-a-row danger)
      // obvious so the mechanic clearly reads on the board.
      if (s.phase === "post_roll" && s.extra_roll) {
        return s.doubles_streak === 2
          ? `Doubles #2! ${name} rolls again — a 3rd sends you to JAIL`
          : `Doubles #1! ${name} rolls again`;
      }
      // Prefer the freshest event; fall back to a turn/jail prompt.
      if (latest) return latest;
      if (cur?.in_jail) return `${name} is in Jail — roll doubles or pay to get out`;
      if (s.phase === "post_roll") return `${name} is on ${tileName(cur?.position)} — ${isBot ? "wrapping up…" : "build or end turn"}`;
      return isBot ? `${name}'s turn…` : `${name}'s turn — ready to roll`;
  }
}
