import React, { useState, useEffect, useRef, useCallback } from "react";
import Board from "./components/Board";
import Sidebar from "./components/Sidebar";
import RoomMenu from "./components/RoomMenu";
import RoomLobby from "./components/RoomLobby";
import Diagnostics from "./components/Diagnostics";
import Auction from "./components/Auction";
import Settings from "./components/Settings";
import Toast from "./components/Toast";
import ConfirmDialog from "./components/ConfirmDialog";
import { PropertyDetailModal, ManageModal } from "./components/Modals";

import { ensureAuth } from "./lib/supabase";
import {
  createRoom, joinRoom, rejoinRoom, clearSession,
  subscribeToRoom, subscribeToActions, fetchPlayers, fetchRoom,
  sendAction, updateGameState, startRoomGame, endRoom, leaveRoom,
  updateHouseRules, updateGameMode, addBot, removeBot,
  touchHeartbeat, claimHost, markActionProcessed,
} from "./lib/roomClient";

import {
  createInitialState, addPlayer, startGame, applyAction, getAIDecision, forceEndGame, DEFAULT_HOUSE_RULES,
} from "./lib/gameEngine";

import {
  playClick, playRoll, playMove, playBuy, playRent, playWin, playJail,
  startChiptune, stopChiptune,
} from "./lib/audio";
import {
  ConfettiCanvas, diffStates, ANIM, animateDice, animateHop, AnimationQueue,
} from "./lib/animation";
import { PlayIcon, CloseIcon, SettingsIcon, BankruptcyIcon, AlertIcon } from "./lib/icons";

const HEARTBEAT_INTERVAL_MS = 5000;
const AI_MIN_DELAY_MS = 800;
const AI_MAX_DELAY_MS = 1500;

function randomAIDelay() {
  return AI_MIN_DELAY_MS + Math.random() * (AI_MAX_DELAY_MS - AI_MIN_DELAY_MS);
}

