# TIỆM BĂNG NỬA ĐÊM (MIDNIGHT TAPES) — PROJECT RULES & CODING STANDARDS

> **Tagline:** *"Thả nỗi buồn vào cuộn băng, nghe người xa lạ gửi lời ủi an."*  
> **Philosophy:** Micro-social Cathartic Ritual & Ambient Web Experience.

---

## 1. NGUYÊN TẮC BẤT BIẾN (THE CORE INVARIANTS)

Khi lập trình và thiết kế bất kỳ tính năng nào cho Tiệm Băng Nửa Đêm, **BẮT BUỘC** tuân thủ 4 quy tắc cốt lõi:

1. **Quy tắc "Một lần duy nhất" (Strictly No Back-and-Forth Chat):**
   - Không xây dựng bất kỳ ô nhập liệu văn bản tự do (text chat) giữa người dùng.
   - Không cho phép người lạ gửi tin nhắn thứ hai: 1 Tape chỉ nhận tối đa 1 Voice Reply (hoặc Tea Hugs).
   - Người tạo Tape chỉ có 1 hành động duy nhất: Bấm "Cảm ơn" (Thank you acknowledgment). Không có phản hồi ngược lại.
   - Triệt tiêu hoàn toàn khả năng biến tướng thành app hẹn hò, gạ gẫm, xin thông tin cá nhân.

2. **Quy tắc "Ẩn danh tuyệt đối" (Absolute Anonymity & Zero-Login):**
   - Không yêu cầu đăng nhập Gmail, số điện thoại, tên thật, avatar, hay liên kết mạng xã hội.
   - Nhận diện phiên ẩn danh bằng cơ chế lai: `session_uuid` (lưu `localStorage` / `HttpOnly Cookie`) kết hợp **Hash IP (`SHA-256(ip + server_salt)`)** ở backend.
   - **Lưu ý bảo mật IP:** Không lưu IP thô (raw IP) vào database và không dùng IP làm khóa định danh *duy nhất* để mở hộp thư cá nhân (tránh rủi ro người dùng chung Wi-Fi quán cà phê hoặc 4G/CGNAT thấy nhầm băng của nhau). Hash IP dùng để chống spam (rate-limit) và nhận diện thiết bị bổ trợ.
   - Giọng nói có tùy chọn xử lý bộ lọc (Voice Masking / Pitch modulation) cục bộ ngay tại trình duyệt trước khi upload.

3. **Quy tắc "Tự hủy sau 24 giờ" (Ephemeral Life Cycle):**
   - Bất kỳ cuộn băng (Tape), hồi âm (Voice Reply) hoặc phản hồi (Reaction) nào đều có thời gian sống (TTL) đúng 24 giờ kể từ lúc phát hành.
   - Sau 24h, audio file và metadata bị xóa vĩnh viễn (Hard delete).
   - "Mọi muộn phiền ngày hôm nay, ngày mai thức dậy đều sẽ tan biến."

4. **Bộ lọc an toàn chủ động & Hỗ trợ tâm lý RAG (AI Moderation & Psych-RAG):**
   - Tất cả audio trước khi đưa vào hàng đợi "Lắng nghe" (Public Queue) phải qua pipeline kiểm duyệt:
     - Regex & Speech-to-Text quét: số điện thoại, link URL, tài khoản Telegram/Zalo, địa chỉ cá nhân.
     - Phân loại độc hại (Toxicity / Harassment / Doxxing / Phân biệt vùng miền / Lừa đảo).
   - **Chuyển hướng RAG hỗ trợ tâm lý:** Nếu nội dung mang tính chất nặng nề, trầm cảm sâu hoặc có dấu hiệu tự hại (`HEAVY_DISTRESS` / `CRISIS`), hệ thống chuyển qua pipeline **RAG Sơ cứu tâm lý (Psychological First Aid)** truy xuất tri thức tâm lý học đã kiểm chứng để gửi một lá thư ủi an, bài tập thở/grounding và đường dây nóng hỗ trợ — giữ nguyên nguyên tắc không biến thành chatbot trò chuyện vô tận.

---

## 2. NGUYÊN TẮC THIẾT KẾ TRẢI NGHIỆM (AMBIENT & SOUND-FIRST)

- **Sound Design chiếm 60% cảm xúc:**
  - Mọi thao tác bấm nút cơ học (REC, PLAY, EJECT, PAUSE) đều phải phát âm thanh lách cách (mechanical micro-clicks / spring releases).
  - Luôn có lớp nền âm thanh mưa đêm (Rain ambience loop) và tiếng xì rè của băng từ (Tape hiss) êm dịu, cho phép bật/tắt hoặc điều chỉnh âm lượng dễ dàng.
  - Chuyển động quay của bánh xe băng cassette phải đồng bộ chính xác với trạng thái audio (đang chạy, tạm dừng, tua).
