
-- Table for structure layer options (materials, finishes, and default thicknesses)
CREATE TABLE public.structure_layer_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- 'material', 'finish', 'thickness_preset'
  label text NOT NULL,
  parent_material text, -- for thickness_preset: which material this default belongs to
  default_value numeric, -- for thickness_preset: the default thickness value
  default_unit text, -- for thickness_preset: gauge, microns, mils
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, label, parent_material)
);

ALTER TABLE public.structure_layer_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage structure layer options"
  ON public.structure_layer_options FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view structure layer options"
  ON public.structure_layer_options FOR SELECT
  USING (true);

-- Seed materials
INSERT INTO public.structure_layer_options (category, label, sort_order) VALUES
  ('material', 'LDPE', 1),
  ('material', 'LLDPE', 2),
  ('material', 'HDPE', 3),
  ('material', 'PP', 4),
  ('material', 'CPP', 5),
  ('material', 'BOPP', 6),
  ('material', 'PET', 7),
  ('material', 'BOPET', 8),
  ('material', 'PA', 9),
  ('material', 'Nylon', 10),
  ('material', 'EVA', 11),
  ('material', 'Metallized PET', 12),
  ('material', 'Metallized BOPP', 13),
  ('material', 'Aluminum Foil', 14),
  ('material', 'Paper', 15),
  ('material', 'Other', 16);

-- Seed finishes
INSERT INTO public.structure_layer_options (category, label, sort_order) VALUES
  ('finish', 'Natural', 1),
  ('finish', 'White', 2),
  ('finish', 'Pigmented', 3),
  ('finish', 'Metallic', 4),
  ('finish', 'Matte', 5),
  ('finish', 'Glossy', 6),
  ('finish', 'Satin', 7);
