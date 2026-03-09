ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS codigo_producto text,
  ADD COLUMN IF NOT EXISTS print_card_url text,
  ADD COLUMN IF NOT EXISTS bfx_spec_url text,
  ADD COLUMN IF NOT EXISTS tipo_empaque text;