-- ==============================================================================
-- 1. USERS TABLE (Extends Supabase Auth)
-- ==============================================================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked'))
);

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all users" ON public.users FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Trigger to sync auth.users to public.users on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name', 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 2. CHANNELS TABLE (Global Shared Resource)
-- ==============================================================================
CREATE TABLE public.channels (
    channel_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT,
    description TEXT,
    channel_url TEXT,
    subscribers BIGINT DEFAULT 0,
    avg_views BIGINT DEFAULT 0,
    category TEXT,
    niche TEXT,
    email TEXT,
    contact_number TEXT,
    last_fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    fetched_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    search_key TEXT,
    source_query TEXT,
    page_token TEXT
);

-- Indexes for fast searching
CREATE INDEX idx_channels_subscribers ON public.channels (subscribers);
CREATE INDEX idx_channels_avg_views ON public.channels (avg_views);
CREATE INDEX idx_channels_niche ON public.channels (niche);
CREATE INDEX idx_channels_category ON public.channels (category);
CREATE INDEX idx_channels_email ON public.channels (email) WHERE email IS NOT NULL;
CREATE INDEX idx_channels_last_fetched ON public.channels (last_fetched_at);
CREATE INDEX idx_channels_search_key ON public.channels (search_key);

-- RLS: Channels are globally readable by all authenticated users
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read channels" ON public.channels FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Backend service can insert/update channels" ON public.channels FOR ALL USING (true); -- Usually bypassed by service role key

-- ==============================================================================
-- 3. CAMPAIGNS TABLE
-- ==============================================================================
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    campaign_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_template TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'paused')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    total_target INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    total_skipped INT DEFAULT 0,
    total_failed INT DEFAULT 0
);

CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);

-- RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- 4. EMAIL LOGS TABLE
-- ==============================================================================
CREATE TABLE public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL REFERENCES public.channels(channel_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    error_message TEXT,
    sent_at TIMESTAMPTZ
);

CREATE INDEX idx_email_logs_campaign_id ON public.email_logs(campaign_id);
CREATE INDEX idx_email_logs_user_id ON public.email_logs(user_id);
CREATE UNIQUE INDEX idx_unique_campaign_channel ON public.email_logs(campaign_id, channel_id); -- Prevent duplicate emails per campaign

-- RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own email logs" ON public.email_logs FOR SELECT USING (auth.uid() = user_id);

-- ==============================================================================
-- 5. SEARCH HISTORY TABLE
-- ==============================================================================
CREATE TABLE public.search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    query TEXT,
    niche TEXT,
    min_subscribers BIGINT,
    max_subscribers BIGINT,
    min_avg_views BIGINT,
    requested_count INT DEFAULT 50,
    returned_count INT DEFAULT 0,
    cache_hit_count INT DEFAULT 0,
    cache_miss_count INT DEFAULT 0,
    last_page_token TEXT,
    refresh_status TEXT DEFAULT 'completed' CHECK (refresh_status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_history_user_id ON public.search_history(user_id);

-- RLS
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own search history" ON public.search_history FOR SELECT USING (auth.uid() = user_id);

-- ==============================================================================
-- 6. API USAGE TABLE
-- ==============================================================================
CREATE TABLE public.api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    api_name TEXT NOT NULL CHECK (api_name IN ('youtube_data_api', 'google_sheets_api', 'sendgrid')),
    units_used INT NOT NULL,
    request_type TEXT,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    quota_remaining_estimate INT
);

CREATE INDEX idx_api_usage_created_at ON public.api_usage(created_at);

-- RLS: Admins only
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view API usage" ON public.api_usage FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- 7. SYSTEM SETTINGS TABLE
-- ==============================================================================
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Admins only
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage system settings" ON public.system_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- 8. EMAIL SETTINGS TABLE
-- ==============================================================================
CREATE TABLE public.email_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender_email TEXT NOT NULL,
    smtp_host TEXT NOT NULL,
    smtp_port INT NOT NULL,
    smtp_user TEXT NOT NULL,
    smtp_password_encrypted TEXT NOT NULL,
    provider TEXT DEFAULT 'custom',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own email settings" ON public.email_settings FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_email_settings_updated_at BEFORE UPDATE ON public.email_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
