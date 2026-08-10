-- 1) players: never expose the session token (a bearer credential) to clients.
REVOKE SELECT ON public.players FROM anon, authenticated;
GRANT SELECT (
  id, room_id, nickname, avatar, is_host, is_connected,
  seat, card_count, eliminated, finished_rank, last_seen, joined_at
) ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;

-- 2) games: hide the RNG seed (predicting the shuffle = seeing every future card).
REVOKE SELECT ON public.games FROM anon, authenticated;
GRANT SELECT (
  id, room_id, status, current_player_id, direction, pending_draw,
  discard_top, active_color, turn_started_at, turn_count, winner_id,
  created_at, phase, public_state
) ON public.games TO anon, authenticated;
GRANT ALL ON public.games TO service_role;

-- 3) rooms / game_events: public-by-room-code reads are intentional, but make the
--    grants explicit and safe-column scoped.
REVOKE SELECT ON public.rooms FROM anon, authenticated;
GRANT SELECT (id, code, status, host_player_id, max_players, created_at)
  ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;

REVOKE SELECT ON public.game_events FROM anon, authenticated;
GRANT SELECT (id, room_id, game_id, player_id, event_type, event_data, created_at)
  ON public.game_events TO anon, authenticated;
GRANT ALL ON public.game_events TO service_role;

-- 4) Hidden state tables: hard deny for every client role. Only the server
--    (service_role, which bypasses RLS) may touch them.
REVOKE ALL ON public.game_private FROM anon, authenticated;
REVOKE ALL ON public.player_secrets FROM anon, authenticated;
GRANT ALL ON public.game_private TO service_role;
GRANT ALL ON public.player_secrets TO service_role;

DROP POLICY IF EXISTS "no client access to game_private" ON public.game_private;
CREATE POLICY "no client access to game_private"
  ON public.game_private FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "no client access to player_secrets" ON public.player_secrets;
CREATE POLICY "no client access to player_secrets"
  ON public.player_secrets FOR SELECT TO anon, authenticated USING (false);