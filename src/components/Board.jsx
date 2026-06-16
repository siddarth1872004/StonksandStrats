import React from "react";
import { TILES, GROUP_COLORS, TOKEN_COLORS } from "../boardData";
import { getTileGridCoords } from "../lib/animation";
import { TokenIcon, HouseIcon, HotelIcon, UtilityIcon, RailroadIcon, DiceIcon } from "../lib/icons";
import { playClick } from "../lib/audio";

/* Plain-English description of what's happening right now. */
function describeStatus(gameState, cur) {
  const s = gameState;
  const name = cur?.name || "—";
  if (s.winner !== null || s.phase === "game_over") {
    const w = s.players.find(p => p.id === s.winner);
    return { headline: `${w?.name || "Someone"} wins!`, sub: "Game over" };
  }
  if (s.pending_trade) {
    const f = s.players.find(p => p.id === s.pending_trade.from);
    const t = s.players.find(p => p.id === s.pending_trade.to);
    return { headline: "Trade on the table", sub: `${f?.name} → ${t?.name} awaiting reply` };
  }
  switch (s.phase) {
    case "debt": {
      const d = s.players.find(p => p.id === s.debtor_id);
      return { headline: `${d?.name} is short on cash`, sub: `Must raise $${Math.max(0, -(d?.money || 0)).toLocaleString()} or go bankrupt` };
    }
    case "auction": {
      const a = s.auction;
      const tile = TILES.find(t => t.id === a?.tile);
      const bidder = a?.current_bidder ? s.players.find(p => p.id === a.current_bidder)?.name : null;
      return { headline: `Auction: ${tile?.name || ""}`, sub: bidder ? `High bid $${a.current_bid} · ${bidder}` : "No bids yet" };
    }
    case "payment": {
      const pp = s.pending_payment;
      const to = pp?.toPid ? s.players.find(p => p.id === pp.toPid)?.name : "the Bank";
      return { headline: `${name} owes $${(pp?.amount || 0).toLocaleString()}`, sub: `Paying ${to}${pp?.reason ? ` · ${pp.reason}` : ""}` };
    }
    case "buy_decision": {
      const tile = TILES.find(t => t.id === s.can_buy);
      return { headline: `${name} can buy ${tile?.name || ""}`, sub: `Price $${tile?.price?.toLocaleString() || "?"}` };
    }
    case "speed_bus":
      return { headline: `${name} caught the bus`, sub: "Choosing how far to ride" };
    case "post_roll":
      return { headline: `${name} is set`, sub: "Building or ending the turn" };
    case "turn":
    default:
      if (cur?.in_jail) return { headline: `${name} is in Jail`, sub: "Rolling for doubles or paying out" };
      return { headline: `${name}'s turn`, sub: "Ready to roll" };
  }
}

/* ── Center status card (replaces the brand logo) ─────────────────── */
function BoardLogo({ gameState, animDice, animationsBusy, onSkipAnimations }) {
  const currentTurnPlayerId = gameState?.order?.[gameState?.current];
  const currentPlayer = gameState?.players?.find(p => p.id === currentTurnPlayerId);
  const inPlay = gameState && gameState.phase !== "lobby" && gameState.phase !== "game_over";
  const displayDice = animDice || gameState?.dice;
  const speedDie = gameState?.speed_die;
  const accent = currentPlayer ? (currentPlayer.token_color || TOKEN_COLORS[currentPlayer.token_shape || currentPlayer.token] || "#38bdf8") : "#38bdf8";
  const status = gameState ? describeStatus(gameState, currentPlayer) : { headline: "", sub: "" };
  const recent = (gameState?.log || []).slice(-3).reverse();

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", width: "100%", gap: "clamp(6px, 1.6cqw, 14px)", padding: "clamp(8px, 2cqw, 18px)",
    }}>
      {/* Headline status */}
      <div style={{
        textAlign: "center", background: "rgba(0,0,0,0.45)",
        border: `1px solid ${accent}55`, borderTop: `2px solid ${accent}`,
        padding: "clamp(6px,1.4cqw,12px) clamp(10px,2cqw,18px)", maxWidth: "92%",
      }}>
        <div style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(5px,0.8cqw,7px)", color: "#64748b", letterSpacing: "0.2em", marginBottom: "5px" }}>
          ◆ LIVE STATUS ◆
        </div>
        <div style={{
          fontFamily: "var(--font-retro)", fontSize: "clamp(8px,1.6cqw,15px)", fontWeight: "bold",
          color: accent, textShadow: `0 0 8px ${accent}70`, lineHeight: 1.4,
          overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {status.headline}
        </div>
        <div style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(6px,1cqw,9px)", color: "#94a3b8", marginTop: "5px", lineHeight: 1.4 }}>
          {status.sub}
        </div>
      </div>

      {/* Center dice */}
      {inPlay && displayDice && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(5px, 1.4cqw, 12px)" }}>
            <div style={{ width: "clamp(26px, 6.5cqw, 54px)", height: "clamp(26px, 6.5cqw, 54px)" }} className={animationsBusy ? "dice-rolling" : ""}>
              <DiceIcon value={displayDice[0]} size="100%" />
            </div>
            <div style={{ width: "clamp(26px, 6.5cqw, 54px)", height: "clamp(26px, 6.5cqw, 54px)" }} className={animationsBusy ? "dice-rolling" : ""}>
              <DiceIcon value={displayDice[1]} size="100%" />
            </div>
            {speedDie && (
              <div style={{
                width: "clamp(26px, 6.5cqw, 54px)", height: "clamp(26px, 6.5cqw, 54px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${speedDie.type === "mr_monopoly" ? "#F59E0B" : speedDie.type === "bus" ? "#8B5CF6" : "#38bdf8"}`,
                background: "rgba(0,0,0,0.6)",
                fontFamily: "var(--font-retro)",
                fontSize: speedDie.type === "move" ? "clamp(12px,3cqw,22px)" : "clamp(6px,1.4cqw,10px)",
                color: speedDie.type === "mr_monopoly" ? "#F59E0B" : speedDie.type === "bus" ? "#8B5CF6" : "#38bdf8",
              }}>
                {speedDie.type === "move" ? speedDie.face : speedDie.type === "bus" ? "BUS" : "MR.M"}
              </div>
            )}
          </div>
          {animationsBusy && onSkipAnimations && (
            <button
              onClick={() => { playClick(); onSkipAnimations(); }}
              style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(6px,1cqw,8px)", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24", padding: "2px 8px", cursor: "pointer" }}
            >
              SKIP ▶▶
            </button>
          )}
        </div>
      )}

      {/* Recent activity */}
      {recent.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxWidth: "94%", width: "100%", alignItems: "center" }}>
          {recent.map((line, i) => (
            <div key={i} style={{
              fontFamily: "var(--font-retro)", fontSize: "clamp(5px,0.85cqw,8px)",
              color: i === 0 ? "#cbd5e1" : i === 1 ? "#64748b" : "#475569",
              maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", textAlign: "center",
            }}>
              {i === 0 ? "▶ " : "· "}{line}
            </div>
          ))}
        </div>
      )}

      {/* Lobby branding only (before the game starts) */}
      {!inPlay && gameState?.phase === "lobby" && (
        <div style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(8px,1.4cqw,12px)", color: "#34d399", fontWeight: "bold", letterSpacing: "0.1em", textShadow: "0 0 8px rgba(52,211,153,0.4)" }}>
          STONKS &amp; STRATS
        </div>
      )}
    </div>
  );
}

