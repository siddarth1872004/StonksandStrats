import React, { useEffect, useState, useRef } from "react";
import { CloseIcon } from "../lib/icons";

export default function Diagnostics({ visible, onClose, gameState, isHost, roomId, playerId }) {
  const [fps, setFps] = useState(60);
  const logsEndRef = useRef(null);

  // Monitor frame rate
  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;
    let animationId;

    const tick = () => {
      frames++;
      const now = performance.now();
      if (now >= lastTime + 1000) {
        setFps(Math.round((frames * 1000) / (now - lastTime)));
        frames = 0;
        lastTime = now;
      }
      animationId = requestAnimationFrame(tick);
    };
    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Scroll logs to bottom when they change
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [gameState?.log]);

  if (!visible) return null;

  return (
    <div className="diagnostics-overlay">
      <div className="diagnostics-container">
        {/* Left Column: Diagnostics Statistics */}
        <div className="diagnostics-stats-col">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(239, 68, 68, 0.2)", paddingBottom: "4px" }}>
            <span style={{ fontWeight: "bold" }}>STONKS &amp; STRATS CORE DIAGNOSTICS</span>
            <button
              onClick={onClose}
              className="btn-retro"
              style={{ background: "transparent", border: "1px solid #EF4444", color: "#EF4444", padding: "1px 4px", fontSize: "7px", cursor: "pointer", fontFamily: "var(--font-retro)", display: "flex", alignItems: "center", gap: "2px", boxShadow: "none", transform: "none" }}
            >
              <CloseIcon size={8} /> CLOSE
            </button>
          </div>
          <div className="diagnostics-stats-grid" style={{ marginTop: "6px" }}>
            <span>TRANSPORT:</span>
            <span style={{ color: "#10B981" }}>SUPABASE REALTIME</span>

            <span>ROOM ID:</span>
            <span style={{ color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {roomId ? roomId.slice(0, 8) + "…" : "NONE"}
            </span>

            <span>PLAYER ID:</span>
            <span style={{ color: "#F59E0B" }}>
              {playerId ? playerId.slice(0, 8) + "…" : "NONE"}
            </span>

            <span>ROLE:</span>
            <span style={{ color: isHost ? "#34d399" : "#38bdf8" }}>{isHost ? "HOST ENGINE" : "CLIENT"}</span>

            <span>FRAME RATE:</span>
            <span>{fps} FPS</span>

            <span>PLAYERS:</span>
            <span>{gameState?.players?.length ?? 0}</span>

            <span>ROUND:</span>
            <span>{gameState?.round_counter ?? 0}</span>

            <span>GAME STATE:</span>
            <span style={{ textTransform: "uppercase" }}>{gameState?.phase || "UNKNOWN"}</span>
          </div>
        </div>

        {/* Right Column: Console Action Log */}
        <div className="diagnostics-logs-col">
          <div style={{ fontWeight: "bold", borderBottom: "1px solid rgba(239, 68, 68, 0.2)", paddingBottom: "4px", marginBottom: "6px" }}>
            SYSTEM & RULES ACTION OVERLAY LOG
          </div>
          <div className="diagnostics-logs-feed scrollbar">
            {gameState?.log && gameState.log.length > 0 ? (
              gameState.log.map((logStr, idx) => (
                <div key={idx} style={{ lineHeight: "1.4", paddingBottom: "2px", borderBottom: "1px solid rgba(239, 68, 68, 0.05)" }}>
                  <span style={{ color: "#B91C1C" }}>[{idx.toString().padStart(2, "0")}]</span> {logStr}
                </div>
              ))
            ) : (
              <div style={{ color: "#B91C1C", fontStyle: "italic" }}>No logs recorded yet. Spin the reels or move players to populate.</div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
