import React, { useState } from "react";
import { TOKEN_COLORS } from "../boardData";
import { DiceIcon, ManageIcon, TradeIcon, SettingsIcon, AlertIcon } from "../lib/icons";
import { playClick } from "../lib/audio";
import TradeBroker from "./TradeBroker";

function feedCategory(entry) {
  const e = entry.toLowerCase();
  if (e.includes("rolled") || e.includes("dice"))           return { icon: "⚂", color: "#FFB300" };
  if (e.includes("wins") || e.includes("winner") || e.includes("victory")) return { icon: "★", color: "#FFD600" };
  if (e.includes("bought") || e.includes("purchased"))      return { icon: "⌂", color: "#00C853" };
  if (e.includes("rent") || e.includes("paid $") || e.includes("owes")) return { icon: "$", color: "#f87171" };
  if (e.includes("jail"))                                    return { icon: "⊗", color: "#F59E0B" };
  if (e.includes("hotel") || e.includes("house"))           return { icon: "△", color: "#a78bfa" };
  if (e.includes("mortgag"))                                 return { icon: "⚠", color: "#F97316" };
  if (e.includes("bankrupt"))                                return { icon: "☠", color: "#EF4444" };
  if (e.includes("passed go") || e.includes("collected $200")) return { icon: "○", color: "#38bdf8" };
  if (e.includes("free parking"))                            return { icon: "P", color: "#fbbf24" };
  if (e.includes("chance") || e.includes("community chest")) return { icon: "?", color: "#fbbf24" };
  if (e.includes("trade") || e.includes("offer"))           return { icon: "⇄", color: "#34d399" };
  if (e.includes(":"))                                       return { icon: "☎", color: "#64748b" };
  return { icon: "▶", color: "#374151" };
}

