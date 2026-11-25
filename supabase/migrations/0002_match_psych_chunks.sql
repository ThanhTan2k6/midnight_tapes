-- ============================================================================
-- RPC truy vấn tri thức Sơ cứu tâm lý (pgvector cosine similarity)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_psych_chunks(
    query_embedding VECTOR(768),
    match_count INT DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    topic VARCHAR(64),
    title TEXT,
    content TEXT,
    exercise_type VARCHAR(32),
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.topic,
        c.title,
        c.content,
        c.exercise_type,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM public.psych_knowledge_chunks c
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
