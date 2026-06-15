import { useState, useRef } from "react";

export default function Tooltip({ text, children, position = "top", className = "" }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setVisible(true), 300);
  };

  const handleLeave = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  const posStyles = {
    top:    { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: "8px" },
    bottom: { top: "100%",   left: "50%", transform: "translateX(-50%)", marginTop: "8px" },
    left:   { right: "100%", top: "50%",  transform: "translateY(-50%)", marginRight: "8px" },
    right:  { left: "100%",  top: "50%",  transform: "translateY(-50%)", marginLeft: "8px" },
  };

  const bubbleStyle = {
    pointerEvents: "none",
    position: "absolute",
    zIndex: 9999,
    background: "rgba(5, 5, 5, 0.95)",
    border: "1.5px solid #38BDF8",
    borderRadius: "0px",
    padding: "8px",
    fontSize: "8px",
    color: "#38BDF8",
    fontFamily: "var(--font-retro)",
    width: "190px",
    boxShadow: "3px 3px 0px rgba(56, 189, 248, 0.4)",
    opacity: visible ? 1 : 0,
    transition: "opacity 0.15s ease-in-out",
    display: visible ? "block" : "none",
    ...posStyles[position],
  };

  return (
    <div
      className={className}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ position: "relative", display: "inline-block" }}
    >
      {children}
      <div style={bubbleStyle}>
        <div style={{ lineHeight: "1.4", whiteSpace: "pre-wrap" }}>{text}</div>
      </div>
    </div>
  );
}
