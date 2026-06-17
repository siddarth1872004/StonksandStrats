import { useEffect } from "react";
import { AlertIcon, CloseIcon } from "../lib/icons";

export default function Toast({ message, type = "info", duration = 3000, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Tan board card with a type-coloured accent (no dark/blue surfaces).
  const accents = { info: "#b45309", error: "#b91c1c", success: "#0f766e", warning: "#b45309" };
  const accent = accents[type] || accents.info;

  const toastStyle = {
    position: "fixed",
    top: "18px",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "min(92vw, 460px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "11px 16px",
    background: "#e6dcc2",
    color: "#1f2430",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.25)",
    borderLeft: `4px solid ${accent}`,
    fontFamily: "var(--font-retro)",
    fontSize: "13px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
    animation: "toast-drop 0.25s ease",
  };

  return (
    <div style={toastStyle}>
      <AlertIcon size={11} color={accent} />
      <span style={{ fontWeight: "bold", color: accent }}>[{type.toUpperCase()}]</span>
      <span style={{ color: "#3a3320" }}>{message}</span>
      <button 
        onClick={onClose} 
        style={{
          marginLeft: "8px",
          background: "transparent",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          padding: "2px"
        }}
      >
        <CloseIcon size={10} />
      </button>
    </div>
  );
}
