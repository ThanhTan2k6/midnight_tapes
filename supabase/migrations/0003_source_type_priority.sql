-- Thêm cột source_type để ưu tiên phân phối băng của người dùng thật ('USER') trước băng mẫu ('SEED')
ALTER TABLE public.tapes
ADD COLUMN IF NOT EXISTS source_type VARCHAR(16) NOT NULL DEFAULT 'USER'
CHECK (source_type IN ('USER', 'SEED'));

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
          (source_type = 'SEED') ASC,
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

NOTIFY pgrst, 'reload schema';
