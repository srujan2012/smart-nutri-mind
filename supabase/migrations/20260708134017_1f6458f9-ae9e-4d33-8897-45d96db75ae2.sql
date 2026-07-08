
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allergies text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.grocery_items ADD COLUMN IF NOT EXISTS aisle text NOT NULL DEFAULT 'Other';
ALTER TABLE public.grocery_items ADD COLUMN IF NOT EXISTS substitutes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.grocery_items ADD COLUMN IF NOT EXISTS unavailable boolean NOT NULL DEFAULT false;
