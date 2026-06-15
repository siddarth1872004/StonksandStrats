# Stonks & Strats — Progress Report

Last updated: 2026-06-15 (Phase 3 audit + implementation).

---

## Phase 3 Audit Findings (pre-implementation)

### 1. Supabase client setup
- `src/lib/supabase.js` exists: creates client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- **`signInAnonymously()` is NOT called** — no auth of any kind.
- `.env` has placeholder credentials — the Supabase project has not been provisioned.

### 2. Game engine location
- **Host-side JS module** at `src/lib/gameEngine.js` (~950 lines). No Supabase Edge Functions. No `supabase/functions/` directory.
- Engine is pure functions: `createInitialState`, `addPlayer`, `startGame`, `applyAction`, etc.
- Already ported from `game_state.py` in Phase 2.

### 3. Database schema — current vs Phase 3 target

| Column / feature | Phase 2 design | Phase 3 target |
|---|---|---|
| `rooms.id` | UUID (generated) | `text` — IS the 6-char room code |
| `rooms.code` | separate `text` column | removed (id is the code) |
| `rooms.status` values | `'waiting'` / `'playing'` / `'finished'` | `'lobby'` / `'playing'` / `'finished'` |
| `rooms.house_rules` | ❌ missing | `jsonb` |
| `rooms.game_mode` | ❌ missing | `text` |
| `rooms.quick_mode_rounds` | ❌ missing | `int` |
| `rooms.host_last_heartbeat` | ❌ missing | `timestamptz` |
| `players.token` | single string (`'car'`, etc.) | split into `token_shape` + `token_color` |
| `players.seat_index` | `slot` | renamed `seat_index` |
| `players.is_host` | `boolean` column | removed (host = `rooms.host_player_id`) |
| `players.is_bot` | ❌ missing | `boolean` |
| `players.last_seen` | ❌ missing | `timestamptz` |
| `actions.action_type` | column named `type` | renamed `action_type` |
| `actions.processed` | ❌ missing | `boolean` |
| RLS policies | `allow all` | per-auth RLS (see §2.2) |
| RPCs | ❌ none | `claim_host`, `touch_heartbeat`, `create_room` |

Since `.env` has placeholders, **no database has been created yet** — full Phase 3 schema can be applied fresh.

### 4. Room create/join flow
- `roomClient.js` has `createRoom`, `joinRoom`, `rejoinRoom` — functional but uses Phase 2 schema.
- No anonymous auth.
- No heartbeat, no host migration, no presence channels.
- No house rules in room row.

### 5. Legacy WebSocket code — dead/live
- `src/lib/netClient.js` exists but **is imported by nothing** (dead code after Phase 2 migration).
- `network.py`, `server.py`, `board_data.py`, `cards.py`, `game_state.py` — Python files, no longer used.
- `run_server.sh`, `launch.sh` — still reference `python3 server.py` (stale scripts).
- **None of the above are imported/bundled by the frontend.**

### 6. Token color bug
`boardData.js` exports `TOKEN_COLORS` with keys `red`, `green`, `blue`, etc. (color names).
`Sidebar.jsx` and `Board.jsx` call `TOKEN_COLORS[p.token]` where `p.token` is a shape name (`'car'`, `'hat'`). **Result: always `undefined`** — player-colored borders and glows are broken. Phase 3's `token_color` field fixes this.

---

## Phase 3 Implementation Status — COMPLETE ✓

All items implemented. Build passes (527 kB bundle, expected for feature set).

### SQL schema
- [x] `supabase_phase3.sql` — rooms.id=text code PK, players.token_shape/color, actions.action_type, RLS, RPCs

### Auth + roomClient (`src/lib/supabase.js`, `src/lib/roomClient.js`)
- [x] `ensureAuth()` / `signInAnonymously()` on app load; Supabase restores session from localStorage
- [x] Phase 3 schema: `createRoom` via `create_room_fn` RPC, `joinRoom`, `rejoinRoom` all updated
- [x] `touchHeartbeat` / `claimHost` RPCs, `addBot` / `removeBot`, `updateHouseRules` / `updateGameMode`
- [x] `subscribeToRoom` now receives full room row (not just game_state)
- [x] `sendAction` uses `action_type` column; `markActionProcessed` cleans up

### Game Engine (`src/lib/gameEngine.js`)
- [x] 12 house rules in `DEFAULT_HOUSE_RULES`, threaded through all affected functions
- [x] Speed Die: 3 face types — move (1-3), bus (4-5), Mr. Monopoly (6); `speed_bus` phase + `choose_bus_route` action
- [x] Quick Mode: `advanceTurn` checks `round_counter >= quick_mode_rounds`, net worth winner
- [x] AI: `getAIDecision(state, botId)` covering all phases
- [x] `calcNetWorth` exported
- [x] `addPlayer` accepts `token_shape` + `token_color` (backward-compat with `token`)
- [x] Free parking jackpot, no-rent-in-jail, skip auction, income tax choice, luxury tax, unlimited buildings

### UI
- [x] `src/boardData.js` — `TOKEN_COLORS` now keyed by shape names (car/hat/dog/…)
- [x] `src/components/HouseRulesPanel.jsx` — host-editable 12-rule panel, read-only for guests
- [x] `src/components/RoomLobby.jsx` — game mode selector, quick-rounds input, AI bot management, house rules tab
- [x] `src/components/RoomMenu.jsx` — passes `tokenColor` to create/join handlers
- [x] `src/components/Sidebar.jsx` — speed die third-die display, bus route choice buttons, token_color fallback
- [x] `src/lib/icons.jsx` — added `PlusIcon`
- [x] `src/App.jsx` — auth init, 5s heartbeat, host migration watcher (10s poll), AI turn processor with random 800-1500ms delays, Phase 3 room API throughout

---

## Phase 2 findings (carried forward)

### Fixed in Phase 3
- Token color bug (see above)

### Remaining known issues
- Tooltip.jsx — no 300ms hover delay (shows instantly)
- animation.js — partial §6.1 animation suite (no dice cycling, dust, money floats, etc.)
