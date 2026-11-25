# THIẾT KẾ KIẾN TRÚC HỆ THỐNG (SYSTEM DESIGN)
## Dự án: Tiệm Băng Nửa Đêm (Midnight Tapes)

---

## 1. KIẾN TRÚC TỔNG THỂ (HIGH-LEVEL ARCHITECTURE)

Hệ thống được thiết kế theo mô hình **Serverless Jamstack + Object Storage + Managed SQL Database**, tối ưu hóa để chi phí duy trì gần bằng $0 khi khởi điểm, đồng thời chịu tải mượt mà khi có lưu lượng tăng đột biến (viral traffic).

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      CLIENT (Next.js PWA / React)                      │
 │   - Web Audio API (Mic Capture, Voice Mask Pitch Shifter, VU Meter)    │
 │   - Cassette Skeuomorphic Canvas/WebGL Engine                          │
 │   - Ambient Audio Player (Howler.js / Web Audio)                       │
 └──────────────────────┬──────────────────────────┬──────────────────────┘
                        │                          │
                 HTTP / REST / RPC           Direct S3 Upload (Presigned URL)
                        │                          │
                        ▼                          ▼
 ┌──────────────────────────────────────┐  ┌──────────────────────────────┐
 │    APPLICATION LAYER / API ROUTES    │  │   AUDIO STORAGE (Cloudflare  │
 │  (Next.js App Router / Edge Worker)  │  │   R2 / Supabase S3 Bucket)   │
 │   - Auth: Anonymous Session Tokens   │  │   - Zero Egress Cost         │
 │   - Rate Limiter (Upstash / KV)      │  │   - Audio (.webm / .opus)    │
 │   - Queue & Matchmaking Engine       │  │   - 24h Auto Lifecycle Rule  │
 └──────────────┬───────────────────────┘  └──────────────┬───────────────┘
                │                                         │
        SQL Queries / RLS                          Fetch Audio for AI
                │                                         │
                ▼                                         ▼
 │ ┌──────────────────────────────────────┐  ┌──────────────────────────────┐ │
 │ │     DATABASE (Supabase / Postgres)   │  │   AI MODERATION PIPELINE     │ │
 │ │   - Tables: tapes, replies, reacts   │  │   - Whisper (Audio to Text)  │ │
 │ │   - pg_cron: Purge expired records   │  │   - Gemini 2.5 Flash Guard   │ │
 │ │   - RLS: Row-Level Security Rules    │  │   - PII & Toxicity Detector  │ │
 │ └──────────────────────────────────────┘  └──────────────────────────────┘ │
```

---

## 2. DỮ LIỆU & LƯỢC ĐỒ DATABASE (DATABASE SCHEMA)

Sử dụng PostgreSQL (Supabase) với cấu trúc bảng tinh gọn, có index tối ưu cho việc truy vấn ngẫu nhiên và tự hủy sau 24h.

```sql
-- Kích hoạt extension UUID, pg_cron và pgvector (cho RAG tâm lý)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Enum trạng thái cuộn băng & mức độ tâm lý
CREATE TYPE tape_status AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'EXPIRED');
CREATE TYPE severity_tier AS ENUM ('NORMAL', 'HEAVY_DISTRESS', 'CRISIS');

-- 1. BẢNG TAPES (Cuộn băng tâm sự)
CREATE TABLE public.tapes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_hash VARCHAR(64) NOT NULL, -- SHA-256 hash của session_uuid
    ip_hash VARCHAR(64) NOT NULL,      -- SHA-256 hash của IP + server_salt (chống spam, không lưu IP thô)
    tag VARCHAR(32) NOT NULL,          -- 'FINANCE', 'QUARTER_LIFE', 'FAMILY', 'LONELY', 'LOVE'
    audio_path TEXT NOT NULL,          -- R2 storage object key
    duration_seconds INT NOT NULL CHECK (duration_seconds BETWEEN 5 AND 420), -- Tối đa 7 phút
    is_voice_masked BOOLEAN DEFAULT FALSE,
    status tape_status DEFAULT 'PENDING_REVIEW',
    severity severity_tier DEFAULT 'NORMAL',
    
    -- Nội dung hỗ trợ từ RAG (nếu severity là HEAVY_DISTRESS hoặc CRISIS)
    rag_support_payload JSONB,
    
    -- Thống kê tương tác
    listen_count INT DEFAULT 0,
    tea_count INT DEFAULT 0,
    has_reply BOOLEAN DEFAULT FALSE,
    
    -- Khóa tạm thời khi có người đang nghe (tránh 2 người cùng reply 1 lúc)
    reserved_by_hash VARCHAR(64),
    reserved_until TIMESTAMPTZ,
    
    -- Vòng đời 24 giờ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 HOURS')
);

