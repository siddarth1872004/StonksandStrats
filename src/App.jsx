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
const Board3D = lazy(() => import("./components/Board3D"));
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
  fetchUnprocessedActions, updatePlayerToken,
} from "./lib/roomClient";

import {
  createInitialState, addPlayer, startGame, applyAction, getAIDecision, forceEndGame, DEFAULT_HOUSE_RULES,
} from "./lib/gameEngine";

import {
  playClick, playRoll, playMove, playBuy, playRent, playWin, playJail,
  setMuted, getMuted,
} from "./lib/audio";
import {
  ConfettiCanvas, diffStates, ANIM, animateDice, animateHop, AnimationQueue,
} from "./lib/animation";
import { PlayIcon, CloseIcon, BankruptcyIcon, SoundIcon, MuteIcon } from "./lib/icons";

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
  const processedActionsRef = useRef(new Set()); // host idempotency guard
  const writeTimerRef = useRef(null);            // coalesced game_state writes
  const pendingWriteRef = useRef(null);
  const isHostRef = useRef(false);               // current host flag for live-channel callbacks

  const [toast, setToast] = useState(null);
  const [connected, setConnected] = useState(true); // realtime link health

  // Responsive layout
  const { isCompact, isPhone } = useViewport();

  // Resizable sidebar (desktop). The board fills whatever space is left of it
  // (it is NOT constrained to a square — it stretches to fill the area).
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem("stonks_sidebar_w"));
    if (saved) return saved;
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    return Math.min(Math.max(280, Math.round(w * 0.25)), Math.round(w * 0.5));
  });
  const draggingRef = useRef(false);
  useEffect(() => { localStorage.setItem("stonks_sidebar_w", String(sidebarWidth)); }, [sidebarWidth]);

  const startSidebarDrag = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev) => {
      if (!draggingRef.current) return;
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const next = Math.min(Math.max(240, window.innerWidth - clientX), Math.round(window.innerWidth * 0.7));
      setSidebarWidth(next);
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
  // Transient per-token visual states for live token animations.
  const [tokenFx, setTokenFx] = useState({});       // pid -> 'gain' | 'loss'
  const [movingPids, setMovingPids] = useState({});  // pid -> true while hopping
  const [landing, setLanding] = useState(null);      // { pid, tileId, key } center card
  const landingTimerRef = useRef(null);
  const animQueueRef = useRef(null);
  const animationsBusyRef = useRef(false);
  const lastAiAtRef = useRef(0); // when the host last applied a bot action (watchdog throttle)
  // Monotonic version of the last game_state we committed/applied. Lets clients
  // drop stale or duplicate states (the same update arrives over BOTH the
  // broadcast fast-path and the ~1s postgres_changes echo, and the two can land
  // out of order — without this a late DB echo briefly reverts to an old state).
  const lastSeqRef = useRef(0);

  // Client visual settings
  const [scanlinesActive, setScanlinesActive] = useState(
    () => localStorage.getItem("stonks_scanlines") !== "false"
  );
  const [bloomSetting, setBloomSetting] = useState(
    () => localStorage.getItem("stonks_bloom") || "low"
  );
  // 3D board toggle — defaults on for capable devices, off on low-power/mobile.
  const [use3D, setUse3D] = useState(() => {
    const saved = localStorage.getItem("stonks_3d");
    if (saved !== null) return saved === "true";
    const lowPower =
      (navigator.hardwareConcurrency || 8) <= 4 ||
      (navigator.deviceMemory || 8) <= 4 ||
      window.matchMedia("(max-width: 820px)").matches;
    return !lowPower;
  });
  const toggle3D = useCallback(() => {
    setUse3D(prev => { const next = !prev; localStorage.setItem("stonks_3d", String(next)); return next; });
    playClick();
  }, []);
  const [muted, setMutedState] = useState(() => getMuted());
  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) playClick();
  }, [muted]);

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
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  // Bloom is always on (high). On weak devices (few cores / little memory /
  // small touch screens / reduced-motion) add `low-power`, which the stylesheet
  // uses to drop the GPU-heavy effects (backdrop blur, hue-cycling plasma) so
  // the game stays smooth on phones and low-end PCs.
  useEffect(() => {
    const lowPower =
      (navigator.hardwareConcurrency || 8) <= 4 ||
      (navigator.deviceMemory || 8) <= 4 ||
      window.matchMedia("(max-width: 820px)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.body.className = lowPower ? "bloom-high low-power" : "bloom-high";
  }, [bloomSetting]);

  useEffect(() => {
    const q = new AnimationQueue();
    q.onBusyChange((b) => { animationsBusyRef.current = b; setAnimationsBusy(b); });
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

  // Mark where a player landed. The card stays up (no auto-close) until the
  // turn advances — syncGameState clears it when `current` changes.
  const showLanding = useCallback((pid, tileId) => {
    setLanding({ pid, tileId, key: Date.now() });
  }, []);

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
          // Pin the token at its ORIGIN now (this batches with the setGameState
          // above) so it never flashes at the destination while the dice animate;
          // the hop walks it forward when the queue reaches this step.
          setRenderedPositions(p => ({ ...p, [ev.pid]: ev.from }));
          q.enqueue(qInst => {
            playMove();
            setMovingPids(m => ({ ...m, [ev.pid]: true }));
            return animateHop(ev.pid, ev.from, ev.steps,
              (pid, pos) => setRenderedPositions(p => ({ ...p, [pid]: pos })), qInst)
              .finally(() => {
                setMovingPids(m => { const n = { ...m }; delete n[ev.pid]; return n; });
                showLanding(ev.pid, ev.to);
              });
          });
          break;
        case ANIM.MOVE_WARP:
          // Hold at the origin, then warp after any dice settle (sequenced through
          // the queue) so the jump doesn't pop before the roll is shown.
          setRenderedPositions(p => ({ ...p, [ev.pid]: ev.from }));
          q.enqueue(() => new Promise(res => {
            setMovingPids(m => ({ ...m, [ev.pid]: true }));
            setTimeout(() => {
              setRenderedPositions(p => ({ ...p, [ev.pid]: ev.to }));
              setMovingPids(m => { const n = { ...m }; delete n[ev.pid]; return n; });
              showLanding(ev.pid, ev.to);
              res();
            }, 320);
          }));
          break;
        case ANIM.MONEY_DELTA: {
          const deltaId = `${Date.now()}-${ev.pid}`;
          setMoneyDeltas(d => [...d, { id: deltaId, pid: ev.pid, delta: ev.delta }]);
          setTimeout(() => setMoneyDeltas(d => d.filter(x => x.id !== deltaId)), 1200);
          // Flash the token green (gained) or red+shake (paid).
          const fx = ev.delta >= 0 ? "gain" : "loss";
          setTokenFx(m => ({ ...m, [ev.pid]: fx }));
          setTimeout(() => setTokenFx(m => {
            if (m[ev.pid] !== fx) return m;
            const n = { ...m }; delete n[ev.pid]; return n;
          }), 1000);
          if (ev.delta < 0) playRent();
          break;
        }
        case ANIM.CARD_DRAW:
          // Sequence the card through the queue so it appears AFTER the token
          // lands on the Chance/Chest tile (not mid-hop), holds, then clears.
          q.enqueue(() => new Promise(res => {
            playClick();
            setCardOverlay({ text: ev.text, isChance: ev.isChance });
            setTimeout(() => { setCardOverlay(null); res(); }, 1900);
          }));
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
    // Clear the landing card once the turn moves on (player ended their turn).
    if (prev && newState && prev.current !== newState.current) setLanding(null);
  }, [showLanding]);

  // Coalesced game_state writer. Each write is the COMPLETE state, so collapsing
  // rapid successive writes (AI build loops, animation micro-steps) into one
  // trailing write is loss-free and dramatically cuts DB/realtime traffic.
  const flushGameWrite = useCallback(() => {
    if (writeTimerRef.current) { clearTimeout(writeTimerRef.current); writeTimerRef.current = null; }
    const st = pendingWriteRef.current;
    pendingWriteRef.current = null;
    if (st && roomId) updateGameState(roomId, st).catch(console.error);
  }, [roomId]);

  const queueGameWrite = useCallback((newState) => {
    pendingWriteRef.current = newState;
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(flushGameWrite, 90);
  }, [flushGameWrite]);

  // Authoritative immediate write: cancels any pending coalesced write so an
  // older queued state can never land after a start/reset/deadline transition.
  const writeGameStateNow = useCallback((state) => {
    if (writeTimerRef.current) { clearTimeout(writeTimerRef.current); writeTimerRef.current = null; }
    pendingWriteRef.current = null;
    if (!roomId) return Promise.resolve();
    return updateGameState(roomId, state);
  }, [roomId]);

  const cancelPendingWrite = useCallback(() => {
    if (writeTimerRef.current) { clearTimeout(writeTimerRef.current); writeTimerRef.current = null; }
    pendingWriteRef.current = null;
  }, []);

  // Stamp a strictly-increasing version onto a state before it leaves this client.
  // Date.now()-based so it keeps climbing across host migration/reload; the +1
  // guards against two commits within the same millisecond.
  const stampSeq = useCallback((st) => {
    const seq = Math.max(Date.now(), lastSeqRef.current + 1);
    lastSeqRef.current = seq;
    return { ...st, state_seq: seq };
  }, []);

  // Apply a state that arrived from a remote source (broadcast or DB echo),
  // ignoring anything we've already superseded. Legacy states without a
  // state_seq are always applied (safe fallback).
  const applyRemoteState = useCallback((st) => {
    if (!st) return;
    if (st.state_seq != null) {
      if (st.state_seq <= lastSeqRef.current) return; // stale or duplicate
      lastSeqRef.current = st.state_seq;
    }
    syncGameState(st);
    navigateForState(st);
  }, [syncGameState]);

  // Commit a new state: run animations + persist to DB. Use everywhere instead of
  // setGameState+updateGameState so the host always gets animations too.
  const commitState = useCallback((newState) => {
    const stamped = stampSeq(newState);
    syncGameState(stamped);
    // The host drives its OWN screen navigation locally; it can't rely on the
    // DB echo anymore because the seq-guard (correctly) drops its own echoes.
    navigateForState(stamped);
    // Fast path: push the new state to guests over the broadcast channel
    // immediately (sub-100ms) so the flow isn't a postgres_changes hop behind.
    liveRef.current?.sendState(stamped);
    if (roomId) queueGameWrite(stamped); // durable copy for reconnects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, queueGameWrite, stampSeq]);

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
        // Seed the seq baseline from the loaded state so the first DB echo of the
        // same state isn't re-applied as if it were new.
        if (room.game_state.state_seq != null) lastSeqRef.current = room.game_state.state_seq;
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
          // Seq-guarded: ignores our own DB echo and any out-of-order/stale write
          // (the broadcast fast-path already delivered newer state to guests).
          applyRemoteState(roomRow.game_state);
        } else if (roomRow.status === "lobby") {
          // Only treat an empty state as "lobby" when the room is actually back in
          // the lobby (host "play again"). Ignoring transient empty payloads during
          // an active game prevents players from being bounced out mid-game.
          gameStateRef.current = null;
          setGameState(null);
          setScreen("LOBBY");
        }
      },
      (ps) => setPlayers(ps || []),
      (status) => setConnected(status === "SUBSCRIBED")
    );

    return () => { unsubRoom(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Apply a single guest action (from the realtime broadcast fast-path, the
  // actions-table postgres_changes stream, or a safety drain). Idempotent: a
  // client-generated `cid` (or DB row id) is processed at most once, so the same
  // action arriving on multiple paths can never double-apply. DB rows are always
  // marked processed so the drain stops re-delivering them.
  const applyActionRow = useCallback((row) => {
    if (!row) return;
    const key = row.payload?.cid ?? row.id;
    const isDbRow = row.id != null;

    if (key == null || !processedActionsRef.current.has(key)) {
      const currentState = gameStateRef.current;
      if (!currentState) return; // not ready yet — a later drain will retry
      if (key != null) processedActionsRef.current.add(key);

      const actionType = row.action_type || row.type;
      const enginePayload = actionType === "propose_trade"
        ? { fromId: row.player_id, toId: row.payload.toId, offer: row.payload.offer }
        : { ...row.payload, playerId: row.player_id };

      const result = applyAction(currentState, { type: actionType, payload: enginePayload });
      if (result.error) console.error("[host] action error:", result.error);
      else commitState(result.state);
    }
    if (isDbRow) markActionProcessed(row.id).catch(console.error);
  }, [commitState]);

  // Host subscribes to actions + drains any it missed (on connect and on a timer).
  useEffect(() => {
    if (!roomId || !isHost) return;

    const drain = () => fetchUnprocessedActions(roomId)
      .then(rows => rows.forEach(applyActionRow))
      .catch(() => {});

    const unsubActions = subscribeToActions(roomId, applyActionRow);
    drain(); // catch anything queued before this subscription existed
    const drainInterval = setInterval(drain, 3000); // safety net for missed events

    actionsUnsubRef.current = unsubActions;
    return () => { unsubActions(); clearInterval(drainInterval); actionsUnsubRef.current = null; };
  }, [roomId, isHost, applyActionRow]);

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
      // Guests apply host-broadcast state instantly (skip our own echo as host).
      onState: (st) => {
        if (isHostRef.current) return;
        applyRemoteState(st);
      },
      // Host applies guest-broadcast actions instantly (the DB row is durable backup).
      onAction: (row) => { if (isHostRef.current) applyActionRow(row); },
    });
    liveRef.current = live;
    return () => { live.unsubscribe(); liveRef.current = null; setEmotes([]); setLobbyChat([]); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const withDeadline = stampSeq({ ...s, turn_deadline: deadline });
    gameStateRef.current = withDeadline;
    setGameState(withDeadline);
    liveRef.current?.sendState(withDeadline);
    writeGameStateNow(withDeadline).catch(console.error);

    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    turnTimerRef.current = setTimeout(() => autoResolveTurn(actorId), seconds * 1000 + 400);

    return () => { if (turnTimerRef.current) clearTimeout(turnTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, animationsBusy, gameState?.phase, gameState?.current, gameState?.debtor_id, gameState?.auction?.active?.[gameState?.auction?.turn_idx], gameState?.auction?.active?.length]);

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
    const tradePid = s.pending_trade?.to;
    const tradeBot = tradePid ? s.players?.find(p => p.id === tradePid && p.is_bot) : null;

    // A trade aimed at a bot must be answered even when it's a human's turn.
    const botId = tradeBot?.id ?? currentBot?.id ?? auctionBot?.id ?? debtorBot?.id;
    if (!botId) return;

    const decision = getAIDecision(s, botId);
    if (!decision) return;

    const result = applyAction(s, decision);
    if (result.error) { console.error("[AI]", result.error); return; }

    commitState(result.state);
    lastAiAtRef.current = Date.now();

    // If the same bot still has a move in the same phase (e.g. build_house loop),
    // self-schedule instead of waiting for the useEffect to notice.
    const ns = result.state;
    const nsCurrentPid = ns.order?.[ns.current];
    const nsAuctionPid = ns.phase === "auction" ? ns.auction?.active?.[ns.auction?.turn_idx] : null;
    const nsDebtorId = ns.phase === "debt" ? ns.debtor_id : null;
    const sameBot = nsCurrentPid === botId || nsAuctionPid === botId || nsDebtorId === botId;
    // Only self-chain when nothing is animating. If the action kicked off a move
    // (e.g. a roll), let the animation finish — the effect (keyed on
    // animationsBusy) re-schedules the next decision once the token has landed.
    if (sameBot && !animationsBusyRef.current && ns.phase !== "game_over" && getAIDecision(ns, botId)) {
      aiTimerRef.current = setTimeout(processAITurn, Math.floor(Math.random() * 400) + 350);
    }
  }, [commitState]);

  useEffect(() => {
    if (!isHost || !gameState || gameState.phase === "lobby" || gameState.phase === "game_over") return;
    // Hold the bot back ONLY while a dice/token move is mid-flight, so it doesn't
    // buy/build the instant it lands. Auctions, debt and trade responses have no
    // pending move, so they must never be animation-gated (that was stalling the
    // auction AI). When the move animation ends, animationsBusy flips and this
    // effect re-runs (it's in the deps) to schedule with a natural think-pause.
    const moveSpoilingPhase = ["turn", "post_roll", "buy_decision", "speed_bus", "payment"].includes(gameState.phase);
    if (animationsBusy && moveSpoilingPhase) return;

    const currentPid = gameState.order?.[gameState.current];
    const currentBot = gameState.players?.find(p => p.id === currentPid && p.is_bot);
    const auctionPid = gameState.phase === "auction" ? gameState.auction?.active?.[gameState.auction?.turn_idx] : null;
    const auctionBot = auctionPid ? gameState.players?.find(p => p.id === auctionPid && p.is_bot) : null;
    const debtorBot = gameState.phase === "debt"
      ? gameState.players?.find(p => p.id === gameState.debtor_id && p.is_bot) : null;
    const tradePid = gameState.pending_trade?.to;
    const tradeBot = tradePid ? gameState.players?.find(p => p.id === tradePid && p.is_bot) : null;

    if (!currentBot && !auctionBot && !debtorBot && !tradeBot) return;

    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(processAITurn, randomAIDelay());

    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
    // Key on the actual auction actor id, not turn_idx: when a player passes the
    // index can stay the same while pointing at a new bidder, which would
    // otherwise stall the auction (the next bot never gets prompted).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase, gameState?.current, gameState?.auction?.active?.[gameState?.auction?.turn_idx], gameState?.auction?.active?.length, gameState?.debtor_id, gameState?.pending_trade?.to, isHost, animationsBusy, processAITurn]);

  // ── AI watchdog (host only) ────────────────────────────────────────────────
  // Safety net: if a bot ever stops getting scheduled (e.g. an auction effect
  // that didn't re-fire), this kicks it back into motion. processAITurn no-ops
  // when no bot is actually due, so this can't act out of turn.
  useEffect(() => {
    if (!isHost) return;
    const iv = setInterval(() => {
      const s = gameStateRef.current;
      if (!s || s.phase === "lobby" || s.phase === "game_over") return;
      if (animationsBusyRef.current) return;
      if (Date.now() - lastAiAtRef.current < 2500) return; // a bot acted recently — leave it
      processAITurn();
    }, 1500);
    return () => clearInterval(iv);
  }, [isHost, processAITurn]);

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
      // Tag with a client id so the host dedupes the fast broadcast against the
      // durable DB row. Broadcast first (instant), then persist to the actions
      // table as the reliable fallback.
      const cid = (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`);
      const payloadWithCid = { ...payload, cid };
      liveRef.current?.sendAction({ action_type: type, player_id: playerId, payload: payloadWithCid });
      sendAction(roomId, playerId, type, payloadWithCid);
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

    const newState = stampSeq(result.state);
    gameStateRef.current = newState;
    setGameState(newState);
    navigateForState(newState); // host navigates locally (its DB echo is seq-dropped)
    // Write the game state BEFORE flipping status to 'playing' so no client ever
    // sees status=playing with an empty state (which would bounce them to lobby).
    processedActionsRef.current.clear();
    await writeGameStateNow(newState);
    await startRoomGame(roomId);
  };

  const handleLeaveRoom = async () => {
    playClick();
    stopHeartbeat();
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    if (writeTimerRef.current) { clearTimeout(writeTimerRef.current); writeTimerRef.current = null; }
    if (landingTimerRef.current) { clearTimeout(landingTimerRef.current); landingTimerRef.current = null; }
    setLanding(null);
    pendingWriteRef.current = null;
    processedActionsRef.current.clear();
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

  const handleChangeToken = async (shape, color) => {
    if (!roomId || !playerId) return;
    playClick();
    try {
      await updatePlayerToken(roomId, playerId, shape, color);
      const ps = await fetchPlayers(roomId);
      setPlayers(ps);
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    }
  };

  // Play again: host resets the room back to the lobby with the same players.
  const handlePlayAgain = useCallback(async () => {
    playClick();
    if (!isHost || !roomId) return;
    cancelPendingWrite();
    processedActionsRef.current.clear();
    gameStateRef.current = null;
    setGameState(null);
    timerKeyRef.current = null;
    await resetRoomToLobby(roomId).catch(console.error);
    setScreen("LOBBY");
  }, [isHost, roomId, cancelPendingWrite]);

  const handleTileClick = useCallback((tid) => setSelectedTileId(tid), []);
  const handleBankruptcyClick = useCallback(() => { playClick(); setShowConfirmBankruptcy(true); }, []);
  const handleConfirmBankruptcy = () => { setShowConfirmBankruptcy(false); handleAction("declare_bankruptcy"); };
  // Stable identity so the memoized <Board> isn't forced to re-render every tick.
  const handleSkipAnimations = useCallback(() => { playClick(); if (animQueueRef.current) animQueueRef.current.skip(); }, []);
  // Stable props for the memoized <Sidebar> (inline arrows would break the memo).
  const handleSidebarAction = useCallback((act, pay) => {
    if (act === "declare_bankruptcy") handleBankruptcyClick();
    else handleAction(act, pay);
  }, [handleBankruptcyClick, handleAction]);
  const openSettings = useCallback(() => setShowSettings(true), []);

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
    <div className="crt-screen select-none">

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {cardOverlay && !use3D && (
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
        // Hold the payment prompt until the dice + token-move animations finish,
        // so the "what happens next" suspense isn't spoiled before the token lands.
        if (!pp || gameState?.phase !== "payment" || curId !== playerId || animationsBusy) return null;
        const me = gameState.players.find(p => p.id === playerId);
        const creditor = pp.toPid ? gameState.players.find(p => p.id === pp.toPid)?.name : "the Bank";
        const canAfford = (me?.money ?? 0) >= pp.amount;
        return (
          <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.7)", zIndex: 8600 }}>
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
        <header style={{ height: "38px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid rgba(255,179,0,0.18)", background: "rgba(3,4,8,0.99)", flexShrink: 0, zIndex: 10, gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
            {!isPhone && <span style={{ fontFamily: "var(--font-display)", fontSize: "9px", color: "#FFB300", fontWeight: "bold", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>STONKS &amp; STRATS</span>}
            {roomId && <>
              <span style={{ fontFamily: "var(--font-retro)", fontSize: "13px", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", padding: "1px 8px", borderRadius: "4px", letterSpacing: "0.1em" }}>
                {roomId}
              </span>
              <span style={{ fontFamily: "var(--font-retro)", fontSize: "12px", color: isHost ? "#fbbf24" : "#94a3b8", border: "1px solid", borderColor: isHost ? "rgba(251,191,36,0.35)" : "rgba(100,116,139,0.2)", padding: "1px 8px", borderRadius: "4px" }}>
                {isHost ? "HOST" : "PLAYER"}{isBankrupt ? " · SPECTATOR" : ""}
              </span>
            </>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
            <button
              onClick={toggle3D}
              title={use3D ? "Switch to 2D board" : "Switch to 3D board"}
              style={{ fontFamily: "var(--font-retro)", fontSize: "11px", fontWeight: "bold", letterSpacing: "0.08em",
                background: use3D ? "rgba(56,189,248,0.16)" : "transparent", border: "1px solid",
                borderColor: use3D ? "#38bdf8" : "rgba(100,116,139,0.3)", color: use3D ? "#38bdf8" : "#64748b",
                padding: "2px 8px", borderRadius: "4px", cursor: "pointer" }}
            >
              {use3D ? "3D" : "2D"}
            </button>
            {roomId && (
              <span title={connected ? "Realtime connected" : "Reconnecting…"} style={{ display: "flex", alignItems: "center", gap: "5px", fontFamily: "var(--font-retro)", fontSize: "12px", color: connected ? "#34d399" : "#fbbf24", whiteSpace: "nowrap" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: connected ? "#22c55e" : "#fbbf24", boxShadow: connected ? "0 0 5px #22c55e" : "0 0 5px #fbbf24", animation: connected ? "pulse-anim 2s infinite" : "blink-anim 0.8s infinite" }} />
                {isPhone ? (connected ? "" : "…") : (connected ? "LIVE" : "RECONNECTING")}
              </span>
            )}
            <button
              onClick={toggleMute}
              title={muted ? "Unmute" : "Mute"}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center" }}
            >
              {muted ? <MuteIcon size={15} color="#64748b" /> : <SoundIcon size={15} color="#FFB300" />}
            </button>
          </div>
        </header>

        <div className={`flex-1 min-h-0 flex ${screen === "GAME" ? "items-center justify-center overflow-hidden p-0" : "scroll-center p-4"}`}>

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
              onChangeToken={handleChangeToken}
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
            const board = use3D ? (
              <Suspense fallback={<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-retro)", color: "#38bdf8", fontSize: "14px" }}>LOADING 3D BOARD…</div>}>
                <Board3D
                  gameState={gameState}
                  myPlayerId={playerId}
                  onTileClick={handleTileClick}
                  renderedPositions={renderedPositions}
                  animationsBusy={animationsBusy}
                  landing={landing}
                  card={cardOverlay}
                />
              </Suspense>
            ) : (
              <Board
                gameState={gameState}
                myPlayerId={playerId}
                onTileClick={handleTileClick}
                renderedPositions={renderedPositions}
                animDice={animDice}
                animationsBusy={animationsBusy}
                onSkipAnimations={handleSkipAnimations}
                tokenFx={tokenFx}
                movingPids={movingPids}
                landing={landing}
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
                onAction={handleSidebarAction}
                onOpenSettings={openSettings}
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
            // Desktop: the board FILLS the area left of the sidebar (stretches to
            // fit, not square); the drag handle resizes the sidebar and the board
            // reflows to fill the remaining space. No empty bars.
            return (
              <div style={{ display: "flex", flexDirection: "row", width: "100%", height: "100%", overflow: "hidden" }}>
                <div style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {spectatorBanner}
                  {/* Square-fit the board so cells stay square and tokens never
                      clip on a stretched axis (containerType enables cqw/cqh). */}
                  <div style={{ flex: 1, minHeight: 0, overflow: "hidden", containerType: "size", display: "flex", alignItems: "center", justifyContent: "center", padding: "6px" }}>
                    <div style={{ width: use3D ? "100%" : "min(100cqw, 100cqh)", height: use3D ? "100%" : "min(100cqw, 100cqh)" }}>
                      {board}
                    </div>
                  </div>
                </div>
                {/* Drag handle — resizes the sidebar; the board reflows to fill */}
                <div
                  onMouseDown={startSidebarDrag}
                  onTouchStart={startSidebarDrag}
                  title="Drag to resize"
                  style={{
                    width: "10px", flexShrink: 0, cursor: "col-resize",
                    background: "rgba(255,179,0,0.18)",
                    borderLeft: "1px solid rgba(255,179,0,0.3)",
                    borderRight: "1px solid rgba(255,179,0,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,179,0,0.4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,179,0,0.18)"; }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: "rgba(255,179,0,0.8)" }} />)}
                  </div>
                </div>
                <div style={{ width: `${sidebarWidth}px`, flexShrink: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
