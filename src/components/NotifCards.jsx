import { GROUP_COLORS, GROUPS, TOKEN_COLORS } from "../boardData";

/* Tan "board card" notifications shared by the 2D and 3D boards so both speak
   the same design language. Pure DOM — no three.js — safe to import anywhere. */

const GROUP_LABEL = {
  brown: "Brown", light_blue: "Light Blue", pink: "Pink", orange: "Orange",
  red: "Red", yellow: "Yellow", green: "Green", dark_blue: "Dark Blue",
};
const RAIL_RENT = [25, 50, 100, 200];

const LAND_DESC = {
  go: "Collect $200 salary.",
  tax: null,
  chance: "Draw a Chance card.",
  community_chest: "Draw a Community Chest card.",
  jail: "Just visiting — no effect.",
  free_parking: "Free rest — nothing happens.",
  go_to_jail: "Go directly to Jail!",
};

function bandColor(tile) {
  if (tile.group && GROUP_COLORS[tile.group]) return GROUP_COLORS[tile.group];
  if (tile.type === "railroad") return "#cbd5e1";
  if (tile.type === "utility") return "#94a3b8";
  if (tile.type === "chance") return "#fbbf24";
  if (tile.type === "community_chest") return "#38bdf8";
  if (tile.type === "go") return "#10B981";
  if (tile.type === "go_to_jail") return "#EF4444";
  if (tile.type === "free_parking") return "#38bdf8";
  if (tile.type === "tax") return "#64748b";
  return null;
}
const tokenColor = (p) => p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#38bdf8";

const SHELL = {
  position: "absolute", bottom: "14px", left: "14px",
  width: "min(300px, 78%)", pointerEvents: "none", zIndex: 7,
  background: "#e6dcc2", color: "#1f2430", borderRadius: "9px", overflow: "hidden",
  border: "1px solid rgba(0,0,0,0.25)", boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
  fontFamily: "var(--font-retro)",
};

export function LandingCard({ tile, gameState }) {
  const band = bandColor(tile);
  const ownerId = gameState?.owner?.[tile.id.toString()];
  const ownerObj = ownerId !== undefined ? gameState.players?.find((p) => p.id === ownerId) : null;
  const ownerCol = ownerObj ? tokenColor(ownerObj) : null;
  const mortgaged = gameState?.mortgaged?.includes(tile.id);
  const houses = gameState?.houses?.[tile.id.toString()] || 0;
  const ownsGroup = ownerId !== undefined && GROUPS[tile.group]?.every((sid) => gameState.owner[sid.toString()] === ownerId);

  // Detailed rent ladder, with the level that's currently in force highlighted.
  const rows = [];
  if (tile.type === "property") {
    rows.push(["Base rent", tile.rent[0], houses === 0 && !ownsGroup]);
    rows.push(["Full set ×2", tile.rent[0] * 2, houses === 0 && ownsGroup]);
    rows.push(["1 house", tile.rent[1], houses === 1]);
    rows.push(["2 houses", tile.rent[2], houses === 2]);
    rows.push(["3 houses", tile.rent[3], houses === 3]);
    rows.push(["4 houses", tile.rent[4], houses === 4]);
    rows.push(["Hotel", tile.rent[5], houses === 5]);
  } else if (tile.type === "railroad") {
    RAIL_RENT.forEach((r, i) => rows.push([`${i + 1} station${i ? "s" : ""}`, r, false]));
  } else if (tile.type === "utility") {
    rows.push(["1 owned", "4× dice", false]);
    rows.push(["Both owned", "10× dice", false]);
  }

  const groupLabel = GROUP_LABEL[tile.group] || (tile.type === "railroad" ? "Station" : tile.type === "utility" ? "Utility" : null);
  const desc = tile.type === "tax" ? `Pay $${tile.price}${tile.id === 4 ? " (or 10% of net worth)" : ""}.` : LAND_DESC[tile.type];

  return (
    <div style={SHELL} className="animate-scale-up">
      {band && <div style={{ height: "8px", background: band }} />}
      <div style={{ padding: "10px 13px 12px" }}>
        <div style={{ fontSize: "9px", letterSpacing: "0.18em", color: "#7c6f4f", fontWeight: "bold" }}>YOU LANDED ON</div>
        <div style={{ fontSize: "17px", fontWeight: "bold", margin: "1px 0 5px", lineHeight: 1.1 }}>{tile.name}</div>

        <div style={{ display: "flex", gap: "9px", flexWrap: "wrap", fontSize: "11px", color: "#5c5232", marginBottom: rows.length ? "7px" : "0" }}>
          {groupLabel && <span><b style={{ color: "#43391f" }}>{groupLabel}</b></span>}
          {tile.price != null && <span>Price <b style={{ color: "#0f766e" }}>${tile.price.toLocaleString()}</b></span>}
          {tile.mortgage != null && <span>Mortgage <b style={{ color: "#43391f" }}>${tile.mortgage}</b></span>}
          {tile.houseCost != null && <span>House <b style={{ color: "#43391f" }}>${tile.houseCost}</b></span>}
        </div>

        {rows.length > 0 && (
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.12)", paddingTop: "5px" }}>
            {rows.map(([label, val, on], i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "1.5px 4px",
                borderRadius: "3px", background: on ? "rgba(15,118,110,0.16)" : "transparent",
                color: on ? "#0f5e57" : "#3a3320", fontWeight: on ? "bold" : "normal",
              }}>
                <span>{label}</span>
                <span>{typeof val === "number" ? `$${val.toLocaleString()}` : val}</span>
              </div>
            ))}
          </div>
        )}

        {desc && <div style={{ fontSize: "11px", color: "#3a3320", marginTop: "6px" }}>{desc}</div>}
        <div style={{ fontSize: "11px", marginTop: "6px", color: mortgaged ? "#b91c1c" : "#43391f", fontWeight: "bold" }}>
          {mortgaged ? "⚑ Mortgaged — no rent"
            : ownerObj ? <>Owned by <span style={{ color: ownerCol }}>{ownerObj.name}</span>{ownsGroup ? " · full set" : ""}</>
            : tile.price != null ? "Unowned — available to buy" : ""}
        </div>
      </div>
    </div>
  );
}

/* Chance / Community-Chest card — same bottom-left slot, so all draws read from
   one consistent place. */
export function CardNotif({ card }) {
  const accent = card.isChance ? "#f59e0b" : "#38bdf8";
  return (
    <div style={SHELL} className="animate-scale-up">
      <div style={{ height: "8px", background: accent }} />
      <div style={{ padding: "10px 13px 12px" }}>
        <div style={{ fontSize: "10px", letterSpacing: "0.18em", fontWeight: "bold", color: card.isChance ? "#b45309" : "#0369a1" }}>
          {card.isChance ? "✦ CHANCE" : "✦ COMMUNITY CHEST"}
        </div>
        <div style={{ fontSize: "13px", color: "#3a3320", marginTop: "6px", lineHeight: 1.4 }}>{card.text}</div>
      </div>
    </div>
  );
}
