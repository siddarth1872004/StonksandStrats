import { TILES, GROUPS, GROUP_COLORS, TOKEN_COLORS } from "../boardData";
import { HouseIcon, HotelIcon, UtilityIcon, RailroadIcon } from "../lib/icons";

const RAILROAD_IDS = [5, 15, 25, 35];
const UTILITY_IDS = [12, 28];

// Plain-English explanations for non-deed squares so every tile is informative.
const SPECIAL_INFO = {
  go: { color: "#34d399", text: "Collect $200 salary as you pass or land here. The starting square of the board." },
  tax: { color: "#f87171", text: null }, // handled inline (uses tile.price)
  chance: { color: "#fbbf24", text: "Draw a Chance card — movement, cash swings, repairs, or a Get Out of Jail Free card." },
  community_chest: { color: "#38bdf8", text: "Draw a Community Chest card — usually bank payouts, fees, or a Get Out of Jail Free card." },
  jail: { color: "#F59E0B", text: "Just visiting? No effect. Sent here? Roll doubles, pay $50, or use a Get Out of Jail Free card to leave." },
  free_parking: { color: "#fbbf24", text: "A safe resting square. No rent, no fee — unless a house rule puts a cash pot here." },
  go_to_jail: { color: "#ef4444", text: "Go directly to Jail. Do not pass GO, do not collect $200." },
};

// Rent that would currently be owed if an opponent landed here.
function computeLiveRent(tile, gameState) {
  const owner = gameState?.owner?.[tile.id.toString()];
  if (owner === undefined) return null;
  if (gameState?.mortgaged?.includes(tile.id)) return { amount: 0, note: "Mortgaged — no rent collected" };
  const houses = gameState?.houses?.[tile.id.toString()] || 0;

  if (tile.type === "property") {
    if (houses > 0) return { amount: tile.rent[houses], note: houses === 5 ? "with a Hotel" : `with ${houses} house${houses > 1 ? "s" : ""}` };
    const ownsGroup = GROUPS[tile.group]?.every(sid => gameState.owner[sid.toString()] === owner);
    if (ownsGroup) return { amount: tile.rent[0] * 2, note: "Monopoly — base rent doubled" };
    return { amount: tile.rent[0], note: "Base rent (unimproved)" };
  }
  if (tile.type === "railroad") {
    const count = RAILROAD_IDS.filter(id => gameState.owner[id.toString()] === owner).length;
    return { amount: 25 * Math.pow(2, Math.max(0, count - 1)), note: `${count} railroad${count > 1 ? "s" : ""} owned` };
  }
  if (tile.type === "utility") {
    const count = UTILITY_IDS.filter(id => gameState.owner[id.toString()] === owner).length;
    const mult = count === 2 ? 10 : 4;
    return { amount: null, note: `${mult}× dice roll (${count} utilit${count > 1 ? "ies" : "y"} owned)` };
  }
  return null;
}

