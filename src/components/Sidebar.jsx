import React, { useState } from "react";
import { TOKEN_COLORS } from "../boardData";
import { DiceIcon, ManageIcon, TradeIcon, SettingsIcon, ChatIcon, AlertIcon, StatsIcon } from "../lib/icons";
import { playClick } from "../lib/audio";
import StatsScreen from "./StatsScreen";
import TradeBroker from "./TradeBroker";

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
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [logMinimized, setLogMinimized] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);

  if (!gameState) return null;

  const {
    players,
    dice,
    speed_die,
    speed_die_choice,
    phase,
    current,
    order,
    log,
    winner,
    debtor_id,
    extra_roll,
  } = gameState;

  const displayDice = animDice || dice;
  const currPlayerId = order && order.length > 0 ? order[current] : null;
  const isMyTurn = currPlayerId === myPlayerId;
  const inDebt = phase === "debt";
  const myPlayer = players.find(p => p.id === myPlayerId);
  const isBankrupt = myPlayer?.bankrupt || false;
  const activeOpponents = players.filter(p => p.id !== myPlayerId && !p.bankrupt);

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onAction("chat", { name: playerName || "Player", text: chatInput.trim() });
    setChatInput("");
  };

  const SectionHeader = ({ label, icon, isOpen, onToggle, accent = "#38bdf8" }) => (
    <button
      onClick={() => { playClick(); onToggle(!isOpen); }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid rgba(56,189,248,0.15)`,
        padding: "5px 0",
        cursor: "pointer",
        fontFamily: "var(--font-retro)",
        fontSize: "7px",
        color: "#64748b",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        gap: "6px",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "5px", color: accent }}>
        {icon}
        {label}
      </span>
      <span style={{ color: "#475569", fontSize: "9px" }}>{isOpen ? "▲" : "▼"}</span>
    </button>
  );

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: "rgba(2,6,23,0.55)",
      borderLeft: "1px solid rgba(56,189,248,0.2)",
      overflowY: "auto",
      overflowX: "hidden",
    }}>
      {/* ── Header ─────────────────────── */}
      <div style={{
        padding: "10px 14px 8px",
        borderBottom: "1px solid rgba(56,189,248,0.15)",
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: "var(--font-retro)",
          fontSize: "10px",
          color: "#38bdf8",
          fontWeight: "bold",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: "4px",
        }}>
          CONTROL CONSOLE
        </div>

        {winner !== null ? (
          <div style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#34d399", textAlign: "center", fontWeight: "bold" }}
               className="blink">
            ✦ VICTORY ACHIEVED ✦
          </div>
        ) : currPlayerId !== null ? (
          <div style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#64748b", textAlign: "center" }}>
            TURN:{" "}
            <span style={{ color: TOKEN_COLORS[players.find(p => p.id === currPlayerId)?.token], fontWeight: "bold" }}>
              {players.find(p => p.id === currPlayerId)?.name}
            </span>
          </div>
        ) : null}
      </div>

      {/* ── Player standings ───────────── */}
      <div style={{ padding: "8px 12px", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-retro)", fontSize: "6px", color: "#475569", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "5px" }}>
          STANDINGS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {players.map(p => {
            const isCurrent = p.id === currPlayerId && winner === null;
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "5px 8px",
                  background: isCurrent ? "rgba(56,189,248,0.08)" : "rgba(15,23,42,0.3)",
                  border: isCurrent ? "1px solid rgba(56,189,248,0.35)" : "1px solid rgba(15,23,42,0.4)",
                  boxShadow: isCurrent ? "0 0 8px rgba(56,189,248,0.1)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{
                    width: "6px", height: "6px",
                    background: p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#38bdf8",
                    boxShadow: `0 0 5px ${p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#38bdf8"}`,
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontFamily: "var(--font-retro)",
                    fontSize: "9px",
                    color: p.bankrupt ? "#475569" : "#e2e8f0",
                    textDecoration: p.bankrupt ? "line-through" : "none",
                    maxWidth: "100px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {p.name} {p.id === myPlayerId && "(YOU)"}
                  </span>
                </div>
                <span style={{
                  fontFamily: "var(--font-retro)",
                  fontSize: "9px",
                  fontWeight: "bold",
                  color: p.bankrupt ? "#ef4444" : p.in_jail ? "#fbbf24" : "#34d399",
                }}>
                  {p.bankrupt ? "BKRPT" : p.in_jail ? "JAIL" : `$${p.money}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Dice display ───────────────── */}
      {dice && winner === null && phase !== "lobby" && (
        <div style={{ display: "flex", justifyContent: "center", gap: "12px", padding: "8px 12px", borderTop: "1px solid rgba(15,23,42,0.4)", borderBottom: "1px solid rgba(15,23,42,0.4)", flexShrink: 0, flexWrap: "wrap" }}>
          <DiceIcon value={displayDice[0]} size={34} />
          <DiceIcon value={displayDice[1]} size={34} />
          {speed_die && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              <div style={{
                width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${speed_die.type === 'mr_monopoly' ? '#f59e0b' : speed_die.type === 'bus' ? '#8b5cf6' : '#38bdf8'}`,
                borderRadius: 4, background: "rgba(0,0,0,0.4)",
                fontFamily: "var(--font-retro)", fontSize: speed_die.type === 'move' ? "16px" : "10px",
                color: speed_die.type === 'mr_monopoly' ? '#f59e0b' : speed_die.type === 'bus' ? '#8b5cf6' : '#38bdf8',
                fontWeight: "bold",
              }}>
                {speed_die.type === 'move' ? speed_die.face : speed_die.type === 'bus' ? 'BUS' : 'MR.M'}
              </div>
              <span style={{ fontFamily: "var(--font-retro)", fontSize: "6px", color: "#475569", textTransform: "uppercase" }}>
                SPEED
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Action buttons ─────────────── */}
      {winner === null && (
        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>


          {/* Manage + Trade buttons */}
          {!isBankrupt && (
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                className="btn-retro"
                style={{ flex: 1, fontSize: "8px", padding: "7px 4px" }}
                onClick={() => { playClick(); onOpenManage(); }}
                disabled={inDebt}
              >
                <ManageIcon size={10} />
                <span style={{ marginLeft: "4px" }}>PORTFOLIO</span>
              </button>
              <button
                className="btn-retro"
                style={{ flex: 1, fontSize: "8px", padding: "7px 4px" }}
                onClick={() => { playClick(); setTradeOpen(v => !v); }}
                disabled={activeOpponents.length === 0 || inDebt}
              >
                <TradeIcon size={10} />
                <span style={{ marginLeft: "4px" }}>SWAP</span>
              </button>
            </div>
          )}

          {/* Turn controls */}
          {isMyTurn && (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", opacity: animationsBusy ? 0.55 : 1, pointerEvents: animationsBusy ? "none" : "auto" }}>
              {phase === "turn" && (
                <>
                  {myPlayer?.in_jail ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <button className="btn-retro btn-retro-green" style={{ width: "100%", fontWeight: "bold", fontSize: "9px" }} onClick={() => onAction("roll_dice")}>
                        ROLL FOR DOUBLES
                      </button>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button className="btn-retro" style={{ flex: 1, fontSize: "8px" }} disabled={myPlayer?.money < 50} onClick={() => onAction("pay_jail_fine")}>
                          PAY $50
                        </button>
                        <button className="btn-retro" style={{ flex: 1, fontSize: "8px" }} disabled={myPlayer?.jail_cards === 0} onClick={() => onAction("use_jail_card")}>
                          CARD ({myPlayer?.jail_cards})
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn-retro btn-retro-green" style={{ width: "100%", fontWeight: "bold", padding: "10px", fontSize: "10px" }} onClick={() => onAction("roll_dice")}>
                      ROLL DICE
                    </button>
                  )}
                </>
              )}

              {phase === "speed_bus" && speed_die_choice && (
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#8b5cf6", textAlign: "center" }}>
                    BUS — choose movement:
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    {speed_die_choice.map((steps, i) => (
                      <button
                        key={i}
                        className="btn-retro"
                        style={{ flex: 1, fontSize: "9px", fontWeight: "bold", borderColor: "#8b5cf6", color: "#8b5cf6" }}
                        onClick={() => onAction("choose_bus_route", { steps })}
                      >
                        {steps}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {phase === "buy_decision" && gameState.can_buy !== null && (
                <div style={{ display: "flex", gap: "5px" }}>
                  <button className="btn-retro btn-retro-green" style={{ flex: 1, fontWeight: "bold", fontSize: "9px" }} onClick={() => onAction("buy_property")}>
                    BUY
                  </button>
                  <button className="btn-retro btn-retro-red" style={{ flex: 1, fontWeight: "bold", fontSize: "9px" }} onClick={() => onAction("decline_buy")}>
                    SKIP
                  </button>
                </div>
              )}

              {phase === "post_roll" && (
                <button className="btn-retro btn-retro-green" style={{ width: "100%", fontWeight: "bold", fontSize: "9px" }} onClick={() => onAction("end_turn")}>
                  {extra_roll ? "ROLL AGAIN (DOUBLES)" : "END TURN"}
                </button>
              )}

              {inDebt && debtor_id === myPlayerId && (
                <button className="btn-retro btn-retro-red" style={{ width: "100%", fontWeight: "bold", padding: "8px", fontSize: "9px" }} onClick={() => onAction("declare_bankruptcy")}>
                  DECLARE BANKRUPTCY
                </button>
              )}
            </div>
          )}

          {/* Waiting messages */}
          {inDebt && debtor_id !== myPlayerId && (
            <div style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#ef4444", padding: "8px", background: "rgba(69,10,10,0.1)", border: "1px solid rgba(239,68,68,0.2)", textAlign: "center" }}
                 className="animate-pulse">
              <AlertIcon size={9} color="#ef4444" /> Waiting: {players.find(p => p.id === debtor_id)?.name} resolving debt
            </div>
          )}
          {!isMyTurn && !inDebt && phase !== "lobby" && (
            <div style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#475569", padding: "7px", background: "rgba(15,23,42,0.15)", border: "1px solid rgba(15,23,42,0.3)", textAlign: "center" }}>
              <AlertIcon size={9} color="#475569" /> Waiting for turn...
            </div>
          )}

          {/* Host: end game */}
          {isHost && phase !== "game_over" && (
            confirmEnd ? (
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  className="btn-retro"
                  style={{ flex: 1, fontSize: "8px", color: "#ef4444", borderColor: "rgba(239,68,68,0.5)", background: "rgba(69,10,10,0.3)" }}
                  onClick={() => { playClick(); setConfirmEnd(false); onEndGame(); }}
                >
                  CONFIRM END
                </button>
                <button
                  className="btn-retro"
                  style={{ fontSize: "8px", color: "#64748b", borderColor: "rgba(15,23,42,0.5)", padding: "4px 8px" }}
                  onClick={() => { playClick(); setConfirmEnd(false); }}
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <button
                className="btn-retro"
                style={{ width: "100%", fontSize: "8px", color: "#ef4444", borderColor: "rgba(239,68,68,0.4)" }}
                onClick={() => { playClick(); setConfirmEnd(true); }}
              >
                <AlertIcon size={10} color="#ef4444" />
                <span style={{ marginLeft: "4px" }}>END GAME (HOST)</span>
              </button>
            )
          )}

          {/* Settings button */}
          <button
            className="btn-retro"
            style={{ width: "100%", fontSize: "8px", color: "#64748b", borderColor: "rgba(15,23,42,0.5)" }}
            onClick={() => { playClick(); onOpenSettings(); }}
          >
            <SettingsIcon size={10} />
            <span style={{ marginLeft: "4px" }}>CLIENT SETTINGS</span>
          </button>
        </div>
      )}

      {/* ── Expandable Stats section ───── */}
      <div style={{ padding: "0 12px", flexShrink: 0 }}>
        <SectionHeader
          label="STATS & HISTORY"
          icon={<StatsIcon size={9} color="#38bdf8" />}
          isOpen={statsOpen}
          onToggle={setStatsOpen}
        />
        {statsOpen && (
          <div style={{ paddingTop: "6px", paddingBottom: "6px" }}>
            <StatsScreen gameState={gameState} />
          </div>
        )}
      </div>

      {/* ── Expandable Trade Broker ────── */}
      {!isBankrupt && (
        <div style={{ padding: "0 12px", flexShrink: 0 }}>
          <SectionHeader
            label="SWAP BROKER"
            icon={<TradeIcon size={9} color="#fbbf24" />}
            isOpen={tradeOpen}
            onToggle={setTradeOpen}
            accent="#fbbf24"
          />
          {tradeOpen && (
            <div style={{ paddingTop: "6px", paddingBottom: "6px" }}>
              <TradeBroker
                gameState={gameState}
                myPlayerId={myPlayerId}
                onAction={onAction}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Chat / Log section ─────────── */}
      <div style={{
        marginTop: "auto",
        borderTop: "1px solid rgba(56,189,248,0.12)",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Log header with minimize toggle */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 12px",
          cursor: "pointer",
        }}
          onClick={() => { playClick(); setLogMinimized(v => !v); }}
        >
          <span style={{ fontFamily: "var(--font-retro)", fontSize: "7px", color: "#f59e0b", letterSpacing: "0.15em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "5px" }}>
            <ChatIcon size={9} color="#f59e0b" /> CONSOLE LOG
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{
              width: "5px", height: "5px",
              background: "#22c55e",
              boxShadow: "0 0 5px #22c55e",
              display: "inline-block",
              animation: "pulse-anim 2s infinite",
            }} />
            <button
              style={{
                fontFamily: "var(--font-retro)",
                fontSize: "8px",
                background: "transparent",
                border: "1px solid rgba(56,189,248,0.2)",
                color: "#64748b",
                cursor: "pointer",
                padding: "1px 5px",
                lineHeight: 1,
              }}
              onClick={e => { e.stopPropagation(); playClick(); setLogMinimized(v => !v); }}
              title={logMinimized ? "Expand log" : "Minimize log"}
            >
              {logMinimized ? "▲ SHOW" : "▼ HIDE"}
            </button>
          </div>
        </div>

        {/* Log content */}
        {!logMinimized && (
          <div style={{ padding: "0 12px 8px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {/* Scrollable log feed */}
            <div style={{
              height: "100px",
              overflowY: "auto",
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(15,23,42,0.5)",
              padding: "6px",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              scrollbarWidth: "thin",
            }}>
              {log && log.slice(-30).map((l, i) => (
                <div key={i} style={{
                  fontFamily: "var(--font-retro)",
                  fontSize: "7px",
                  color: "#94a3b8",
                  lineHeight: 1.4,
                }}>
                  <span style={{ color: "#475569" }}>&gt;</span> {l}
                </div>
              ))}
            </div>

            {/* Chat input */}
            <form onSubmit={handleChatSubmit} style={{ display: "flex", gap: "5px" }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type message..."
                maxLength={60}
                className="retro-input"
                style={{ flex: 1, padding: "5px 7px", fontSize: "8px", fontFamily: "var(--font-retro)" }}
              />
              <button type="submit" className="btn-retro" style={{ padding: "5px 8px", fontSize: "7px" }}>
                <ChatIcon size={9} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
