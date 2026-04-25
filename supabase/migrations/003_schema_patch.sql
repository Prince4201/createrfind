-- ==============================================================================
-- SCHEMA PATCH: Add missing columns referenced by application code
-- ==============================================================================

-- 1. Add email_sent boolean to channels (used by channel status filter)
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false;

-- 2. Add search_history_id to channels (used to link channels to discovery sessions)
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS search_history_id UUID REFERENCES public.search_history(id) ON DELETE SET NULL;

-- 3. Add is_discovered flag to channels
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS is_discovered BOOLEAN DEFAULT false;

-- 4. Add created_at to email_logs (used by analytics charts)
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Index for faster search_history_id lookups
CREATE INDEX IF NOT EXISTS idx_channels_search_history_id ON public.channels(search_history_id);

-- 6. Index for email_sent filter
CREATE INDEX IF NOT EXISTS idx_channels_email_sent ON public.channels(email_sent);

-- 7. Index for email_logs created_at (analytics chart queries)
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at);

-- 8. Index for fetched_by_user_id (used on every channel list query)
CREATE INDEX IF NOT EXISTS idx_channels_fetched_by_user_id ON public.channels(fetched_by_user_id);
