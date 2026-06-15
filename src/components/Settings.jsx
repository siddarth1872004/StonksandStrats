import React, { useEffect, useState } from "react";
import { setMuted, getMuted } from "../lib/audio";
import { SettingsIcon, SoundIcon, MuteIcon, PlayIcon } from "../lib/icons";

export default function Settings({ isOpen, onClose, scanlinesActive, setScanlinesActive, bloomSetting, setBloomSetting }) {
  const [muted, setLocalMuted] = useState(getMuted());

  const toggleMute = () => {
    const nextMute = !muted;
    setLocalMuted(nextMute);
    setMuted(nextMute);
    localStorage.setItem("stonks_muted", nextMute ? "true" : "false");
  };

  const handleBloomChange = (e) => {
    const val = e.target.value;
    setBloomSetting(val);
    localStorage.setItem("stonks_bloom", val);
  };

  const toggleScanlines = () => {
    const nextScan = !scanlinesActive;
    setScanlinesActive(nextScan);
    localStorage.setItem("stonks_scanlines", nextScan ? "true" : "false");
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="glass-card dialog-box animate-scale-up" style={{ borderTop: "4px solid #38BDF8" }}>
        {/* Title */}
        <h2 style={{ fontFamily: "var(--font-retro)", fontSize: "10px", color: "#38BDF8", fontWeight: "bold", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "1px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <SettingsIcon size={12} /> SYSTEM SETTINGS
        </h2>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontFamily: "var(--font-retro)", fontSize: "8px", color: "#CBD5E1", textAlign: "left" }}>
          {/* Mute Setting */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>CHIPTUNE AUDIO FX:</span>
            <button 
              onClick={toggleMute} 
              className={`btn-retro ${muted ? "btn-retro-red" : "btn-retro-green"}`}
            >
              {muted ? <MuteIcon size={10} /> : <SoundIcon size={10} />} {muted ? "MUTED" : "ENABLED"}
            </button>
          </div>

          {/* CRT Scanline Filter */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>CRT SCANLINES:</span>
            <button 
              onClick={toggleScanlines} 
              className={`btn-retro ${scanlinesActive ? "btn-retro-green" : ""}`}
            >
              <SettingsIcon size={10} /> {scanlinesActive ? "ACTIVE" : "INACTIVE"}
            </button>
          </div>

          {/* Bloom/Glow Setting */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>GLOW BLOOM INTENSITY:</span>
              <span style={{ fontWeight: "bold", color: "#38BDF8", textTransform: "uppercase" }}>{bloomSetting}</span>
            </div>
            <select
              value={bloomSetting}
              onChange={handleBloomChange}
              className="retro-input"
              style={{ width: "100%", background: "#020617", border: "1px solid rgba(56, 189, 248, 0.2)", color: "#38BDF8", fontSize: "8px", fontFamily: "var(--font-retro)", borderRadius: "0px" }}
            >
              <option value="low">LOW (RECOMMENDED)</option>
              <option value="high">HIGH (BLOOM STRENGTH)</option>
            </select>
          </div>
        </div>

        {/* Footer buttons */}
        <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
          <button 
            onClick={onClose} 
            className="btn-retro btn-retro-green"
          >
            <PlayIcon size={10} /> CONFIRM & RETURN
          </button>
        </div>
      </div>
    </div>
  );
}