// Full tile information body (no overlay). Shared by the inspect modal and the
// board-center landing card so landing shows exactly what clicking the tile does.
export function TileDetails({ tileId, gameState }) {
  const tile = TILES.find(t => t.id === tileId);
  if (!tile) return null;

  const ownerId = gameState?.owner?.[tileId.toString()];
  const isMortgaged = gameState?.mortgaged?.includes(tileId);
  const houseCount = gameState?.houses?.[tileId.toString()] || 0;
  const ownerObj = ownerId !== undefined ? gameState.players.find(p => p.id === ownerId) : null;
  const ownerColor = ownerObj ? (ownerObj.token_color || TOKEN_COLORS[ownerObj.token_shape || ownerObj.token]) : null;

  const liveRent = gameState ? computeLiveRent(tile, gameState) : null;
  const ownsGroup = tile.type === "property" && ownerId !== undefined
    && GROUPS[tile.group]?.every(sid => gameState.owner[sid.toString()] === ownerId);
  const occupants = (gameState?.players || []).filter(p => !p.bankrupt && p.position === tileId);
  const special = SPECIAL_INFO[tile.type];

  return (
    <div className="text-left">
      {/* Header band for colored properties */}
      {tile.group && tile.group !== "railroad" && tile.group !== "utility" && (
        <div className="p-3 rounded mb-4 text-center font-mono font-bold text-xs shadow"
          style={{ backgroundColor: GROUP_COLORS[tile.group], color: "#000" }}>
          {tile.name.toUpperCase()}
          {ownsGroup && <div className="text-[8px] mt-1">★ MONOPOLY</div>}
        </div>
      )}

      {(tile.type === "railroad" || tile.type === "utility") && (
        <h3 className="font-mono text-sm font-bold mb-4 uppercase" style={{ color: tile.type === "railroad" ? "#cbd5e1" : "#94a3b8" }}>
          {tile.type === "utility" && <UtilityIcon type={tile.id === 12 ? "electric" : "water"} size={14} color="#94a3b8" />}
          {tile.type === "railroad" && <RailroadIcon size={14} color="#cbd5e1" />} {tile.name}
        </h3>
      )}

      {!tile.group && (
        <h3 className="font-mono text-sm font-bold mb-2 uppercase" style={{ color: special?.color || "#38bdf8" }}>
          {tile.name}
        </h3>
      )}

      {/* Special (non-deed) tile description */}
      {!tile.price && special?.text && (
        <p className="font-mono text-[10px] leading-relaxed text-slate-300 bg-black/30 p-3 rounded border border-slate-950 mb-3">
          {special.text}
        </p>
      )}
      {tile.type === "tax" && (
        <div className="font-mono text-[10px] leading-relaxed text-slate-300 bg-black/30 p-3 rounded border border-slate-950 mb-3">
          Pay <strong className="text-red-400">${tile.price}</strong> to the bank
          {tile.id === 4 ? " (or 10% of total net worth, whichever the house rules use)" : ""}.
        </div>
      )}

      {/* LIVE rent due */}
      {liveRent && (
        <div className="mb-4 p-3 rounded border" style={{ borderColor: `${ownerColor || "#38bdf8"}55`, background: `${ownerColor || "#38bdf8"}10` }}>
          <div className="font-mono text-[8px] text-slate-400 uppercase tracking-wider mb-1">Rent Due Now</div>
          <div className="font-mono text-lg font-bold" style={{ color: liveRent.amount === 0 ? "#64748b" : "#34d399" }}>
            {liveRent.amount === null ? "Dice-based" : `$${liveRent.amount.toLocaleString()}`}
          </div>
          <div className="font-mono text-[8px] text-slate-500 mt-0.5">{liveRent.note}</div>
        </div>
      )}

      {/* Occupants */}
      {occupants.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[8px] text-slate-500 uppercase">Here now:</span>
          {occupants.map(p => {
            const col = p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#38bdf8";
            return (
              <span key={p.id} className="font-mono text-[9px] flex items-center gap-1" style={{ color: col }}>
                <span style={{ width: "8px", height: "8px", background: col, display: "inline-block", borderRadius: "50%" }} />
                {p.name}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 font-mono text-[10px] text-slate-300">
        {tile.price && (
          <div className="flex justify-between border-b border-slate-900 pb-1">
            <span className="text-slate-500">Purchase Price:</span>
            <span className="font-bold text-slate-200">${tile.price}</span>
          </div>
        )}
        {tile.mortgage && (
          <div className="flex justify-between border-b border-slate-900 pb-1">
            <span className="text-slate-500">Mortgage Value:</span>
            <span className="font-bold text-slate-200">${tile.mortgage}</span>
          </div>
        )}

        {tile.type === "property" && tile.rent && (
          <div className="mt-2">
            <div className="text-amber-500 font-bold text-[9px] mb-2 uppercase tracking-wide">Rent Schedule:</div>
            <div className="flex flex-col gap-1.5 bg-black/30 p-2 rounded border border-slate-950">
              <div className="flex justify-between items-center"><span>Base Rent (Unimproved):</span><span>${tile.rent[0]}</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1"><HouseIcon size={8} color="#10B981" /> 1 House:</span><span>${tile.rent[1]}</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1"><HouseIcon size={8} color="#10B981" /> 2 Houses:</span><span>${tile.rent[2]}</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1"><HouseIcon size={8} color="#10B981" /> 3 Houses:</span><span>${tile.rent[3]}</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1"><HouseIcon size={8} color="#10B981" /> 4 Houses:</span><span>${tile.rent[4]}</span></div>
              <div className="flex justify-between items-center text-green-400 font-bold"><span className="flex items-center gap-1"><HotelIcon size={8} color="#EF4444" /> HOTEL:</span><span>${tile.rent[5]}</span></div>
            </div>
            <div className="text-slate-500 text-[8px] mt-2 italic">House/Hotel Construction Cost: ${tile.houseCost} each</div>
          </div>
        )}

        {tile.type === "railroad" && (
          <div className="mt-2">
            <div className="text-amber-500 font-bold text-[9px] mb-2 uppercase tracking-wide">Railroad Rent Scale:</div>
            <div className="flex flex-col gap-1 bg-black/30 p-2 rounded border border-slate-950">
              <div className="flex justify-between items-center"><span className="flex items-center gap-1"><RailroadIcon size={10} /> 1 Station owned:</span><span>$25</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1"><RailroadIcon size={10} /> 2 Stations owned:</span><span>$50</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1"><RailroadIcon size={10} /> 3 Stations owned:</span><span>$100</span></div>
              <div className="flex justify-between items-center font-bold text-green-400"><span className="flex items-center gap-1"><RailroadIcon size={10} /> 4 Stations owned:</span><span>$200</span></div>
            </div>
          </div>
        )}

        {tile.type === "utility" && (
          <div className="mt-2">
            <div className="text-amber-500 font-bold text-[9px] mb-2 uppercase tracking-wide font-mono flex items-center gap-1">
              <UtilityIcon type="electric" size={10} /> Utility Rent Rule:
            </div>
            <p className="leading-relaxed bg-black/30 p-2.5 rounded border border-slate-950 text-slate-400 text-[9px]">
              If 1 Utility is owned: Rent is <strong className="text-green-400">4x</strong> the dice roll value.<br/>
              If 2 Utilities are owned: Rent is <strong className="text-green-400">10x</strong> the dice roll value.
            </p>
          </div>
        )}

        {/* Owner Details */}
        <div className="mt-4 pt-3 border-t border-slate-900">
          <div className="flex justify-between items-center mb-1">
            <span>CURRENT HOLDER:</span>
            <span className="font-bold">
              {ownerObj
                ? <span style={{ color: ownerColor || "#38bdf8" }}>{ownerObj.name}</span>
                : <span className="text-slate-500">None (Bank)</span>}
            </span>
          </div>
          {ownerObj && (
            <div className="flex justify-between items-center">
              <span>IMPROVEMENTS:</span>
              <span className="font-bold text-sky-400 uppercase">
                {isMortgaged ? "Mortgaged" : houseCount === 5 ? "Hotel" : houseCount > 0 ? `${houseCount} Houses` : "Unimproved"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
