
-- Access profiles table: defines named profiles with per-module permissions
CREATE TABLE public.access_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  user_type text NOT NULL DEFAULT 'external',
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT access_profiles_user_type_check CHECK (user_type IN ('internal', 'external'))
);

-- Profile permissions: per-module view/edit control
CREATE TABLE public.profile_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.access_profiles(id) ON DELETE CASCADE NOT NULL,
  module text NOT NULL,
  can_view boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, module)
);

-- Add access_profile_id and user_type to profiles
ALTER TABLE public.profiles
  ADD COLUMN access_profile_id uuid REFERENCES public.access_profiles(id),
  ADD COLUMN user_type text DEFAULT 'external',
  ADD COLUMN phone text,
  ADD COLUMN company text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check CHECK (user_type IN ('internal', 'external'));

-- Enable RLS
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;

-- RLS for access_profiles
CREATE POLICY "Admins can manage access profiles"
ON public.access_profiles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view access profiles"
ON public.access_profiles FOR SELECT
USING (true);

-- RLS for profile_permissions
CREATE POLICY "Admins can manage profile permissions"
ON public.profile_permissions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view profile permissions"
ON public.profile_permissions FOR SELECT
USING (true);

-- Trigger for updated_at on access_profiles
CREATE TRIGGER update_access_profiles_updated_at
BEFORE UPDATE ON public.access_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default profiles with permissions
INSERT INTO public.access_profiles (id, name, description, user_type, is_default) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Administrador', 'Acceso completo a todos los módulos', 'internal', true),
  ('00000000-0000-0000-0000-000000000002', 'Ventas', 'Acceso a productos, órdenes y envíos', 'internal', false),
  ('00000000-0000-0000-0000-000000000003', 'Ingeniería', 'Acceso a productos y solicitudes de producto', 'internal', false),
  ('00000000-0000-0000-0000-000000000004', 'Diseño', 'Acceso a solicitudes de producto', 'internal', false),
  ('00000000-0000-0000-0000-000000000005', 'Cliente', 'Acceso estándar de cliente', 'external', true);

-- Permissions for Administrador (full access)
INSERT INTO public.profile_permissions (profile_id, module, can_view, can_edit) VALUES
  ('00000000-0000-0000-0000-000000000001', 'dashboard', true, true),
  ('00000000-0000-0000-0000-000000000001', 'products', true, true),
  ('00000000-0000-0000-0000-000000000001', 'purchase_orders', true, true),
  ('00000000-0000-0000-0000-000000000001', 'shipping_loads', true, true),
  ('00000000-0000-0000-0000-000000000001', 'product_requests', true, true),
  ('00000000-0000-0000-0000-000000000001', 'inventory', true, true),
  ('00000000-0000-0000-0000-000000000001', 'settings', true, true),
  ('00000000-0000-0000-0000-000000000001', 'users', true, true);

-- Permissions for Ventas
INSERT INTO public.profile_permissions (profile_id, module, can_view, can_edit) VALUES
  ('00000000-0000-0000-0000-000000000002', 'dashboard', true, false),
  ('00000000-0000-0000-0000-000000000002', 'products', true, false),
  ('00000000-0000-0000-0000-000000000002', 'purchase_orders', true, true),
  ('00000000-0000-0000-0000-000000000002', 'shipping_loads', true, true),
  ('00000000-0000-0000-0000-000000000002', 'product_requests', true, false),
  ('00000000-0000-0000-0000-000000000002', 'inventory', true, false);

-- Permissions for Ingeniería
INSERT INTO public.profile_permissions (profile_id, module, can_view, can_edit) VALUES
  ('00000000-0000-0000-0000-000000000003', 'dashboard', true, false),
  ('00000000-0000-0000-0000-000000000003', 'products', true, true),
  ('00000000-0000-0000-0000-000000000003', 'product_requests', true, true);

-- Permissions for Diseño
INSERT INTO public.profile_permissions (profile_id, module, can_view, can_edit) VALUES
  ('00000000-0000-0000-0000-000000000004', 'dashboard', true, false),
  ('00000000-0000-0000-0000-000000000004', 'product_requests', true, true);

-- Permissions for Cliente
INSERT INTO public.profile_permissions (profile_id, module, can_view, can_edit) VALUES
  ('00000000-0000-0000-0000-000000000005', 'dashboard', true, false),
  ('00000000-0000-0000-0000-000000000005', 'products', true, false),
  ('00000000-0000-0000-0000-000000000005', 'purchase_orders', true, true),
  ('00000000-0000-0000-0000-000000000005', 'shipping_loads', true, false),
  ('00000000-0000-0000-0000-000000000005', 'product_requests', true, true);
