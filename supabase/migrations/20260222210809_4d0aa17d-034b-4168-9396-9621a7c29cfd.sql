
-- Add POD (Proof of Delivery) PDF URL column to load_destination_dates
ALTER TABLE public.load_destination_dates
ADD COLUMN pod_pdf_url text;
