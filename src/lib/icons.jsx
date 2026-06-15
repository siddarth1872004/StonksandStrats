import React from "react";

// Crisp pixel-art SVGs for the retro theme

export const TokenIcon = ({ name, color = "currentColor", size = 24, className = "" }) => {
  const nameLower = (name || "").toLowerCase();
  
  if (nameLower === "car") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
        <path d="M2 10h12v3H2z" />
        <path d="M4 10V7c0-1 1-2 2-2h4c1 0 2 1 2 2v3" />
        <circle cx="5.5" cy="13" r="1.5" fill={color} />
        <circle cx="10.5" cy="13" r="1.5" fill={color} />
        <rect x="7" y="6" width="2" height="2" fill={color} />
      </svg>
    );
  }
  
  if (nameLower === "hat") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
        <path d="M2 13h12v1H2z" fill={color} />
        <path d="M4 13V5c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v8" />
        <path d="M4 9h8" />
      </svg>
    );
  }

  if (nameLower === "dog") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
        <path d="M3 11v-4h1v1h2V5c0-.6.4-1 1-1h1V3h2v2c0 .6-.4 1-1 1H9v2h2v1h1V8h1v3h-1V9h-1v2H9V9H7v2H6V9H4v2H3z" fill={color} />
        <circle cx="8.5" cy="4.5" r="0.5" fill="black" />
      </svg>
    );
  }

  if (nameLower === "ship") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
        <path d="M1 11l2 3h10l2-3H1z" fill={color} />
        <path d="M8 3v8M5 6V11M11 6V11" />
        <path d="M8 3l3 2H8M5 6l3 2V6" />
      </svg>
    );
  }

  if (nameLower === "iron") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
        <path d="M2 13h12V9c0-2-1.5-4-4.5-4H2v8z" />
        <path d="M4 5V3h5" />
      </svg>
    );
  }

  if (nameLower === "shoe") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
        <path d="M2 5v8h12v-3c0-2-1.5-3-3-4H9V5H2z" />
        <circle cx="5" cy="9" r="1.5" fill={color} />
      </svg>
    );
  }

  if (nameLower === "cat") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill={color}>
        <path d="M3 2v4l1 1H3v2h1v1h1v1h6v-1h1v-1h1V7h-1L12 6V2l-2 2H6L3 2z" />
        <rect x="6" y="9" width="1" height="1" fill="black" />
        <rect x="9" y="9" width="1" height="1" fill="black" />
        <rect x="7" y="12" width="2" height="2" />
      </svg>
    );
  }

  if (nameLower === "ring") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
        <ellipse cx="8" cy="10" rx="5" ry="3" />
        <path d="M3 10V8a5 2.5 0 0010 0v2" />
        <polygon points="8,2 10,6 6,6" fill={color} stroke="none" />
        <rect x="7" y="1" width="2" height="1" fill={color} stroke="none" />
      </svg>
    );
  }

  if (nameLower === "wheelbarrow") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
        <path d="M2 12l3-6h6l2 6H2z" />
        <circle cx="4" cy="13" r="1.5" fill={color} />
        <path d="M11 6l3-3" />
        <path d="M13 3h-2" />
      </svg>
    );
  }

  // Fallback default token icon (retro square)
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="2">
      <rect x="3" y="3" width="10" height="10" rx="1" />
      <circle cx="8" cy="8" r="2" fill={color} />
    </svg>
  );
};

export const HouseIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill={color}>
    <path d="M8 1L2 7v8h12V7L8 1zm0 2.5l4 4V13H4V7.5l4-4z" />
    <rect x="6" y="9" width="4" height="4" />
  </svg>
);

export const HotelIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill={color}>
    <path d="M8 1L1 7v8h14V7L8 1z" />
    <rect x="5" y="8" width="6" height="7" fill="black" />
  </svg>
);

export const UtilityIcon = ({ type, color = "currentColor", size = 20, className = "" }) => {
  if (type === "electric") {
    // Lightbulb
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
        <path d="M8 2a4 4 0 00-4 4c0 1.5.8 2.8 2 3.5V12h4V9.5c1.2-.7 2-2 2-3.5a4 4 0 00-4-4z" />
        <path d="M6 14h4" />
        <path d="M8 6V4M6 6H4M10 6h2" />
      </svg>
    );
  }
  // Water faucet/tap
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
      <path d="M5 4h6M8 2v2M4 7h8v2H4V7z" />
      <path d="M6 9v3a1 1 0 001 1h2a1 1 0 001-1V9" />
      <path d="M8 13v2" strokeDasharray="2 2" />
    </svg>
  );
};

export const RailroadIcon = ({ color = "currentColor", size = 20, className = "" }) => (
  // Train Engine
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <path d="M3 10h10v4H3v-4z" />
    <path d="M4 10V5c0-1 1-2 2-2h4c1 0 2 1 2 2v5" />
    <circle cx="5" cy="14" r="1" fill={color} />
    <circle cx="11" cy="14" r="1" fill={color} />
    <path d="M8 3h1v2H8z" />
    <rect x="6" y="6" width="4" height="2" />
  </svg>
);

