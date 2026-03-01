-- Add 'hot_order' to the change_request_type enum
ALTER TYPE public.change_request_type ADD VALUE IF NOT EXISTS 'hot_order';