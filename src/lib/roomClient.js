// Phase 3 room client — rooms.id = room code (text PK), auth.uid() = player.id
import { supabase } from './supabase';

// ── Room creation ─────────────────────────────────────────────────────────────
// Uses the create_room_fn RPC so code generation + insert is atomic server-side.
export async function createRoom(playerName, tokenShape, tokenColor, houseRules = {}, gameMode = 'classic', quickModeRounds = 30) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: code, error: rpcErr } = await supabase.rpc('create_room_fn', {
    p_host_id:      user.id,
    p_house_rules:  houseRules,
    p_game_mode:    gameMode,
    p_quick_rounds: quickModeRounds,
  });
  if (rpcErr) throw new Error(rpcErr.message);

  const { data: existingPlayers } = await supabase
    .from('players').select('seat_index').eq('room_id', code).order('seat_index');
  const seat = existingPlayers?.length ?? 0;

  const { error: playerErr } = await supabase.from('players').upsert({
    id:          user.id,
    room_id:     code,
    seat_index:  seat,
    name:        playerName,
    token_shape: tokenShape || 'car',
    token_color: tokenColor || '#EF4444',
    is_bot:      false,
    is_connected: true,
  }, { onConflict: 'id' });
  if (playerErr) throw new Error(playerErr.message);

  localStorage.setItem('stonks_room_id', code);
  localStorage.setItem('stonks_player_name', playerName);

  const room = await fetchRoom(code);
  const player = await fetchPlayerById(user.id);
  return { room, player };
}

// ── Room joining ──────────────────────────────────────────────────────────────
export async function joinRoom(code, playerName, tokenShape, tokenColor) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const room = await fetchRoom(code.toUpperCase());
  if (!room) throw new Error('Room not found.');
  if (room.status !== 'lobby') throw new Error('Game already in progress.');

  const existingPlayers = await fetchPlayers(code.toUpperCase());
  if (existingPlayers.length >= 6) throw new Error('Lobby is full (max 6 players).');
  if (existingPlayers.some(p => p.name === playerName)) throw new Error('That name is already taken.');
  // If we already have a player row in this room (rejoin), update it instead
  const existing = existingPlayers.find(p => p.id === user.id);
  if (existing) {
    await supabase.from('players').update({ is_connected: true, last_seen: new Date().toISOString() }).eq('id', user.id);
    localStorage.setItem('stonks_room_id', code.toUpperCase());
    localStorage.setItem('stonks_player_name', playerName);
    return { room, player: existing };
  }

  const seat = existingPlayers.length;
  const { error: playerErr } = await supabase.from('players').upsert({
    id:          user.id,
    room_id:     code.toUpperCase(),
    seat_index:  seat,
    name:        playerName,
    token_shape: tokenShape || 'hat',
    token_color: tokenColor || '#3B82F6',
    is_bot:      false,
    is_connected: true,
  }, { onConflict: 'id' });
  if (playerErr) throw new Error(playerErr.message);

  localStorage.setItem('stonks_room_id', code.toUpperCase());
  localStorage.setItem('stonks_player_name', playerName);

  const player = await fetchPlayerById(user.id);
  return { room, player };
}

// ── Rejoin on page reload ─────────────────────────────────────────────────────
// Supabase restores the anonymous session automatically — just look up the room.
export async function rejoinRoom() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const roomId = localStorage.getItem('stonks_room_id');
  if (!roomId) return null;

  const room = await fetchRoom(roomId);
  const player = await fetchPlayerById(user.id);
  if (!room || !player || room.status === 'finished') {
    clearSession();
    return null;
  }
  await supabase.from('players').update({ is_connected: true, last_seen: new Date().toISOString() }).eq('id', user.id);
  return { room, player };
}

// ── Session helpers ───────────────────────────────────────────────────────────
export function clearSession() {
  ['stonks_room_id', 'stonks_player_name'].forEach(k => localStorage.removeItem(k));
}

// ── Data fetchers ─────────────────────────────────────────────────────────────
export async function fetchRoom(roomId) {
  const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  return data;
}

export async function fetchPlayers(roomId) {
  const { data } = await supabase
    .from('players').select('*').eq('room_id', roomId).order('seat_index', { ascending: true });
  return data || [];
}

export async function fetchPlayerById(playerId) {
  const { data } = await supabase.from('players').select('*').eq('id', playerId).single();
  return data;
}

// ── Realtime subscriptions ────────────────────────────────────────────────────
export function subscribeToRoom(roomId, onRoomChange, onPlayersChange, onStatus) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`,
    }, payload => onRoomChange(payload.new))
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}`,
    }, () => fetchPlayers(roomId).then(onPlayersChange))
    .subscribe(status => onStatus?.(status));
  return () => supabase.removeChannel(channel);
}

