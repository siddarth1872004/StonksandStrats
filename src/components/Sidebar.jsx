import { useState, useEffect, useRef } from "react";
import { TOKEN_COLORS } from "../boardData";
import { ManageIcon, TradeIcon, SettingsIcon } from "../lib/icons";
import { playClick } from "../lib/audio";
import { calcNetWorth } from "../lib/gameEngine";
import { EmoteBar } from "./Emotes";

// Condense raw log lines into a deduped, concise activity stream for the feed.
function abstractFeed(log) {
  const recent = (log || []).slice(-120);
  const base = log ? log.length - recent.length : 0;
  const groups = [];
  for (let i = 0; i < recent.length; i++) {
    const text = recent[i];
    const prev = groups[groups.length - 1];
    if (prev && prev.text === text) { prev.count++; prev.key = base + i; }
    else groups.push({ text, count: 1, key: base + i });
  }
  return groups.slice(-60).reverse();
}

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
  return { icon: "▶", color: "#374151" };
}

const tokenColor = (p) => p.token_color || TOKEN_COLORS[p.token_shape || p.token] || "#38bdf8";

// ── Hoisted presentational pieces (module scope → stable identity, no re-creation) ──
function Section({ label, right }) {
  return (
    <div className="mk-section">
      <span>{label}</span>
      {right && <span>{right}</span>}
    </div>
  );
}

function Btn({ children, onClick, disabled, style, variant }) {
  const base = {
    fontFamily: "var(--font-retro)",
    fontSize: "clamp(8px, 1.4vw, 10px)",
    background: "rgba(10,14,24,0.7)",
    border: "2px solid rgba(255,179,0,0.2)",
    color: "#cbd5e1",
    padding: "8px",
    minHeight: "30px",
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
}

// Live countdown driven by game_state.turn_deadline (set by the host). All clients
// render the same number; the host enforces the auto-action when it hits zero.
function TurnTimer({ deadline }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const danger = remaining <= 10;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
      padding: "4px 10px", flexShrink: 0,
      background: danger ? "rgba(69,10,10,0.35)" : "rgba(0,0,0,0.25)",
      borderBottom: "1px solid rgba(255,179,0,0.08)",
    }}>
      <span style={{ fontFamily: "var(--font-retro)", fontSize: "6px", color: "#64748b", letterSpacing: "0.15em" }}>TURN TIMER</span>
      <span style={{
        fontFamily: "var(--font-retro)", fontSize: "clamp(9px,1.6vw,12px)", fontWeight: "bold",
        color: danger ? "#f87171" : "#fbbf24",
        animation: danger ? "timer-pulse 1s infinite" : "none",
      }}>
        {remaining}s
      </span>
    </div>
  );
}

