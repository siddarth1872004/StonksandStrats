import React from "react";
import { TILES, GROUP_COLORS, TOKEN_COLORS } from "../boardData";
import { getTileGridCoords } from "../lib/animation";
import { TokenIcon, HouseIcon, HotelIcon, UtilityIcon, RailroadIcon, DiceIcon, ChestIcon, JailIcon, GoToJailIcon } from "../lib/icons";
import { TileDetails } from "./TileDetails";
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

/* Compact "X landed on Y" descriptor for the center landing card. */
function landingInfo(gameState, landing) {
  if (!landing) return null;
  const player = gameState.players.find(p => p.id === landing.pid);
  const tile = TILES.find(t => t.id === landing.tileId);
  if (!player || !tile) return null;
  const tokenCol = player.token_color || TOKEN_COLORS[player.token_shape || player.token] || "#38bdf8";
  const bandColor = tile.group && GROUP_COLORS[tile.group] ? GROUP_COLORS[tile.group]
    : tile.type === "railroad" ? "#cbd5e1" : tile.type === "utility" ? "#94a3b8" : "#64748b";

  const ownerId = gameState.owner?.[String(tile.id)];
  const mortgaged = gameState.mortgaged?.includes(tile.id);
  let detail;
  switch (tile.type) {
    case "go": detail = "Collect $200 salary"; break;
    case "tax": detail = `Pay $${tile.price} tax`; break;
    case "chance": detail = "Draw a Chance card"; break;
    case "community_chest": detail = "Draw a Community Chest card"; break;
    case "jail": detail = "Just visiting"; break;
    case "free_parking": detail = "Free parking — rest easy"; break;
    case "go_to_jail": detail = "Go directly to Jail!"; break;
    default:
      if (mortgaged) detail = "Mortgaged — no rent";
      else if (ownerId === undefined) detail = `Unowned — $${tile.price} to buy`;
      else if (ownerId === player.id) detail = "You own this";
      else {
        const owner = gameState.players.find(p => p.id === ownerId);
        detail = `Owned by ${owner?.name || "a rival"} — pay rent`;
      }
  }
  return { player, tile, tokenCol, bandColor, detail };
}

