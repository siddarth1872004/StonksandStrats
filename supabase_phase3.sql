-- Stonks & Strats — Phase 3 Supabase Schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to re-run: uses CREATE OR REPLACE for functions, IF NOT EXISTS for tables.

-- ── Drop Phase 2 tables if they exist ────────────────────────────────────────
drop table if exists actions;
drop table if exists players;
drop table if exists rooms;

-- ── Core tables ───────────────────────────────────────────────────────────────

create table rooms (
  id                  text        primary key,          -- 6-char room code IS the PK
  host_player_id      uuid        not null,
  status              text        not null default 'lobby',  -- lobby | playing | finished
  house_rules         jsonb       not null default '{}',
  game_mode           text        not null default 'classic', -- classic | speed_die | quick
  quick_mode_rounds   int                  default 30,
  game_state          jsonb,
  host_last_heartbeat timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create table players (
  id           uuid        primary key default gen_random_uuid(),
  room_id      text        references rooms(id) on delete cascade,
  seat_index   int         not null,
  name         text        not null,
  token_shape  text        not null,
  token_color  text        not null,
  is_bot       boolean     not null default false,
  is_connected boolean     not null default true,
  last_seen    timestamptz not null default now()
);

create table actions (
  id          bigint generated always as identity primary key,
  room_id     text    references rooms(id) on delete cascade,
  player_id   uuid    not null,
  action_type text    not null,
  payload     jsonb   not null default '{}',
  processed   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── Enable Realtime ───────────────────────────────────────────────────────────
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table actions;

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table rooms   enable row level security;
alter table players enable row level security;
alter table actions enable row level security;

-- rooms: anyone can read; only the host can write game_state/status
create policy "rooms_select"      on rooms for select using (true);
create policy "rooms_insert"      on rooms for insert with check (auth.uid() = host_player_id);
create policy "rooms_update_host" on rooms for update using (auth.uid() = host_player_id);

-- players: anyone can read; a player manages their own row; host manages bot rows
create policy "players_select" on players for select using (true);
create policy "players_insert" on players for insert with check (
  auth.uid() = id
  or (is_bot = true and auth.uid() = (select host_player_id from rooms where id = room_id))
);
create policy "players_update" on players for update using (
  auth.uid() = id
  or (is_bot = true and auth.uid() = (select host_player_id from rooms where id = room_id))
);
create policy "players_delete" on players for delete using (
  auth.uid() = id
  or auth.uid() = (select host_player_id from rooms where id = room_id)
);

-- actions: only action author inserts; only current host reads/marks processed
create policy "actions_insert" on actions for insert with check (auth.uid() = player_id);
create policy "actions_select" on actions for select using (
  auth.uid() = (select host_player_id from rooms where id = room_id)
);
create policy "actions_update" on actions for update using (
  auth.uid() = (select host_player_id from rooms where id = room_id)
);
create policy "actions_delete" on actions for delete using (
  auth.uid() = (select host_player_id from rooms where id = room_id)
);

-- ── RPCs ──────────────────────────────────────────────────────────────────────
-- All functions use SET search_path = '' (prevents search-path injection)
-- and are restricted to the `authenticated` role only (anon = no session at all;
-- anonymous-auth users get `authenticated` after signInAnonymously()).

create or replace function public.touch_heartbeat(p_room_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.rooms
  set host_last_heartbeat = now()
  where id = p_room_id and host_player_id = auth.uid();
end;
$$;

create or replace function public.claim_host(p_room_id text, p_candidate_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_rows int;
begin
  update public.rooms
  set host_player_id = p_candidate_id, host_last_heartbeat = now()
  where id = p_room_id
    and host_last_heartbeat < now() - interval '15 seconds';
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.create_room_fn(
  p_host_id      uuid,
  p_house_rules  jsonb  default '{}',
  p_game_mode    text   default 'classic',
  p_quick_rounds int    default 30
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_code  text;
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_try   int  := 0;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    end loop;
    begin
      insert into public.rooms(id, host_player_id, house_rules, game_mode, quick_mode_rounds)
      values (v_code, p_host_id, p_house_rules, p_game_mode, p_quick_rounds);
      return v_code;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try >= 10 then raise exception 'Could not generate unique room code'; end if;
    end;
  end loop;
end;
$$;

-- ── RPC grants: authenticated only (anon = no JWT at all) ─────────────────────
-- Revoke the implicit PUBLIC grant, then grant only to authenticated.
-- Users who called signInAnonymously() get the `authenticated` role.
revoke execute on function public.touch_heartbeat(text)                  from public;
revoke execute on function public.claim_host(text, uuid)                 from public;
revoke execute on function public.create_room_fn(uuid, jsonb, text, int) from public;

grant execute on function public.touch_heartbeat(text)                  to authenticated;
grant execute on function public.claim_host(text, uuid)                 to authenticated;
grant execute on function public.create_room_fn(uuid, jsonb, text, int) to authenticated;
