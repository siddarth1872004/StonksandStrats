import React, { useEffect } from "react";
import { AlertIcon, CloseIcon } from "../lib/icons";

export default function Toast({ message, type = "info", duration = 3000, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    info: { border: "2px solid #38BDF8", color: "#38BDF8", boxShadow: "3px 3px 0px rgba(56, 189, 248, 0.4)" },
    error: { border: "2px solid #EF4444", color: "#EF4444", boxShadow: "3px 3px 0px rgba(239, 68, 68, 0.4)" },
    success: { border: "2px solid #10B981", color: "#10B981", boxShadow: "3px 3px 0px rgba(16, 185, 129, 0.4)" },
    warning: { border: "2px solid #F59E0B", color: "#F59E0B", boxShadow: "3px 3px 0px rgba(245, 158, 11, 0.4)" }
  };

  const activeStyle = colors[type] || colors.info;

  const toastStyle = {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
    background: "rgba(5, 5, 5, 0.95)",
    borderRadius: "0px",
    fontFamily: "var(--font-retro)",
    fontSize: "8px",
    ...activeStyle
  };

  return (
    <div style={toastStyle}>
      <AlertIcon size={11} color="currentColor" />
      <span style={{ fontWeight: "bold" }}>[{type.toUpperCase()}]</span>
      <span style={{ color: "#E2E8F0" }}>{message}</span>
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
