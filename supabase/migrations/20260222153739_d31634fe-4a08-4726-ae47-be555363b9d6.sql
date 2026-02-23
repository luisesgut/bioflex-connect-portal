
ALTER TABLE public.shipping_loads
  ADD COLUMN invoice_number text,
  ADD COLUMN invoice_pdf_url text;
