ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS score_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS match_winner_id uuid;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS last_hand_points integer NOT NULL DEFAULT 0;
GRANT SELECT (score_mode, match_winner_id) ON public.rooms TO anon, authenticated;
GRANT SELECT (score, last_hand_points) ON public.players TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.players TO service_role;