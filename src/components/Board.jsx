import React from "react";
import { TILES, GROUP_COLORS, TOKEN_COLORS } from "../boardData";
import { getTileGridCoords } from "../lib/animation";
import { TokenIcon, HouseIcon, HotelIcon, UtilityIcon, RailroadIcon } from "../lib/icons";

/* ── Center logo: pixel-art stock chart + brand ───────────────────── */
function BoardLogo({ gameState }) {
  const currentTurnPlayerId = gameState?.order?.[gameState?.current];
  const currentPlayer = gameState?.players?.find(p => p.id === currentTurnPlayerId);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      gap: "10px",
      padding: "12px",
    }}>
      {/* SVG Brand logo — candlestick chart */}
      <svg viewBox="0 0 80 40" style={{ width: "min(90px, 14cqw)", height: "auto", flexShrink: 0 }} fill="none">
        {/* Grid lines */}
        <line x1="0" y1="10" x2="80" y2="10" stroke="rgba(56,189,248,0.1)" strokeWidth="0.5"/>
        <line x1="0" y1="20" x2="80" y2="20" stroke="rgba(56,189,248,0.1)" strokeWidth="0.5"/>
        <line x1="0" y1="30" x2="80" y2="30" stroke="rgba(56,189,248,0.1)" strokeWidth="0.5"/>
        {/* Candle wicks */}
        <line x1="10" y1="5" x2="10" y2="35" stroke="#34d399" strokeWidth="1"/>
        <line x1="22" y1="8" x2="22" y2="32" stroke="#ef4444" strokeWidth="1"/>
        <line x1="34" y1="3" x2="34" y2="28" stroke="#34d399" strokeWidth="1"/>
        <line x1="46" y1="10" x2="46" y2="34" stroke="#ef4444" strokeWidth="1"/>
        <line x1="58" y1="4" x2="58" y2="25" stroke="#34d399" strokeWidth="1"/>
        <line x1="70" y1="2" x2="70" y2="22" stroke="#34d399" strokeWidth="1"/>
        {/* Candle bodies */}
        <rect x="7" y="10" width="6" height="14" fill="#34d399" rx="0"/>
        <rect x="19" y="15" width="6" height="12" fill="#ef4444" rx="0"/>
        <rect x="31" y="8" width="6" height="16" fill="#34d399" rx="0"/>
        <rect x="43" y="18" width="6" height="12" fill="#ef4444" rx="0"/>
        <rect x="55" y="6" width="6" height="14" fill="#34d399" rx="0"/>
        <rect x="67" y="4" width="6" height="14" fill="#34d399" rx="0"/>
        {/* Trend line overlay */}
        <polyline
          points="10,17 22,21 34,16 46,24 58,13 70,11"
          stroke="#fbbf24"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="3 2"
          style={{ filter: "drop-shadow(0 0 2px #fbbf2480)" }}
        />
      </svg>

      {/* Brand title */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "var(--font-retro)",
          fontSize: "clamp(7px, 1.3cqw, 11px)",
          color: "#34d399",
          fontWeight: "bold",
          letterSpacing: "0.1em",
          textShadow: "0 0 8px rgba(52,211,153,0.4)",
          lineHeight: 1.3,
        }}>
          STONKS &amp;
        </div>
        <div style={{
          fontFamily: "var(--font-retro)",
          fontSize: "clamp(7px, 1.3cqw, 11px)",
          color: "#34d399",
          fontWeight: "bold",
          letterSpacing: "0.1em",
          textShadow: "0 0 8px rgba(52,211,153,0.4)",
          lineHeight: 1.3,
        }}>
          STRATS
        </div>
        <div style={{
          fontFamily: "var(--font-retro)",
          fontSize: "clamp(5px, 0.8cqw, 7px)",
          color: "#475569",
          letterSpacing: "0.2em",
          marginTop: "3px",
        }}>
          P2P MARKET SIM
        </div>
      </div>

      {/* Current turn indicator */}
      {gameState && gameState.phase !== "lobby" && gameState.phase !== "game_over" && currentPlayer && (
        <div style={{
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(56,189,248,0.25)",
          borderLeft: `2px solid ${currentPlayer.token_color || TOKEN_COLORS[currentPlayer.token_shape || currentPlayer.token] || "#38bdf8"}`,
          padding: "5px 8px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3px",
          maxWidth: "90%",
        }}>
          <span style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(5px, 0.7cqw, 6px)", color: "#64748b", letterSpacing: "0.15em" }}>
            ACTIVE PLAYER:
          </span>
          <span style={{
            fontFamily: "var(--font-retro)",
            fontSize: "clamp(6px, 0.9cqw, 8px)",
            fontWeight: "bold",
            color: currentPlayer.token_color || TOKEN_COLORS[currentPlayer.token_shape || currentPlayer.token] || "#38bdf8",
            textShadow: `0 0 6px ${currentPlayer.token_color || TOKEN_COLORS[currentPlayer.token_shape || currentPlayer.token] || "#38bdf8"}80`,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {currentPlayer.name}
          </span>
          <span style={{
            fontFamily: "var(--font-retro)",
            fontSize: "clamp(5px, 0.7cqw, 6px)",
            color: "#10b981",
            border: "1px solid rgba(16,185,129,0.3)",
            padding: "1px 5px",
            background: "rgba(5,46,22,0.3)",
          }}>
            {gameState.phase?.toUpperCase()}
          </span>
        </div>
      )}

      {/* Latest log line */}
      {gameState?.log?.length > 0 && (
        <div style={{
          position: "absolute",
          bottom: "6px",
          left: "6px",
          right: "6px",
          background: "rgba(0,0,0,0.7)",
          border: "1px solid rgba(15,23,42,0.8)",
          padding: "4px 6px",
          fontFamily: "var(--font-retro)",
          fontSize: "clamp(4px, 0.65cqw, 6px)",
          color: "#94a3b8",
          textAlign: "center",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}>
          <span style={{ color: "#f59e0b" }}>▶ </span>
          {gameState.log[gameState.log.length - 1]}
        </div>
      )}

    </div>
  );
}

/* ── Main Board component ────────────────────────────────────────── */
export default function Board({ gameState, myPlayerId, onTileClick, renderedPositions }) {
  const getPlayersOnTile = (tileId) => {
    if (!gameState || !gameState.players) return [];
    return gameState.players.filter(p => {
      const pos = renderedPositions[p.id] !== undefined ? renderedPositions[p.id] : p.position;
      return pos === tileId && !p.bankrupt;
    });
  };

  return (
    /* container-type enables cqw units for fluid font sizing inside the board */
    <div style={{
      containerType: "inline-size",
      /* Fill the parent container (containerType: size) as a square */
      width: "min(100cqw, 100cqh)",
      height: "min(100cqw, 100cqh)",
      display: "grid",
      gridTemplateColumns: "repeat(13, 1fr)",
      gridTemplateRows: "repeat(13, 1fr)",
      background: "#080c18",
      border: "3px solid rgba(56,189,248,0.45)",
      boxShadow: "0 0 40px rgba(56,189,248,0.18), inset 0 0 20px rgba(0,0,0,0.6)",
      position: "relative",
      flexShrink: 0,
    }}>
      {/* Board Center Area */}
      <div style={{
        gridColumn: "3 / 12",
        gridRow: "3 / 12",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle, #0e1633 0%, #050811 100%)",
        border: "1px solid rgba(56,189,248,0.15)",
        position: "relative",
        overflow: "hidden",
        containerType: "size",
      }}>
        <BoardLogo gameState={gameState} />
      </div>

      {/* Render 40 tiles */}
      {TILES.map((tile) => {
        const tid = tile.id;
        const coords = getTileGridCoords(tid);
        const playersHere = getPlayersOnTile(tid);

        const ownerId = gameState?.owner?.[tid.toString()];
        const houseCount = gameState?.houses?.[tid.toString()] || 0;
        const isMortgaged = gameState?.mortgaged?.includes(tid);

        const ownerObj = ownerId !== undefined ? gameState.players.find(p => p.id === ownerId) : null;
        const ownerColor = ownerObj ? (ownerObj.token_color || TOKEN_COLORS[ownerObj.token_shape || ownerObj.token]) : null;

        const cellStyle = {
          gridColumnStart: coords.colStart,
          gridColumnEnd: coords.colStart + coords.colSpan,
          gridRowStart: coords.rowStart,
          gridRowEnd: coords.rowStart + coords.rowSpan,
          border: isMortgaged
            ? "1px dashed rgba(239,68,68,0.7)"
            : ownerColor
              ? `1.5px solid ${ownerColor}`
              : "1px solid rgba(42,50,90,0.4)",
          background: ownerColor
            ? `${ownerColor}12`
            : "rgba(12,17,34,0.9)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          cursor: "pointer",
          overflow: "hidden",
          padding: "1px",
          transition: "background 0.15s",
          position: "relative",
        };

        const isChanceOrChest = tile.type === "chance" || tile.type === "community_chest";
        const textSize = "clamp(4px, 0.9cqw, 8px)";

        return (
          <div
            key={tid}
            style={cellStyle}
            onClick={() => onTileClick(tid)}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(56,189,248,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = ownerColor ? `${ownerColor}12` : "rgba(12,17,34,0.9)"; }}
          >
            {/* 1. Property group color band */}
            {tile.group && tile.group !== "railroad" && tile.group !== "utility" && (
              <div style={{
                height: "clamp(5px, 1.2cqw, 10px)",
                width: "100%",
                background: GROUP_COLORS[tile.group],
                flexShrink: 0,
              }} />
            )}

            {/* 2. House/Hotel indicators */}
            {houseCount > 0 && !isMortgaged && (
              <div style={{ display: "flex", gap: "1px", justifyContent: "center", flexShrink: 0 }}>
                {houseCount === 5 ? (
                  <HotelIcon size={10} color="#EF4444" />
                ) : (
                  Array.from({ length: houseCount }).map((_, idx) => (
                    <HouseIcon key={idx} size={9} color="#10B981" />
                  ))
                )}
              </div>
            )}

            {/* 3. Icons + name */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px", padding: "1px" }}>
              {tile.group === "utility" && (
                <UtilityIcon type={tile.id === 12 ? "electric" : "water"} size={10} color={ownerColor || "#8492A6"} />
              )}
              {tile.group === "railroad" && (
                <RailroadIcon size={10} color={ownerColor || "#8492A6"} />
              )}
              {isChanceOrChest && (
                <span style={{
                  fontSize: "clamp(8px, 1.6cqw, 14px)",
                  fontWeight: "bold",
                  color: tile.type === "chance" ? "#fbbf24" : "#38bdf8",
                  textShadow: tile.type === "chance" ? "0 0 4px #fbbf2480" : "0 0 4px #38bdf880",
                  lineHeight: 1,
                }}>
                  {tile.type === "chance" ? "?" : "C"}
                </span>
              )}

              {/* Tile name */}
              <span style={{
                fontFamily: "var(--font-retro)",
                fontSize: textSize,
                fontWeight: "bold",
                textAlign: "center",
                color: isMortgaged ? "#ef4444" : ownerColor ? "#fff" : "#cbd5e1",
                lineHeight: 1.1,
                wordBreak: "break-word",
                hyphens: "auto",
                maxWidth: "100%",
                padding: "0 1px",
              }}>
                {tile.name === "GO" ? "GO" :
                 tile.name.includes("Jail") ? "JAIL" :
                 tile.name.includes("Free Parking") ? "FREE PKG" :
                 tile.name.includes("Go To Jail") ? "GO JAIL" :
                 tile.name
                   .replace(" Avenue", " Ave")
                   .replace(" Place", " Pl")
                   .replace(" Street", " St")
                   .replace(" Gardens", " Gdns")
                   .replace(" Station", " Stn")
                   .substring(0, 10)}
              </span>

              {/* Price tag */}
              {tile.price && !ownerColor && !isMortgaged && (
                <span style={{
                  fontFamily: "var(--font-retro)",
                  fontSize: "clamp(4px, 0.75cqw, 7px)",
                  color: "#38bdf8",
                  fontWeight: "bold",
                }}>
                  ${tile.price}
                </span>
              )}
              {isMortgaged && (
                <span style={{
                  fontFamily: "var(--font-retro)",
                  fontSize: "clamp(4px, 0.65cqw, 6px)",
                  color: "#ef4444",
                  fontWeight: "bold",
                }}>
                  MRTG
                </span>
              )}
            </div>

            {/* 4. Player tokens */}
            {playersHere.length > 0 && (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1px",
                justifyContent: "center",
                alignItems: "center",
                background: "rgba(0,0,0,0.5)",
                padding: "1px",
                flexShrink: 0,
              }}>
                {playersHere.map(p => (
                  <div key={p.id} className="token-hop" style={{ width: "clamp(10px, 2.8cqw, 22px)", height: "clamp(10px, 2.8cqw, 22px)", flexShrink: 0 }}>
                    <TokenIcon
                      name={p.token_shape || p.token}
                      color={p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#38bdf8"}
                      size="100%"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
