
CREATE TABLE public.destiny_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  default_weekly_capacity numeric NOT NULL DEFAULT 0,
  item_type_mapping text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.destiny_families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view destiny families" ON public.destiny_families FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage destiny families" ON public.destiny_families FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_destiny_families_updated BEFORE UPDATE ON public.destiny_families FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.destiny_weekly_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.destiny_families(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  weekly_capacity numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, week_start)
);
ALTER TABLE public.destiny_weekly_capacity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view destiny weekly capacity" ON public.destiny_weekly_capacity FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage destiny weekly capacity" ON public.destiny_weekly_capacity FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_destiny_weekly_capacity_updated BEFORE UPDATE ON public.destiny_weekly_capacity FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.destiny_week_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,
  is_frozen boolean NOT NULL DEFAULT false,
  frozen_at timestamptz,
  frozen_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.destiny_week_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view destiny week status" ON public.destiny_week_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage destiny week status" ON public.destiny_week_status FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_destiny_week_status_updated BEFORE UPDATE ON public.destiny_week_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.destiny_weekly_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.destiny_families(id),
  purchase_order_id uuid NOT NULL,
  week_start date NOT NULL,
  assigned_quantity numeric NOT NULL CHECK (assigned_quantity > 0),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_destiny_assignments_week_family ON public.destiny_weekly_assignments (week_start, family_id);
CREATE INDEX idx_destiny_assignments_po ON public.destiny_weekly_assignments (purchase_order_id);
ALTER TABLE public.destiny_weekly_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view destiny assignments" ON public.destiny_weekly_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage open-week assignments" ON public.destiny_weekly_assignments FOR ALL TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  AND NOT EXISTS (SELECT 1 FROM public.destiny_week_status s WHERE s.week_start = destiny_weekly_assignments.week_start AND s.is_frozen = true)
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  AND NOT EXISTS (SELECT 1 FROM public.destiny_week_status s WHERE s.week_start = destiny_weekly_assignments.week_start AND s.is_frozen = true)
);
CREATE TRIGGER trg_destiny_assignments_updated BEFORE UPDATE ON public.destiny_weekly_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.facility_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility text NOT NULL DEFAULT 'BioFlex',
  closure_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.facility_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view facility closures" ON public.facility_closures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage facility closures" ON public.facility_closures FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.destiny_families (name, default_weekly_capacity, sort_order) VALUES
  ('Bag No Wicket Orders', 0, 1),
  ('Bag Wicket Orders', 0, 2),
  ('Pouch Orders', 0, 3),
  ('Film Orders', 0, 4);
