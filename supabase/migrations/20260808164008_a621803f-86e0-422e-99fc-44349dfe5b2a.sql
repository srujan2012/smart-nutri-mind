
CREATE TABLE public.health_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT 'v1',
  scope text NOT NULL DEFAULT 'health_documents',
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_consents TO authenticated;
GRANT ALL ON public.health_consents TO service_role;
ALTER TABLE public.health_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own health consents" ON public.health_consents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_health_consents_updated_at BEFORE UPDATE ON public.health_consents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.health_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Health report',
  report_type text NOT NULL DEFAULT 'blood_panel',
  report_date date,
  review_date date,
  upload_status text NOT NULL DEFAULT 'pending',
  file_path text,
  file_mime text,
  reminder_enabled boolean NOT NULL DEFAULT true,
  reminder_time text NOT NULL DEFAULT '09:00',
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  missing_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  profile_mismatches jsonb NOT NULL DEFAULT '[]'::jsonb,
  alert_level text NOT NULL DEFAULT 'information',
  summary text,
  blocks_plan boolean NOT NULL DEFAULT false,
  reviewed_by_professional boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_reports TO authenticated;
GRANT ALL ON public.health_reports TO service_role;
ALTER TABLE public.health_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own health reports" ON public.health_reports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_health_reports_updated_at BEFORE UPDATE ON public.health_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.health_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid REFERENCES public.health_reports(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  level text NOT NULL DEFAULT 'information',
  title text NOT NULL,
  message text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocks_diet boolean NOT NULL DEFAULT false,
  blocks_training boolean NOT NULL DEFAULT false,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_flags TO authenticated;
GRANT ALL ON public.health_flags TO service_role;
ALTER TABLE public.health_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own health flags" ON public.health_flags FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_health_flags_updated_at BEFORE UPDATE ON public.health_flags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.program_report_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  program text NOT NULL,
  region text NOT NULL DEFAULT 'global',
  required boolean NOT NULL DEFAULT true,
  required_report_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  countdown_days integer NOT NULL DEFAULT 10,
  due_date date,
  daily_reminder boolean NOT NULL DEFAULT true,
  satisfied_by uuid REFERENCES public.health_reports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, program, region)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_report_requirements TO authenticated;
GRANT ALL ON public.program_report_requirements TO service_role;
ALTER TABLE public.program_report_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own program requirements" ON public.program_report_requirements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_program_report_requirements_updated_at BEFORE UPDATE ON public.program_report_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_health_reports_user ON public.health_reports(user_id, created_at DESC);
CREATE INDEX idx_health_flags_user ON public.health_flags(user_id, created_at DESC);