/* ── Center status card (replaces the brand logo) ─────────────────── */
function BoardLogo({ gameState, myPlayerId, animDice, animationsBusy, onSkipAnimations, landing }) {
  const currentTurnPlayerId = gameState?.order?.[gameState?.current];
  const currentPlayer = gameState?.players?.find(p => p.id === currentTurnPlayerId);
  const inPlay = gameState && gameState.phase !== "lobby" && gameState.phase !== "game_over";
  const displayDice = animDice || gameState?.dice;
  const speedDie = gameState?.speed_die;
  const accent = currentPlayer ? (currentPlayer.token_color || TOKEN_COLORS[currentPlayer.token_shape || currentPlayer.token] || "#38bdf8") : "#38bdf8";
  // While the dice/token are still animating, never reveal the outcome (e.g.
  // "can buy …") — keep the suspense until the token actually lands.
  const status = animationsBusy
    ? { headline: `${currentPlayer?.name || "—"} is rolling`, sub: "Where will the token land?" }
    : (gameState ? describeStatus(gameState, currentPlayer) : { headline: "", sub: "" });
  const latest = (gameState?.log || []).slice(-1)[0];
  // The full tile-details card is shown only to the player who actually landed
  // (and persists through their turn). Everyone else just sees the live news.
  const land = (inPlay && !animationsBusy && landing && landing.pid === myPlayerId)
    ? landingInfo(gameState, landing) : null;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", width: "100%", gap: "clamp(10px, 2.4cqw, 22px)", padding: "clamp(10px, 2.5cqw, 24px)",
    }}>
      {/* Landing on a tile shows the FULL tile info (same as clicking it),
          headed by who landed. Replaces the status/dice for a few seconds. */}
      {land ? (
        <div key={landing.key} className="animate-scale-up" style={{
          width: "94%", maxHeight: "100%", overflowY: "auto",
          background: "rgba(0,0,0,0.72)",
          border: `1px solid ${land.tokenCol}66`, borderTop: `3px solid ${land.tokenCol}`,
          padding: "clamp(10px,2cqw,18px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "10px" }}>
            <div style={{ width: "clamp(14px,2.4cqw,22px)", height: "clamp(14px,2.4cqw,22px)" }}>
              <TokenIcon name={land.player.token_shape || land.player.token} color={land.tokenCol} size="100%" />
            </div>
            <span style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(11px,1.5cqw,15px)", color: land.tokenCol, fontWeight: "bold" }}>
              {land.player.name} landed on
            </span>
          </div>
          <TileDetails tileId={land.tile.id} gameState={gameState} />
          {latest && (
            <div key={latest} className="feed-in" style={{
              marginTop: "clamp(10px,1.6cqw,16px)", paddingTop: "clamp(8px,1.4cqw,14px)",
              borderTop: "1px solid rgba(255,179,0,0.18)",
              display: "flex", alignItems: "center", gap: "8px", justifyContent: "center",
            }}>
              <span style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(9px,1.2cqw,12px)", color: "#FFB300", letterSpacing: "0.18em", flexShrink: 0 }}>▶ NEWS</span>
              <span style={{
                fontFamily: "var(--font-retro)", fontSize: "clamp(12px,1.7cqw,16px)", color: "#e2e8f0", lineHeight: 1.4,
                overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}>{latest}</span>
            </div>
          )}
        </div>
      ) : (
      <>
      {/* Headline status */}
      <div style={{
        textAlign: "center",
        background: "linear-gradient(180deg, rgba(6,8,14,0.75), rgba(0,0,0,0.5))",
        border: `1px solid ${accent}40`, borderTop: `3px solid ${accent}`, borderRadius: "8px",
        padding: "clamp(10px,2.2cqw,20px) clamp(14px,3cqw,28px)", maxWidth: "96%", minWidth: "62%",
        boxShadow: `0 0 26px ${accent}22, inset 0 0 30px rgba(0,0,0,0.5)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "9px" }}>
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: accent, boxShadow: `0 0 6px ${accent}`, animation: "pulse-anim 1.8s infinite" }} />
          <span style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(9px,1.3cqw,12px)", color: "#64748b", letterSpacing: "0.22em" }}>LIVE NEWS</span>
        </div>
        <div style={{
          fontFamily: "var(--font-retro)", fontSize: "clamp(15px,2.8cqw,28px)", fontWeight: "bold",
          color: accent, textShadow: `0 0 12px ${accent}80`, lineHeight: 1.4,
          overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {status.headline}
        </div>
        <div style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(11px,1.8cqw,16px)", color: "#94a3b8", marginTop: "8px", lineHeight: 1.4 }}>
          {status.sub}
        </div>
        {inPlay && latest && (
          <div key={latest} className="feed-in" style={{
            marginTop: "clamp(10px,1.6cqw,16px)", paddingTop: "clamp(8px,1.4cqw,14px)",
            borderTop: "1px solid rgba(255,179,0,0.18)",
            display: "flex", alignItems: "center", gap: "8px", justifyContent: "center",
          }}>
            <span style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(9px,1.2cqw,12px)", color: "#FFB300", letterSpacing: "0.18em", flexShrink: 0 }}>▶ NEWS</span>
            <span style={{
              fontFamily: "var(--font-retro)", fontSize: "clamp(12px,1.7cqw,16px)", color: "#e2e8f0", lineHeight: 1.4,
              overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            }}>{latest}</span>
          </div>
        )}
      </div>

      {/* Center dice */}
      {inPlay && displayDice && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(8px, 2cqw, 18px)" }}>
            <div style={{ width: "clamp(40px, 9.5cqw, 84px)", height: "clamp(40px, 9.5cqw, 84px)" }} className={animationsBusy ? "dice-rolling" : ""}>
              <DiceIcon value={displayDice[0]} size="100%" />
            </div>
            <div style={{ width: "clamp(40px, 9.5cqw, 84px)", height: "clamp(40px, 9.5cqw, 84px)" }} className={animationsBusy ? "dice-rolling" : ""}>
              <DiceIcon value={displayDice[1]} size="100%" />
            </div>
            {speedDie && (
              <div style={{
                width: "clamp(40px, 9.5cqw, 84px)", height: "clamp(40px, 9.5cqw, 84px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${speedDie.type === "mr_monopoly" ? "#F59E0B" : speedDie.type === "bus" ? "#8B5CF6" : "#38bdf8"}`,
                background: "rgba(0,0,0,0.6)",
                fontFamily: "var(--font-retro)",
                fontSize: speedDie.type === "move" ? "clamp(18px,4.5cqw,34px)" : "clamp(8px,2cqw,14px)",
                color: speedDie.type === "mr_monopoly" ? "#F59E0B" : speedDie.type === "bus" ? "#8B5CF6" : "#38bdf8",
              }}>
                {speedDie.type === "move" ? speedDie.face : speedDie.type === "bus" ? "BUS" : "MR.M"}
              </div>
            )}
          </div>
          {animationsBusy && onSkipAnimations && (
            <button
              onClick={() => { playClick(); onSkipAnimations(); }}
              style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(10px,1.4cqw,13px)", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24", padding: "3px 10px", cursor: "pointer" }}
            >
              SKIP ▶▶
            </button>
          )}
        </div>
      )}

      {/* Lobby branding only (before the game starts) */}
      {!inPlay && gameState?.phase === "lobby" && (
        <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(10px,1.8cqw,16px)", color: "#34d399", fontWeight: "bold", letterSpacing: "0.06em", textShadow: "0 0 12px rgba(52,211,153,0.5)", lineHeight: 1.6 }}>
          STONKS &amp; STRATS
        </div>
      )}
      </>
      )}
    </div>
  );
}