export const DiceIcon = ({ value, size = 32, className = "" }) => {
  const dots = {
    1: [[4, 4]],
    2: [[2, 2], [6, 6]],
    3: [[2, 2], [4, 4], [6, 6]],
    4: [[2, 2], [2, 6], [6, 2], [6, 6]],
    5: [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]],
    6: [[2, 2], [2, 4], [2, 6], [6, 2], [6, 4], [6, 6]]
  };

  const currentDots = dots[value] || [];

  return (
    <div className={`relative inline-block border-2 border-green-500 rounded bg-black flex items-center justify-center select-none ${className}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0 bg-green-500/10 glow-sm"></div>
      <svg width={size - 4} height={size - 4} viewBox="0 0 8 8" className="relative z-10">
        {currentDots.map(([cx, cy], i) => (
          <rect key={i} x={cx - 0.5} y={cy - 0.5} width="1" height="1" fill="#10B981" />
        ))}
      </svg>
    </div>
  );
};

export const ChatIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <path d="M2 3h12v8H7l-4 3v-3H2V3z" />
  </svg>
);

export const StatsIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <path d="M2 13h12M4 10v3M8 6v7M12 3v10" />
  </svg>
);

export const SettingsIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5l1.5-1.5M11 5l1.5-1.5" />
  </svg>
);

export const TradeIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <path d="M3 5h10M10 2l3 3-3 3M13 11H3M6 8l-3 3 3 3" />
  </svg>
);

export const ManageIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <path d="M12 2l2 2-7 7-3 1 1-3 7-7z" />
    <path d="M2 14h12" />
  </svg>
);

export const AlertIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="2">
    <path d="M8 2v8M8 12h.01" strokeLinecap="square" />
  </svg>
);

export const CloseIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <path d="M3 3l10 10M13 3L3 13" />
  </svg>
);

export const BankruptcyIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <path d="M1 8l4-5h6l4 5-7 6-7-6z" />
    <path d="M8 5v4M6 7h4" />
  </svg>
);

export const PlayIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <path d="M4 3l8 5-8 5V3z" fill={color} />
  </svg>
);

export const ArrowRightIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <path d="M2 8h12M10 4l4 4-4 4" strokeLinecap="square" />
  </svg>
);

export const CardIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <rect x="2" y="3" width="12" height="10" rx="1" />
    <path d="M5 6h6M5 9h4" />
  </svg>
);

export const GavelIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <path d="M4 11l7-7 2 2-7 7-2-2z" fill={color} />
    <path d="M2 13l3-3M1 15h5M10 2l4 4" />
  </svg>
);

export const DollarIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <path d="M6 5c0-1 1-2 2-2s2 1 2 2v2c0 1-1 2-2 2s-2 1-2 2v2c0 1 1 2 2 2s2-1 2-2" />
    <path d="M8 2v12" />
  </svg>
);

export const SoundIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <path d="M2 5v6h3l4 4V1L5 5H2z" fill={color} />
    <path d="M11.5 5.5a3 3 0 010 5M13 4a5 5 0 010 8" />
  </svg>
);

export const MuteIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5">
    <path d="M2 5v6h3l4 4V1L5 5H2z" fill={color} />
    <path d="M11 5l4 6M15 5l-4 6" />
  </svg>
);

// ── Board tile icons ──────────────────────────────────────────────────────────

export const JailIcon = ({ color = "currentColor", size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <rect x="2" y="2" width="12" height="12" />
    <line x1="5" y1="2" x2="5" y2="14" />
    <line x1="8" y1="2" x2="8" y2="14" />
    <line x1="11" y1="2" x2="11" y2="14" />
    <circle cx="8" cy="9" r="2" fill={color} stroke="none" />
  </svg>
);

export const ChestIcon = ({ color = "currentColor", size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <rect x="2" y="5" width="12" height="9" />
    <path d="M2 9h12" />
    <path d="M2 5c0-1.7 12-1.7 12 0" />
    <rect x="6" y="8" width="4" height="2" />
    <circle cx="8" cy="9" r="0.8" fill={color} stroke="none" />
  </svg>
);

export const ParkingIcon = ({ color = "currentColor", size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <rect x="2" y="2" width="12" height="12" />
    <path d="M6 12V4h3c1.7 0 3 1.3 3 3s-1.3 3-3 3H6" />
  </svg>
);

export const GoToJailIcon = ({ color = "currentColor", size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <circle cx="8" cy="7" r="3" />
    <path d="M5 10l-3 5M11 10l3 5M5 7H2M14 7h-3" />
    <path d="M8 4V2" />
    <path d="M6 2h4" />
  </svg>
);

export const GoIcon = ({ color = "currentColor", size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <path d="M2 8h8" />
    <path d="M7 4l5 4-5 4" fill="none" />
    <circle cx="13" cy="8" r="2" fill={color} stroke="none" />
  </svg>
);

export const TaxIcon = ({ color = "currentColor", size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <path d="M4 2h8v2H4z" fill={color} />
    <path d="M3 4h10v10H3z" />
    <path d="M8 7v5M6 9h4" />
    <path d="M5 6h6" />
  </svg>
);

export const CrownIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill={color}>
    <path d="M2 12h12l1-8-4 3-3-5-3 5-4-3 1 8z" />
  </svg>
);

export const CopyIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <rect x="4" y="4" width="9" height="9" />
    <path d="M3 3V2h10v1M2 4h1" />
  </svg>
);

export const KeyIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <circle cx="6" cy="7" r="3" />
    <path d="M9 7h5M12 7v2M14 7v2" />
  </svg>
);

export const UsersIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square">
    <circle cx="6" cy="5" r="2.5" />
    <path d="M1 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
    <circle cx="12" cy="5" r="2" />
    <path d="M11 14h4c0-2-1.3-3.5-3-4" />
  </svg>
);

export const PlusIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const WifiIcon = ({ color = "currentColor", size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <path d="M1 5c3.9-3.3 10.1-3.3 14 0" />
    <path d="M3.5 7.5c2.5-2 8.5-2 9 0" />
    <path d="M6 10c1.3-1 3.7-1 4 0" />
    <circle cx="8" cy="13" r="1" fill={color} stroke="none" />
  </svg>
);
