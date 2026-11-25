# 📼 TIỆM BĂNG NỬA ĐÊM (MIDNIGHT TAPES)

> *"Thả nỗi buồn vào cuộn băng, nghe người xa lạ gửi lời ủi an."*  
> **Thể loại:** Ambient Web Experience / Micro-social Cathartic Ritual  
> **Nền tảng:** Responsive Web (Mobile Web Walkman POV & Desktop Wooden Desk POV)

---

## 📖 GIỚI THIỆU DỰ ÁN

**Tiệm Băng Nửa Đêm** là một không gian web chữa lành được xây dựng xung quanh ý niệm *"Người lạ trên chuyến tàu"* (The Stranger Effect). Nơi những tâm sự chất chứa của người trẻ được thu lại trong cuộn băng cassette (tối đa **7 phút**) và thả trôi vào màn đêm, để một người xa lạ ngẫu nhiên nhặt được, lắng nghe và gửi lại một tách trà ấm hay một lời ủi an chân thành.

### 4 Quy tắc bất biến (The Golden Rules):
1. **Một lần duy nhất (No Back-and-Forth Chat):** Không chat text, không nói qua nói lại, 1 cuộn băng chỉ nhận tối đa 1 Voice Reply từ người lạ.
2. **Ẩn danh tuyệt đối (Zero-Login Anonymity):** Không profile, không avatar, không đăng nhập Gmail/MXH. Định danh bằng Session UUID kết hợp Hash IP chống spam.
3. **Tự hủy sau 24 giờ (Ephemeral 24h):** Mọi cuộn băng và lời hồi âm đều tự động xóa sạch sau 24h.
4. **Kiểm duyệt an toàn & RAG Hỗ trợ tâm lý:** Quét SĐT, link mời gọi, từ ngữ độc hại; nếu phát hiện tâm sự quá nặng nề hoặc khủng hoảng, tự động chuyển qua RAG Sơ cứu tâm lý để gửi bài tập điều hòa và tổng đài hỗ trợ.

---

## 📂 HỆ THỐNG TÀI LIỆU DỰ ÁN (SPECIFICATIONS & ARCHITECTURE)

Toàn bộ tài liệu thiết kế và quy tắc kỹ thuật đã được biên soạn chi tiết tại thư mục `specs/`:

- [📜 `PROJECT_RULES.md`](./PROJECT_RULES.md): Nguyên tắc cốt lõi, tiêu chuẩn code TypeScript, Web Audio and AudioWorklet.
- [🤖 `.cursorrules`](./.cursorrules): Bộ hướng dẫn ngữ cảnh cho AI coding assistant.
- [📝 `specs/functional-spec.md`](./specs/functional-spec.md): Đặc tả chi tiết tính năng, 3 hành trình trải nghiệm người dùng, bảng quy tắc nghiệp vụ.
- [🏗️ `specs/system-design.md`](./specs/system-design.md): Kiến trúc hệ thống, lược đồ PostgreSQL/Supabase, thuật toán nhặt băng công bằng, cơ chế tự hủy 24h.
- [🎨 `specs/ui-ux-design-system.md`](./specs/ui-ux-design-system.md): Bảng màu hổ phách đêm muộn, thiết kế cơ học Skeuomorphic máy cassette, âm thanh môi trường & tiếng lách cách nút bấm.
- [🔌 `specs/api-spec.md`](./specs/api-spec.md): Chi tiết các RESTful API endpoints, request/response JSON, presigned upload URL cho audio.
- [🛡️ `specs/ai-moderation-spec.md`](./specs/ai-moderation-spec.md): Pipeline kiểm duyệt Speech-to-Text Whisper + Gemini 2.5 Flash an toàn nội dung & RAG tâm lý.
- [🗺️ `specs/implementation-roadmap.md`](./specs/implementation-roadmap.md): Kế hoạch chia **7 Phase công việc (Phase 0 → Phase 6)** chi tiết kèm checklist và tiêu chí hoàn thành (DoD).

---

## 🛠️ CÔNG NGHỆ CHỦ ĐẠO (TECH STACK)

| Thành phần | Công nghệ lựa chọn | Mục đích |
| :--- | :--- | :--- |
| **Frontend** | Next.js (App Router), React 19, Tailwind CSS | Tối ưu render, hiệu năng cao, SEO |
| **Animation** | Framer Motion, HTML5 Canvas / SVG | Chuyển động quay bánh xe cassette mượt mà 60fps |
| **Audio Processing** | Web Audio API + MediaRecorder | Thu âm tới 7 phút (hỗ trợ Pause/Resume), hạ tone "Màn che giọng ấm" (Voice Mask), VU Meter |
| **Audio Format** | `.webm` / `.opus` (fallback `.mp4` iOS) | Siêu nhẹ (~240KB/phút; ~1.68MB/7 phút), nén chất lượng cao |
| **Database** | PostgreSQL (Supabase) + `pgvector` + `pg_cron` | Lưu metadata, quản lý queue, RAG tri thức tâm lý, tự dọn dẹp sau 24h |
| **Audio Storage** | Cloudflare R2 | Không tốn phí băng thông tải (Zero egress fee), S3-compatible |
| **AI & Psych RAG** | Whisper / Gemini 2.5 Flash + `pgvector` | Quét PII/độc hại và RAG Sơ cứu tâm lý cho ca nặng |

---

## 🚀 KẾ HOẠCH TRIỂN KHAI THEO PHASE (ROADMAP)

Xem checklist chi tiết từng đầu việc và tiêu chí hoàn thành (DoD) tại [`specs/implementation-roadmap.md`](./specs/implementation-roadmap.md):

- **Phase 0:** Khởi tạo dự án & Hạ tầng (Next.js, Supabase + `pgvector` + `pg_cron`, Cloudflare R2, Upstash Redis).
- **Phase 1:** Giao diện Skeuomorphic (Desktop Wooden Desk & Mobile Walkman) & Sound Engine.
- **Phase 2:** Web Audio Recording tới 7 phút (Pause/Resume) & Voice Mask DSP.
- **Phase 3:** Backend Core, Zero-Login (`session_uuid` + `ip_hash`), Nhật ký 24h & Audit Log `tape_events`.
- **Phase 4:** Lắng nghe ngẫu nhiên, Tách trà ấm & Voice Reply 3 phút.
- **Phase 5:** AI Moderation 3 tầng & RAG Hỗ trợ tâm lý ("Lá thư ủi an từ Gác Đêm").
- **Phase 6:** Tự hủy 24h, Kiểm thử chéo thiết bị (iOS/Android/Desktop) & Deploy Production.