- **Thẩm mỹ Skeuomorphic hoài cổ:**
  - Tông màu: Dark Amber (#0E0D0B, #1C1917, #D97706, #F59E0B), ánh sáng vàng ấm của bóng đèn sợi đốt ban đêm.
  - Tránh các giao diện phẳng lạnh lùng (flat/material). Hãy tạo cảm giác chất liệu gỗ, nhựa mờ của vỏ băng, đèn LED đỏ hiển thị REC, mặt kính bảo vệ cuộn băng phản chiếu ánh sáng.

---

## 3. TIÊU CHUẨN CÔNG NGHỆ & LẬP TRÌNH (TECH STACK STANDARDS)

### 3.1. Frontend
- **Framework:** Next.js (App Router) / React 19 + TypeScript.
- **Styling:** Tailwind CSS + Radix UI (nếu cần accessible primitives) + CSS Modules/Canvas cho các hiệu ứng cassette vật lý.
- **Animation:** Framer Motion (cho transitions, cassette eject, trôi vào bóng đêm) + WebGL/Canvas cho bánh xe quay 60fps mượt mà trên mobile.
- **State Management:** Zustand nhẹ nhàng để quản lý trạng thái máy phát, queue, âm thanh môi trường.

### 3.2. Audio Engineering
- **Audio Capture:** `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })`.
- **MediaRecorder Format:** `audio/webm;codecs=opus` (mặc định), fallback `audio/mp4` cho iOS Safari.
- **Voice Masking (Local DSP):** Sử dụng Web Audio API (`AudioContext`, `BiquadFilterNode`, và pitch-shifting buffer processing / AudioWorklet) để hạ tone hoặc làm ấm giọng mà không gửi file thô chưa che giấu.
- **Audio Constraints:**
  - Cuộn băng tâm sự chính (Main Tape): Tối thiểu 5 giây, tối đa **7 phút (420 giây)** để người dùng đủ thời gian trải lòng những câu chuyện áp lực dài. Nén bitrate ~32kbps Opus (dung lượng 7 phút ~ **1.68MB**).
  - Cuộn băng hồi đáp (Voice Reply): Tối thiểu 5 giây, tối đa **3 phút (180 giây)** (~720KB).

### 3.3. Backend & Storage
- **Platform:** Supabase (PostgreSQL + RLS + Edge Functions) hoặc Cloudflare Workers/Hono.
- **Storage:** Cloudflare R2 / Supabase Storage (S3-compatible). Miễn phí egress, tối ưu chi phí phân phối audio.
- **Queue & Random Matchmaking:** 
  - Hệ thống lấy băng ngẫu nhiên: Thuật toán chọn cuộn băng theo tag, ưu tiên cuộn băng chưa có ai nghe và chưa nhận được hồi âm, đồng thời đảm bảo không phân phối lại cho chính người ghi.
- **Cron / Auto Purge:** pg_cron hoặc Cloudflare Cron Triggers quét các record có `created_at < NOW() - INTERVAL '24 HOURS'` để xóa bản ghi và xóa blob file trên R2.

### 3.4. AI Moderation Pipeline
- Pipeline xử lý bất đồng bộ sau khi upload:
  1. Client upload audio lên staging bucket.
  2. Edge function / Serverless trigger: Gửi audio đến Whisper API (hoặc Gemini 2.5 Flash Audio multimodal).
  3. Prompt kiểm duyệt Gemini: Kiểm tra PII, số điện thoại, nội dung quấy rối, chào mời dịch vụ.
  4. Nếu Pass -> Đổi trạng thái `status: 'active'`, đẩy vào Public Queue.
  5. Nếu Fail -> Đổi trạng thái `status: 'rejected'`, thông báo cho tác giả.

---

## 4. QUY ƯỚC ĐẶT TÊN & CẤU TRÚC CODE (CODE CONVENTIONS)

- **Ngôn ngữ code:** TypeScript Strict Mode (`noImplicitAny: true`).
- **Giao tiếp UI / Content:** Tiếng Việt truyền cảm, dịu dàng, đồng cảm, mang chất thơ hoài niệm (Ví dụ: "Thả vào màn đêm", "Nhặt một cuộn băng", "Gửi một tách trà ấm").
- **Tên thư mục & file:** `kebab-case` cho thư mục và file utility, `PascalCase` cho React Components.
- **Audio Asset Management:** Tất cả sound effects (sfx) và ambient tracks phải được nén tối ưu (mp3/ogg/webm < 100KB cho SFX, < 1.5MB cho Ambient loop).