-- Index phục vụ Matching Queue
CREATE INDEX idx_tapes_matching ON public.tapes (status, has_reply, listen_count, expires_at)
WHERE status = 'ACTIVE';

CREATE INDEX idx_tapes_creator ON public.tapes (creator_hash, expires_at);
CREATE INDEX idx_tapes_expires_at ON public.tapes (expires_at);


-- 2. BẢNG TAPE_REPLIES (Cuộn băng hồi âm - tối đa 1 reply / tape)
CREATE TABLE public.tape_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tape_id UUID NOT NULL REFERENCES public.tapes(id) ON DELETE CASCADE,
    sender_hash VARCHAR(64) NOT NULL,
    audio_path TEXT NOT NULL,
    duration_seconds INT NOT NULL CHECK (duration_seconds BETWEEN 5 AND 180), -- Tối đa 3 phút
    status tape_status DEFAULT 'PENDING_REVIEW',
    
    -- Trạng thái người nhận đã nghe và cảm ơn
    is_listened BOOLEAN DEFAULT FALSE,
    is_thanked BOOLEAN DEFAULT FALSE,
    thanked_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 HOURS'),
    
    CONSTRAINT unique_reply_per_tape UNIQUE (tape_id)
);


-- 3. BẢNG TAPE_REACTIONS (Tách trà ấm)
CREATE TABLE public.tape_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tape_id UUID NOT NULL REFERENCES public.tapes(id) ON DELETE CASCADE,
    sender_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Mỗi người chỉ được gửi 1 tách trà cho 1 cuộn băng
    CONSTRAINT unique_reaction_per_user UNIQUE (tape_id, sender_hash)
);


-- 4. BẢNG MODERATION_LOGS (Lưu vết kiểm duyệt bảo mật)
CREATE TABLE public.moderation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_id UUID NOT NULL,            -- tape_id hoặc reply_id
    target_type VARCHAR(16) NOT NULL,   -- 'TAPE' | 'REPLY'
    transcript TEXT,
    pii_detected JSONB,                 -- Phone numbers, URLs, addresses
    toxicity_score FLOAT,               -- 0.0 -> 1.0
    verdict BOOLEAN NOT NULL,           -- TRUE = PASS, FALSE = REJECT
    reject_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BẢNG PSYCH_KNOWLEDGE_CHUNKS (Kho tri thức RAG Sơ cứu tâm lý)
CREATE TABLE public.psych_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic VARCHAR(64) NOT NULL,          -- 'BURNOUT', 'GRIEF', 'LONELINESS', 'PANIC', 'SELF_HARM_DEESCALATION'
    title TEXT NOT NULL,
    content TEXT NOT NULL,               -- Nội dung hướng dẫn tâm lý học chuẩn y khoa/PFA
    exercise_type VARCHAR(32),           -- 'BREATHING_478', 'GROUNDING_54321', 'HOTLINE_ONLY'
    embedding VECTOR(768) NOT NULL,      -- Vector từ gemini-embedding-001 (outputDimensionality: 768)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_psych_rag_embedding ON public.psych_knowledge_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);


-- 6. BẢNG TAPE_EVENTS (Nhật ký vòng đời cuộn băng - Audit Log không chứa PII)
-- Lưu vết mọi chuyển đổi trạng thái để truy xuất/debug nếu người gửi thắc mắc "gửi xong vô lại không thấy"
-- Không đặt ON DELETE CASCADE để giữ log vận hành 7 ngày ngay cả khi audio đã tự hủy sau 24h.
CREATE TABLE public.tape_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tape_id UUID NOT NULL,
    actor_hash VARCHAR(64),            -- creator_hash / listener_hash (đã băm)
    event_type VARCHAR(32) NOT NULL,   -- 'UPLOAD_URL_ISSUED' | 'PUBLISHED' | 'MOD_PASS' | 'MOD_REJECT' | 'RAG_TRIGGERED' | 'PICKED' | 'TEA_SENT' | 'REPLY_SENT' | 'THANKED' | 'PURGED_24H'
    metadata JSONB,                    -- Chi tiết kỹ thuật (ví dụ: lý do reject, duration, HTTP status)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tape_events_tape_id ON public.tape_events (tape_id, created_at DESC);
