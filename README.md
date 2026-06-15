# Stonks & Strats

A full-featured Monopoly clone with a retro CRT / glassmorphism aesthetic. Multiplayer via **Supabase Realtime** — no dedicated server required. The host's browser runs the game engine; guests sync via Postgres change subscriptions.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite 8 |
| Realtime / DB | Supabase (Postgres + Realtime) |
| Auth | Supabase anonymous auth (seamless page-reload rejoin) |
| Deploy | Vercel (static SPA) |

## Features

- **Retro CRT UI** — bloom glow, vignette, scanline overlay, Press Start 2P font
- **Responsive** — desktop board+panel layout collapses to a stacked, touch-friendly
  layout on phones/tablets; clamp-based typography stays legible at any size
- **Full Monopoly rules** — rent, houses/hotels (even-build), mortgages, auctions, trading, bankruptcy
- **House Rules** — 14 toggleable settings (Free Parking jackpot, no rent in jail, double GO salary, custom taxes, turn timer, etc.)
- **Game Modes** — Classic, Speed Die (3rd die unlocks after passing GO), Quick (ends after N rounds by net worth)
- **Turn timer** — optional per-decision countdown; the host auto-resolves idle turns
- **AI Bots** — host adds CPU players with **Easy / Normal / Hard** difficulty; engine drives turns with realistic delays
- **Chat & Emotes** — lobby + in-game chat plus floating emoji reactions (Realtime broadcast)
- **End-game stats** — net-worth-over-time chart, peak cash, final standings, and host "Play Again"
- **Host migration** — if host disconnects, a guest automatically claims host
- **Fast initial load** — code-split bundle (main app chunk ~124 kB) with lazy-loaded modals

## Local setup

```bash
git clone <repo>
cd sussymono
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
npm run dev
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor → New query**, paste the contents of `supabase_phase3.sql`, and run it
3. Copy your **Project URL** and **anon public key** into `.env`

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the repo in [vercel.com/new](https://vercel.com/new)
3. Add environment variables in **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy — Vercel auto-detects Vite; build command is `npm run build`, output is `dist`

## Controls

| Key | Action |
|---|---|
| Space / Enter | Roll dice / Buy / End turn (context-aware) |
| M | Toggle property manager |
| \| (pipe) | Toggle system diagnostics overlay |
| Esc | Close any open modal |

Click any board tile to inspect its price, rent table, and mortgage value.

## Project structure

```
src/
├── App.jsx               # Root — auth, room lifecycle, subscriptions, AI loop
├── boardData.js          # 40 tiles, color groups, TOKEN_COLORS
├── lib/
│   ├── supabase.js       # Supabase client + ensureAuth()
│   ├── roomClient.js     # create/join/rejoin room, heartbeat, bot management
│   ├── gameEngine.js     # Pure-function rules engine (house rules, speed die, AI)
│   ├── animation.js      # AnimationQueue, diffStates, dice/hop animations
│   ├── audio.js          # Chiptune SFX
│   └── icons.jsx         # SVG icon components
├── components/
│   ├── Board.jsx         # SVG board, tokens, house/hotel overlays
│   ├── Sidebar.jsx       # Turn controls, dice, standings, chat log
│   ├── RoomMenu.jsx      # Create / join room with token picker
│   ├── RoomLobby.jsx     # Lobby with house rules, game mode, AI bots
│   ├── HouseRulesPanel.jsx
│   ├── Auction.jsx
│   ├── TradeBroker.jsx
│   ├── Modals.jsx        # Property inspector, portfolio manager
│   └── ...
supabase_phase3.sql       # Full schema: tables, RLS, RPCs
```
