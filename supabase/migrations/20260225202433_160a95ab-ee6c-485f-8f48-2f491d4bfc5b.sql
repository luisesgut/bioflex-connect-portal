
-- Add product_line column to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_line text;

-- Pre-populate based on existing tipo_empaque values
UPDATE public.products SET product_line = 'bag_wicket' WHERE tipo_empaque ILIKE '%Wicket%' AND product_line IS NULL;
UPDATE public.products SET product_line = 'bag_no_wicket_zipper' WHERE tipo_empaque ILIKE '%Sello Lateral%' AND product_line IS NULL;
UPDATE public.products SET product_line = 'bag_zipper' WHERE tipo_empaque ILIKE '%Zipper%' AND product_line IS NULL;
UPDATE public.products SET product_line = 'film' WHERE tipo_empaque ILIKE '%Bobina%' AND product_line IS NULL;