/* ── Main Board component ────────────────────────────────────────── */
function Board({ gameState, myPlayerId, onTileClick, renderedPositions, animDice, animationsBusy, onSkipAnimations, tokenFx = {}, movingPids = {}, landing = null }) {
  const currentTurnPlayerId = gameState?.order?.[gameState?.current];
  const isMyTurn = currentTurnPlayerId === myPlayerId && gameState?.winner === null
    && gameState?.phase !== "lobby" && gameState?.phase !== "game_over";

  // id → player lookup, rebuilt only when the player list changes (not on every
  // animation frame), so per-tile owner resolution is O(1) instead of a .find().
  const playersById = React.useMemo(() => {
    const m = {};
    (gameState?.players || []).forEach(p => { m[p.id] = p; });
    return m;
  }, [gameState?.players]);

  // tileId → occupants, computed in a single O(players) pass per render rather
  // than 40 .filter() scans. renderedPositions changes every hop frame, so this
  // must recompute, but one pass is far cheaper than one scan per tile.
  const playersByTile = {};
  (gameState?.players || []).forEach(p => {
    if (p.bankrupt) return;
    const pos = renderedPositions[p.id] !== undefined ? renderedPositions[p.id] : p.position;
    (playersByTile[pos] ||= []).push(p);
  });

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
      background: "#000000",
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
        background: "radial-gradient(circle, #0a0a0c 0%, #000000 100%)",
        border: "1px solid rgba(56,189,248,0.15)",
        position: "relative",
        overflow: "hidden",
        containerType: "size",
      }}>
        <BoardLogo gameState={gameState} myPlayerId={myPlayerId} animDice={animDice} animationsBusy={animationsBusy} onSkipAnimations={onSkipAnimations} landing={landing} />
      </div>

      {/* Render 40 tiles */}
      {TILES.map((tile) => {
        const tid = tile.id;
        const coords = getTileGridCoords(tid);
        const playersHere = playersByTile[tid] || [];

        const ownerId = gameState?.owner?.[tid.toString()];
        const houseCount = gameState?.houses?.[tid.toString()] || 0;
        const isMortgaged = gameState?.mortgaged?.includes(tid);

        const ownerObj = ownerId !== undefined ? playersById[ownerId] : null;
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
            ? `${ownerColor}1f`
            : "#000000",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          cursor: "pointer",
          overflow: "hidden",
          padding: "1px",
          transition: "background 0.15s",
          position: "relative",
        };

        const textSize = "clamp(8px, 1.6cqw, 14px)";

        return (
          <div
            key={tid}
            style={cellStyle}
            onClick={() => onTileClick(tid)}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(56,189,248,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = ownerColor ? `${ownerColor}1f` : "#000000"; }}
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
              {tile.type === "chance" && (
                <span style={{
                  fontSize: "clamp(10px, 2cqw, 18px)",
                  fontWeight: "bold",
                  color: "#fbbf24",
                  textShadow: "0 0 4px #fbbf2480",
                  lineHeight: 1,
                }}>
                  ?
                </span>
              )}
              {tile.type === "community_chest" && (
                <ChestIcon size={16} color="#38bdf8" />
              )}
              {tile.type === "jail" && (
                <JailIcon size={16} color="#F59E0B" />
              )}
              {tile.type === "go_to_jail" && (
                <GoToJailIcon size={16} color="#EF4444" />
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
                {tile.type === "go" ? "GO" :
                 tile.type === "go_to_jail" ? "GO TO JAIL" :
                 tile.type === "jail" ? "JUST VISITING" :
                 tile.type === "free_parking" ? "FREE PARKING" :
                 tile.name
                   .replace(" Avenue", " Ave")
                   .replace(" Street", " St")
                   .replace(" Station", " Stn")}
              </span>

              {/* Price tag */}
              {tile.price && !ownerColor && !isMortgaged && (
                <span style={{
                  fontFamily: "var(--font-retro)",
                  fontSize: "clamp(7px, 1.1cqw, 12px)",
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
