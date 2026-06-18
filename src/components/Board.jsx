import React from "react";
import { TILES, GROUP_COLORS, TOKEN_COLORS } from "../boardData";
import { getTileGridCoords } from "../lib/animation";
import { TokenIcon, HouseIcon, HotelIcon, UtilityIcon, RailroadIcon, DiceIcon, ChestIcon, JailIcon, GoToJailIcon } from "../lib/icons";
import { playClick } from "../lib/audio";
import { liveNewsLine } from "../lib/liveNews";
import { LandingCard, CardNotif, DoublesPips } from "./NotifCards";

/* ── Center status card (replaces the brand logo) ─────────────────── */
function BoardLogo({ gameState, animDice, animationsBusy, onSkipAnimations }) {
  const inPlay = gameState && gameState.phase !== "lobby" && gameState.phase !== "game_over";
  const displayDice = animDice || gameState?.dice;
  const speedDie = gameState?.speed_die;
  // One big bold headline carries EVERYTHING — actionable prompts ("can buy",
  // "owes rent", "auction") plus the freshest event ("bought", "rolled 4+3").
  const newsLine = liveNewsLine(gameState, animationsBusy);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", width: "100%", overflowY: "auto", overflowX: "hidden",
      padding: "clamp(10px, 2.5cqw, 24px)",
    }}>
      {/* margin:auto centers the block when it fits and lets it scroll when it's
          taller than the board centre — never clipped. */}
      <div style={{ margin: "auto", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(10px, 2.4cqw, 22px)" }}>
      <>
      {/* Headline status — tan board card */}
      <div style={{
        textAlign: "center",
        background: "#e6dcc2", color: "#1f2430",
        border: "1px solid rgba(0,0,0,0.25)", borderRadius: "10px",
        padding: "clamp(10px,2.2cqw,18px) clamp(14px,3cqw,28px)", maxWidth: "96%", minWidth: "62%",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "clamp(6px,1.2cqw,10px)" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#b45309", animation: "pulse-anim 1.8s infinite" }} />
          <span style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(10px,1.4cqw,13px)", color: "#b45309", letterSpacing: "0.24em", fontWeight: "bold" }}>LIVE NEWS</span>
        </div>
        {/* Every event flows through here as one big, bold headline (no small
            sub-text). During the roll we hold the suspense instead of spoiling
            the outcome. */}
        <div key={newsLine} className={animationsBusy ? "" : "feed-in"} style={{
          fontFamily: "var(--font-retro)", fontSize: "clamp(16px,2.8cqw,27px)", fontWeight: "bold",
          color: "#1f2430", lineHeight: 1.25,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
        }}>
          {newsLine}
        </div>
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
          {!animationsBusy && gameState?.doubles_streak > 0 && <DoublesPips streak={gameState.doubles_streak} />}
        </div>
      )}

      {/* Lobby branding only (before the game starts) */}
      {!inPlay && gameState?.phase === "lobby" && (
        <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(10px,1.8cqw,16px)", color: "#34d399", fontWeight: "bold", letterSpacing: "0.06em", textShadow: "0 0 12px rgba(52,211,153,0.5)", lineHeight: 1.6 }}>
          STONKS &amp; STRATS
        </div>
      )}
      </>
      </div>
    </div>
  );
}