CREATE INDEX idx_tape_events_created_at ON public.tape_events (created_at);
```

---

## 3. THUẬT TOÁN NHẶT BĂNG NGẪU NHIÊN (MATCHMAKING ALGORITHM)

### 3.1. Tiêu chí lựa chọn băng
Khi một người dùng bấm "Nhặt một cuộn băng", hệ thống phải đảm bảo:
1. **Không phải băng của chính mình:** `creator_hash != requester_hash`.
2. **Băng còn hạn sử dụng:** `expires_at > NOW() AND status = 'ACTIVE'`.
3. **Ưu tiên sự cô đơn nhất:** Ưu tiên những cuộn băng có `listen_count = 0` và `has_reply = FALSE` (để ai gửi băng lên cũng có ít nhất một người lắng nghe).
4. **Cơ chế Soft-Reserve (Khóa mềm 3 phút):** Khi băng được phân phối cho User B nghe, đánh dấu `reserved_by_hash = UserB` và `reserved_until = NOW() + INTERVAL '3 MINUTES'`. Nếu User B không gửi voice reply trong 3 phút, băng được giải phóng cho người khác nhặt tiếp.

### 3.2. Câu lệnh SQL Query lấy băng tối ưu
```sql
-- Function RPC nhặt băng công bằng
CREATE OR REPLACE FUNCTION pick_random_tape(
    p_user_hash VARCHAR(64),
    p_tag VARCHAR(32) DEFAULT NULL
)
RETURNS SETOF public.tapes AS $$
BEGIN
    RETURN QUERY
    WITH candidate AS (
        SELECT id FROM public.tapes
        WHERE status = 'ACTIVE'
          AND expires_at > NOW()
          AND creator_hash != p_user_hash
          AND (p_tag IS NULL OR tag = p_tag)
          AND (reserved_until IS NULL OR reserved_until < NOW())
        ORDER BY 
          has_reply ASC,          -- Ưu tiên chưa có ai reply
          listen_count ASC,        -- Ưu tiên ít người nghe nhất
          RANDOM()                 -- Ngẫu nhiên trong nhóm ưu tiên
        LIMIT 1
        FOR UPDATE SKIP LOCKED    -- Khóa tránh race condition khi đồng thời pick
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
```

---

## 4. QUY TRÌNH XỬ LÝ ÂM THANH & STORAGE (AUDIO PIPELINE)

### 4.1. Phía Trình duyệt (Client-Side DSP & Recording)
1. **Khởi tạo AudioContext:**
   - Cấu hình chuẩn: 48kHz, 1 channel (mono) để tối ưu dung lượng đàm thoại giọng nói.
2. **Bộ lọc "Màn che giọng ấm" (Voice Mask):**
   - Khi công tắc kích hoạt: Âm thanh đi qua chuỗi xử lý Web Audio Graph:
     `SourceNode -> BiquadFilter (Lowpass 3.8kHz, Q=1.2) -> Pitch Shifter AudioWorklet (-2.5 semitones) -> GainNode -> MediaStreamDestination`.
3. **Mã hóa file nén:**
   - Sử dụng `MediaRecorder` với codec:
     - Chrome/Firefox/Android: `audio/webm;codecs=opus` (bitrate 32kbps).
     - iOS Safari: `audio/mp4` fallback.
   - Dung lượng trung bình: 60s audio ~ **240KB**; cuộn băng dài tối đa 7 phút (420s) ~ **1.68MB** (giới hạn upload tối đa 3MB). Tốc độ tải về qua 4G/5G vẫn rất nhanh (< 1 giây).

### 4.2. Luồng Upload trực tiếp lên Cloudflare R2 (Direct Presigned Upload)
Không chuyển file audio qua Next.js Server để tránh chiếm dụng RAM và băng thông server:
1. Client gửi request `POST /api/tapes/presigned-url` kèm checksum và metadata.
2. Server sinh một S3 Presigned PUT URL có thời hạn 5 phút.
3. Client `PUT` file blob trực tiếp lên Cloudflare R2 bucket (`s3.r2.cloudflarestorage.com`).
4. Client gọi `POST /api/tapes/publish` thông báo file đã upload thành công -> Server kích hoạt AI Moderation.

---

## 5. HỆ THỐNG TỰ HỦY 24 GIỜ (ACCESS DEADLINE & EPHEMERAL PURGE)

Để đảm bảo cam kết BR-04 chính xác tuyệt đối về mặt quyền truy cập lẫn dọn dẹp vật lý:

### 5.1. Ngắt quyền truy cập tức thì ở mốc 24h (Strict Access Deadline)
- Mọi truy vấn API (`pick_random_tape`, `my-mailbox`, playback) đều kiểm tra cứng `expires_at > NOW()`. Ngay tại giây thứ `86,400`, cuộn băng không còn thể truy cập hoặc phát lại được nữa.

### 5.2. Xóa vật lý chủ động & Fallback Lifecycle
- **Explicit Object Deletion Worker:** Worker chạy định kỳ mỗi 10 phút gọi S3/R2 `DeleteObjectsCommand` xóa trực tiếp các file audio đã quá `expires_at` trước khi xóa record DB.
- **Cloudflare R2 Object Lifecycle (Fallback):** Thiết lập quy tắc tự động xóa sau 1 ngày làm lớp dự phòng nếu worker gặp sự cố (lưu ý R2 Lifecycle có độ trễ xử lý nền tối đa ~24h sau hạn, nên không dùng thay thế cho cơ chế ngắt truy cập tức thì).

### 5.3. Database Level (`pg_cron` mỗi 10 phút)
```sql
SELECT cron.schedule(
    'purge-expired-midnight-tapes',
    '*/10 * * * *',
    $$
    INSERT INTO public.tape_events (tape_id, event_type, metadata)
    SELECT id, 'PURGED_24H', jsonb_build_object('status', status, 'listen_count', listen_count)
    FROM public.tapes WHERE expires_at < NOW();

    -- Xóa/ẩn dữ liệu nhạy cảm (transcript, pii_detected) ngay khi băng hết hạn 24h
    UPDATE public.moderation_logs m
    SET transcript = NULL, pii_detected = NULL
    WHERE (m.transcript IS NOT NULL OR m.pii_detected IS NOT NULL)
      AND m.target_id IN (
          SELECT id FROM public.tapes WHERE expires_at < NOW()
          UNION
          SELECT id FROM public.tape_replies WHERE expires_at < NOW()
      );

    -- Xóa các cuộn băng quá hạn 24 giờ (CASCADE xóa replies và reactions)
    DELETE FROM public.tapes WHERE expires_at < NOW();
    
    -- Chỉ giữ metadata vận hành đã ẩn danh (không chứa transcript/PII) đủ 7 ngày
    DELETE FROM public.moderation_logs WHERE created_at < NOW() - INTERVAL '7 DAYS';
    DELETE FROM public.tape_events WHERE created_at < NOW() - INTERVAL '7 DAYS';
    $$
);
```

---

## 6. ĐỊNH DANH ZERO-LOGIN (SESSION UUID + IP HASH) & BẢO MẬT

- **Tại sao không dùng IP thuần túy làm tài khoản đăng nhập?**
  - Trên mạng di động 4G/5G (CGNAT) hoặc Wi-Fi công cộng (quán cà phê, ký túc xá), hàng trăm người dùng chung **một địa chỉ IP công cộng**. Nếu dùng IP làm khóa định danh duy nhất, người A có thể nhìn thấy hộp thư và lời hồi đáp riêng tư của người B. Ngược lại, khi người dùng chuyển từ Wi-Fi sang 4G, IP thay đổi làm mất cuộn băng họ vừa thả.
- **Giải pháp Zero-Login an toàn (Session UUID + IP Hash):**
  - **Khóa hộp thư cá nhân:** Khi vào web lần đầu, hệ thống tự động cấp `session_uuid` lưu bền vững ở `HttpOnly Cookie` + `localStorage` (không cần Gmail, không mật khẩu). Server hash UUID này với `SALT` bí mật thành `creator_hash`.
  - **Hash IP (`ip_hash`):** Server đọc IP từ header (`CF-Connecting-IP` / `X-Forwarded-For`), băm một chiều `SHA-256(ip + daily_salt)` để tạo `ip_hash` (tuyệt đối không lưu IP thô). `ip_hash` dùng để **Rate Limiting chống spam** và hỗ trợ nhận diện mức độ lạm dụng trên cùng một đường mạng.
- **Rate Limiting:**
  - Cấu hình theo cả `creator_hash` và `ip_hash` qua Upstash Redis / Memory Store:
    - Tạo Tape mới: Tối đa 3 lần / 24 giờ / `creator_hash` (và giới hạn ngưỡng an toàn theo `ip_hash`).
    - Gửi Voice Reply: Tối đa 5 lần / 24 giờ.
    - Nhặt cuộn băng: Tối đa **15 lượt nhặt / 1 giờ**, đồng thời áp dụng sub-limit **tối đa 5 lượt đổi băng liên tiếp / 10 phút** (cả hai điều kiện phải thỏa mãn đồng thời).
