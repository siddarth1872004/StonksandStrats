import { useState } from "react";
import { TILES, GROUP_COLORS, TOKEN_COLORS } from "../boardData";
import { playClick } from "../lib/audio";
import { TradeIcon, CloseIcon } from "../lib/icons";

const tokenColor = (p) => p?.token_color || TOKEN_COLORS[p?.token_shape || p?.token] || "#38bdf8";
const tileColor = (tid) => {
  const t = TILES.find(x => x.id === tid);
  if (!t) return "#64748b";
  if (t.type === "railroad") return "#cbd5e1";
  if (t.type === "utility") return "#94a3b8";
  return GROUP_COLORS[t.group] || "#64748b";
};
const tileName = (tid) => TILES.find(x => x.id === tid)?.name || `#${tid}`;
const clampInt = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));

// Property chip toggle
function PropChip({ tid, selected, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Sell its houses before trading" : tileName(tid)}
      style={{
        display: "flex", alignItems: "center", gap: "5px",
        padding: "5px 7px", textAlign: "left", width: "100%",
        fontFamily: "var(--font-retro)", fontSize: "9px",
        background: selected ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${selected ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.08)"}`,
        color: disabled ? "#475569" : selected ? "#e5e7eb" : "#94a3b8",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ width: "6px", height: "12px", background: tileColor(tid), flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tileName(tid)}</span>
    </button>
  );
}

// Hoisted to module scope so typing in the inputs doesn't remount/lose focus.
function TradeColumn({ title, color, player, side, setSide, houses }) {
  const isImproved = (tid) => (houses?.[tid.toString()] || 0) > 0;
  const toggleProp = (tid) => setSide(s => ({
    ...s, props: s.props.includes(tid) ? s.props.filter(x => x !== tid) : [...s.props, tid],
  }));
  return (
    <div style={{ width: "100%", minWidth: 0, display: "flex", flexDirection: "column", gap: "8px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)", padding: "10px" }}>
      <div style={{ fontFamily: "var(--font-retro)", fontSize: "10px", color, fontWeight: "bold" }}>{title}</div>
      <label style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#64748b" }}>
        CASH (max ${player.money.toLocaleString()})
        <input type="number" value={side.cash} min={0} max={player.money}
          onChange={e => setSide(s => ({ ...s, cash: clampInt(e.target.value, player.money) }))}
          className="retro-input" style={{ width: "100%", marginTop: "3px", fontSize: "11px", padding: "6px" }} />
      </label>
      {player.jail_cards > 0 && (
        <label style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#64748b" }}>
          JAIL CARDS (max {player.jail_cards})
          <input type="number" value={side.cards} min={0} max={player.jail_cards}
            onChange={e => setSide(s => ({ ...s, cards: clampInt(e.target.value, player.jail_cards) }))}
            className="retro-input" style={{ width: "100%", marginTop: "3px", fontSize: "11px", padding: "6px" }} />
        </label>
      )}
      <div style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#64748b" }}>PROPERTIES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
        {player.properties.length ? player.properties.map(tid => (
          <PropChip key={tid} tid={tid} selected={side.props.includes(tid)} disabled={isImproved(tid)} onClick={() => toggleProp(tid)} />
        )) : <span style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#475569", fontStyle: "italic" }}>none owned</span>}
      </div>
    </div>
  );
}

// Display-only side summary for the offer modal.
function OfferSide({ title, color, money, cards, props }) {
  return (
    <div style={{ width: "100%", minWidth: 0, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)", padding: "10px" }}>
      <div style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color, fontWeight: "bold", marginBottom: "8px" }}>{title}</div>
      <div style={{ fontFamily: "var(--font-retro)", fontSize: "11px", color: "#34d399", marginBottom: "4px" }}>${(money || 0).toLocaleString()}</div>
      {cards > 0 && <div style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#fbbf24", marginBottom: "4px" }}>{cards}× Jail card</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "6px" }}>
        {(props || []).length ? props.map(tid => (
          <div key={tid} style={{ display: "flex", alignItems: "center", gap: "5px", fontFamily: "var(--font-retro)", fontSize: "9px", color: "#cbd5e1" }}>
            <span style={{ width: "5px", height: "10px", background: tileColor(tid) }} /> {tileName(tid)}
          </div>
        )) : <span style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#475569", fontStyle: "italic" }}>nothing</span>}
      </div>
    </div>
  );
}

// ── Inline pending-offer view (rendered inside the sidebar Trade tab) ──
export function TradeOfferView({ gameState, myPlayerId, onAction, onCounter }) {
  const pending = gameState?.pending_trade;
  if (!pending) return null;

  const fromP = gameState.players.find(p => p.id === pending.from);
  const toP = gameState.players.find(p => p.id === pending.to);
  const offer = pending.offer || {};
  const isTarget = pending.to === myPlayerId;
  const isProposer = pending.from === myPlayerId;

  return (
    <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontFamily: "var(--font-retro)", fontSize: "10px", color: "#22d3ee", fontWeight: "bold", letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: "6px" }}>
        <TradeIcon size={12} /> TRADE OFFER
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <OfferSide title={`${fromP?.name} GIVES`} color={tokenColor(fromP)} money={offer.from_money} cards={offer.from_cards} props={offer.from_properties} />
        <OfferSide title={`${toP?.name} GIVES`} color={tokenColor(toP)} money={offer.to_money} cards={offer.to_cards} props={offer.to_properties} />
      </div>
      {isTarget ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={() => { playClick(); onAction("respond_trade", { accept: true }); }} className="btn-retro btn-retro-green" style={{ flex: 1, fontSize: "9px", padding: "9px" }}>✓ ACCEPT</button>
            <button onClick={() => { playClick(); onAction("respond_trade", { accept: false }); }} className="btn-retro btn-retro-red" style={{ flex: 1, fontSize: "9px", padding: "9px" }}>✕ REJECT</button>
          </div>
          {onCounter && (
            <button onClick={() => { playClick(); onCounter(); }} className="btn-retro" style={{ width: "100%", fontSize: "9px", padding: "8px", borderColor: "#fbbf24", color: "#fbbf24" }}>
              ⇄ COUNTER-OFFER
            </button>
          )}
        </div>
      ) : isProposer ? (
        <button onClick={() => { playClick(); onAction("cancel_trade", {}); }} className="btn-retro btn-retro-red" style={{ width: "100%", fontSize: "9px", padding: "9px" }}>
          <CloseIcon size={10} className="mr-1" /> WITHDRAW OFFER
        </button>
      ) : (
        <div className="animate-pulse" style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#64748b", textAlign: "center", padding: "8px" }}>
          Waiting for {toP?.name} to respond…
        </div>
      )}
    </div>
  );
}

