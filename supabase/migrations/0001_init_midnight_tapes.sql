-- ============================================================================
-- TIỆM BĂNG NỬA ĐÊM (MIDNIGHT TAPES) — INITIAL DATABASE SCHEMA
-- Database: PostgreSQL (Supabase)
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Custom Enums
DO $$ BEGIN
    CREATE TYPE tape_status AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE severity_tier AS ENUM ('NORMAL', 'HEAVY_DISTRESS', 'CRISIS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Bảng TAPES (Cuộn băng tâm sự chính — Tối đa 7 phút / 420s, tự hủy sau 24h)
CREATE TABLE IF NOT EXISTS public.tapes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_hash VARCHAR(64) NOT NULL,  -- SHA-256(session_uuid + SERVER_SALT)
    ip_hash VARCHAR(64) NOT NULL,       -- SHA-256(ip + DAILY_SALT), không lưu IP thô
    tag VARCHAR(32) NOT NULL CHECK (tag IN ('FINANCE', 'QUARTER_LIFE', 'FAMILY', 'LONELY', 'LOVE')),
    audio_path TEXT NOT NULL,           -- Object key trên Cloudflare R2
    duration_seconds INT NOT NULL CHECK (duration_seconds BETWEEN 5 AND 420),
    is_voice_masked BOOLEAN DEFAULT FALSE,
    status tape_status DEFAULT 'PENDING_REVIEW',
    severity severity_tier DEFAULT 'NORMAL',
    reject_reason TEXT,                 -- Lý do dịu dàng nếu bị AI moderation từ chối
    rag_support_payload JSONB,          -- Thư ủi an + bài tập thở + hotline (nếu HEAVY_DISTRESS / CRISIS)

    listen_count INT DEFAULT 0,
    tea_count INT DEFAULT 0,
    has_reply BOOLEAN DEFAULT FALSE,

    -- Khóa mềm 3 phút khi có người lạ đang nghe
    reserved_by_hash VARCHAR(64),
    reserved_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 HOURS')
);

CREATE INDEX IF NOT EXISTS idx_tapes_matching
    ON public.tapes (status, has_reply, listen_count, expires_at)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_tapes_creator ON public.tapes (creator_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_tapes_expires_at ON public.tapes (expires_at);

-- 4. Bảng TAPE_REPLIES (Lời ủi an bằng giọng nói — Tối đa 3 phút / 180s, duy nhất 1 reply/tape)
CREATE TABLE IF NOT EXISTS public.tape_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tape_id UUID NOT NULL REFERENCES public.tapes(id) ON DELETE CASCADE,
    sender_hash VARCHAR(64) NOT NULL,
    ip_hash VARCHAR(64) NOT NULL,
    audio_path TEXT NOT NULL,
    duration_seconds INT NOT NULL CHECK (duration_seconds BETWEEN 5 AND 180),
    status tape_status DEFAULT 'PENDING_REVIEW',

    is_listened BOOLEAN DEFAULT FALSE,
    is_thanked BOOLEAN DEFAULT FALSE,
    thanked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 HOURS'),

    CONSTRAINT unique_reply_per_tape UNIQUE (tape_id)
);

-- 5. Bảng TAPE_REACTIONS (Tách trà ấm — Quick Hug)
CREATE TABLE IF NOT EXISTS public.tape_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tape_id UUID NOT NULL REFERENCES public.tapes(id) ON DELETE CASCADE,
    sender_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_reaction_per_user UNIQUE (tape_id, sender_hash)
);

-- 6. Bảng MODERATION_LOGS (Lưu vết kiểm duyệt bảo mật — Giữ 7 ngày)
CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_id UUID NOT NULL,
    target_type VARCHAR(16) NOT NULL CHECK (target_type IN ('TAPE', 'REPLY')),
    transcript TEXT,
    pii_detected JSONB,
    toxicity_score FLOAT,
    verdict VARCHAR(32) NOT NULL,
    reject_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Bảng PSYCH_KNOWLEDGE_CHUNKS (Kho tri thức RAG Sơ cứu tâm lý — pgvector)
CREATE TABLE IF NOT EXISTS public.psych_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    exercise_type VARCHAR(32),          -- 'BREATHING_478' | 'GROUNDING_54321' | 'HOTLINE_ONLY'
    embedding VECTOR(768) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psych_rag_embedding
    ON public.psych_knowledge_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

-- 8. Bảng TAPE_EVENTS (Audit Log vòng đời cuộn băng — Không PII, giữ 7 ngày để đối soát)
CREATE TABLE IF NOT EXISTS public.tape_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tape_id UUID NOT NULL,
    actor_hash VARCHAR(64),
    event_type VARCHAR(32) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tape_events_tape_id ON public.tape_events (tape_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tape_events_created_at ON public.tape_events (created_at);

-- 9. RPC Nhặt cuộn băng ngẫu nhiên công bằng (Atomic & chống race condition)
CREATE OR REPLACE FUNCTION public.pick_random_tape(
    p_user_hash VARCHAR(64),
    p_tag VARCHAR(32) DEFAULT NULL
)
RETURNS SETOF public.tapes AS $$
BEGIN
    RETURN QUERY
    WITH candidate AS (
        SELECT id FROM public.tapes
        WHERE status = 'ACTIVE'
          AND severity != 'CRISIS'
          AND expires_at > NOW()
          AND creator_hash != p_user_hash
          AND (p_tag IS NULL OR tag = p_tag)
          AND (reserved_until IS NULL OR reserved_until < NOW())
        ORDER BY
          has_reply ASC,
          listen_count ASC,
          RANDOM()
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.tapes t
    SET
        listen_count = t.listen_count + 1,
        reserved_by_hash = p_user_hash,
        reserved_until = NOW() + INTERVAL '3 MINUTES'
    FROM candidate c
    WHERE t.id = c.id
    RETURNING t.*;
END;
$$ LANGUAGE plpgsql;

-- 10. Row-Level Security (RLS)
-- Khóa truy cập trực tiếp từ anon client; mọi thao tác đi qua Next.js Server API (Service Role)
ALTER TABLE public.tapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tape_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tape_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psych_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tape_events ENABLE ROW LEVEL SECURITY;

-- 11. Cron Job tự hủy sau 24 giờ & dọn log sau 7 ngày (chạy mỗi 10 phút)
SELECT cron.schedule(
    'purge-expired-midnight-tapes',
    '*/10 * * * *',
    $$
    INSERT INTO public.tape_events (tape_id, event_type, metadata)
    SELECT id, 'PURGED_24H', jsonb_build_object('status', status, 'listen_count', listen_count)
    FROM public.tapes
    WHERE expires_at < NOW();

    -- Xóa/ẩn dữ liệu nhạy cảm (transcript, pii_detected) trong moderation_logs ngay khi băng hết hạn 24h
    UPDATE public.moderation_logs m
    SET transcript = NULL, pii_detected = NULL
    WHERE (m.transcript IS NOT NULL OR m.pii_detected IS NOT NULL)
      AND m.target_id IN (
          SELECT id FROM public.tapes WHERE expires_at < NOW()
          UNION
          SELECT id FROM public.tape_replies WHERE expires_at < NOW()
      );

    DELETE FROM public.tapes WHERE expires_at < NOW();
    DELETE FROM public.moderation_logs WHERE created_at < NOW() - INTERVAL '7 DAYS';
    DELETE FROM public.tape_events WHERE created_at < NOW() - INTERVAL '7 DAYS';
    $$
);
