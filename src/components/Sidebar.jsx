import { useState, useEffect, useRef } from "react";
import { TOKEN_COLORS, TILES, GROUPS, GROUP_COLORS } from "../boardData";
import { ManageIcon, TradeIcon, SettingsIcon, HouseIcon } from "../lib/icons";
import { playClick } from "../lib/audio";
import { calcNetWorth } from "../lib/gameEngine";
import { EmoteBar } from "./Emotes";
import { TradeBuilder, TradeOfferView } from "./TradeBroker";

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
    fontSize: "clamp(12px, 1.6vw, 15px)",
    background: "rgba(10,14,24,0.7)",
    border: "1px solid rgba(255,179,0,0.22)",
    color: "#cbd5e1",
    padding: "8px 10px",
    minHeight: "32px",
    borderRadius: "8px",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    opacity: disabled ? 0.4 : 1,
    letterSpacing: "0.04em",
    transition: "border-color 0.12s, color 0.12s, background 0.12s",
    ...style,
  };
  if (variant === "green") { base.border = "1px solid rgba(52,211,153,0.55)"; base.color = "#34d399"; base.background = "rgba(5,46,22,0.35)"; }
  if (variant === "red")   { base.border = "1px solid rgba(239,68,68,0.5)"; base.color = "#f87171"; base.background = "rgba(69,10,10,0.35)"; }
  if (variant === "amber") { base.border = "1px solid rgba(255,179,0,0.5)"; base.color = "#FFB300"; base.background = "rgba(30,20,0,0.45)"; }
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