/* ── Main Board component ────────────────────────────────────────── */
function Board({ gameState, myPlayerId, onTileClick, renderedPositions, animDice, animationsBusy, onSkipAnimations, tokenFx = {}, movingPids = {} }) {
  const currentTurnPlayerId = gameState?.order?.[gameState?.current];
  const isMyTurn = currentTurnPlayerId === myPlayerId && gameState?.winner === null
    && gameState?.phase !== "lobby" && gameState?.phase !== "game_over";
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
      width: "100%",
      height: "100%",
      display: "grid",
      gridTemplateColumns: "repeat(13, 1fr)",
      gridTemplateRows: "repeat(13, 1fr)",
      background: "#080c18",
      border: `3px solid ${isMyTurn ? "rgba(52,211,153,0.75)" : "rgba(255,179,0,0.5)"}`,
      boxShadow: isMyTurn
        ? "0 0 40px rgba(52,211,153,0.25), inset 0 0 20px rgba(0,0,0,0.6)"
        : "0 0 30px rgba(255,179,0,0.12), inset 0 0 20px rgba(0,0,0,0.6)",
      transition: "border-color 0.4s, box-shadow 0.4s",
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
        <BoardLogo gameState={gameState} animDice={animDice} animationsBusy={animationsBusy} onSkipAnimations={onSkipAnimations} />
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
                {playersHere.map(p => {
                  const isActive = p.id === currentTurnPlayerId && gameState?.winner === null;
                  const col = p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#38bdf8";
                  // Choose a state-specific animation: moving > money fx > idle (active).
                  const fx = movingPids[p.id] ? "token-moving"
                    : tokenFx[p.id] === "gain" ? "token-gain"
                    : tokenFx[p.id] === "loss" ? "token-paying"
                    : isActive ? "token-idle"
                    : "token-hop";
                  const glow = movingPids[p.id]
                    ? `0 0 9px 3px ${col}`
                    : tokenFx[p.id] === "gain" ? "0 0 9px 3px #34d399"
                    : tokenFx[p.id] === "loss" ? "0 0 9px 3px #f87171"
                    : isActive ? `0 0 7px 2px ${col}` : "none";
                  return (
                    <div
                      key={p.id}
                      className={fx}
                      style={{
                        width: "clamp(10px, 2.8cqw, 22px)", height: "clamp(10px, 2.8cqw, 22px)", flexShrink: 0,
                        borderRadius: "50%",
                        boxShadow: glow,
                        transition: "box-shadow 0.2s",
                      }}
                    >
                      <TokenIcon name={p.token_shape || p.token} color={col} size="100%" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Memoized: the board only re-renders when game state, the local player, or
// animated token positions change — not on every App-level update (emotes,
// toasts, dice ticks, etc.).
export default React.memo(Board);
