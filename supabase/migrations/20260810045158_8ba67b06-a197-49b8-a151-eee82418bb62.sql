ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'PLAYER_TURN',
  ADD COLUMN IF NOT EXISTS public_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seed bigint;

ALTER TABLE public.game_private
  ADD COLUMN IF NOT EXISTS full_state jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.rooms
  ALTER COLUMN max_players SET DEFAULT 10;

UPDATE public.rooms SET max_players = 10 WHERE max_players < 10 AND status = 'lobby';