export default function App() {
  const [screen, setScreen] = useState("MENU");
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem("stonks_player_name") || ""
  );
  const [authReady, setAuthReady] = useState(false);

  // Supabase room identity
  const [roomId, setRoomId] = useState(null);           // = room code (text PK)
  const [playerId, setPlayerId] = useState(null);        // = auth.uid()
  const [isHost, setIsHost] = useState(false);
  const [hostPlayerId, setHostPlayerId] = useState(null);
  const [players, setPlayers] = useState([]);

  // Room meta (lobby settings)
  const [houseRules, setHouseRules] = useState({ ...DEFAULT_HOUSE_RULES });
  const [gameMode, setGameMode] = useState("classic");
  const [quickModeRounds, setQuickModeRounds] = useState(30);

  // Game state — the JSONB column from rooms table
  const [gameState, setGameState] = useState(null);
  const gameStateRef = useRef(null);

  // Refs for cleanup
  const actionsUnsubRef = useRef(null);
  const heartbeatRef = useRef(null);
  const aiTimerRef = useRef(null);

  const [toast, setToast] = useState(null);

  // Animation state
  const [renderedPositions, setRenderedPositions] = useState({});
  const [animDice, setAnimDice] = useState([1, 1]);
  const [animationsBusy, setAnimationsBusy] = useState(false);
  const [moneyDeltas, setMoneyDeltas] = useState([]);
  const [cardOverlay, setCardOverlay] = useState(null);
  const animQueueRef = useRef(null);

  // Client visual settings
  const [scanlinesActive, setScanlinesActive] = useState(
    () => localStorage.getItem("stonks_scanlines") !== "false"
  );
  const [bloomSetting, setBloomSetting] = useState(
    () => localStorage.getItem("stonks_bloom") || "low"
  );

  // Modal visibility
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [showManage, setShowManage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showConfirmBankruptcy, setShowConfirmBankruptcy] = useState(false);

  const confettiCanvasRef = useRef(null);
  const confettiEngineRef = useRef(null);

  // ── Auth init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    ensureAuth()
      .then(user => {
        setPlayerId(user.id);
        setAuthReady(true);
        // Try to rejoin from a previous session
        tryRejoin(user.id);
      })
      .catch(err => {
        console.error("Auth failed:", err);
        setAuthReady(true); // allow menu to render even if offline
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => { document.body.className = `bloom-${bloomSetting}`; }, [bloomSetting]);

  useEffect(() => {
    const q = new AnimationQueue();
    q.onBusyChange(setAnimationsBusy);
    animQueueRef.current = q;
  }, []);

  useEffect(() => {
    if (screen === "GAME_OVER" && confettiCanvasRef.current) {
      confettiEngineRef.current = new ConfettiCanvas(confettiCanvasRef.current);
      confettiEngineRef.current.start();
    } else if (confettiEngineRef.current) {
      confettiEngineRef.current.stop();
      confettiEngineRef.current = null;
    }
  }, [screen]);

  // ── Heartbeat (host) ───────────────────────────────────────────────────────
  const startHeartbeat = useCallback((rid) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      touchHeartbeat(rid).catch(console.error);
    }, HEARTBEAT_INTERVAL_MS);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
  }, []);

  // ── Rejoin helper ──────────────────────────────────────────────────────────
  const tryRejoin = async (uid) => {
    const storedRoom = localStorage.getItem("stonks_room_id");
    if (!storedRoom) return;
    try {
      const result = await rejoinRoom();
      if (!result) return;
      const { room, player } = result;
      applyRoomJoin(room, player, uid);
    } catch {
      // ignore stale session
    }
  };

  // Shared post-join setup
  const applyRoomJoin = (room, player, uid) => {
    const amHost = room.host_player_id === (uid || player.id);
    setRoomId(room.id);
    setPlayerId(uid || player.id);
    setIsHost(amHost);
    setHostPlayerId(room.host_player_id);
    setPlayerName(player.name);
    setHouseRules(room.house_rules || { ...DEFAULT_HOUSE_RULES });
    setGameMode(room.game_mode || "classic");
    setQuickModeRounds(room.quick_mode_rounds || 30);
    localStorage.setItem("stonks_player_name", player.name);
    setScreen("LOBBY");
    if (amHost) startHeartbeat(room.id);
  };

  // ── Game state sync ────────────────────────────────────────────────────────
  const navigateForState = (state) => {
    if (!state || Object.keys(state).length === 0) { setScreen("LOBBY"); return; }
    if (state.winner !== null || state.phase === "game_over") setScreen("GAME_OVER");
    else if (state.phase && state.phase !== "lobby") setScreen("GAME");
    else setScreen("LOBBY");
  };

  const syncGameState = useCallback((newState) => {
    const prev = gameStateRef.current;
    gameStateRef.current = newState;
    setGameState(newState);
    if (!prev || !animQueueRef.current) return;
    const q = animQueueRef.current;
    const events = diffStates(prev, newState);
    for (const ev of events) {
      switch (ev.type) {
        case ANIM.DICE:
          playRoll();
          q.enqueue(qInst => animateDice(ev.d1, ev.d2, setAnimDice, qInst));
          break;
        case ANIM.MOVE_HOP:
          q.enqueue(qInst => {
            playMove();
            return animateHop(ev.pid, ev.from, ev.steps,
              (pid, pos) => setRenderedPositions(p => ({ ...p, [pid]: pos })), qInst);
          });
          break;
        case ANIM.MOVE_WARP:
          setRenderedPositions(p => ({ ...p, [ev.pid]: ev.to }));
          break;
        case ANIM.MONEY_DELTA: {
          const deltaId = `${Date.now()}-${ev.pid}`;
          setMoneyDeltas(d => [...d, { id: deltaId, pid: ev.pid, delta: ev.delta }]);
          setTimeout(() => setMoneyDeltas(d => d.filter(x => x.id !== deltaId)), 1200);
          if (ev.delta < 0) playRent();
          break;
        }
        case ANIM.CARD_DRAW:
          setCardOverlay({ text: ev.text, isChance: ev.isChance });
          setTimeout(() => setCardOverlay(null), 1800);
          break;
        case ANIM.BANKRUPT: playJail(); break;
        case ANIM.WINNER: playWin(); break;
        default: break;
      }
    }
    if (prev && newState) {
      const prevProps = prev.players?.reduce((s, p) => s + p.properties.length, 0) || 0;
      const nextProps = newState.players?.reduce((s, p) => s + p.properties.length, 0) || 0;
      if (nextProps > prevProps) playBuy();
    }
  }, []);

  // Commit a new state: run animations + persist to DB. Use everywhere instead of
  // setGameState+updateGameState so the host always gets animations too.
  const commitState = useCallback((newState) => {
    syncGameState(newState);
    if (roomId) updateGameState(roomId, newState).catch(console.error);
  }, [roomId]);

  // ── Supabase subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    fetchRoom(roomId).then(room => {
      if (!room) return;
      setHostPlayerId(room.host_player_id);
      setHouseRules(room.house_rules || { ...DEFAULT_HOUSE_RULES });
      setGameMode(room.game_mode || "classic");
      setQuickModeRounds(room.quick_mode_rounds || 30);
      if (room.game_state && Object.keys(room.game_state).length > 0) {
        gameStateRef.current = room.game_state;
        setGameState(room.game_state);
        navigateForState(room.game_state);
      }
    });

    fetchPlayers(roomId).then(ps => setPlayers(ps || []));

    const unsubRoom = subscribeToRoom(
      roomId,
      (roomRow) => {
        if (!roomRow) return;
        // Detect host migration — if we see a new host, update our isHost flag
        setHostPlayerId(prev => {
          if (roomRow.host_player_id !== prev) {
            setIsHost(roomRow.host_player_id === playerId);
            if (roomRow.host_player_id === playerId) startHeartbeat(roomId);
          }
          return roomRow.host_player_id;
        });
        setHouseRules(roomRow.house_rules || { ...DEFAULT_HOUSE_RULES });
        setGameMode(roomRow.game_mode || "classic");
        setQuickModeRounds(roomRow.quick_mode_rounds || 30);
        if (roomRow.game_state && Object.keys(roomRow.game_state).length > 0) {
          syncGameState(roomRow.game_state);
          navigateForState(roomRow.game_state);
        }
      },
      (ps) => setPlayers(ps || [])
    );

    return () => { unsubRoom(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Host subscribes to actions table
  useEffect(() => {
    if (!roomId || !isHost) return;

    const unsubActions = subscribeToActions(roomId, actionRow => {
      const currentState = gameStateRef.current;
      if (!currentState) return;

      let enginePayload;
      const actionType = actionRow.action_type || actionRow.type;
      if (actionType === "propose_trade") {
        enginePayload = { fromId: actionRow.player_id, toId: actionRow.payload.toId, offer: actionRow.payload.offer };
      } else {
        enginePayload = { ...actionRow.payload, playerId: actionRow.player_id };
      }

      const result = applyAction(currentState, { type: actionType, payload: enginePayload });
      if (result.error) { console.error("[host] action error:", result.error); return; }

      commitState(result.state);
      markActionProcessed(actionRow.id).catch(console.error);
    });

    actionsUnsubRef.current = unsubActions;
    return () => { unsubActions(); actionsUnsubRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isHost]);

  // ── Host migration watcher ─────────────────────────────────────────────────
  // Non-hosts periodically check if the host is stale and attempt to claim it
  useEffect(() => {
    if (!roomId || isHost || !playerId) return;
    const check = setInterval(async () => {
      try {
        const claimed = await claimHost(roomId, playerId);
        if (claimed) {
          setIsHost(true);
          setHostPlayerId(playerId);
          startHeartbeat(roomId);
          setToast({ message: "You are now the host (previous host disconnected).", type: "info" });
        }
      } catch { /* ignore */ }
    }, 10000);
    return () => clearInterval(check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isHost, playerId]);

  // ── AI turn processor (host only) ─────────────────────────────────────────
  // Determines which bot (if any) needs to act in the current state and applies
  // one decision. If the same bot still needs to act after the action (e.g.
  // build_house keeps phase=post_roll), it self-schedules another step.
  const processAITurn = useCallback(() => {
    const s = gameStateRef.current;
    if (!s || s.phase === "lobby" || s.phase === "game_over") return;

    // Determine the bot that should act right now
    const currentPid = s.order?.[s.current];
    const currentBot = s.players?.find(p => p.id === currentPid && p.is_bot);
    const auctionPid = s.phase === "auction" ? s.auction?.active?.[s.auction?.turn_idx] : null;
    const auctionBot = auctionPid ? s.players?.find(p => p.id === auctionPid && p.is_bot) : null;
    const debtorBot = s.phase === "debt" ? s.players?.find(p => p.id === s.debtor_id && p.is_bot) : null;

    const botId = currentBot?.id ?? auctionBot?.id ?? debtorBot?.id;
    if (!botId) return;

    const decision = getAIDecision(s, botId);
    if (!decision) return;

    const result = applyAction(s, decision);
    if (result.error) { console.error("[AI]", result.error); return; }

    commitState(result.state);

    // If the same bot still has a move in the same phase (e.g. build_house loop),
    // self-schedule instead of waiting for the useEffect to notice.
    const ns = result.state;
    const nsCurrentPid = ns.order?.[ns.current];
    const nsAuctionPid = ns.phase === "auction" ? ns.auction?.active?.[ns.auction?.turn_idx] : null;
    const nsDebtorId = ns.phase === "debt" ? ns.debtor_id : null;
    const sameBot = nsCurrentPid === botId || nsAuctionPid === botId || nsDebtorId === botId;
    if (sameBot && ns.phase !== "game_over" && getAIDecision(ns, botId)) {
      aiTimerRef.current = setTimeout(processAITurn, Math.floor(Math.random() * 300) + 200);
    }
  }, [commitState]);

  useEffect(() => {
    if (!isHost || !gameState || gameState.phase === "lobby" || gameState.phase === "game_over") return;

    const currentPid = gameState.order?.[gameState.current];
    const currentBot = gameState.players?.find(p => p.id === currentPid && p.is_bot);
    const auctionPid = gameState.phase === "auction" ? gameState.auction?.active?.[gameState.auction?.turn_idx] : null;
    const auctionBot = auctionPid ? gameState.players?.find(p => p.id === auctionPid && p.is_bot) : null;
    const debtorBot = gameState.phase === "debt"
      ? gameState.players?.find(p => p.id === gameState.debtor_id && p.is_bot) : null;

    if (!currentBot && !auctionBot && !debtorBot) return;

    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(processAITurn, randomAIDelay());

    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
  }, [gameState?.phase, gameState?.current, gameState?.auction?.turn_idx, gameState?.debtor_id, isHost, processAITurn]);

  // ── Action dispatch ────────────────────────────────────────────────────────
  const buildEnginePayload = (type, payload) => {
    if (type === "propose_trade") return { fromId: playerId, toId: payload.toId, offer: payload.offer };
    return { ...payload, playerId };
  };

  const dispatchAction = useCallback((type, payload = {}) => {
    const currentState = gameStateRef.current;
    if (!currentState || !roomId || !playerId) return;
    if (isHost) {
      const enginePayload = buildEnginePayload(type, payload);
      const result = applyAction(currentState, { type, payload: enginePayload });
      if (result.error) { setToast({ message: result.error, type: "error" }); return; }
      commitState(result.state);
    } else {
      sendAction(roomId, playerId, type, payload);
    }
  }, [roomId, playerId, isHost, commitState]);

  const handleAction = useCallback((type, payload = {}) => {
    playClick();
    dispatchAction(type, payload);
  }, [dispatchAction]);

  // ── Room lifecycle ─────────────────────────────────────────────────────────
  const handleCreateRoom = async (name, tokenShape, tokenColor) => {
    try {
      const result = await createRoom(name, tokenShape, tokenColor, houseRules, gameMode, quickModeRounds);
      applyRoomJoin(result.room, result.player, result.player.id);
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    }
  };

  const handleJoinRoom = async (code, name, tokenShape, tokenColor) => {
    try {
      const result = await joinRoom(code, name, tokenShape, tokenColor);
      applyRoomJoin(result.room, result.player, result.player.id);
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    }
  };

  const handleStartGame = async () => {
    playClick();
    if (!isHost || !roomId) return;

    let state = createInitialState(houseRules, gameMode, quickModeRounds);
    const sortedPlayers = [...players].sort((a, b) => a.seat_index - b.seat_index);
    for (const p of sortedPlayers) {
      const result = addPlayer(state, {
        id: p.id,
        name: p.name,
        token_shape: p.token_shape || p.token,
        token_color: p.token_color,
        seat_index: p.seat_index,
        is_bot: p.is_bot,
      });
      if (result.error) { setToast({ message: result.error, type: "error" }); return; }
      state = result.state;
    }

    const result = startGame(state, { hostId: playerId });
    if (result.error) { setToast({ message: result.error, type: "error" }); return; }

    const newState = result.state;
    gameStateRef.current = newState;
    setGameState(newState);
    await startRoomGame(roomId);
    await updateGameState(roomId, newState);
    startChiptune();
  };

  const handleLeaveRoom = async () => {
    playClick();
    stopHeartbeat();
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (playerId) await leaveRoom(playerId);
    clearSession();
    setRoomId(null);
    setPlayerId(null);
    setIsHost(false);
    setHostPlayerId(null);
    setPlayers([]);
    setGameState(null);
    gameStateRef.current = null;
    setHouseRules({ ...DEFAULT_HOUSE_RULES });
    setGameMode("classic");
    setScreen("MENU");
    stopChiptune();
  };

  // Lobby host controls
  const handleHouseRulesChange = async (newRules) => {
    setHouseRules(newRules);
    if (roomId) await updateHouseRules(roomId, newRules).catch(console.error);
  };

  const handleGameModeChange = async (mode, rounds) => {
    setGameMode(mode);
    setQuickModeRounds(rounds ?? quickModeRounds);
    if (roomId) await updateGameMode(roomId, mode, rounds ?? quickModeRounds).catch(console.error);
  };

  const handleAddBot = async (name, shape, color) => {
    if (!isHost || !roomId) return;
    try {
      await addBot(roomId, playerId, name, shape, color);
      const ps = await fetchPlayers(roomId);
      setPlayers(ps);
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    }
  };

  const handleRemoveBot = async (botId) => {
    if (!isHost || !roomId) return;
    await removeBot(botId);
    const ps = await fetchPlayers(roomId);
    setPlayers(ps);
  };

  const handleBankruptcyClick = () => { playClick(); setShowConfirmBankruptcy(true); };
  const handleConfirmBankruptcy = () => { setShowConfirmBankruptcy(false); handleAction("declare_bankruptcy"); };
  const handleSkipAnimations = () => { playClick(); if (animQueueRef.current) animQueueRef.current.skip(); };

  const handleEndGame = useCallback(async () => {
    if (!isHost || !roomId || !gameState) return;
    const newState = forceEndGame(gameState);
    commitState(newState);
    await endRoom(roomId).catch(console.error);
  }, [isHost, roomId, gameState, commitState]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = e => {
      const tag = document.activeElement?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "|") { playClick(); setShowDiagnostics(prev => !prev); return; }
      if (e.key === "Escape") {
        setSelectedTileId(null); setShowManage(false); setShowSettings(false); setShowConfirmBankruptcy(false);
        return;
      }
      if (inInput) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault(); playClick();
        if (screen === "LOBBY" && isHost && players.length >= 2) handleStartGame();
        else if (screen === "GAME") {
          const currId = gameState?.order?.[gameState?.current];
          if (currId === playerId && !animationsBusy) {
            const phase = gameState.phase;
            if (phase === "turn") handleAction("roll_dice");
            else if (phase === "buy_decision") handleAction("buy_property");
            else if (phase === "post_roll") handleAction("end_turn");
          }
        }
        return;
      }
      if ((e.key === "m" || e.key === "M") && screen === "GAME") { playClick(); setShowManage(prev => !prev); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, gameState, animationsBusy, playerId, players, isHost]);

  const isBankrupt = gameState?.players?.find(p => p.id === playerId)?.bankrupt;

  if (!authReady) {
    return (
      <div className="crt-screen flex items-center justify-center font-mono text-[10px] text-sky-400 tracking-widest">
        INITIALIZING…
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`crt-screen select-none ${scanlinesActive ? "scanlines" : ""} ${scanlinesActive ? "flicker" : ""}`}>
      <div className="crt-vignette" />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {cardOverlay && (
        <div className="fixed inset-0 z-[8500] flex items-center justify-center pointer-events-none">
          <div className={`glass-card px-8 py-6 border-t-4 animate-scale-up text-center max-w-xs ${cardOverlay.isChance ? "border-amber-500" : "border-sky-400"}`}>
            <div className={`font-mono text-[8px] font-bold tracking-widest mb-2 ${cardOverlay.isChance ? "text-amber-400" : "text-sky-400"}`}>
              {cardOverlay.isChance ? "✦ CHANCE ✦" : "✦ COMMUNITY CHEST ✦"}
            </div>
            <div className="font-mono text-[10px] text-slate-200 leading-relaxed">{cardOverlay.text}</div>
          </div>
        </div>
      )}

      <div className="fixed top-0 right-0 h-full w-[320px] pointer-events-none z-[8400]">
        {moneyDeltas.map(d => {
          const playerIdx = gameState?.players?.findIndex(p => p.id === d.pid) ?? 0;
          const topPct = 15 + playerIdx * 7;
          return (
            <div key={d.id} className="absolute right-4 font-mono text-[11px] font-bold animate-float-up"
              style={{ top: `${topPct}%`, color: d.delta >= 0 ? "#4ade80" : "#f87171" }}>
              {d.delta >= 0 ? "+" : ""}${d.delta}
            </div>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 border-b border-sky-950/40 bg-slate-950/60 z-10 font-mono">
          <div className="flex items-center gap-3">
            <span className="text-xs text-sky-400 font-bold tracking-widest uppercase">Stonks &amp; Strats Console</span>
            {roomId && (
              <span className="text-[8px] border border-green-500/30 bg-green-950/20 text-green-400 px-2 py-0.5 rounded uppercase">
                {isHost ? "HOST" : "CLIENT"} {isBankrupt ? "(SPECTATOR)" : "(PLAYER)"}
              </span>
            )}
          </div>
          <div className="text-[8px] text-slate-500 hidden sm:block">PRESS "|" FOR DIAGNOSTICS</div>
        </header>

        <div className={`flex-1 flex items-center justify-center overflow-hidden ${screen === "GAME" ? "p-0" : "p-4"}`}>

          {screen === "MENU" && (
            <RoomMenu
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              defaultName={playerName}
            />
          )}

          {screen === "LOBBY" && (
            <RoomLobby
              players={players}
              myPlayerId={playerId}
              isHost={isHost}
              hostPlayerId={hostPlayerId}
              roomCode={roomId}
              houseRules={houseRules}
              onHouseRulesChange={handleHouseRulesChange}
              gameMode={gameMode}
              quickModeRounds={quickModeRounds}
              onGameModeChange={handleGameModeChange}
              onStartGame={handleStartGame}
              onLeave={handleLeaveRoom}
              onAddBot={handleAddBot}
              onRemoveBot={handleRemoveBot}
            />
          )}

          {screen === "GAME" && gameState && (
            <div style={{ display: "flex", flexDirection: "row", width: "100%", height: "100%", gap: "8px", padding: "0 8px 8px 8px", overflow: "hidden" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", overflow: "hidden", minWidth: 0 }}>
                {isBankrupt && (
                  <div className="w-full px-4 py-2 bg-slate-900/80 border border-slate-700/50 font-mono text-[9px] text-slate-400 text-center tracking-widest uppercase flex items-center justify-center gap-2" style={{ flexShrink: 0 }}>
                    <BankruptcyIcon size={12} color="#EF4444" /> You&apos;re out — spectating
                  </div>
                )}
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", containerType: "size" }}>
                  <Board
                    gameState={gameState}
                    myPlayerId={playerId}
                    onTileClick={tid => setSelectedTileId(tid)}
                    renderedPositions={renderedPositions}
                    animationsBusy={animationsBusy}
                    onSkipAnimations={handleSkipAnimations}
                  />
                </div>
              </div>
              <div style={{ width: "340px", flexShrink: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <Sidebar
                  gameState={gameState}
                  myPlayerId={playerId}
                  playerName={playerName}
                  animDice={animDice}
                  animationsBusy={animationsBusy}
                  isHost={isHost}
                  onEndGame={handleEndGame}
                  onAction={(act, pay) => {
                    if (act === "declare_bankruptcy") handleBankruptcyClick();
                    else handleAction(act, pay);
                  }}
                  onOpenManage={() => setShowManage(true)}
                  onOpenSettings={() => setShowSettings(true)}
                  onSkipAnimations={handleSkipAnimations}
                />
              </div>
            </div>
          )}

          {screen === "GAME_OVER" && gameState && (
            <div className="relative glass-card w-full max-w-md p-6 flex flex-col gap-5 border-t-2 border-green-500 text-center font-mono text-[10px]">
              <canvas ref={confettiCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none rounded" />
              <h2 className="text-xs text-green-500 font-bold tracking-widest uppercase mb-1 flex items-center justify-center gap-1.5">
                <PlayIcon size={12} color="#10B981" /> SESSION CONCLUDED
              </h2>
              <div>
                <span className="text-[8px] text-slate-500">WINNING COMMANDER:</span>
                <div className="text-base font-bold text-green-400 glow-green mt-1">
                  {gameState.players.find(p => p.id === gameState.winner)?.name || "SYSTEM"}
                </div>
              </div>
              <div className="text-left flex flex-col gap-2 mt-2">
                <div className="text-[8px] text-slate-500 tracking-wider border-b border-slate-900 pb-1">STANDINGS LIST:</div>
                {gameState.players.slice().sort((a, b) => a.bankrupt === b.bankrupt ? b.money - a.money : a.bankrupt ? 1 : -1).map((p, idx) => (
                  <div key={p.id} className="flex justify-between border-b border-slate-900/30 pb-0.5 text-slate-300">
                    <span>{idx + 1}. {p.name}</span>
                    <span className="font-bold text-green-400">{p.bankrupt ? "BANKRUPT" : `$${p.money}`}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleLeaveRoom} className="btn-retro btn-retro-green w-full font-bold tracking-wider py-2.5 mt-2">
                <CloseIcon size={11} className="mr-1" /> RETURN TO MENU
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedTileId !== null && (
        <PropertyDetailModal tileId={selectedTileId} gameState={gameState} onClose={() => setSelectedTileId(null)} />
      )}
      {showManage && (
        <ManageModal gameState={gameState} myPlayerId={playerId} onAction={handleAction} onClose={() => setShowManage(false)} />
      )}
      <Auction gameState={gameState} myPlayerId={playerId} onAction={handleAction} />
      <Settings
        isOpen={showSettings} onClose={() => setShowSettings(false)}
        scanlinesActive={scanlinesActive} setScanlinesActive={setScanlinesActive}
        bloomSetting={bloomSetting} setBloomSetting={setBloomSetting}
      />
      <Diagnostics
        visible={showDiagnostics} onClose={() => setShowDiagnostics(false)}
        gameState={gameState} isHost={isHost} roomId={roomId} playerId={playerId}
      />
      <ConfirmDialog
        isOpen={showConfirmBankruptcy}
        title="DECLARATION OF BANKRUPTCY"
        message="Are you certain you wish to submit bankruptcy papers? All owned assets, holdings, and remaining cash will be foreclosed and liquidated."
        onConfirm={handleConfirmBankruptcy}
        onCancel={() => setShowConfirmBankruptcy(false)}
      />
    </div>
  );
}
