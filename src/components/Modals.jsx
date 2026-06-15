import { TILES, GROUPS, GROUP_COLORS, TOKEN_COLORS } from "../boardData";
import { playClick } from "../lib/audio";
import { CloseIcon, HouseIcon, HotelIcon, UtilityIcon, RailroadIcon } from "../lib/icons";
import { calcNetWorth } from "../lib/gameEngine";

/* 1. Property Details Inspect Modal */
export function PropertyDetailModal({ tileId, gameState, onClose }) {
  const tile = TILES.find(t => t.id === tileId);
  if (!tile) return null;

  const ownerId = gameState?.owner?.[tileId.toString()];
  const isMortgaged = gameState?.mortgaged?.includes(tileId);
  const houseCount = gameState?.houses?.[tileId.toString()] || 0;
  const ownerObj = ownerId !== undefined ? gameState.players.find(p => p.id === ownerId) : null;

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="glass-card w-full max-w-sm p-5 border animate-scale-up text-left" 
        onClick={e => e.stopPropagation()}
        style={{ borderColor: tile.group && GROUP_COLORS[tile.group] ? GROUP_COLORS[tile.group] : "rgba(56, 189, 248, 0.3)" }}
      >
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-900">
          <span className="font-mono text-[9px] text-slate-500 uppercase">INSPECT TILE</span>
          <button 
            className="btn-retro px-2 py-0.5 bg-slate-950 text-[9px]"
            onClick={onClose}
          >
            <CloseIcon size={10} className="mr-1" /> CLOSE
          </button>
        </div>

        {/* Header band for colored properties */}
        {tile.group && tile.group !== "railroad" && tile.group !== "utility" && (
          <div 
            className="p-3 rounded mb-4 text-center font-mono font-bold text-xs shadow"
            style={{ backgroundColor: GROUP_COLORS[tile.group], color: "#000" }}
          >
            {tile.name.toUpperCase()}
          </div>
        )}

        {!tile.group && (
          <h3 className="font-mono text-sm text-sky-400 font-bold mb-4 uppercase">
            {tile.name}
          </h3>
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

          {/* Rents display */}
          {tile.type === "property" && tile.rent && (
            <div className="mt-2">
              <div className="text-amber-500 font-bold text-[9px] mb-2 uppercase tracking-wide">
                Rent Schedule:
              </div>
              <div className="flex flex-col gap-1.5 bg-black/30 p-2 rounded border border-slate-950">
                <div className="flex justify-between items-center">
                  <span>Base Rent (Unimproved):</span>
                  <span>${tile.rent[0]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><HouseIcon size={8} color="#10B981" /> 1 House:</span>
                  <span>${tile.rent[1]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><HouseIcon size={8} color="#10B981" /> 2 Houses:</span>
                  <span>${tile.rent[2]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><HouseIcon size={8} color="#10B981" /> 3 Houses:</span>
                  <span>${tile.rent[3]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><HouseIcon size={8} color="#10B981" /> 4 Houses:</span>
                  <span>${tile.rent[4]}</span>
                </div>
                <div className="flex justify-between items-center text-green-400 font-bold">
                  <span className="flex items-center gap-1"><HotelIcon size={8} color="#EF4444" /> HOTEL:</span>
                  <span>${tile.rent[5]}</span>
                </div>
              </div>
              <div className="text-slate-500 text-[8px] mt-2 italic">
                House/Hotel Construction Cost: ${tile.houseCost} each
              </div>
            </div>
          )}

          {tile.type === "railroad" && (
            <div className="mt-2">
              <div className="text-amber-500 font-bold text-[9px] mb-2 uppercase tracking-wide">
                Railroad Rent Scale:
              </div>
              <div className="flex flex-col gap-1 bg-black/30 p-2 rounded border border-slate-950">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><RailroadIcon size={10} /> 1 Railroad owned:</span>
                  <span>$25</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><RailroadIcon size={10} /> 2 Railroads owned:</span>
                  <span>$50</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><RailroadIcon size={10} /> 3 Railroads owned:</span>
                  <span>$100</span>
                </div>
                <div className="flex justify-between items-center font-bold text-green-400">
                  <span className="flex items-center gap-1"><RailroadIcon size={10} /> 4 Railroads owned:</span>
                  <span>$200</span>
                </div>
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
                {ownerObj ? (
                  <span style={{ color: TOKEN_COLORS[ownerObj.token] }}>{ownerObj.name}</span>
                ) : (
                  <span className="text-slate-500">None (Bank)</span>
                )}
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
    </div>
  );
}

/* 2. Portfolio & Asset Management Modal */
export function ManageModal({ gameState, myPlayerId, onAction, onClose }) {
  if (!gameState) return null;
  const p = gameState.players.find(x => x.id === myPlayerId);
  const myProps = p?.properties || [];

  const housesMap = gameState.houses || {};
  const mortgagedList = gameState.mortgaged || [];

  const netWorth = calcNetWorth(gameState, myPlayerId);
  const cashVal = p?.money || 0;
  const propVal = netWorth - cashVal;

  const handleManagementAction = (action, tid) => {
    playClick();
    onAction(action, { tileId: tid });
  };

  /* group properties by color group */
  const grouped = {};
  const ungrouped = [];
  for (const tid of myProps) {
    const tile = TILES.find(t => t.id === tid);
    if (!tile) continue;
    if (tile.group && tile.group !== "railroad" && tile.group !== "utility") {
      if (!grouped[tile.group]) grouped[tile.group] = [];
      grouped[tile.group].push(tid);
    } else {
      ungrouped.push(tid);
    }
  }

  const S = {
    overlay: {
      position: "fixed", inset: 0, zIndex: 8000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.88)", backdropFilter: "blur(2px)",
      padding: "12px",
    },
    panel: {
      width: "100%", maxWidth: "560px",
      background: "#050810",
      border: "2px solid rgba(255,179,0,0.25)",
      display: "flex", flexDirection: "column",
      maxHeight: "88vh",
      boxShadow: "0 0 40px rgba(0,0,0,0.9)",
    },
    header: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 14px",
      borderBottom: "1px solid rgba(255,179,0,0.2)",
      background: "rgba(255,179,0,0.06)",
    },
    title: {
      fontFamily: "var(--font-retro)", fontSize: "10px", color: "#FFB300",
      letterSpacing: "0.12em", fontWeight: "bold",
    },
    closeBtn: {
      fontFamily: "var(--font-retro)", fontSize: "8px", background: "transparent",
      border: "1px solid rgba(255,179,0,0.2)", color: "#64748b",
      padding: "4px 10px", cursor: "pointer",
    },
    netWorthBar: {
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      flexShrink: 0,
    },
    nwCell: () => ({
      padding: "8px 14px", borderRight: "1px solid rgba(255,255,255,0.05)",
      display: "flex", flexDirection: "column", gap: "2px",
    }),
    nwLabel: { fontFamily: "var(--font-retro)", fontSize: "6px", color: "#334155", letterSpacing: "0.15em" },
    nwValue: (color) => ({ fontFamily: "var(--font-retro)", fontSize: "13px", fontWeight: "bold", color }),
    scroll: { flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" },
    groupHeader: (color) => ({
      display: "flex", alignItems: "center", gap: "6px",
      padding: "4px 0 4px 0",
      borderBottom: `1px solid ${color}50`,
      marginBottom: "4px",
    }),
    groupSwatch: (color) => ({
      width: "12px", height: "12px", background: color, flexShrink: 0,
    }),
    groupLabel: { fontFamily: "var(--font-retro)", fontSize: "8px", color: "#94a3b8", letterSpacing: "0.1em" },
    deedCard: (leftColor, mortgaged) => ({
      display: "flex", alignItems: "stretch", gap: 0,
      border: `1px solid ${mortgaged ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.06)"}`,
      background: mortgaged ? "rgba(69,10,10,0.15)" : "rgba(0,0,0,0.3)",
      overflow: "hidden",
    }),
    deedLeft: (color, mortgaged) => ({
      width: "4px", background: mortgaged ? "#ef4444" : color, flexShrink: 0,
    }),
    deedBody: {
      flex: 1, padding: "7px 10px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
    },
    deedInfo: { display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 },
    deedName: { fontFamily: "var(--font-retro)", fontSize: "9px", fontWeight: "bold", color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    houseDots: { display: "flex", gap: "2px", alignItems: "center" },
    deedStatus: (mortgaged) => ({
      fontFamily: "var(--font-retro)", fontSize: "7px",
      color: mortgaged ? "#ef4444" : "#334155",
      fontWeight: mortgaged ? "bold" : "normal",
    }),
    actionRow: { display: "flex", gap: "4px", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" },
    actionBtn: (variant, disabled) => {
      const base = {
        fontFamily: "var(--font-retro)", fontSize: "8px", padding: "5px 9px",
        background: "rgba(0,0,0,0.4)", cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", gap: "3px", opacity: disabled ? 0.35 : 1,
        border: "1px solid transparent",
      };
      if (variant === "green") { base.border = "1px solid rgba(52,211,153,0.4)"; base.color = "#34d399"; }
      if (variant === "amber") { base.border = "1px solid rgba(251,191,36,0.3)"; base.color = "#fbbf24"; }
      if (variant === "red")   { base.border = "1px solid rgba(239,68,68,0.35)"; base.color = "#f87171"; }
      return base;
    },
  };

  const renderDeed = (tid) => {
    const tile = TILES.find(t => t.id === tid);
    if (!tile) return null;
    const isMortgaged = mortgagedList.includes(tid);
    const houses = housesMap[tid.toString()] || 0;
    const hasColorGroup = tile.group && tile.group !== "railroad" && tile.group !== "utility";
    const groupColor = hasColorGroup ? GROUP_COLORS[tile.group] : tile.group === "railroad" ? "#94a3b8" : "#38bdf8";
    const ownsAll = hasColorGroup
      ? GROUPS[tile.group].every(sid => gameState.owner[sid.toString()] === myPlayerId)
      : false;
    const canBuild = ownsAll && !isMortgaged && houses < 5 && p.money >= (tile.houseCost || 0);
    const canSell = houses > 0;
    const hasImprovementsInGroup = hasColorGroup
      ? GROUPS[tile.group].some(sid => (housesMap[sid.toString()] || 0) > 0)
      : false;
    const canMortgage = !isMortgaged && !hasImprovementsInGroup;
    const canUnmortgage = isMortgaged && p.money >= Math.round((tile.mortgage || 0) * 1.1);

    return (
      <div key={tid} style={S.deedCard(groupColor, isMortgaged)}>
        <div style={S.deedLeft(groupColor, isMortgaged)} />
        <div style={S.deedBody}>
          <div style={S.deedInfo}>
            <span style={S.deedName}>{tile.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={S.deedStatus(isMortgaged)}>
                {isMortgaged ? "MORTGAGED" : houses === 0 ? "UNIMPROVED" : ""}
              </span>
              {!isMortgaged && houses > 0 && (
                <div style={S.houseDots}>
                  {houses === 5 ? (
                    <HotelIcon size={9} color="#EF4444" />
                  ) : (
                    Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} style={{
                        width: "7px", height: "7px",
                        background: i < houses ? "#10b981" : "rgba(255,255,255,0.07)",
                        flexShrink: 0,
                      }} />
                    ))
                  )}
                </div>
              )}
              {tile.price && (
                <span style={{ fontFamily: "var(--font-retro)", fontSize: "7px", color: "#1e293b" }}>
                  ${tile.price}
                </span>
              )}
            </div>
          </div>
          <div style={S.actionRow}>
            {hasColorGroup && ownsAll && !isMortgaged && (
              <>
                <button style={S.actionBtn("green", !canBuild)} disabled={!canBuild} onClick={() => handleManagementAction("build_house", tid)}
                  title={`+HOUSE $${tile.houseCost}`}>
                  <HouseIcon size={8} color="currentColor" /> +HOUSE
                </button>
                <button style={S.actionBtn("amber", !canSell)} disabled={!canSell} onClick={() => handleManagementAction("sell_house", tid)}
                  title={`-HOUSE +$${Math.round((tile.houseCost || 0) * 0.5)}`}>
                  <HouseIcon size={8} color="currentColor" /> -HOUSE
                </button>
              </>
            )}
            {!isMortgaged ? (
              <button style={S.actionBtn("red", !canMortgage)} disabled={!canMortgage} onClick={() => handleManagementAction("mortgage", tid)}
                title={`MORTGAGE +$${tile.mortgage}`}>
                MRTG
              </button>
            ) : (
              <button style={S.actionBtn("green", !canUnmortgage)} disabled={!canUnmortgage} onClick={() => handleManagementAction("unmortgage", tid)}
                title={`REDEEM $${Math.round((tile.mortgage || 0) * 1.1)}`}>
                REDEEM
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <span style={S.title}>PORTFOLIO</span>
          <button style={S.closeBtn} onClick={onClose}>✕ CLOSE</button>
        </div>

        {/* Net worth breakdown */}
        <div style={S.netWorthBar}>
          <div style={S.nwCell()}>
            <span style={S.nwLabel}>NET WORTH</span>
            <span style={S.nwValue("#FFB300")}>${netWorth.toLocaleString()}</span>
          </div>
          <div style={S.nwCell()}>
            <span style={S.nwLabel}>CASH</span>
            <span style={S.nwValue("#34d399")}>${cashVal.toLocaleString()}</span>
          </div>
          <div style={S.nwCell()}>
            <span style={S.nwLabel}>PROPERTY</span>
            <span style={S.nwValue("#38bdf8")}>${propVal.toLocaleString()}</span>
          </div>
        </div>

        {/* Property list */}
        <div style={S.scroll}>
          {myProps.length === 0 ? (
            <div style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#334155", textAlign: "center", padding: "32px 0" }}>
              NO TITLE DEEDS — BUY PROPERTIES TO POPULATE PORTFOLIO
            </div>
          ) : (
            <>
              {Object.entries(grouped).map(([group, tids]) => (
                <div key={group}>
                  <div style={S.groupHeader(GROUP_COLORS[group])}>
                    <div style={S.groupSwatch(GROUP_COLORS[group])} />
                    <span style={S.groupLabel}>{group.toUpperCase()}</span>
                    {GROUPS[group] && tids.length === GROUPS[group].length && (
                      <span style={{ fontFamily: "var(--font-retro)", fontSize: "6px", color: "#34d399", marginLeft: "auto", letterSpacing: "0.1em" }}>★ MONOPOLY</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", paddingLeft: "4px" }}>
                    {tids.map(renderDeed)}
                  </div>
                </div>
              ))}
              {ungrouped.length > 0 && (
                <div>
                  <div style={{ ...S.groupHeader("#94a3b8"), borderColor: "rgba(148,163,184,0.3)" }}>
                    <span style={S.groupLabel}>RAILROADS & UTILITIES</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", paddingLeft: "4px" }}>
                    {ungrouped.map(renderDeed)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
