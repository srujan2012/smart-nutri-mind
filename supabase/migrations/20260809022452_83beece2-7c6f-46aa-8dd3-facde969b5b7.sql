ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exam_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exam_until date,
  ADD COLUMN IF NOT EXISTS injuries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS growth_mode boolean NOT NULL DEFAULT false;

CREATE TABLE public.coach_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  log_date date NOT NULL,
  twin jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_best_action jsonb NOT NULL DEFAULT '{}'::jsonb,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  corrections jsonb NOT NULL DEFAULT '{}'::jsonb,
  narrative text,
  nba_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_days TO authenticated;
GRANT ALL ON public.coach_days TO service_role;
ALTER TABLE public.coach_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coach days" ON public.coach_days FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_coach_days_updated_at BEFORE UPDATE ON public.coach_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  cue text,
  routine text,
  reward text,
  identity_statement text,
  target_days_per_week integer NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habits" ON public.habits FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_habits_updated_at BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  done boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_logs TO authenticated;
GRANT ALL ON public.habit_logs TO service_role;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habit logs" ON public.habit_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.micro_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  log_date date NOT NULL,
  title text NOT NULL,
  detail text,
  kind text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.micro_wins TO authenticated;
GRANT ALL ON public.micro_wins TO service_role;
ALTER TABLE public.micro_wins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own micro wins" ON public.micro_wins FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.coach_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  streak_days integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  shields_available integer NOT NULL DEFAULT 2,
  shields_used integer NOT NULL DEFAULT 0,
  consistency_score integer NOT NULL DEFAULT 0,
  identity_statement text,
  future_self text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_state TO authenticated;
GRANT ALL ON public.coach_state TO service_role;
ALTER TABLE public.coach_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coach state" ON public.coach_state FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_coach_state_updated_at BEFORE UPDATE ON public.coach_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();