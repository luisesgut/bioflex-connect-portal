
-- Add freight invoice fields and invoice amounts to shipping_loads
ALTER TABLE public.shipping_loads
  ADD COLUMN freight_invoice_number text,
  ADD COLUMN freight_invoice_pdf_url text,
  ADD COLUMN invoice_amount numeric,
  ADD COLUMN freight_invoice_amount numeric;
