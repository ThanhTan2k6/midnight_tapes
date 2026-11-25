# KẾ HOẠCH CHIA PHASE CÔNG VIỆC (IMPLEMENTATION ROADMAP)
## Dự án: Tiệm Băng Nửa Đêm (Midnight Tapes)

Tài liệu này chia nhỏ toàn bộ quá trình xây dựng sản phẩm thành **7 Phase (Phase 0 → Phase 6)** theo đúng thứ tự phụ thuộc kỹ thuật, kèm đầu việc cụ thể và tiêu chí hoàn thành (Definition of Done) cho từng Phase.

```
[Phase 0: Hạ tầng & DB] ──► [Phase 1: UI Cassette & Sound] ──► [Phase 2: Web Audio 7p & Voice Mask]
                                                                               │
[Phase 6: Purge 24h & QA] ◄── [Phase 5: AI Mod & Psych-RAG] ◄── [Phase 4: Hồi âm] ◄── [Phase 3: Backend Core & Log]
```

---

## PHASE 0: KHỞI TẠO DỰ ÁN & HẠ TẦNG CƠ SỞ (SETUP & INFRA)
**Mục tiêu:** Sẵn sàng codebase, database, object storage và biến môi trường để các phase sau code trơn tru.

### Công việc chi tiết:
- [ ] Khởi tạo Next.js (App Router, TypeScript Strict Mode), Tailwind CSS, Framer Motion, Zustand.
- [ ] Cấu hình Design Tokens trong Tailwind (`midnight-void`, `wood-desk-base`, `amber-lamp`, `led-rec-active`, `sticker-parchment`...) và font (`Caveat`/`Patrick Hand`, `VT323`, `Inter`).
- [ ] Thiết lập Supabase (PostgreSQL), kích hoạt extensions: `uuid-ossp`, `pg_cron`, `vector` (`pgvector`).
- [ ] Chạy SQL migration tạo các bảng: `tapes`, `tape_replies`, `tape_reactions`, `moderation_logs`, `psych_knowledge_chunks`, `tape_events` và RPC `pick_random_tape`.
- [ ] Thiết lập Cloudflare R2 bucket (`tapes/`, `replies/`), cấu hình CORS cho phép browser `PUT` trực tiếp và bật **Object Lifecycle Rule tự xóa sau 1 ngày (24h)**.
- [ ] Thiết lập Upstash Redis (hoặc store tương đương) phục vụ Rate Limiting.

**Tiêu chí hoàn thành (DoD):** Next.js chạy local thành công; kết nối được Supabase & R2; chạy thử migration SQL không lỗi.

---

## PHASE 1: GIAO DIỆN SKEUOMORPHIC & HỆ THỐNG ÂM THANH (UI/UX & SOUND)
**Mục tiêu:** Hoàn thiện "linh hồn" không gian đêm muộn — nhìn vào là thấy tiệm băng, bấm nút là nghe tiếng cạch cơ học.

### Công việc chi tiết:
- [ ] Dựng không gian nền Responsive:
  - **Desktop:** Góc nhìn POV mặt bàn gỗ tối, quầng sáng đèn bàn vàng ấm, hạt bụi bay nhẹ (Canvas), cốc trà bốc khói.
  - **Mobile:** Co gọn tỷ lệ cầm tay như máy Sony Walkman, nút bấm nằm trong thumb-zone.
- [ ] Dựng Component Máy Cassette vật lý:
  - Hai bánh xe răng cưa SVG/Canvas quay 60fps đồng bộ với trạng thái `PLAY` / `REC` / `PAUSE`.
  - Dải băng từ co giãn độ dày hai bên theo tiến độ thời gian.
  - Đồng hồ đếm cơ học `000 → 420` + đồng hồ `07:00`.
  - Nút cơ học nổi khối 3D có độ lún khi nhấn (`REC`, `PLAY`, `PAUSE`, `STOP`, `EJECT`) + công tắc gạt kim loại cho Voice Mask.
- [ ] Xây dựng `SoundEngine` (Web Audio / Howler):
  - Tự động unlock `AudioContext` ở lần chạm đầu tiên của người dùng.
  - Lớp nền: Tiếng mưa đêm (`ambience_midnight_rain.opus`) + nút bật/tắt & volume slider; tiếng rít đầu từ (`sfx_tape_hiss.opus`) khi phát băng.
  - Lớp hiệu ứng cơ học: `sfx_rec_click`, `sfx_play_engage`, `sfx_eject_snap`, `sfx_toggle`, `sfx_tea_hug`.

**Tiêu chí hoàn thành (DoD):** Giao diện mượt trên cả Desktop & Mobile; mọi thao tác bấm nút đều có phản hồi lún vật lý và tiếng SFX tương ứng.

---

