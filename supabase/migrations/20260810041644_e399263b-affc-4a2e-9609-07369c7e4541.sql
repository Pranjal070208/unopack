CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'lobby',
  host_player_id uuid,
  max_players int NOT NULL DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  nickname text NOT NULL,
  avatar text NOT NULL DEFAULT 'skull',
  is_host boolean NOT NULL DEFAULT false,
  is_connected boolean NOT NULL DEFAULT true,
  seat int NOT NULL DEFAULT 0,
  card_count int NOT NULL DEFAULT 0,
  eliminated boolean NOT NULL DEFAULT false,
  finished_rank int,
  last_seen timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, session_id)
);

CREATE TABLE public.player_secrets (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  secret text NOT NULL
);

CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'playing',
  current_player_id uuid,
  direction int NOT NULL DEFAULT 1,
  pending_draw int NOT NULL DEFAULT 0,
  discard_top jsonb,
  active_color text,
  turn_started_at timestamptz NOT NULL DEFAULT now(),
  turn_count int NOT NULL DEFAULT 0,
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.game_private (
  game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  deck jsonb NOT NULL DEFAULT '[]'::jsonb,
  pile jsonb NOT NULL DEFAULT '[]'::jsonb,
  hands jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.game_events (
  id bigserial PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_id uuid,
  player_id uuid,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_room ON public.players(room_id);
CREATE INDEX idx_games_room ON public.games(room_id);
CREATE INDEX idx_events_room ON public.game_events(room_id, id DESC);

GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT SELECT ON public.players TO anon, authenticated;
GRANT SELECT ON public.games TO anon, authenticated;
GRANT SELECT ON public.game_events TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.players TO service_role;
GRANT ALL ON public.player_secrets TO service_role;
GRANT ALL ON public.games TO service_role;
GRANT ALL ON public.game_private TO service_role;
GRANT ALL ON public.game_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.game_events_id_seq TO service_role;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms are publicly viewable" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "players are publicly viewable" ON public.players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "games are publicly viewable" ON public.games FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "events are publicly viewable" ON public.game_events FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.game_events REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_events;