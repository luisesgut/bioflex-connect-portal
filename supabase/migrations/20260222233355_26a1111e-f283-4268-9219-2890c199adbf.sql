-- Add DP Sales/CSR names field to product_requests table
ALTER TABLE public.product_requests ADD COLUMN dp_sales_csr_names text DEFAULT NULL;