## PHASE 2: WEB AUDIO RECORDING 7 PHÚT & VOICE MASK DSP
**Mục tiêu:** Người dùng thu được tâm sự dài tới 7 phút, có thể tạm dừng giữa chừng và bật màn che giọng ấm ngay tại trình duyệt.

### Công việc chi tiết:
- [ ] Viết hook `useAudioRecorder`:
  - Xin quyền microphone (`echoCancellation`, `noiseSuppression`) kèm thông báo dịu dàng nếu bị từ chối.
  - Hỗ trợ thu âm tối đa **7 phút (420 giây)**, tối thiểu **5 giây**.
  - Hỗ trợ **Pause / Resume** (tạm dừng lấy hơi rồi thu tiếp trên cùng 1 cuộn băng).
  - Xuất dữ liệu nén `audio/webm;codecs=opus` (~32kbps), fallback `audio/mp4` cho iOS Safari.
- [ ] Hiển thị VU Meter / Sóng âm thời gian thực khi đang thu và khi nghe lại (Preview).
- [ ] Xây dựng **Voice Mask AudioWorklet / Graph**:
  - `SourceNode -> Lowpass Filter (3.8kHz) -> Pitch Shifter (-2.5 semitones) -> MediaStreamDestination`.
  - Cho phép bật/tắt công tắc "Màn che giọng ấm" và nghe thử (Preview) chính xác giọng đã xử lý trước khi gửi.
- [ ] Giao diện dán 1 trong 5 nhãn cảm xúc (`Cơm áo gạo tiền`, `Chông chênh tuổi 20s`, `Gia đình & Người lớn`, `Một mình`, `Chuyện tình dở dang`) và hiệu ứng `EJECT` thả băng vào màn đêm.

**Tiêu chí hoàn thành (DoD):** Thu âm 7 phút (có Pause/Resume) hoạt động ổn định trên Chrome, Firefox và iOS Safari; Voice Mask làm trầm ấm giọng tự nhiên, dung lượng file < 2MB.

---

## PHASE 3: BACKEND CORE, ZERO-LOGIN & NHẬT KÝ 24H
**Mục tiêu:** Kết nối hoàn chỉnh luồng dữ liệu, định danh không cần Gmail, upload audio trực tiếp lên R2 và lưu log vòng đời đầy đủ.

### Công việc chi tiết:
- [ ] Xây dựng cơ chế **Zero-Login (`session_uuid` + `ip_hash`)**:
  - `POST /api/v1/session/init`: Cấp `session_uuid` lưu `HttpOnly Cookie` + `localStorage`.
  - Middleware trích xuất IP (`CF-Connecting-IP` / `X-Forwarded-For`), băm `SHA-256(ip + daily_salt)` thành `ip_hash` (tuyệt đối không lưu IP thô).
- [ ] Triển khai Rate Limiting qua Upstash Redis theo cả `creator_hash` và `ip_hash` (tối đa 3 băng/24h, 5 reply/24h, 15 lượt nhặt/1h và tối đa 5 lượt đổi/10p).
- [ ] API Upload & Publish:
  - `POST /api/v1/tapes/presigned-url` (validate MIME, size ≤ 3MB, duration 5–420s).
  - `POST /api/v1/tapes/publish` (lưu DB trạng thái `PENDING_REVIEW` và kích hoạt worker kiểm duyệt).
- [ ] API Nhật ký cuộn băng 24h:
  - `GET /api/v1/tapes/my-mailbox`: Trả về danh sách tất cả cuộn băng của người gửi trong 24h qua (gồm `PENDING_REVIEW`, `ACTIVE`, `REJECTED` kèm `rejectReason`, `ragSupport`, `reply`) + đồng bộ fallback `localStorage`.
- [ ] Tích hợp ghi bảng Audit Log `tape_events` ở mọi bước chuyển trạng thái (`UPLOAD_URL_ISSUED`, `PUBLISHED`, `MOD_PASS`, `MOD_REJECT`, `PICKED`, `TEA_SENT`, `REPLY_SENT`, `THANKED`, `PURGED_24H`).

**Tiêu chí hoàn thành (DoD):** Người dùng thả băng xong đóng tab mở lại vẫn thấy đầy đủ trạng thái cuộn băng của mình; `tape_events` ghi nhận đủ toàn bộ vòng đời.

---

## PHASE 4: LẮNG NGHE, TÁCH TRÀ ẤM & VOICE REPLY
**Mục tiêu:** Hoàn thiện vòng lặp kết nối một lần duy nhất giữa người trút áp lực và người lắng nghe.

### Công việc chi tiết:
- [ ] Giao diện & API **Nhặt băng ngẫu nhiên (`POST /api/v1/tapes/pick`)**:
  - Lọc theo 5 nhãn hoặc "Tất cả".
  - Chạy RPC `pick_random_tape` (ưu tiên băng chưa ai nghe, chưa có reply, loại trừ băng của chính mình, soft-lock 3 phút).
  - Hiển thị nhãn giấy, thời lượng và đồng hồ đếm ngược thời gian tự hủy còn lại.
