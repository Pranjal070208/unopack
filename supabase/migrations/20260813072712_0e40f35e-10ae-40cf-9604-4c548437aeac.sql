ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_difficulty text,
  ADD COLUMN IF NOT EXISTS bot_persona text;

ALTER TABLE public.players
  ADD CONSTRAINT players_bot_difficulty_check
  CHECK (bot_difficulty IS NULL OR bot_difficulty IN ('easy','normal','hard'));

GRANT SELECT (is_bot, bot_difficulty, bot_persona) ON public.players TO anon;
GRANT SELECT (is_bot, bot_difficulty, bot_persona) ON public.players TO authenticated;