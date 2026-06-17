import { TILES } from "../boardData";

const tileName = (id) => TILES.find((t) => t.id === id)?.name || "";

/* One descriptive line of "live news" for the board centre / 3D overlay.
   Actionable phases get a prompt ("X can buy Y for $Z", "X owes rent…");
   resting phases surface the most recent event from the log ("X bought Y",
   "X rolled 4 and 3", "X drew Chance: …"). */
export function liveNewsLine(s, busy) {
  if (!s) return "";
  const curId = s.order?.[s.current];
  const cur = s.players?.find((p) => p.id === curId);
  const name = cur?.name || "—";
  const latest = (s.log || []).slice(-1)[0];

  if (busy) return `${name} is rolling the dice…`;

  if (s.winner != null || s.phase === "game_over") {
    const w = s.players?.find((p) => p.id === s.winner);
    return `${w?.name || "Someone"} wins the game!`;
  }
  if (s.pending_trade) {
    const f = s.players?.find((p) => p.id === s.pending_trade.from);
    const t = s.players?.find((p) => p.id === s.pending_trade.to);
    return `${f?.name || "?"} offered a trade to ${t?.name || "?"}`;
  }

  switch (s.phase) {
    case "buy_decision": {
      const tile = TILES.find((t) => t.id === s.can_buy);
      return `${name} landed on ${tile?.name} — buy it for $${tile?.price?.toLocaleString()}?`;
    }
    case "payment": {
      const pp = s.pending_payment;
      const to = pp?.toPid ? s.players?.find((p) => p.id === pp.toPid)?.name : "the Bank";
      return `${name} owes $${(pp?.amount || 0).toLocaleString()} to ${to}${pp?.reason ? ` (${pp.reason})` : ""}`;
    }
    case "auction": {
      const a = s.auction;
      const tile = TILES.find((t) => t.id === a?.tile);
      const bidder = a?.current_bidder ? s.players?.find((p) => p.id === a.current_bidder)?.name : null;
      return `Auction — ${tile?.name}: ${bidder ? `high bid $${a.current_bid} by ${bidder}` : "no bids yet"}`;
    }
    case "debt": {
      const d = s.players?.find((p) => p.id === s.debtor_id);
      return `${d?.name} must raise $${Math.max(0, -(d?.money || 0)).toLocaleString()} or go bankrupt`;
    }
    case "speed_bus":
      return `${name} caught the Bus — choose how far to ride`;
    case "post_roll":
    case "turn":
    default:
      // Prefer the freshest event; fall back to a turn/jail prompt.
      if (latest) return latest;
      if (cur?.in_jail) return `${name} is in Jail — roll doubles or pay to get out`;
      if (s.phase === "post_roll") return `${name} is on ${tileName(cur?.position)} — build or end turn`;
      return `${name}'s turn — ready to roll`;
  }
}
