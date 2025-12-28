-- Add new columns to products table based on uploaded CSV
-- Customer-visible columns (marked green in Excel)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS customer_item TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS item_description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS customer TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS item_type TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pieces_per_pallet INTEGER;

-- Internal columns (admin only)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS et TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS descripcion_cliente TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS et_verificada BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS codigo_producto TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS print_card TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS nombre_producto_2 TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tipo_empaque TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS estructura TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ancho NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS alto NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS fuelle_de_fondo NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pestana_al_ancho NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pestana_al_alto NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS refilado TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS metros_x_bobina NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unidades_en_ancho INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unidades_en_largo INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pisos INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unidades_por_tarima INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tipo_embalaje TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS descripcion_caja TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS empacado_de_producto_por TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS piezas_por_paquete INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS paquete_por_caja INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS piezas_totales_por_caja INTEGER;