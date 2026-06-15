import { useState } from "react";
import { TokenIcon, PlayIcon, KeyIcon, UsersIcon } from "../lib/icons";
import { playClick } from "../lib/audio";

const TOKENS = ["car", "hat", "dog", "ship", "iron", "shoe", "cat", "ring", "wheelbarrow"];
const TOKEN_COLORS = {
  car: "#EF4444", hat: "#3B82F6", dog: "#F59E0B", ship: "#06B6D4",
  iron: "#8B5CF6", shoe: "#10B981", cat: "#F97316", ring: "#EC4899", wheelbarrow: "#84CC16",
};

export default function RoomMenu({ onCreateRoom, onJoinRoom, defaultName }) {
  const [tab, setTab] = useState("create");
  const [name, setName] = useState(defaultName || "");
  const [token, setToken] = useState("car");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    playClick();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreateRoom(name.trim(), token, TOKEN_COLORS[token]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    playClick();
    if (!name.trim() || joinCode.length !== 6) return;
    setLoading(true);
    try {
      await onJoinRoom(joinCode.toUpperCase(), name.trim(), token, TOKEN_COLORS[token]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card w-full max-w-sm p-6 flex flex-col gap-5 border-t-2 border-sky-500">
      <div className="text-center">
        <h2 className="font-mono text-xs text-sky-400 font-bold tracking-widest uppercase mb-1 flex items-center justify-center gap-1.5">
          <UsersIcon size={12} /> STONKS &amp; STRATS
        </h2>
        <p className="text-[10px] text-slate-500 font-mono">Multiplayer Monopoly via Supabase</p>
      </div>

      {/* Player name */}
      <div className="flex flex-col gap-1 font-mono text-[9px] text-slate-400">
        <span>PLAYER NAME:</span>
        <input
          type="text"
          maxLength={14}
          value={name}
          onChange={e => setName(e.target.value)}
          className="retro-input"
          placeholder="Enter name..."
        />
      </div>

      {/* Token picker */}
      <div className="flex flex-col gap-1 font-mono text-[9px] text-slate-400">
        <span>SELECT TOKEN:</span>
        <div className="grid grid-cols-5 gap-1.5">
          {TOKENS.map(t => (
            <button
              key={t}
              onClick={() => { playClick(); setToken(t); }}
              style={{
                border: token === t ? `2px solid ${TOKEN_COLORS[t]}` : "1px solid rgba(56,189,248,0.2)",
                background: token === t ? `${TOKEN_COLORS[t]}20` : "rgba(0,0,0,0.3)",
                boxShadow: token === t ? `0 0 8px ${TOKEN_COLORS[t]}40` : "none",
                padding: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.1s",
              }}
              title={t}
            >
              <TokenIcon name={t} color={TOKEN_COLORS[t]} size={18} />
            </button>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex font-mono text-[9px]">
        <button
          onClick={() => { playClick(); setTab("create"); }}
          className={`flex-1 py-2 border-b-2 transition-colors ${tab === "create" ? "border-sky-500 text-sky-400" : "border-slate-800 text-slate-500"}`}
        >
          <PlayIcon size={9} className="inline mr-1" /> CREATE ROOM
        </button>
        <button
          onClick={() => { playClick(); setTab("join"); }}
          className={`flex-1 py-2 border-b-2 transition-colors ${tab === "join" ? "border-amber-500 text-amber-400" : "border-slate-800 text-slate-500"}`}
        >
          <KeyIcon size={9} className="inline mr-1" /> JOIN ROOM
        </button>
      </div>

      {tab === "create" && (
        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="btn-retro btn-retro-green w-full font-bold tracking-wider py-2.5"
        >
          {loading ? "Creating…" : <><PlayIcon size={11} className="mr-1" /> CREATE NEW ROOM</>}
        </button>
      )}

      {tab === "join" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 font-mono text-[9px] text-slate-400">
            <span>ROOM CODE (6 characters):</span>
            <input
              type="text"
              maxLength={6}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              className="retro-input text-center tracking-[0.5em] font-bold text-lg text-amber-400"
              placeholder="XXXXXX"
              style={{ letterSpacing: "0.5em" }}
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={loading || !name.trim() || joinCode.length !== 6}
            className="btn-retro w-full font-bold tracking-wider py-2.5"
            style={{ borderColor: "#F59E0B", color: "#F59E0B" }}
          >
            {loading ? "Joining…" : <><KeyIcon size={11} className="mr-1" /> JOIN ROOM</>}
          </button>
        </div>
      )}
    </div>
  );
}
