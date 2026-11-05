
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'farmer');
CREATE TYPE public.gender_t AS ENUM ('Male', 'Female');
CREATE TYPE public.health_t AS ENUM ('Healthy', 'At Risk', 'Critical');
CREATE TYPE public.vacc_status_t AS ENUM ('Scheduled', 'Upcoming', 'Overdue', 'Completed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  farm_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- ============ CATTLE ============
CREATE TABLE public.cattle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  name TEXT NOT NULL,
  breed TEXT NOT NULL,
  age INTEGER NOT NULL DEFAULT 0,
  gender public.gender_t NOT NULL DEFAULT 'Female',
  color TEXT,
  health_status public.health_t NOT NULL DEFAULT 'Healthy',
  milk_yield NUMERIC(6,2) NOT NULL DEFAULT 0,
  purchase_date DATE,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, tag)
);
CREATE INDEX idx_cattle_owner ON public.cattle(owner_id);
ALTER TABLE public.cattle ENABLE ROW LEVEL SECURITY;

-- ============ MILK RECORDS ============
CREATE TABLE public.milk_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  morning NUMERIC(6,2) NOT NULL DEFAULT 0,
  evening NUMERIC(6,2) NOT NULL DEFAULT 0,
  total NUMERIC(6,2) GENERATED ALWAYS AS (morning + evening) STORED,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cattle_id, date)
);
CREATE INDEX idx_milk_cattle_date ON public.milk_records(cattle_id, date DESC);
ALTER TABLE public.milk_records ENABLE ROW LEVEL SECURITY;

-- ============ HEALTH RECORDS ============
CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  condition TEXT NOT NULL,
  treatment TEXT,
  vet_name TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_checkup DATE,
  status public.vacc_status_t NOT NULL DEFAULT 'Scheduled',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_cattle_date ON public.health_records(cattle_id, date DESC);
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

-- ============ BREED PREDICTIONS ============
CREATE TABLE public.breed_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  predicted_breed TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  reasoning TEXT,
  confirmed_breed TEXT,
  cattle_id UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pred_user ON public.breed_predictions(user_id, created_at DESC);
ALTER TABLE public.breed_predictions ENABLE ROW LEVEL SECURITY;

-- ============ updated_at TRIGGER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_cattle_updated BEFORE UPDATE ON public.cattle
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, farm_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'farm_name', 'My Farm')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'farmer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- user_roles (read only for users; admins read all)
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- cattle
CREATE POLICY "Owners view cattle" ON public.cattle FOR SELECT
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners insert cattle" ON public.cattle FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update cattle" ON public.cattle FOR UPDATE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners delete cattle" ON public.cattle FOR DELETE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- milk_records (via cattle ownership)
CREATE POLICY "Owners view milk" ON public.milk_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND (c.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Owners insert milk" ON public.milk_records FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()) AND auth.uid() = recorded_by);
CREATE POLICY "Owners update milk" ON public.milk_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()));
CREATE POLICY "Owners delete milk" ON public.milk_records FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()));

-- health_records
CREATE POLICY "Owners view health" ON public.health_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND (c.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Owners insert health" ON public.health_records FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Owners update health" ON public.health_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()));
CREATE POLICY "Owners delete health" ON public.health_records FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cattle c WHERE c.id = cattle_id AND c.owner_id = auth.uid()));

-- breed_predictions
CREATE POLICY "Users view own predictions" ON public.breed_predictions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own predictions" ON public.breed_predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own predictions" ON public.breed_predictions FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own predictions" ON public.breed_predictions FOR DELETE
  USING (auth.uid() = user_id);

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('cattle-images', 'cattle-images', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('breed-uploads', 'breed-uploads', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: users access only their own folder
CREATE POLICY "Users read own cattle images" ON storage.objects FOR SELECT
  USING (bucket_id = 'cattle-images' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Users upload own cattle images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cattle-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own cattle images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'cattle-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own cattle images" ON storage.objects FOR DELETE
  USING (bucket_id = 'cattle-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own breed uploads" ON storage.objects FOR SELECT
  USING (bucket_id = 'breed-uploads' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Users upload own breed uploads" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'breed-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own breed uploads" ON storage.objects FOR DELETE
  USING (bucket_id = 'breed-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