// One-shot fetch of any unprocessed actions — lets a (re)connecting host drain
// the queue so a guest action is never lost if a realtime event was missed.
export async function fetchUnprocessedActions(roomId) {
  const { data } = await supabase
    .from('actions')
    .select('*')
    .eq('room_id', roomId)
    .eq('processed', false)
    .order('id', { ascending: true });
  return data || [];
}

// Host subscribes to unprocessed action rows
export function subscribeToActions(roomId, onAction) {
  const channel = supabase
    .channel(`actions:${roomId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'actions', filter: `room_id=eq.${roomId}`,
    }, payload => {
      if (!payload.new.processed) onAction(payload.new);
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ── Data mutations ────────────────────────────────────────────────────────────
export async function sendAction(roomId, playerId, actionType, payload = {}) {
  const { error } = await supabase.from('actions').insert({
    room_id: roomId,
    player_id: playerId,
    action_type: actionType,
    payload,
  });
  if (error) console.error('sendAction error:', error);
}

export async function updateGameState(roomId, gameState) {
  const { error } = await supabase.from('rooms').update({ game_state: gameState }).eq('id', roomId);
  if (error) console.error('updateGameState error:', error);
}

export async function startRoomGame(roomId) {
  await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId);
}

// Reset a finished/won room back to the lobby keeping the same player rows.
export async function resetRoomToLobby(roomId) {
  await supabase.from('rooms').update({ status: 'lobby', game_state: {} }).eq('id', roomId);
}

export async function endRoom(roomId) {
  await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId);
  // Delete all player rows so human user.id can be reused in a new game
  await supabase.from('players').delete().eq('room_id', roomId);
}

export async function leaveRoom(playerId) {
  await supabase.from('players').update({ is_connected: false }).eq('id', playerId);
}

export async function updateHouseRules(roomId, houseRules) {
  await supabase.from('rooms').update({ house_rules: houseRules }).eq('id', roomId);
}

export async function updateGameMode(roomId, gameMode, quickModeRounds) {
  await supabase.from('rooms').update({ game_mode: gameMode, quick_mode_rounds: quickModeRounds }).eq('id', roomId);
}

// ── Bot management (host only) ────────────────────────────────────────────────
export async function addBot(roomId, hostPlayerId, name, tokenShape, tokenColor, difficulty = 'normal') {
  const existingPlayers = await fetchPlayers(roomId);
  if (existingPlayers.length >= 6) throw new Error('Lobby is full.');
  const seat = existingPlayers.length;
  const botId = crypto.randomUUID();
  const { error } = await supabase.from('players').insert({
    id:          botId,
    room_id:     roomId,
    seat_index:  seat,
    name,
    token_shape: tokenShape,
    token_color: tokenColor,
    is_bot:      true,
    is_connected: true,
    bot_difficulty: difficulty,
  });
  if (error) throw new Error(error.message);
  return botId;
}

export async function updateBotDifficulty(botId, difficulty) {
  await supabase.from('players').update({ bot_difficulty: difficulty }).eq('id', botId).eq('is_bot', true);
}

export async function removeBot(botId) {
  await supabase.from('players').delete().eq('id', botId).eq('is_bot', true);
}

// ── Ephemeral live channel (emotes + lobby chat) ──────────────────────────────
// Realtime broadcast — no DB writes, works before game_state exists (lobby).
export function subscribeToLive(roomId, { onEmote, onChat } = {}) {
  const channel = supabase.channel(`live:${roomId}`, { config: { broadcast: { self: true } } });
  if (onEmote) channel.on('broadcast', { event: 'emote' }, ({ payload }) => onEmote(payload));
  if (onChat) channel.on('broadcast', { event: 'chat' }, ({ payload }) => onChat(payload));
  channel.subscribe();
  return {
    sendEmote: (payload) => channel.send({ type: 'broadcast', event: 'emote', payload }),
    sendChat: (payload) => channel.send({ type: 'broadcast', event: 'chat', payload }),
    unsubscribe: () => supabase.removeChannel(channel),
  };
}

// ── Heartbeat RPCs ────────────────────────────────────────────────────────────
export async function touchHeartbeat(roomId) {
  await supabase.rpc('touch_heartbeat', { p_room_id: roomId });
}

export async function claimHost(roomId, candidateId) {
  const { data } = await supabase.rpc('claim_host', { p_room_id: roomId, p_candidate_id: candidateId });
  return data; // boolean
}

// Mark an action row processed (host cleanup)
export async function markActionProcessed(actionId) {
  await supabase.from('actions').update({ processed: true }).eq('id', actionId);
}
