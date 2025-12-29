-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    po_number TEXT NOT NULL,
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL,
    price_per_thousand NUMERIC(10, 2),
    total_price NUMERIC(12, 2),
    pallets_needed INTEGER,
    requested_delivery_date DATE,
    is_hot_order BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    pdf_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT unique_po_number UNIQUE (po_number)
);

-- Enable Row Level Security
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own orders" 
ON public.purchase_orders 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders" 
ON public.purchase_orders 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders" 
ON public.purchase_orders 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own orders" 
ON public.purchase_orders 
FOR DELETE 
USING (auth.uid() = user_id);

-- Admins can view all orders
CREATE POLICY "Admins can view all orders" 
ON public.purchase_orders 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on po_number for faster lookups
CREATE INDEX idx_purchase_orders_po_number ON public.purchase_orders(po_number);