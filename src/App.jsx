import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import Board from "./components/Board";
import Sidebar from "./components/Sidebar";
import RoomMenu from "./components/RoomMenu";
import RoomLobby from "./components/RoomLobby";
import Toast from "./components/Toast";
import ConfirmDialog from "./components/ConfirmDialog";
import { EmoteOverlay } from "./components/Emotes";
import { useViewport } from "./lib/useViewport";

// Heavy / rarely-mounted UI is code-split so the initial bundle stays small.
const Diagnostics = lazy(() => import("./components/Diagnostics"));
const Auction = lazy(() => import("./components/Auction"));
const Settings = lazy(() => import("./components/Settings"));
const StatsScreen = lazy(() => import("./components/StatsScreen"));
const PropertyDetailModal = lazy(() => import("./components/Modals").then(m => ({ default: m.PropertyDetailModal })));
const ManageModal = lazy(() => import("./components/Modals").then(m => ({ default: m.ManageModal })));

import { ensureAuth } from "./lib/supabase";
import {
  createRoom, joinRoom, rejoinRoom, clearSession,
  subscribeToRoom, subscribeToActions, fetchPlayers, fetchRoom,
  sendAction, updateGameState, startRoomGame, endRoom, leaveRoom,
  updateHouseRules, updateGameMode, addBot, removeBot, updateBotDifficulty,
  touchHeartbeat, claimHost, markActionProcessed, subscribeToLive, resetRoomToLobby,
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
import { PlayIcon, CloseIcon, BankruptcyIcon } from "./lib/icons";

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
  const turnTimerRef = useRef(null);
  const timerKeyRef = useRef(null);
  const liveRef = useRef(null);

  const [toast, setToast] = useState(null);

  // Responsive layout
  const { isCompact } = useViewport();

  // Resizable board (desktop). The board is a square flush to the left edge and
  // the sidebar fills the remaining width. The drag handle resizes the board.
  const [boardSize, setBoardSize] = useState(() => {
    const saved = Number(localStorage.getItem("stonks_board_size"));
    if (saved) return saved;
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return Math.max(360, Math.min(h - 44, w - 320));
  });
  const draggingRef = useRef(false);
  useEffect(() => { localStorage.setItem("stonks_board_size", String(boardSize)); }, [boardSize]);

  const startBoardResize = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev) => {
      if (!draggingRef.current) return;
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const maxBoard = Math.min(window.innerHeight - 44, window.innerWidth - 300);
      setBoardSize(Math.max(360, Math.min(clientX, maxBoard)));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  }, []);

  // Ephemeral live channel state (emotes + lobby chat via Realtime broadcast)
  const [emotes, setEmotes] = useState([]);
  const [lobbyChat, setLobbyChat] = useState([]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        } else {
          // Empty state (lobby or host "play again" reset) → back to lobby.
          gameStateRef.current = null;
          setGameState(null);
          navigateForState(null);
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

  // ── Live channel: emotes + lobby chat (ephemeral Realtime broadcast) ────────
  useEffect(() => {
    if (!roomId) return;
    const live = subscribeToLive(roomId, {
      onEmote: (p) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setEmotes(e => [...e, { id, emoji: p.emoji, name: p.name, x: p.x }]);
        setTimeout(() => setEmotes(e => e.filter(x => x.id !== id)), 2500);
      },
      onChat: (p) => setLobbyChat(c => [...c.slice(-40), p]),
    });
    liveRef.current = live;
    return () => { live.unsubscribe(); liveRef.current = null; setEmotes([]); setLobbyChat([]); };
  }, [roomId]);

  const sendEmote = useCallback((emoji) => {
    if (!liveRef.current) return;
    liveRef.current.sendEmote({ emoji, name: playerName || "Player", x: 8 + Math.random() * 84 });
  }, [playerName]);

  const sendLobbyChat = useCallback((text) => {
    if (!liveRef.current || !text.trim()) return;
    liveRef.current.sendChat({ name: playerName || "Player", text: text.trim() });
  }, [playerName]);

  // ── Host turn timer ─────────────────────────────────────────────────────────
  // When enabled, the host stamps game_state.turn_deadline for the human whose
  // segment it is (bots are driven by the AI loop) and auto-resolves on expiry.
  const autoResolveTurn = useCallback((actorId) => {
    const s = gameStateRef.current;
    if (!s) return;
    const curId = s.phase === "auction" ? s.auction?.active?.[s.auction?.turn_idx]
      : s.phase === "debt" ? s.debtor_id
      : s.order?.[s.current];
    if (curId !== actorId) return;
    let act = null;
    if (s.phase === "turn") act = { type: "roll_dice", payload: { playerId: actorId } };
    else if (s.phase === "payment") act = { type: "confirm_payment", payload: { playerId: actorId } };
    else if (s.phase === "buy_decision") act = { type: "decline_buy", payload: { playerId: actorId } };
    else if (s.phase === "post_roll") act = { type: "end_turn", payload: { playerId: actorId } };
    else if (s.phase === "speed_bus") act = { type: "choose_bus_route", payload: { playerId: actorId, steps: Math.max(...(s.speed_die_choice || [0])) } };
    else if (s.phase === "auction") act = { type: "auction_pass", payload: { playerId: actorId } };
    else if (s.phase === "debt") act = getAIDecision(s, actorId); // sell → mortgage → bankrupt
    if (!act) return;
    const result = applyAction(s, act);
    if (result.error) return;
    timerKeyRef.current = null;
    commitState(result.state);
  }, [commitState]);

  useEffect(() => {
    if (!isHost) return;
    const s = gameState;
    if (!s || s.phase === "lobby" || s.phase === "game_over" || s.winner !== null) return;
    const rules = { ...DEFAULT_HOUSE_RULES, ...(s.house_rules || {}) };
    if (!rules.turn_timer_enabled) return;
    if (animationsBusy) return;

    const actorId = s.phase === "auction" ? s.auction?.active?.[s.auction?.turn_idx]
      : s.phase === "debt" ? s.debtor_id
      : s.order?.[s.current];
    const actor = s.players?.find(p => p.id === actorId);
    if (!actor || actor.is_bot || actor.bankrupt) return; // bots handled elsewhere

    const key = `${s.phase}:${actorId}`;
    if (timerKeyRef.current === key) return; // already armed for this segment
    timerKeyRef.current = key;

    const seconds = rules.turn_timer_seconds || 60;
    const deadline = Date.now() + seconds * 1000;
    const withDeadline = { ...s, turn_deadline: deadline };
    gameStateRef.current = withDeadline;
    setGameState(withDeadline);
    if (roomId) updateGameState(roomId, withDeadline).catch(console.error);

    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    turnTimerRef.current = setTimeout(() => autoResolveTurn(actorId), seconds * 1000 + 400);

    return () => { if (turnTimerRef.current) clearTimeout(turnTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, animationsBusy, gameState?.phase, gameState?.current, gameState?.debtor_id, gameState?.auction?.turn_idx]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        difficulty: p.bot_difficulty,
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
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    timerKeyRef.current = null;
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

  const handleAddBot = async (name, shape, color, difficulty = "normal") => {
    if (!isHost || !roomId) return;
    try {
      await addBot(roomId, playerId, name, shape, color, difficulty);
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

  const handleBotDifficulty = async (botId, difficulty) => {
    if (!isHost || !roomId) return;
    await updateBotDifficulty(botId, difficulty);
    const ps = await fetchPlayers(roomId);
    setPlayers(ps);
  };

  // Play again: host resets the room back to the lobby with the same players.
  const handlePlayAgain = useCallback(async () => {
    playClick();
    if (!isHost || !roomId) return;
    gameStateRef.current = null;
    setGameState(null);
    timerKeyRef.current = null;
    await resetRoomToLobby(roomId).catch(console.error);
    setScreen("LOBBY");
  }, [isHost, roomId]);

  const handleTileClick = useCallback((tid) => setSelectedTileId(tid), []);

  // 2.5D parallax: the board tilts slightly toward the cursor (Balatro-ish).
  const boardTiltRef = useRef(null);
  const handleBoardTilt = useCallback((e) => {
    const el = boardTiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${px * 5}deg) rotateX(${-py * 5}deg)`;
  }, []);
  const resetBoardTilt = useCallback(() => {
    if (boardTiltRef.current) boardTiltRef.current.style.transform = "rotateY(0deg) rotateX(0deg)";
  }, []);
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
            else if (phase === "payment") handleAction("confirm_payment");
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
      <div className="crt-bg" />
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

      {(() => {
        const pp = gameState?.pending_payment;
        const curId = gameState?.order?.[gameState?.current];
        if (!pp || gameState?.phase !== "payment" || curId !== playerId) return null;
        const me = gameState.players.find(p => p.id === playerId);
        const creditor = pp.toPid ? gameState.players.find(p => p.id === pp.toPid)?.name : "the Bank";
        const canAfford = (me?.money ?? 0) >= pp.amount;
        return (
          <div className="fixed inset-0 z-[8600] flex items-center justify-center backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="glass-card animate-scale-up text-center" style={{ width: "min(92vw, 360px)", padding: "26px 24px", borderTop: "4px solid #f87171" }}>
              <div style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#f87171", letterSpacing: "0.2em", marginBottom: "10px" }}>⚠ PAYMENT DUE</div>
              <div style={{ fontFamily: "var(--font-retro)", fontSize: "26px", color: "#fca5a5", fontWeight: "bold", textShadow: "0 0 12px rgba(248,113,113,0.5)" }}>${pp.amount.toLocaleString()}</div>
              <div style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#94a3b8", margin: "10px 0 4px" }}>to {creditor}</div>
              <div style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#64748b", marginBottom: "16px" }}>{pp.reason}</div>
              <div style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: canAfford ? "#34d399" : "#fbbf24", marginBottom: "14px" }}>
                YOUR CASH: ${me?.money?.toLocaleString() ?? 0}
                {!canAfford && <div style={{ color: "#fbbf24", marginTop: "6px" }}>Short — paying will require raising funds.</div>}
              </div>
              <button onClick={() => handleAction("confirm_payment")} className="btn-retro btn-retro-red w-full font-bold tracking-wider" style={{ padding: "12px", fontSize: "12px" }}>
                PAY ${pp.amount.toLocaleString()}
              </button>
            </div>
          </div>
        );
      })()}

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

      <div className="flex-1 flex flex-col h-screen overflow-hidden" style={{ position: "relative", zIndex: 1 }}>
        <header style={{ height: "32px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", borderBottom: "2px solid rgba(255,179,0,0.2)", background: "rgba(3,4,8,0.99)", flexShrink: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontFamily: "var(--font-retro)", fontSize: "9px", color: "#FFB300", fontWeight: "bold", letterSpacing: "0.2em" }}>STONKS &amp; STRATS</span>
            {roomId && <>
              <span style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", padding: "2px 6px" }}>
                {roomId}
              </span>
              <span style={{ fontFamily: "var(--font-retro)", fontSize: "8px", color: isHost ? "#fbbf24" : "#64748b", border: "1px solid", borderColor: isHost ? "rgba(251,191,36,0.35)" : "rgba(100,116,139,0.2)", padding: "2px 6px" }}>
                {isHost ? "HOST" : "PLAYER"}{isBankrupt ? " · SPECTATOR" : ""}
              </span>
            </>}
          </div>
          <div style={{ fontFamily: "var(--font-retro)", fontSize: "7px", color: "#334155", letterSpacing: "0.1em" }}>
            [|] DIAG · [M] PORTFOLIO · ESC CLOSE
          </div>
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
              onBotDifficulty={handleBotDifficulty}
              lobbyChat={lobbyChat}
              onLobbyChat={sendLobbyChat}
              onEmote={sendEmote}
            />
          )}

          {screen === "GAME" && gameState && (() => {
            const spectatorBanner = isBankrupt && (
              <div style={{ flexShrink: 0, padding: "5px 10px", background: "rgba(69,10,10,0.3)", borderBottom: "1px solid rgba(239,68,68,0.3)", fontFamily: "var(--font-retro)", fontSize: "8px", color: "#f87171", textAlign: "center", letterSpacing: "0.1em" }}>
                <BankruptcyIcon size={10} color="#EF4444" /> YOU ARE BANKRUPT — SPECTATING
              </div>
            );
            const board = (
              <Board
                gameState={gameState}
                myPlayerId={playerId}
                onTileClick={handleTileClick}
                renderedPositions={renderedPositions}
                animDice={animDice}
                animationsBusy={animationsBusy}
                onSkipAnimations={handleSkipAnimations}
              />
            );
            const sidebar = (
              <Sidebar
                gameState={gameState}
                myPlayerId={playerId}
                playerName={playerName}
                animationsBusy={animationsBusy}
                isHost={isHost}
                stacked={isCompact}
                onEndGame={handleEndGame}
                onEmote={sendEmote}
                onAction={(act, pay) => {
                  if (act === "declare_bankruptcy") handleBankruptcyClick();
                  else handleAction(act, pay);
                }}
                onOpenManage={() => setShowManage(true)}
                onOpenSettings={() => setShowSettings(true)}
              />
            );

            // Mobile/portrait: stack a width-bound square board over a scrolling panel.
            if (isCompact) {
              return (
                <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflowY: "auto", overflowX: "hidden" }}>
                  {spectatorBanner}
                  <div style={{ width: "min(100%, 62vh)", maxWidth: "100%", aspectRatio: "1 / 1", flexShrink: 0, alignSelf: "center", padding: "4px" }}>
                    {board}
                  </div>
                  {sidebar}
                </div>
              );
            }
            // Desktop: the board fills the space left of a resizable sidebar; it is
            // centered as a square that fits whatever room remains (container units).
            return (
              <div style={{ display: "flex", flexDirection: "row", width: "100%", height: "100%", overflow: "hidden" }}>
                <div style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {spectatorBanner}
                  <div
                    onMouseMove={handleBoardTilt}
                    onMouseLeave={resetBoardTilt}
                    style={{ flex: 1, minHeight: 0, containerType: "size", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "10px", perspective: "1400px" }}
                  >
                    <div
                      ref={boardTiltRef}
                      style={{ width: "min(100cqw, 100cqh)", height: "min(100cqw, 100cqh)", flexShrink: 0, transformStyle: "preserve-3d", transition: "transform 0.18s ease-out", willChange: "transform" }}
                    >
                      {board}
                    </div>
                  </div>
                </div>
                {/* Drag handle to resize the sidebar */}
                <div
                  onMouseDown={startBoardResize}
                  onTouchStart={startBoardResize}
                  title="Drag to resize"
                  style={{
                    width: "7px", flexShrink: 0, cursor: "col-resize",
                    background: "rgba(255,179,0,0.12)",
                    borderLeft: "1px solid rgba(255,179,0,0.2)",
                    borderRight: "1px solid rgba(255,179,0,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,179,0,0.35)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,179,0,0.12)"; }}
                >
                  <div style={{ width: "2px", height: "30px", background: "rgba(255,179,0,0.5)" }} />
                </div>
                <div style={{ width: `${boardSize}px`, flexShrink: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {sidebar}
                </div>
              </div>
            );
          })()}

          {screen === "GAME_OVER" && gameState && (
            <div className="relative w-full overflow-y-auto" style={{ maxHeight: "100%", maxWidth: "640px", padding: "8px" }}>
              <div className="relative glass-card w-full p-6 flex flex-col gap-5 border-t-2 border-green-500 text-center font-mono text-[10px]">
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

                <Suspense fallback={<div className="text-[8px] text-slate-500 py-4">LOADING STATS…</div>}>
                  <StatsScreen gameState={gameState} />
                </Suspense>

                <div className="flex flex-col gap-2 mt-1">
                  {isHost && (
                    <button onClick={handlePlayAgain} className="btn-retro btn-retro-green w-full font-bold tracking-wider py-2.5">
                      <PlayIcon size={11} className="mr-1" /> PLAY AGAIN (SAME PLAYERS)
                    </button>
                  )}
                  <button onClick={handleLeaveRoom} className="btn-retro btn-retro-red w-full font-bold tracking-wider py-2.5">
                    <CloseIcon size={11} className="mr-1" /> RETURN TO MENU
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <EmoteOverlay emotes={emotes} />

      <Suspense fallback={null}>
        {selectedTileId !== null && (
          <PropertyDetailModal tileId={selectedTileId} gameState={gameState} onClose={() => setSelectedTileId(null)} />
        )}
        {showManage && (
          <ManageModal gameState={gameState} myPlayerId={playerId} onAction={handleAction} onClose={() => setShowManage(false)} />
        )}
        {gameState?.phase === "auction" && (
          <Auction gameState={gameState} myPlayerId={playerId} onAction={handleAction} />
        )}
        {showSettings && (
          <Settings
            isOpen={showSettings} onClose={() => setShowSettings(false)}
            scanlinesActive={scanlinesActive} setScanlinesActive={setScanlinesActive}
            bloomSetting={bloomSetting} setBloomSetting={setBloomSetting}
          />
        )}
        {showDiagnostics && (
          <Diagnostics
            visible={showDiagnostics} onClose={() => setShowDiagnostics(false)}
            gameState={gameState} isHost={isHost} roomId={roomId} playerId={playerId}
          />
        )}
      </Suspense>
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
