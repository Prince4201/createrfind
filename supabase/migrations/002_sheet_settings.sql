-- ==============================================================================
-- SHEET SETTINGS TABLE (Multi-Tenant Admin Sheets)
-- ==============================================================================

-- 0. Ensure the trigger function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Create the new table for individual user sheet settings
CREATE TABLE public.sheet_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    spreadsheet_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.sheet_settings ENABLE ROW LEVEL SECURITY;

-- 3. Explicit Policies for Admins to manage their own settings
CREATE POLICY "Users can select their own sheet settings" 
ON public.sheet_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sheet settings" 
ON public.sheet_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sheet settings" 
ON public.sheet_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sheet settings" 
ON public.sheet_settings FOR DELETE USING (auth.uid() = user_id);

-- 4. Trigger for updated_at column
CREATE TRIGGER update_sheet_settings_updated_at 
BEFORE UPDATE ON public.sheet_settings 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 5. INSERT permanent Google Sheet ID specifically for the primary admin account
-- Replace 'pj1308109@gmail.com' and the Sheet ID if necessary before running.
INSERT INTO public.sheet_settings (user_id, spreadsheet_id)
SELECT id, '1lIUqyPcnMVgkbCX4kD5J3v65Kp8nRIcYfz2y03o5a7g' 
FROM public.users WHERE email = 'pj1308109@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET spreadsheet_id = '1lIUqyPcnMVgkbCX4kD5J3v65Kp8nRIcYfz2y03o5a7g';
