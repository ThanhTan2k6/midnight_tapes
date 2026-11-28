-- Bảng lưu báo lỗi & góp ý từ người dùng
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_hash VARCHAR(64),
    category VARCHAR(32) NOT NULL DEFAULT 'BUG_AUDIO_UI',
    message TEXT NOT NULL,
    contact VARCHAR(120),
    user_agent TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.bug_reports TO service_role;

NOTIFY pgrst, 'reload schema';
