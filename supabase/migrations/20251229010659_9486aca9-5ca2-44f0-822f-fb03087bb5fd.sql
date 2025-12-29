-- Add new columns for units and DP Sales/CSR Names
ALTER TABLE public.products
ADD COLUMN units text,
ADD COLUMN dp_sales_csr_names text;