/* ── Main Board component ────────────────────────────────────────── */
function Board({ gameState, myPlayerId, onTileClick, renderedPositions, animDice, animationsBusy, onSkipAnimations, tokenFx = {}, movingPids = {}, landing = null, card = null }) {
  const currentTurnPlayerId = gameState?.order?.[gameState?.current];
  const isMyTurn = currentTurnPlayerId === myPlayerId && gameState?.winner === null
    && gameState?.phase !== "lobby" && gameState?.phase !== "game_over";

  // Bottom-left notification card (shared design with the 3D board): a drawn
  // Chance/Chest card takes priority, else the detailed landing card for me.
  const landTile = landing && landing.pid === myPlayerId ? TILES.find(t => t.id === landing.tileId) : null;

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
      background: "#241f19",
      border: `3px solid ${isMyTurn ? "rgba(52,211,153,0.85)" : "rgba(0,0,0,0.4)"}`,
      boxShadow: isMyTurn
        ? "0 0 40px rgba(52,211,153,0.25)"
        : "0 10px 30px rgba(0,0,0,0.5)",
      transition: "border-color 0.4s, box-shadow 0.4s",
      position: "relative",
      flexShrink: 0,
    }}>
      {/* Board Center Area — green felt playfield */}
      <div style={{
        gridColumn: "3 / 12",
        gridRow: "3 / 12",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle, #1c4636 0%, #143528 100%)",
        border: "1px solid rgba(0,0,0,0.3)",
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
            ? "1px dashed rgba(185,28,28,0.8)"
            : ownerColor
              ? `2px solid ${ownerColor}`
              : "1px solid rgba(0,0,0,0.18)",
          background: isMortgaged
            ? "linear-gradient(160deg, #d9c7a0 0%, #cbb888 100%)"
            : "linear-gradient(160deg, #ece2c8 0%, #d8c9a6 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          cursor: "pointer",
          overflow: "hidden",
          padding: "1px",
          transition: "background 0.15s, box-shadow 0.15s",
          boxShadow: ownerColor ? `inset 0 0 10px ${ownerColor}44` : "inset 0 0 6px rgba(0,0,0,0.12)",
          position: "relative",
        };

        const textSize = "clamp(8px, 1.6cqw, 14px)";

        return (
          <div
            key={tid}
            style={cellStyle}
            onClick={() => onTileClick(tid)}
            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(160deg, #f6eed7 0%, #ead9b1 100%)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = cellStyle.background; }}
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
                color: isMortgaged ? "#b91c1c" : "#1f2430",
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
                  color: "#0f766e",
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

            {/* 4. Player tokens — adaptively shrink as more pieces share a tile
                 so they never clip past the cell. */}
            {playersHere.length > 0 && (() => {
              const n = playersHere.length;
              const tScale = n >= 4 ? 0.52 : n === 3 ? 0.66 : n === 2 ? 0.82 : 1;
              const tSize = `clamp(${(9 * tScale).toFixed(1)}px, ${(2.5 * tScale).toFixed(2)}cqw, ${(20 * tScale).toFixed(1)}px)`;
              return (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1px",
                justifyContent: "center",
                alignItems: "center",
                background: "rgba(20,53,40,0.55)",
                borderRadius: "4px",
                padding: "1px 2px",
                flexShrink: 0,
                maxWidth: "100%",
              }}>
                {playersHere.map(p => {
                  const isActive = p.id === currentTurnPlayerId && gameState?.winner === null;
                  const isMoving = !!movingPids[p.id];
                  const col = p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#38bdf8";
                  // Choose a state-specific animation: moving > money fx > idle (active).
                  const fx = isMoving ? "token-moving"
                    : tokenFx[p.id] === "gain" ? "token-gain"
                    : tokenFx[p.id] === "loss" ? "token-paying"
                    : isActive ? "token-idle"
                    : "token-hop";
                  const glow = isMoving
                    ? `0 0 10px 3px ${col}`
                    : tokenFx[p.id] === "gain" ? "0 0 10px 3px #34d399"
                    : tokenFx[p.id] === "loss" ? "0 0 10px 3px #f87171"
                    : "none";
                  // The active piece gets a pulsing colored halo ring (color via
                  // currentColor) — but never while it's mid-move (the ring would
                  // smear the bounce); the moving glow covers that case.
                  const ringClass = isActive && !isMoving ? " token-active" : "";
                  return (
                    <div
                      key={p.id}
                      className={"token-piece" + ringClass}
                      title={`${p.name} · $${(p.money ?? 0).toLocaleString()}`}
                      style={{
                        width: tSize, height: tSize, flexShrink: 0,
                        color: col,
                      }}
                    >
                      <div className={"token-fx " + fx} style={{ boxShadow: glow }}>
                        <TokenIcon name={p.token_shape || p.token} color={col} size="100%" />
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
        );
      })}

      {/* Bottom-left notification card (shared with the 3D board) */}
      {card ? <CardNotif card={card} /> : landTile && <LandingCard tile={landTile} gameState={gameState} />}
    </div>
  );
}

// Memoized: the board only re-renders when game state, the local player, or
// animated token positions change — not on every App-level update (emotes,
// toasts, dice ticks, etc.).
export default React.memo(Board);
