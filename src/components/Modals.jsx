import React from "react";
import { TILES, GROUPS, GROUP_COLORS, TOKEN_COLORS } from "../boardData";
import { playClick } from "../lib/audio";
import { CloseIcon, HouseIcon, HotelIcon, ManageIcon, UtilityIcon, RailroadIcon, DollarIcon, BankruptcyIcon } from "../lib/icons";

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

  const handleManagementAction = (action, tid) => {
    playClick();
    onAction(action, { tile: tid });
  };

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="glass-card w-full max-w-lg p-5 border border-sky-500/30 animate-scale-up text-left flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-900 mb-4">
          <h2 className="font-mono text-[11px] text-sky-400 font-bold tracking-widest uppercase flex items-center gap-1.5">
            <ManageIcon size={12} /> ASSET PORTFOLIO MANAGEMENT
          </h2>
          <button 
            className="btn-retro px-2 py-0.5 bg-slate-950 text-[9px]"
            onClick={onClose}
          >
            <CloseIcon size={10} className="mr-1" /> CLOSE
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1.5 scrollbar">
          {myProps.length === 0 ? (
            <div className="font-mono text-[10px] text-slate-500 italic text-center py-8">
              No title deeds in your portfolio yet. Buy properties to develop them.
            </div>
          ) : (
            myProps.map(tid => {
              const tile = TILES.find(t => t.id === tid);
              if (!tile) return null;

              const isMortgaged = mortgagedList.includes(tid);
              const houses = housesMap[tid.toString()] || 0;
              const hasColorGroup = tile.group && tile.group !== "railroad" && tile.group !== "utility";

              // Check if player owns all properties in color group
              const ownsAllInGroup = hasColorGroup
                ? GROUPS[tile.group].every(sid => gameState.owner[sid.toString()] === myPlayerId)
                : false;

              // Houses build/sell criteria
              const canBuild = ownsAllInGroup && !isMortgaged && houses < 5 && p.money >= tile.houseCost;
              const canSell = houses > 0;
              
              // Mortgage criteria (cannot mortgage if color group has houses built)
              const hasImprovementsInGroup = hasColorGroup
                ? GROUPS[tile.group].some(sid => (housesMap[sid.toString()] || 0) > 0)
                : false;
              const canMortgage = !isMortgaged && !hasImprovementsInGroup;
              const canUnmortgage = isMortgaged && p.money >= Math.round(tile.mortgage * 1.1);

              return (
                <div 
                  key={tid}
                  className="bg-black/40 border border-slate-950 rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-[10px]"
                >
                  {/* Left part: Title & Status */}
                  <div className="flex flex-col gap-1 max-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      {hasColorGroup && (
                        <span 
                          className="w-2 h-2 rounded-sm inline-block" 
                          style={{ backgroundColor: GROUP_COLORS[tile.group] }}
                        />
                      )}
                      <span className="font-bold text-slate-200 truncate">{tile.name}</span>
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {isMortgaged ? (
                        <span className="text-red-500 font-bold">MORTGAGED</span>
                      ) : houses === 5 ? (
                        <span className="text-green-400 font-bold">HOTEL BUILT</span>
                      ) : houses > 0 ? (
                        <span className="text-green-400 font-bold">{houses} HOUSE(S)</span>
                      ) : (
                        <span>UNIMPROVED</span>
                      )}
                    </div>
                  </div>

                  {/* Right part: Action controls */}
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {/* Build House */}
                    {hasColorGroup && ownsAllInGroup && !isMortgaged && (
                      <>
                        <button
                          disabled={!canBuild}
                          onClick={() => handleManagementAction("build_house", tid)}
                          className="btn-retro btn-retro-green px-2 py-1 text-[9px]"
                          title={`Build House/Hotel: -$${tile.houseCost}`}
                        >
                          <HouseIcon size={8} color="currentColor" /> +HOUSE
                        </button>
                        <button
                          disabled={!canSell}
                          onClick={() => handleManagementAction("sell_house", tid)}
                          className="btn-retro btn-retro-amber px-2 py-1 text-[9px]"
                          title={`Sell House/Hotel: +$${Math.round(tile.houseCost * 0.5)}`}
                        >
                          <HouseIcon size={8} color="currentColor" /> -HOUSE
                        </button>
                      </>
                    )}
 
                    {/* Mortgage/Unmortgage */}
                    {!isMortgaged ? (
                      <button
                        disabled={!canMortgage}
                        onClick={() => handleManagementAction("mortgage", tid)}
                        className="btn-retro btn-retro-red px-2 py-1 text-[9px]"
                        title={`Mortgage for +$${tile.mortgage}`}
                      >
                        <BankruptcyIcon size={10} color="currentColor" /> MORTGAGE
                      </button>
                    ) : (
                      <button
                        disabled={!canUnmortgage}
                        onClick={() => handleManagementAction("unmortgage", tid)}
                        className="btn-retro btn-retro-green px-2 py-1 text-[9px]"
                        title={`Unmortgage cost: -$${Math.round(tile.mortgage * 1.1)}`}
                      >
                        <DollarIcon size={10} color="currentColor" /> REDEEM
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
