import React, { useState } from "react";
import { TokenIcon, PlayIcon, CrownIcon, CopyIcon, CloseIcon, AlertIcon, UsersIcon, PlusIcon } from "../lib/icons";
import { playClick } from "../lib/audio";
import HouseRulesPanel from "./HouseRulesPanel";

const TOKEN_COLORS = {
  car: "#EF4444", hat: "#3B82F6", dog: "#F59E0B", ship: "#06B6D4",
  iron: "#8B5CF6", shoe: "#10B981", cat: "#F97316", ring: "#EC4899", wheelbarrow: "#84CC16",
};

const BOT_TOKENS = ["hat", "dog", "ship", "iron", "shoe", "cat", "ring", "wheelbarrow", "car"];
const BOT_NAMES = ["AutoBot Alpha", "RoboStrat", "Moneyman 3000", "BotFolio"];

const GAME_MODES = [
  { id: "classic",   label: "Classic",   desc: "Standard Monopoly rules" },
  { id: "speed_die", label: "Speed Die", desc: "Third die unlocks after passing GO" },
  { id: "quick",     label: "Quick",     desc: "Ends after N rounds; winner = net worth" },
];

export default function RoomLobby({
  players, myPlayerId, isHost, roomCode, hostPlayerId,
  houseRules, onHouseRulesChange,
  gameMode, quickModeRounds, onGameModeChange,
  onStartGame, onLeave, onAddBot, onRemoveBot,
}) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("players"); // players | rules

  const copyCode = () => {
    playClick();
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const addBot = () => {
    playClick();
    if (!isHost) return;
    const usedShapes = players.map(p => p.token_shape || p.token);
    const shape = BOT_TOKENS.find(t => !usedShapes.includes(t)) || "car";
    const usedNames = players.map(p => p.name);
    const name = BOT_NAMES.find(n => !usedNames.includes(n)) || `Bot ${players.length}`;
    onAddBot?.(name, shape, TOKEN_COLORS[shape]);
  };

  const humanCount = players.filter(p => !p.is_bot).length;
  const botCount = players.filter(p => p.is_bot).length;

  return (
    <div className="glass-card w-full max-w-lg p-5 flex flex-col gap-4 border-t-2 border-amber-500 font-mono">

      {/* Room code */}
      <div className="text-center">
        <div className="text-[8px] text-slate-500 tracking-widest uppercase mb-1.5">ROOM CODE</div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-3xl font-bold text-amber-400 tracking-[0.4em] glow-text">
            {roomCode || "------"}
          </span>
          <button onClick={copyCode} className="btn-retro text-[8px] px-2 py-1">
            <CopyIcon size={10} />
            {copied ? " COPIED!" : " COPY"}
          </button>
        </div>
        <p className="text-[9px] text-slate-500 mt-1">Share this code with other players</p>
      </div>

      {/* Tab switcher */}
      <div className="flex font-mono text-[8px]">
        <button
          onClick={() => { playClick(); setTab("players"); }}
          className={`flex-1 py-1.5 border-b-2 transition-colors ${tab === "players" ? "border-amber-500 text-amber-400" : "border-slate-800 text-slate-500"}`}
        >
          <UsersIcon size={8} className="inline mr-1" /> PLAYERS
        </button>
        <button
          onClick={() => { playClick(); setTab("rules"); }}
          className={`flex-1 py-1.5 border-b-2 transition-colors ${tab === "rules" ? "border-sky-500 text-sky-400" : "border-slate-800 text-slate-500"}`}
        >
          HOUSE RULES & MODE
        </button>
      </div>

      {tab === "players" && (
        <>
          {/* Player list */}
          <div className="flex flex-col gap-1.5">
            <div className="text-[8px] text-slate-500 tracking-wider uppercase flex items-center justify-between">
              <span><UsersIcon size={9} className="inline mr-1" />PLAYERS ({players.length}/6)</span>
              <span className="text-slate-600">{humanCount} human · {botCount} bot</span>
            </div>
            {players.map(p => {
              const shape = p.token_shape || p.token;
              const color = p.token_color || TOKEN_COLORS[shape] || "#38bdf8";
              const isMe = p.id === myPlayerId;
              const isHostPlayer = p.id === hostPlayerId;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded"
                  style={{
                    background: isMe ? "rgba(56,189,248,0.08)" : "rgba(15,23,42,0.3)",
                    border: isMe ? "1px solid rgba(56,189,248,0.35)" : "1px solid rgba(15,23,42,0.4)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <TokenIcon name={shape} color={color} size={14} />
                    <span className="text-[10px] text-slate-200 font-bold">
                      {p.name}
                      {isMe && <span className="text-[8px] text-sky-400 ml-1">(YOU)</span>}
                      {p.is_bot && <span className="text-[8px] text-purple-400 ml-1">[BOT]</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isHostPlayer && (
                      <span className="flex items-center gap-1 text-[8px] border border-amber-500/30 bg-amber-950/20 text-amber-400 px-1.5 py-0.5 rounded">
                        <CrownIcon size={9} color="#F59E0B" /> HOST
                      </span>
                    )}
                    {!p.is_bot && (
                      <span className={`text-[8px] border px-1.5 py-0.5 rounded ${
                        p.is_connected
                          ? "border-green-500/30 text-green-400 bg-green-950/20"
                          : "border-slate-700 text-slate-500 bg-slate-900/30"
                      }`}>
                        {p.is_connected ? "ONLINE" : "AWAY"}
                      </span>
                    )}
                    {isHost && p.is_bot && (
                      <button
                        onClick={() => { playClick(); onRemoveBot?.(p.id); }}
                        className="text-[8px] text-red-500 border border-red-500/30 px-1.5 py-0.5 rounded hover:bg-red-950/20"
                      >
                        REMOVE
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {players.length === 0 && (
              <div className="text-center text-slate-600 text-[9px] py-3 italic">Waiting for players to join…</div>
            )}
          </div>

          {/* Add bot button */}
          {isHost && players.length < 6 && (
            <button
              onClick={addBot}
              className="btn-retro text-[8px] w-full"
              style={{ borderColor: "#8B5CF6", color: "#8B5CF6" }}
            >
              <PlusIcon size={9} className="inline mr-1" /> ADD AI BOT
            </button>
          )}
        </>
      )}

      {tab === "rules" && (
        <div className="flex flex-col gap-4 max-h-64 overflow-y-auto pr-1">
          {/* Game mode */}
          <div className="flex flex-col gap-2">
            <div className="text-[8px] text-slate-500 tracking-widest uppercase">GAME MODE</div>
            <div className="flex flex-col gap-1">
              {GAME_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => { playClick(); isHost && onGameModeChange?.(m.id, quickModeRounds); }}
                  disabled={!isHost}
                  className={`flex items-start gap-2 p-2 rounded text-left transition-colors ${
                    gameMode === m.id
                      ? "border border-sky-500/50 bg-sky-950/20"
                      : "border border-slate-800 bg-slate-900/20 text-slate-500"
                  } ${isHost ? "cursor-pointer hover:border-sky-500/30" : "cursor-default"}`}
                >
                  <span className={`text-[9px] font-bold ${gameMode === m.id ? "text-sky-400" : ""}`}>{m.label}</span>
                  <span className="text-[8px] text-slate-500">{m.desc}</span>
                </button>
              ))}
            </div>
            {gameMode === "quick" && isHost && (
              <div className="flex items-center gap-2 text-[9px] text-slate-400">
                <span>End after</span>
                <input
                  type="number" min={5} max={100} value={quickModeRounds}
                  onChange={e => onGameModeChange?.("quick", Number(e.target.value))}
                  className="retro-input w-14 text-center text-[9px] py-0.5"
                />
                <span>rounds</span>
              </div>
            )}
          </div>

          {/* House rules */}
          <HouseRulesPanel
            rules={houseRules}
            onChange={onHouseRulesChange}
            isHost={isHost}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {isHost ? (
          <>
            <button
              onClick={() => { playClick(); onStartGame(); }}
              disabled={players.length < 2}
              className="btn-retro btn-retro-green w-full font-bold tracking-wider py-2.5"
            >
              <PlayIcon size={11} className="mr-1" /> START GAME
            </button>
            {players.length < 2 && (
              <p className="text-[8px] text-slate-500 text-center flex items-center justify-center gap-1">
                <AlertIcon size={9} /> Need at least 2 players to start
              </p>
            )}
          </>
        ) : (
          <div className="text-center text-amber-500 border border-amber-500/20 bg-amber-950/10 p-2.5 rounded blink flex items-center justify-center gap-1.5 text-[9px]">
            <AlertIcon size={10} /> Waiting for host to start the game…
          </div>
        )}

        <button
          onClick={() => { playClick(); onLeave(); }}
          className="btn-retro btn-retro-red w-full text-[9px]"
        >
          <CloseIcon size={10} className="mr-1" /> LEAVE ROOM
        </button>
      </div>
    </div>
  );
}