export default function Sidebar({
  gameState,
  myPlayerId,
  playerName,
  animDice,
  animationsBusy,
  isHost,
  onEndGame,
  onAction,
  onOpenManage,
  onOpenSettings,
  onSkipAnimations,
}) {
  const [chatInput, setChatInput] = useState("");
  const [tradeOpen, setTradeOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (!gameState) return null;

  const {
    players, dice, speed_die, speed_die_choice,
    phase, current, order, log, winner, debtor_id, extra_roll,
  } = gameState;

  const displayDice = animDice || dice;
  const currPlayerId = order?.[current] ?? null;
  const isMyTurn = currPlayerId === myPlayerId;
  const inDebt = phase === "debt";
  const myPlayer = players.find(p => p.id === myPlayerId);
  const isBankrupt = myPlayer?.bankrupt || false;
  const activeOpponents = players.filter(p => p.id !== myPlayerId && !p.bankrupt);

  const tokenColor = (p) => p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#38bdf8";

  const sortedPlayers = [...players].sort((a, b) => {
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    if (a.id === currPlayerId) return -1;
    if (b.id === currPlayerId) return 1;
    return b.money - a.money;
  });

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onAction("chat", { name: playerName || "Player", text: chatInput.trim() });
    setChatInput("");
  };

  const Section = ({ label, right }) => (
    <div className="mk-section">
      <span>{label}</span>
      {right && <span>{right}</span>}
    </div>
  );

  const Btn = ({ children, onClick, disabled, style, variant }) => {
    const base = {
      fontFamily: "var(--font-retro)",
      fontSize: "8px",
      background: "rgba(10,14,24,0.7)",
      border: "2px solid rgba(255,179,0,0.2)",
      color: "#cbd5e1",
      padding: "7px 8px",
      cursor: disabled ? "not-allowed" : "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "5px",
      opacity: disabled ? 0.4 : 1,
      letterSpacing: "0.05em",
      transition: "border-color 0.1s, color 0.1s",
      ...style,
    };
    if (variant === "green") { base.border = "2px solid rgba(52,211,153,0.5)"; base.color = "#34d399"; base.background = "rgba(5,46,22,0.3)"; }
    if (variant === "red")   { base.border = "2px solid rgba(239,68,68,0.4)"; base.color = "#f87171"; base.background = "rgba(69,10,10,0.3)"; }
    if (variant === "amber") { base.border = "2px solid rgba(255,179,0,0.45)"; base.color = "#FFB300"; base.background = "rgba(30,20,0,0.4)"; }
    return <button style={base} onClick={onClick} disabled={disabled}>{children}</button>;
  };

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: "#050810",
      borderLeft: "2px solid rgba(255,179,0,0.18)",
      overflow: "hidden",
    }}>

      {/* ── STANDINGS ─────────────────────────────────────────── */}
      <Section
        label="STANDINGS"
        right={winner !== null ? <span style={{ color: "#FFD600", animation: "blink-anim 1.2s infinite" }}>★ GAME OVER</span> : null}
      />
      <div style={{ flexShrink: 0 }}>
        {sortedPlayers.map((p, idx) => {
          const isCurrent = p.id === currPlayerId && winner === null;
          const color = tokenColor(p);
          const isMe = p.id === myPlayerId;
          const netWorthPropCount = p.properties?.length || 0;
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                padding: "5px 10px 5px 7px",
                borderBottom: "1px solid rgba(255,179,0,0.05)",
                borderLeft: `3px solid ${isCurrent ? color : "transparent"}`,
                background: isCurrent ? `${color}0E` : "transparent",
              }}
            >
              <span style={{ fontFamily: "var(--font-retro)", fontSize: "6px", color: "#334155", flexShrink: 0, width: "10px", textAlign: "right" }}>
                {idx + 1}
              </span>
              <span style={{
                width: "8px", height: "8px", flexShrink: 0,
                background: p.bankrupt ? "#374151" : color,
                boxShadow: isCurrent ? `0 0 8px ${color}90` : "none",
              }} />
              <span style={{
                fontFamily: "var(--font-retro)",
                fontSize: "8px",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: p.bankrupt ? "#374151" : isCurrent ? "#f1f5f9" : "#94a3b8",
                textDecoration: p.bankrupt ? "line-through" : "none",
              }}>
                {p.name}{isMe ? " ★" : ""}{p.is_bot ? " [AI]" : ""}
              </span>
              <span style={{ fontFamily: "var(--font-retro)", fontSize: "6px", color: "#334155", flexShrink: 0 }}>
                {netWorthPropCount}⌂
              </span>
              <span style={{
                fontFamily: "var(--font-retro)",
                fontSize: "8px",
                fontWeight: "bold",
                flexShrink: 0,
                color: p.bankrupt ? "#EF4444" : p.in_jail ? "#F59E0B" : isCurrent ? "#FFB300" : "#34d399",
                minWidth: "50px",
                textAlign: "right",
              }}>
                {p.bankrupt ? "OUT" : p.in_jail ? "⊗JAIL" : `$${p.money.toLocaleString()}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── DICE ──────────────────────────────────────────────── */}
      {dice && winner === null && phase !== "lobby" && (
        <>
          <Section
            label="DICE"
            right={animationsBusy ? (
              <button
                style={{ fontFamily: "var(--font-retro)", fontSize: "6px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", padding: "2px 6px", cursor: "pointer" }}
                onClick={() => { playClick(); onSkipAnimations(); }}
              >SKIP ▶▶</button>
            ) : null}
          />
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "14px", padding: "8px 10px", flexShrink: 0, background: "rgba(0,0,0,0.25)" }}>
            <DiceIcon value={displayDice[0]} size={40} />
            <DiceIcon value={displayDice[1]} size={40} />
            {speed_die && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                <div style={{
                  width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
                  border: `2px solid ${speed_die.type === "mr_monopoly" ? "#F59E0B" : speed_die.type === "bus" ? "#8B5CF6" : "#38bdf8"}`,
                  background: "rgba(0,0,0,0.5)",
                  fontFamily: "var(--font-retro)",
                  fontSize: speed_die.type === "move" ? "18px" : "8px",
                  color: speed_die.type === "mr_monopoly" ? "#F59E0B" : speed_die.type === "bus" ? "#8B5CF6" : "#38bdf8",
                }}>
                  {speed_die.type === "move" ? speed_die.face : speed_die.type === "bus" ? "BUS" : "MR.M"}
                </div>
                <span style={{ fontFamily: "var(--font-retro)", fontSize: "5px", color: "#374151", textTransform: "uppercase" }}>SPEED</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ACTIONS ───────────────────────────────────────────── */}
      {winner === null && (
        <>
          <Section label="ACTIONS" />
          <div style={{ padding: "7px 10px", display: "flex", flexDirection: "column", gap: "5px", flexShrink: 0 }}>

            {/* Turn controls */}
            {isMyTurn && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px", opacity: animationsBusy ? 0.45 : 1, pointerEvents: animationsBusy ? "none" : "auto" }}>
                {phase === "turn" && (
                  myPlayer?.in_jail ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <Btn variant="green" style={{ width: "100%", fontSize: "9px", fontWeight: "bold", padding: "9px" }} onClick={() => onAction("roll_dice")}>
                        ⚂ ROLL FOR DOUBLES
                      </Btn>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <Btn style={{ flex: 1, fontSize: "8px" }} disabled={myPlayer?.money < 50} onClick={() => onAction("pay_jail_fine")}>PAY $50</Btn>
                        <Btn style={{ flex: 1, fontSize: "8px" }} disabled={!myPlayer?.jail_cards} onClick={() => onAction("use_jail_card")}>
                          GET OUT CARD ({myPlayer?.jail_cards})
                        </Btn>
                      </div>
                    </div>
                  ) : (
                    <Btn variant="green" style={{ width: "100%", fontWeight: "bold", padding: "12px", fontSize: "11px" }} onClick={() => onAction("roll_dice")}>
                      ⚂ ROLL DICE
                    </Btn>
                  )
                )}

                {phase === "speed_bus" && speed_die_choice && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ fontFamily: "var(--font-retro)", fontSize: "7px", color: "#8B5CF6", textAlign: "center", padding: "2px 0" }}>
                      BUS — CHOOSE ROUTE:
                    </div>
                    <div style={{ display: "flex", gap: "5px" }}>
                      {speed_die_choice.map((steps, i) => (
                        <Btn key={i} variant="amber" style={{ flex: 1, fontSize: "10px", fontWeight: "bold" }} onClick={() => onAction("choose_bus_route", { steps })}>
                          +{steps}
                        </Btn>
                      ))}
                    </div>
                  </div>
                )}

                {phase === "buy_decision" && gameState.can_buy !== null && (
                  <div style={{ display: "flex", gap: "5px" }}>
                    <Btn variant="green" style={{ flex: 1, fontWeight: "bold", fontSize: "9px" }} onClick={() => onAction("buy_property")}>⌂ BUY</Btn>
                    <Btn variant="red" style={{ flex: 1, fontWeight: "bold", fontSize: "9px" }} onClick={() => onAction("decline_buy")}>PASS</Btn>
                  </div>
                )}

                {phase === "post_roll" && (
                  <Btn variant="green" style={{ width: "100%", fontWeight: "bold", fontSize: "9px", padding: "9px" }} onClick={() => onAction("end_turn")}>
                    {extra_roll ? "⚂ ROLL AGAIN (DOUBLES)" : "END TURN ▶"}
                  </Btn>
                )}

                {inDebt && debtor_id === myPlayerId && (
                  <Btn variant="red" style={{ width: "100%", fontWeight: "bold", padding: "8px", fontSize: "9px" }} onClick={() => onAction("declare_bankruptcy")}>
                    ☠ DECLARE BANKRUPTCY
                  </Btn>
                )}
              </div>
            )}

            {/* Waiting states */}
            {!isMyTurn && !inDebt && phase !== "lobby" && (
              <div style={{ fontFamily: "var(--font-retro)", fontSize: "7px", color: "#334155", padding: "6px 8px", border: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
                WAITING FOR TURN…
              </div>
            )}
            {inDebt && debtor_id !== myPlayerId && (
              <div className="animate-pulse" style={{ fontFamily: "var(--font-retro)", fontSize: "7px", color: "#f87171", padding: "6px 8px", border: "1px solid rgba(239,68,68,0.2)", textAlign: "center", background: "rgba(69,10,10,0.15)" }}>
                ⚠ {players.find(p => p.id === debtor_id)?.name} RESOLVING DEBT
              </div>
            )}

            {/* Portfolio + Trade row */}
            {!isBankrupt && (
              <div style={{ display: "flex", gap: "5px" }}>
                <Btn style={{ flex: 1, fontSize: "8px", padding: "7px 4px" }} onClick={() => { playClick(); onOpenManage(); }} disabled={inDebt}>
                  <ManageIcon size={10} /><span>PORTFOLIO</span>
                </Btn>
                <Btn
                  style={{ flex: 1, fontSize: "8px", padding: "7px 4px", ...(tradeOpen ? { borderColor: "rgba(251,191,36,0.5)", color: "#fbbf24" } : {}) }}
                  onClick={() => { playClick(); setTradeOpen(v => !v); }}
                  disabled={activeOpponents.length === 0 || inDebt}
                >
                  <TradeIcon size={10} /><span>TRADE</span>
                </Btn>
              </div>
            )}

            {/* Host: end game */}
            {isHost && phase !== "game_over" && (
              confirmEnd ? (
                <div style={{ display: "flex", gap: "4px" }}>
                  <Btn variant="red" style={{ flex: 1, fontSize: "8px" }} onClick={() => { playClick(); setConfirmEnd(false); onEndGame(); }}>
                    ✓ CONFIRM END
                  </Btn>
                  <Btn style={{ fontSize: "8px", padding: "4px 8px" }} onClick={() => { playClick(); setConfirmEnd(false); }}>✕</Btn>
                </div>
              ) : (
                <Btn style={{ width: "100%", fontSize: "7px", color: "#ef4444", borderColor: "rgba(239,68,68,0.25)", padding: "5px" }} onClick={() => { playClick(); setConfirmEnd(true); }}>
                  END GAME (HOST)
                </Btn>
              )
            )}

            {/* Settings */}
            <Btn style={{ width: "100%", fontSize: "7px", color: "#334155", borderColor: "rgba(255,255,255,0.06)", padding: "4px" }} onClick={() => { playClick(); onOpenSettings(); }}>
              <SettingsIcon size={9} /><span>SETTINGS</span>
            </Btn>
          </div>
        </>
      )}

      {/* ── TRADE DESK (inline, expandable) ───────────────────── */}
      {tradeOpen && !isBankrupt && (
        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(251,191,36,0.15)", background: "rgba(0,0,0,0.25)" }}>
          <TradeBroker gameState={gameState} myPlayerId={myPlayerId} onAction={onAction} />
        </div>
      )}

      {/* ── LIVE FEED ─────────────────────────────────────────── */}
      <div className="mk-section">
        <span>LIVE FEED</span>
        <span style={{ width: "6px", height: "6px", background: "#22c55e", borderRadius: "50%", display: "inline-block", animation: "pulse-anim 2s infinite" }} />
      </div>
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "5px 10px",
        display: "flex",
        flexDirection: "column",
        gap: "0",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,179,0,0.12) transparent",
        minHeight: "80px",
      }}>
        {log && [...log].reverse().slice(0, 80).map((entry, i) => {
          const { icon, color } = feedCategory(entry);
          const isLatest = i === 0;
          const isRecent = i < 3;
          return (
            <div
              key={i}
              style={{
                fontFamily: "var(--font-retro)",
                fontSize: "7px",
                color: isLatest ? "#d1d5db" : isRecent ? "#4b5563" : "#1f2937",
                lineHeight: "1.7",
                borderLeft: `2px solid ${isLatest ? color : isRecent ? `${color}40` : "rgba(255,255,255,0.03)"}`,
                paddingLeft: "6px",
                display: "flex",
                gap: "4px",
              }}
            >
              <span style={{ color: isLatest ? color : isRecent ? `${color}60` : "rgba(255,255,255,0.06)", flexShrink: 0 }}>{icon}</span>
              <span style={{ wordBreak: "break-word" }}>{entry}</span>
            </div>
          );
        })}
      </div>

      {/* ── CHAT INPUT ────────────────────────────────────────── */}
      <form
        onSubmit={handleChatSubmit}
        style={{
          display: "flex",
          gap: "4px",
          padding: "5px 8px",
          borderTop: "1px solid rgba(255,179,0,0.1)",
          background: "rgba(0,0,0,0.3)",
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder="message…"
          maxLength={60}
          style={{
            flex: 1,
            padding: "4px 6px",
            fontSize: "8px",
            fontFamily: "var(--font-retro)",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,179,0,0.15)",
            color: "#94a3b8",
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            fontFamily: "var(--font-retro)",
            fontSize: "8px",
            background: "rgba(10,14,24,0.7)",
            border: "1px solid rgba(255,179,0,0.2)",
            color: "#FFB300",
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >▶</button>
      </form>
    </div>
  );
}