// ── Inline trade builder (rendered inside the sidebar Trade tab) ──
export function TradeBuilder({ gameState, myPlayerId, onAction, prefill = null, onClose }) {
  const [targetPid, setTargetPid] = useState(prefill?.targetPid || "");
  const [give, setGive] = useState(prefill?.give || { cash: 0, cards: 0, props: [] });
  const [get, setGet] = useState(prefill?.get || { cash: 0, cards: 0, props: [] });
  const isCounter = !!prefill;

  const me = gameState?.players?.find(p => p.id === myPlayerId);
  const others = gameState?.players?.filter(p => !p.bankrupt && p.id !== myPlayerId) || [];
  const target = gameState?.players?.find(p => p.id === targetPid);

  const hasOffer = give.cash || get.cash || give.cards || get.cards || give.props.length || get.props.length;

  const propose = () => {
    playClick();
    if (!target || !hasOffer) return;
    onAction("propose_trade", {
      toId: targetPid,
      offer: {
        from_properties: give.props, to_properties: get.props,
        from_money: give.cash, to_money: get.cash,
        from_cards: give.cards, to_cards: get.cards,
      },
    });
    onClose?.();
  };

  return (
    <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-retro)", fontSize: "10px", color: "#38bdf8", fontWeight: "bold", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "6px" }}>
          <TradeIcon size={12} /> {isCounter ? "COUNTER-OFFER" : "PROPOSE TRADE"}
        </span>
        {isCounter && (
          <button onClick={() => { playClick(); onClose?.(); }} style={{ background: "none", border: "none", cursor: "pointer" }}><CloseIcon size={12} color="#64748b" /></button>
        )}
      </div>

      {/* Partner picker */}
      <div style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#64748b" }}>TRADE WITH</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
        {others.length === 0 && <span style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#475569", fontStyle: "italic" }}>No one to trade with.</span>}
        {others.map(p => {
          const sel = p.id === targetPid;
          return (
            <button key={p.id} onClick={() => { playClick(); setTargetPid(p.id); setGet({ cash: 0, cards: 0, props: [] }); }}
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "5px 8px",
                fontFamily: "var(--font-retro)", fontSize: "9px",
                background: sel ? `${tokenColor(p)}22` : "rgba(255,255,255,0.03)",
                border: `1px solid ${sel ? tokenColor(p) : "rgba(255,255,255,0.1)"}`,
                color: sel ? "#fff" : "#94a3b8", cursor: "pointer",
              }}>
              <span style={{ width: "9px", height: "9px", background: tokenColor(p) }} />
              {p.name}{p.is_bot ? " [AI]" : ""}
            </button>
          );
        })}
      </div>

      {target && me && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <TradeColumn title="YOU GIVE" color="#38bdf8" player={me} side={give} setSide={setGive} houses={gameState?.houses} />
          <TradeColumn title={`${target.name} GIVES`} color="#fbbf24" player={target} side={get} setSide={setGet} houses={gameState?.houses} />
        </div>
      )}

      <button onClick={propose} disabled={!target || !hasOffer}
        className="btn-retro btn-retro-green" style={{ width: "100%", fontSize: "10px", padding: "11px", fontWeight: "bold", opacity: (!target || !hasOffer) ? 0.4 : 1 }}>
        <TradeIcon size={11} className="mr-1" /> {isCounter ? "SEND COUNTER-OFFER" : "SEND OFFER"}
      </button>
    </div>
  );
}
