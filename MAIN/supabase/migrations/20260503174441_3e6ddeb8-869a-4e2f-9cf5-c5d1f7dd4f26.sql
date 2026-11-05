
-- Drop existing FKs (if any) and recreate with cascade
ALTER TABLE public.milk_records DROP CONSTRAINT IF EXISTS milk_records_cattle_id_fkey;
ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_records_cattle_id_fkey;
ALTER TABLE public.breed_predictions DROP CONSTRAINT IF EXISTS breed_predictions_cattle_id_fkey;

DELETE FROM public.milk_records WHERE cattle_id NOT IN (SELECT id FROM public.cattle);
DELETE FROM public.health_records WHERE cattle_id NOT IN (SELECT id FROM public.cattle);
UPDATE public.breed_predictions SET cattle_id = NULL
  WHERE cattle_id IS NOT NULL AND cattle_id NOT IN (SELECT id FROM public.cattle);

ALTER TABLE public.milk_records
  ADD CONSTRAINT milk_records_cattle_id_fkey
  FOREIGN KEY (cattle_id) REFERENCES public.cattle(id) ON DELETE CASCADE;

ALTER TABLE public.health_records
  ADD CONSTRAINT health_records_cattle_id_fkey
  FOREIGN KEY (cattle_id) REFERENCES public.cattle(id) ON DELETE CASCADE;

ALTER TABLE public.breed_predictions
  ADD CONSTRAINT breed_predictions_cattle_id_fkey
  FOREIGN KEY (cattle_id) REFERENCES public.cattle(id) ON DELETE SET NULL;

ALTER TABLE public.cattle DROP CONSTRAINT IF EXISTS cattle_owner_tag_unique;
ALTER TABLE public.cattle ADD CONSTRAINT cattle_owner_tag_unique UNIQUE (owner_id, tag);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT
    '{"health_alerts": true, "vaccination_reminders": true, "milk_reports": false}'::jsonb;

CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_request_log_user_endpoint_time
  ON public.ai_request_log (user_id, endpoint, created_at DESC);

ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ai logs" ON public.ai_request_log;
CREATE POLICY "Users view own ai logs" ON public.ai_request_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own ai logs" ON public.ai_request_log;
CREATE POLICY "Users insert own ai logs" ON public.ai_request_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);