- [ ] Mở khóa nút phản hồi sau khi nghe ≥ 70% thời lượng cuộn băng:
  - **Tách trà ấm (`POST /api/v1/tapes/:id/react-tea`):** Hiệu ứng khói trà bay lên + tiếng chuông gió.
  - **Voice Reply (`POST /api/v1/tapes/:id/reply/presigned-url` & `publish`):** Thu âm tối đa **3 phút (180s)**, khóa cứng 1 reply duy nhất cho mỗi tape.
- [ ] Giao diện **Hành trình C (Nhận hồi đáp)**:
  - Hiển thị số tách trà ấm hoặc cuộn băng hồi âm màu hổ phách.
  - Nút bấm duy nhất **"Gửi lời Cảm ơn"** (`POST /api/v1/tapes/replies/:replyId/thank`) — không có khung chat text.

**Tiêu chí hoàn thành (DoD):** Khép kín toàn bộ vòng lặp 2 chiều (Ghi → Nhặt → Nghe → Trà/Reply → Cảm ơn) đúng 4 Quy tắc bất biến.

---

## PHASE 5: AI MODERATION & RAG HỖ TRỢ TÂM LÝ
**Mục tiêu:** Đảm bảo an toàn cộng đồng và nâng đỡ kịp thời những tâm sự quá nặng nề hoặc có nguy cơ tự hại.

### Công việc chi tiết:
- [ ] Xây dựng Pipeline Kiểm duyệt bất đồng bộ:
  - Gửi audio tới Speech-to-Text (Whisper / Gemini Flash Audio).
  - Chạy Regex quét PII (SĐT 10–11 số, URL, Zalo/Telegram/Facebook, STK).
  - Gọi Gemini 2.5 Flash phân loại 4 đầu ra: `PASS`, `HEAVY_DISTRESS`, `CRISIS`, `REJECT`.
- [ ] Xây dựng **Kho tri thức & Pipeline Psych-RAG**:
  - Biên soạn & kiểm chuẩn dữ liệu Sơ cứu tâm lý (PFA), kỹ thuật thở `4-7-8`, tiếp đất `5-4-3-2-1`, tài liệu ứng phó kiệt sức/cô đơn/tang thương bằng tiếng Việt.
  - Tạo embedding (`gemini-embedding-001`, `outputDimensionality: 768`) và nạp vào bảng `psych_knowledge_chunks` (`pgvector`).
  - Viết hàm truy xuất Top-3 chunks + tổng hợp **"Lá thư ủi an từ Gác Đêm"** kèm ràng buộc an toàn y khoa (không chẩn đoán bệnh, không kê đơn).
- [ ] Dựng UI thẻ **"Lá thư ủi an từ Gác Đêm"**:
  - Tờ giấy note màu kem trượt ra từ khe máy cassette.
  - Vòng tròn hướng dẫn nhịp thở `4-7-8` trực quan.
  - Nút gọi trực tiếp tổng đài hỗ trợ miễn phí (`096 306 1414` - Ngày Mai, `111`).

**Tiêu chí hoàn thành (DoD):** Băng chứa SĐT/chửi bới bị chặn và báo lý do rõ ràng; băng `CRISIS` không lọt ra Public Queue và trả về đúng thẻ RAG + tổng đài.

---

## PHASE 6: TỰ HỦY 24H, KIỂM THỬ & TRIỂN KHAI (QA & LAUNCH)
**Mục tiêu:** Đảm bảo hệ thống tự dọn sạch dữ liệu đúng hạn 24h, chạy ổn định trên mọi thiết bị và sẵn sàng đón người dùng thật.

### Công việc chi tiết:
- [ ] Kích hoạt & kiểm tra job `pg_cron` (`*/10 * * * *`):
  - Xóa `tapes` (CASCADE `tape_replies`, `tape_reactions`) quá 24 giờ.
  - Ghi event `PURGED_24H` trước khi xóa; giữ `moderation_logs` và `tape_events` đủ **7 ngày** rồi mới dọn.
- [ ] Kiểm thử chéo thiết bị (Cross-browser & Device QA):
  - iOS Safari (AudioContext unlock, codec `audio/mp4`, mic permission).
  - Android Chrome & Desktop (7 phút Pause/Resume, Voice Mask, Responsive Walkman vs Wooden Desk).
  - Kịch bản thực tế: Đổi mạng Wi-Fi ↔ 4G, đóng mở lại tab để kiểm tra Nhật ký 24h, test Rate Limit theo `ip_hash`.
- [ ] Deploy Production (Vercel / Cloudflare) + cấu hình monitoring lỗi & dung lượng R2.

**Tiêu chí hoàn thành (DoD):** Toàn bộ checklist QA pass 100%, cơ chế tự hủy 24h đã được verify trên môi trường staging trước khi mở public.