// Inline portfolio: the player's deeds with build/sell/mortgage actions, shown
// inside the sidebar tab (no separate window).
function PortfolioPanel({ gameState, myPlayerId, onAction }) {
  const p = gameState.players.find(x => x.id === myPlayerId);
  const myProps = p?.properties || [];
  const houses = gameState.houses || {};
  const mortgaged = gameState.mortgaged || [];
  const netWorth = calcNetWorth(gameState, myPlayerId);
  const cash = p?.money || 0;

  const grouped = {};
  const misc = [];
  for (const tid of myProps) {
    const tile = TILES.find(t => t.id === tid);
    if (!tile) continue;
    if (tile.group && tile.group !== "railroad" && tile.group !== "utility") {
      (grouped[tile.group] ||= []).push(tid);
    } else misc.push(tid);
  }

  const act = (action, tid) => { playClick(); onAction(action, { tileId: tid }); };

  const deed = (tid) => {
    const tile = TILES.find(t => t.id === tid);
    if (!tile) return null;
    const isMort = mortgaged.includes(tid);
    const h = houses[tid.toString()] || 0;
    const hasColor = tile.group && tile.group !== "railroad" && tile.group !== "utility";
    const gColor = hasColor ? GROUP_COLORS[tile.group] : tile.group === "railroad" ? "#94a3b8" : "#38bdf8";
    const ownsAll = hasColor ? GROUPS[tile.group].every(sid => gameState.owner[sid.toString()] === myPlayerId) : false;
    const groupHasHouses = hasColor ? GROUPS[tile.group].some(sid => (houses[sid.toString()] || 0) > 0) : false;
    const canBuild = ownsAll && !isMort && h < 5 && cash >= (tile.houseCost || 0);
    const canSell = h > 0;
    const canMort = !isMort && !groupHasHouses;
    const canRedeem = isMort && cash >= Math.round((tile.mortgage || 0) * 1.1);
    return (
      <div key={tid} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 5px", background: isMort ? "rgba(69,10,10,0.18)" : "rgba(0,0,0,0.3)", borderLeft: `3px solid ${isMort ? "#ef4444" : gColor}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(8px,1.3vw,10px)", color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tile.name}</div>
          <div style={{ fontFamily: "var(--font-retro)", fontSize: "7px", color: isMort ? "#ef4444" : "#475569" }}>
            {isMort ? "MORTGAGED" : h === 5 ? "★ HOTEL" : h > 0 ? `${h} house${h > 1 ? "s" : ""}` : "unimproved"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
          {hasColor && ownsAll && !isMort && (
            <>
              <button title={`Build ($${tile.houseCost})`} disabled={!canBuild} onClick={() => act("build_house", tid)}
                style={{ fontFamily: "var(--font-retro)", fontSize: "8px", padding: "3px 5px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399", cursor: canBuild ? "pointer" : "not-allowed", opacity: canBuild ? 1 : 0.35 }}>
                <HouseIcon size={8} color="currentColor" />+
              </button>
              <button title="Sell house" disabled={!canSell} onClick={() => act("sell_house", tid)}
                style={{ fontFamily: "var(--font-retro)", fontSize: "8px", padding: "3px 5px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24", cursor: canSell ? "pointer" : "not-allowed", opacity: canSell ? 1 : 0.35 }}>
                <HouseIcon size={8} color="currentColor" />−
              </button>
            </>
          )}
          {!isMort ? (
            <button title={`Mortgage (+$${tile.mortgage})`} disabled={!canMort} onClick={() => act("mortgage", tid)}
              style={{ fontFamily: "var(--font-retro)", fontSize: "8px", padding: "3px 5px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171", cursor: canMort ? "pointer" : "not-allowed", opacity: canMort ? 1 : 0.35 }}>
              MRTG
            </button>
          ) : (
            <button title={`Redeem ($${Math.round((tile.mortgage || 0) * 1.1)})`} disabled={!canRedeem} onClick={() => act("unmortgage", tid)}
              style={{ fontFamily: "var(--font-retro)", fontSize: "8px", padding: "3px 5px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399", cursor: canRedeem ? "pointer" : "not-allowed", opacity: canRedeem ? 1 : 0.35 }}>
              REDEEM
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "6px 8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-retro)", fontSize: "8px" }}>
        <span style={{ color: "#FFB300" }}>NW ${netWorth.toLocaleString()}</span>
        <span style={{ color: "#34d399" }}>CASH ${cash.toLocaleString()}</span>
      </div>
      {myProps.length === 0 ? (
        <div style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#334155", textAlign: "center", padding: "20px 0" }}>
          No deeds yet — buy properties to build your portfolio.
        </div>
      ) : (
        <>
          {Object.entries(grouped).map(([g, tids]) => (
            <div key={g} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "9px", height: "9px", background: GROUP_COLORS[g] }} />
                <span style={{ fontFamily: "var(--font-retro)", fontSize: "7px", color: "#94a3b8", letterSpacing: "0.1em" }}>{g.toUpperCase()}</span>
                {GROUPS[g] && tids.length === GROUPS[g].length && <span style={{ fontFamily: "var(--font-retro)", fontSize: "6px", color: "#34d399", marginLeft: "auto" }}>★ MONOPOLY</span>}
              </div>
              {tids.map(deed)}
            </div>
          ))}
          {misc.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontFamily: "var(--font-retro)", fontSize: "7px", color: "#94a3b8", letterSpacing: "0.1em" }}>STATIONS & UTILITIES</span>
              {misc.map(deed)}
            </div>
          )}
        </>
      )}
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
  onOpenSettings,
}) {
  const [chatInput, setChatInput] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [tab, setTab] = useState("terminal"); // terminal | portfolio | trade
  const [counterPrefill, setCounterPrefill] = useState(null);
  const chatEndRef = useRef(null);

  const chatLog = gameState?.chat_log || [];
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [chatLog.length]);

  // When a trade offer involving me appears, jump to the Trade tab so it's seen.
  const pending = gameState?.pending_trade;
  const pendingKey = pending ? `${pending.from}->${pending.to}` : "";
  const pendingInvolvesMe = pending && (pending.to === myPlayerId || pending.from === myPlayerId);
  useEffect(() => {
    if (pendingInvolvesMe) { setTab("trade"); setCounterPrefill(null); }
  }, [pendingKey, pendingInvolvesMe]);

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
      background: "linear-gradient(180deg, #07090f 0%, #020308 100%)",
      borderLeft: stacked ? "none" : "1px solid rgba(255,179,0,0.22)",
      borderTop: stacked ? "1px solid rgba(255,179,0,0.22)" : "none",
      overflow: "hidden",
    }}>

      {showTimer && <TurnTimer deadline={turn_deadline} />}

      {/* ── STANDINGS ─────────────────────────────────────────── */}
      <Section
        label="STANDINGS"
        right={winner !== null ? <span style={{ color: "#FFD600", animation: "blink-anim 1.2s infinite" }}>★ GAME OVER</span> : null}
      />
      <div style={{ flexShrink: 0 }}>
        {sortedPlayers.map((p) => {
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
                gap: "8px",
                padding: "7px 10px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                borderLeft: `3px solid ${isCurrent ? color : "transparent"}`,
                background: isCurrent ? `${color}16` : "transparent",
              }}
            >
              <span style={{
                width: "12px", height: "12px", borderRadius: "3px", flexShrink: 0,
                background: p.bankrupt ? "#374151" : color,
                boxShadow: isCurrent ? `0 0 9px ${color}` : "none",
                border: isMe ? "1.5px solid rgba(255,255,255,0.7)" : "none",
              }} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
                <span style={{
                  fontFamily: "var(--font-retro)",
                  fontSize: "clamp(9px, 1.5vw, 12px)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: p.bankrupt ? "#475569" : isCurrent ? "#f8fafc" : "#cbd5e1",
                  textDecoration: p.bankrupt ? "line-through" : "none",
                }}>
                  {p.name}{isMe ? " ★" : ""}{p.is_bot ? ` [${(p.difficulty || "ai").slice(0,1).toUpperCase()}]` : ""}
                </span>
                {!p.bankrupt && (
                  <span style={{ fontFamily: "var(--font-retro)", fontSize: "7px", color: "#475569" }}>
                    {netWorthPropCount}⌂ · NW ${netWorth.toLocaleString()}
                  </span>
                )}
              </div>
              <span style={{
                fontFamily: "var(--font-retro)",
                fontSize: "clamp(10px, 1.6vw, 13px)",
                fontWeight: "bold", flexShrink: 0, textAlign: "right",
                color: p.bankrupt ? "#EF4444" : p.in_jail ? "#F59E0B" : isCurrent ? "#FFB300" : "#34d399",
              }}>
                {p.bankrupt ? "OUT" : p.in_jail ? "⊗ JAIL" : `$${p.money.toLocaleString()}`}
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

            {/* Portfolio + Trade — open inline in the panel below (not popups) */}
            {!isBankrupt && (
              <div style={{ display: "flex", gap: "5px" }}>
                <Btn style={{ flex: 1, fontSize: "9px", padding: "8px 4px" }} onClick={() => { playClick(); setTab("portfolio"); }}>
                  <ManageIcon size={10} /><span>PORTFOLIO</span>
                </Btn>
                <Btn
                  style={{ flex: 1, fontSize: "9px", padding: "8px 4px" }}
                  onClick={() => { playClick(); setCounterPrefill(null); setTab("trade"); }}
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


      {/* ── TABS: TERMINAL | PORTFOLIO | TRADE (all inline, no popups) ── */}
      <div style={{ display: "flex", flexShrink: 0, borderTop: "1px solid rgba(255,179,0,0.12)", borderBottom: "1px solid rgba(255,179,0,0.12)" }}>
        {[["terminal", "TERMINAL"], ["portfolio", "PORTFOLIO"], ["trade", "TRADE"]].map(([id, label]) => (
          <button key={id} onClick={() => { playClick(); setTab(id); }}
            style={{
              flex: 1, fontFamily: "var(--font-retro)", fontSize: "8px", padding: "6px 3px",
              background: tab === id ? "rgba(255,179,0,0.1)" : "transparent",
              border: "none", borderBottom: `2px solid ${tab === id ? "#FFB300" : "transparent"}`,
              color: tab === id ? "#FFB300" : (id === "trade" && pendingInvolvesMe) ? "#22d3ee" : "#64748b",
              cursor: "pointer", letterSpacing: "0.08em",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "3px",
            }}>
            {id === "portfolio" ? <ManageIcon size={9} /> : id === "trade" ? <TradeIcon size={9} /> : "▌"}
            {label}{id === "trade" && pendingInvolvesMe ? " ●" : ""}
          </button>
        ))}
      </div>

      {/* Tab content fills the remaining space */}
      <div style={{ flex: stacked ? "none" : 1, height: stacked ? "240px" : "auto", minHeight: "120px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "portfolio" ? (
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin" }}>
            <PortfolioPanel gameState={gameState} myPlayerId={myPlayerId} onAction={onAction} />
          </div>
        ) : tab === "trade" ? (
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin" }}>
            {pendingInvolvesMe && !counterPrefill ? (
              <TradeOfferView gameState={gameState} myPlayerId={myPlayerId} onAction={onAction}
                onCounter={() => {
                  const o = pending.offer || {};
                  setCounterPrefill({
                    targetPid: pending.from,
                    give: { cash: o.to_money || 0, cards: o.to_cards || 0, props: o.to_properties || [] },
                    get: { cash: o.from_money || 0, cards: o.from_cards || 0, props: o.from_properties || [] },
                  });
                }} />
            ) : (
              <TradeBuilder gameState={gameState} myPlayerId={myPlayerId} onAction={onAction}
                prefill={counterPrefill} onClose={() => setCounterPrefill(null)} />
            )}
          </div>
        ) : (
          <>
            {/* Activity log (events) */}
            <div style={{ flex: 1, overflowY: "auto", padding: "5px 10px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,179,0,0.12) transparent", minHeight: "60px" }}>
              {abstractFeed(log).map((g, i) => {
                const { icon, color } = feedCategory(g.text);
                const isLatest = i === 0;
                return (
                  <div key={g.key} className="feed-in" style={{
                    fontFamily: "var(--font-retro)", fontSize: "clamp(8px,1.25vw,10px)",
                    color: isLatest ? "#e5e7eb" : i < 4 ? "#6b7280" : "#374151", lineHeight: "1.6",
                    borderLeft: `2px solid ${isLatest ? color : i < 4 ? `${color}40` : "rgba(255,255,255,0.03)"}`,
                    paddingLeft: "6px", display: "flex", gap: "4px", alignItems: "flex-start",
                  }}>
                    <span style={{ color: isLatest ? color : `${color}60`, flexShrink: 0 }}>{icon}</span>
                    <span style={{ wordBreak: "break-word", flex: 1 }}>{g.text}</span>
                    {g.count > 1 && <span style={{ flexShrink: 0, color, opacity: 0.7, fontSize: "8px" }}>×{g.count}</span>}
                  </div>
                );
              })}
            </div>
            {/* Chat stream */}
            <div style={{ flexShrink: 0, maxHeight: "96px", overflowY: "auto", padding: "4px 10px", borderTop: "1px solid rgba(255,179,0,0.08)", background: "rgba(0,0,0,0.2)", scrollbarWidth: "thin" }}>
              {chatLog.length === 0 && (
                <div style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#475569", fontStyle: "italic" }}>Say something…</div>
              )}
              {chatLog.slice(-60).map((c, i) => (
                <div key={i} style={{ fontFamily: "var(--font-retro)", fontSize: "clamp(9px,1.3vw,11px)", lineHeight: 1.7, color: "#cbd5e1", wordBreak: "break-word" }}>
                  <span style={{ color: c.color || "#fbbf24", fontWeight: "bold" }}>{c.name}:</span> {c.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {onEmote && (
              <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,179,0,0.08)", background: "rgba(0,0,0,0.25)" }}>
                <EmoteBar onEmote={onEmote} compact />
              </div>
            )}
            <form onSubmit={handleChatSubmit} style={{ display: "flex", gap: "4px", padding: "5px 8px", borderTop: "1px solid rgba(255,179,0,0.1)", background: "rgba(0,0,0,0.3)", flexShrink: 0 }}>
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="message…" maxLength={80}
                style={{ flex: 1, padding: "6px", fontSize: "clamp(8px,1.4vw,10px)", fontFamily: "var(--font-retro)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,179,0,0.15)", color: "#cbd5e1", outline: "none" }} />
              <button type="submit" style={{ fontFamily: "var(--font-retro)", fontSize: "10px", background: "rgba(10,14,24,0.7)", border: "1px solid rgba(255,179,0,0.2)", color: "#FFB300", padding: "4px 10px", cursor: "pointer" }}>▶</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