export default function Sidebar({
  gameState,
  myPlayerId,
  playerName,
  animationsBusy,
  isHost,
  stacked = false,
  onEndGame,
  onAction,
  onEmote,
  onOpenManage,
  onOpenTrade,
  onOpenSettings,
}) {
  const [chatInput, setChatInput] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const chatEndRef = useRef(null);

  const chatLog = gameState?.chat_log || [];
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [chatLog.length]);

  if (!gameState) return null;

  const {
    players, speed_die_choice,
    phase, current, order, log, winner, debtor_id, extra_roll, turn_deadline,
  } = gameState;

  const currPlayerId = order?.[current] ?? null;
  const isMyTurn = currPlayerId === myPlayerId;
  const inDebt = phase === "debt";
  const myPlayer = players.find(p => p.id === myPlayerId);
  const isBankrupt = myPlayer?.bankrupt || false;
  const activeOpponents = players.filter(p => p.id !== myPlayerId && !p.bankrupt);

  const sortedPlayers = [...players].sort((a, b) => {
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    if (a.id === currPlayerId) return -1;
    if (b.id === currPlayerId) return 1;
    return b.money - a.money;
  });

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onAction("chat", { name: playerName || "Player", text: chatInput.trim(), color: myPlayer ? tokenColor(myPlayer) : null });
    setChatInput("");
  };

  const showTimer = turn_deadline && winner === null && phase !== "lobby" && !["game_over"].includes(phase);

  return (
    <div style={{
      width: "100%",
      height: stacked ? "auto" : "100%",
      display: "flex",
      flexDirection: "column",
      background: "#050810",
      borderLeft: stacked ? "none" : "2px solid rgba(255,179,0,0.18)",
      borderTop: stacked ? "2px solid rgba(255,179,0,0.18)" : "none",
      overflow: "hidden",
    }}>

      {showTimer && <TurnTimer deadline={turn_deadline} />}

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
          const netWorth = p.bankrupt ? 0 : calcNetWorth(gameState, p.id);
          return (
            <div
              key={p.id}
              className={isCurrent ? "row-active-sheen" : ""}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                padding: "6px 10px 6px 7px",
                borderBottom: "1px solid rgba(255,179,0,0.05)",
                borderLeft: `3px solid ${isCurrent ? color : "transparent"}`,
                background: isCurrent ? `${color}12` : "transparent",
              }}
            >
              <span style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#334155", flexShrink: 0, width: "10px", textAlign: "right" }}>
                {idx + 1}
              </span>
              <span style={{
                width: "9px", height: "9px", flexShrink: 0,
                background: p.bankrupt ? "#374151" : color,
                boxShadow: isCurrent ? `0 0 8px ${color}90` : "none",
              }} />
              <span style={{
                fontFamily: "var(--font-retro)",
                fontSize: "clamp(10px, 1.6vw, 13px)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: p.bankrupt ? "#374151" : isCurrent ? "#f1f5f9" : "#94a3b8",
                textDecoration: p.bankrupt ? "line-through" : "none",
              }}>
                {p.name}{isMe ? " ★" : ""}{p.is_bot ? ` [${(p.difficulty || "ai").slice(0,1).toUpperCase()}]` : ""}
              </span>
              <span style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#334155", flexShrink: 0 }}>
                {netWorthPropCount}⌂
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, minWidth: "58px" }}>
                <span style={{
                  fontFamily: "var(--font-retro)",
                  fontSize: "clamp(10px, 1.6vw, 13px)",
                  fontWeight: "bold",
                  color: p.bankrupt ? "#EF4444" : p.in_jail ? "#F59E0B" : isCurrent ? "#FFB300" : "#34d399",
                }}>
                  {p.bankrupt ? "OUT" : p.in_jail ? "⊗JAIL" : `$${p.money.toLocaleString()}`}
                </span>
                {!p.bankrupt && (
                  <span style={{ fontFamily: "var(--font-retro)", fontSize: "7px", color: "#475569" }}>
                    NW ${netWorth.toLocaleString()}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── ACTIONS ───────────────────────────────────────────── */}
      {winner === null && (
        <>
          <Section label="ACTIONS" right={isMyTurn && !inDebt && phase !== "lobby" ? <span style={{ color: "#34d399" }}>YOUR TURN</span> : null} />
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
                        <Btn style={{ flex: 1, fontSize: "9px" }} disabled={myPlayer?.money < 50} onClick={() => onAction("pay_jail_fine")}>PAY $50</Btn>
                        <Btn style={{ flex: 1, fontSize: "9px" }} disabled={!myPlayer?.jail_cards} onClick={() => onAction("use_jail_card")}>
                          GET OUT CARD ({myPlayer?.jail_cards})
                        </Btn>
                      </div>
                    </div>
                  ) : (
                    <Btn variant="green" style={{ width: "100%", fontWeight: "bold", padding: "12px", fontSize: "clamp(10px,1.8vw,12px)" }} onClick={() => onAction("roll_dice")}>
                      ⚂ ROLL DICE
                    </Btn>
                  )
                )}

                {phase === "speed_bus" && speed_die_choice && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#8B5CF6", textAlign: "center", padding: "2px 0" }}>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <Btn variant="green" style={{ width: "100%", fontWeight: "bold", fontSize: "10px", padding: "10px" }} onClick={() => onAction("buy_property")}>⌂ BUY</Btn>
                    <div style={{ display: "flex", gap: "5px" }}>
                      <Btn variant="amber" style={{ flex: 1, fontWeight: "bold", fontSize: "9px" }} onClick={() => onAction("decline_buy", { auction: true })}>⚖ AUCTION</Btn>
                      <Btn variant="red" style={{ flex: 1, fontWeight: "bold", fontSize: "9px" }} onClick={() => onAction("decline_buy", { auction: false })}>PASS</Btn>
                    </div>
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
              <div style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#475569", padding: "7px 8px", border: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
                WAITING FOR {players.find(p => p.id === currPlayerId)?.name?.toUpperCase() || "TURN"}…
              </div>
            )}
            {inDebt && debtor_id !== myPlayerId && (
              <div className="animate-pulse" style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#f87171", padding: "7px 8px", border: "1px solid rgba(239,68,68,0.2)", textAlign: "center", background: "rgba(69,10,10,0.15)" }}>
                ⚠ {players.find(p => p.id === debtor_id)?.name} RESOLVING DEBT
              </div>
            )}

            {/* Portfolio + Trade row */}
            {!isBankrupt && (
              <div style={{ display: "flex", gap: "5px" }}>
                <Btn style={{ flex: 1, fontSize: "9px", padding: "8px 4px" }} onClick={() => { playClick(); onOpenManage(); }} disabled={inDebt}>
                  <ManageIcon size={10} /><span>PORTFOLIO</span>
                </Btn>
                <Btn
                  style={{ flex: 1, fontSize: "9px", padding: "8px 4px" }}
                  onClick={() => { playClick(); onOpenTrade?.(); }}
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
                  <Btn variant="red" style={{ flex: 1, fontSize: "9px" }} onClick={() => { playClick(); setConfirmEnd(false); onEndGame(); }}>
                    ✓ CONFIRM END
                  </Btn>
                  <Btn style={{ fontSize: "9px", padding: "4px 8px" }} onClick={() => { playClick(); setConfirmEnd(false); }}>✕</Btn>
                </div>
              ) : (
                <Btn style={{ width: "100%", fontSize: "9px", color: "#ef4444", borderColor: "rgba(239,68,68,0.25)", padding: "6px" }} onClick={() => { playClick(); setConfirmEnd(true); }}>
                  END GAME (HOST)
                </Btn>
              )
            )}

            {/* Settings */}
            <Btn style={{ width: "100%", fontSize: "9px", color: "#475569", borderColor: "rgba(255,255,255,0.06)", padding: "5px" }} onClick={() => { playClick(); onOpenSettings(); }}>
              <SettingsIcon size={9} /><span>SETTINGS</span>
            </Btn>
          </div>
        </>
      )}


      {/* ── LIVE FEED ─────────────────────────────────────────── */}
      <div className="mk-section">
        <span>LIVE FEED</span>
        <span style={{ width: "6px", height: "6px", background: "#22c55e", borderRadius: "50%", display: "inline-block", animation: "pulse-anim 2s infinite" }} />
      </div>
      <div style={{
        flex: stacked ? "none" : 1,
        height: stacked ? "150px" : "auto",
        overflowY: "auto",
        padding: "5px 10px",
        display: "flex",
        flexDirection: "column",
        gap: "0",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,179,0,0.12) transparent",
        minHeight: "80px",
      }}>
        {abstractFeed(log).map((g, i) => {
          const { icon, color } = feedCategory(g.text);
          const isLatest = i === 0;
          const isRecent = i < 3;
          return (
            <div
              key={g.key}
              className="feed-in"
              style={{
                fontFamily: "var(--font-retro)",
                fontSize: "clamp(9px, 1.3vw, 11px)",
                color: isLatest ? "#e5e7eb" : isRecent ? "#6b7280" : "#374151",
                lineHeight: "1.7",
                borderLeft: `2px solid ${isLatest ? color : isRecent ? `${color}40` : "rgba(255,255,255,0.03)"}`,
                paddingLeft: "6px",
                display: "flex",
                gap: "4px",
                alignItems: "flex-start",
              }}
            >
              <span style={{ color: isLatest ? color : isRecent ? `${color}60` : "rgba(255,255,255,0.06)", flexShrink: 0 }}>{icon}</span>
              <span style={{ wordBreak: "break-word", flex: 1 }}>{g.text}</span>
              {g.count > 1 && (
                <span style={{ flexShrink: 0, color, opacity: 0.7, fontSize: "8px" }}>×{g.count}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── CHAT STREAM ───────────────────────────────────────── */}
      {chatLog.length > 0 && (
        <div style={{
          flexShrink: 0,
          maxHeight: "110px",
          overflowY: "auto",
          padding: "4px 10px",
          borderTop: "1px solid rgba(255,179,0,0.08)",
          background: "rgba(0,0,0,0.2)",
          scrollbarWidth: "thin",
        }}>
          {chatLog.slice(-40).map((c, i) => (
            <div key={i} style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(9px,1.3vw,11px)", lineHeight: 1.7, color: "#cbd5e1", wordBreak: "break-word" }}>
              <span style={{ color: c.color || "#fbbf24", fontWeight: "bold" }}>{c.name}:</span> {c.text}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* ── EMOTES ────────────────────────────────────────────── */}
      {onEmote && (
        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,179,0,0.08)", background: "rgba(0,0,0,0.25)" }}>
          <EmoteBar onEmote={onEmote} compact />
        </div>
      )}

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
          maxLength={80}
          style={{
            flex: 1,
            padding: "6px",
            fontSize: "clamp(8px,1.4vw,10px)",
            fontFamily: "var(--font-retro)",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,179,0,0.15)",
            color: "#cbd5e1",
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            fontFamily: "var(--font-retro)",
            fontSize: "10px",
            background: "rgba(10,14,24,0.7)",
            border: "1px solid rgba(255,179,0,0.2)",
            color: "#FFB300",
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >▶</button>
      </form>
    </div>
  );
}
