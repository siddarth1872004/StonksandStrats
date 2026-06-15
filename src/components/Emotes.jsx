const EMOTES = ["👍", "😂", "😱", "💰", "🤝", "🔥", "😭", "🎲"];

// Floating reactions broadcast across all clients. Pure presentational: App owns the
// realtime channel and feeds the live `emotes` list (each { id, emoji, name, x }).
export function EmoteOverlay({ emotes }) {
  if (!emotes?.length) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[8600]">
      {emotes.map(e => (
        <div
          key={e.id}
          className="emote-float"
          style={{ position: "absolute", left: `${e.x}%`, bottom: "12%" }}
        >
          <div style={{ fontSize: "clamp(28px, 5vw, 44px)", lineHeight: 1, textAlign: "center", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))" }}>
            {e.emoji}
          </div>
          {e.name && (
            <div style={{
              fontFamily: "var(--font-retro)", fontSize: "7px", color: "#fbbf24",
              textAlign: "center", marginTop: "2px", textShadow: "0 0 4px rgba(0,0,0,0.9)",
            }}>
              {e.name}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Quick-reaction bar. `compact` shrinks it for tight side panels.
export function EmoteBar({ onEmote, compact = false }) {
  return (
    <div style={{
      display: "flex", gap: compact ? "3px" : "5px", flexWrap: "wrap",
      justifyContent: "center", padding: compact ? "4px 6px" : "6px 8px",
    }}>
      {EMOTES.map(emoji => (
        <button
          key={emoji}
          onClick={() => onEmote(emoji)}
          aria-label={`react ${emoji}`}
          style={{
            fontSize: compact ? "14px" : "16px",
            lineHeight: 1,
            background: "rgba(255,179,0,0.06)",
            border: "1px solid rgba(255,179,0,0.18)",
            color: "#fff",
            cursor: "pointer",
            padding: compact ? "3px 5px" : "4px 7px",
            borderRadius: 0,
            minWidth: compact ? "26px" : "30px",
            minHeight: compact ? "26px" : "30px",
            transition: "transform 0.08s, border-color 0.1s",
          }}
          onMouseDown={e => { e.currentTarget.style.transform = "scale(0.85)"; }}
          onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
