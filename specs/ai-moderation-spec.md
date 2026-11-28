# ĐẶC TẢ KIỂM DUYỆT NỘI DUNG BẰNG AI (AI MODERATION SPEC)
## Dự án: Tiệm Băng Nửa Đêm (Midnight Tapes)

---

## 1. MỤC TIÊU KIỂM DUYỆT (SAFETY OBJECTIVES)

Vì "Tiệm Băng Nửa Đêm" là một không gian giải tỏa cảm xúc hoàn toàn ẩn danh giữa những người lạ, hệ thống bắt buộc phải có "tấm khiên" bảo vệ tự động để ngăn chặn:
1. **Lộ lọt thông tin cá nhân (PII Leaks):** Số điện thoại, link Zalo/Telegram/Facebook, số tài khoản ngân hàng, địa chỉ nhà.
2. **Nội dung gạ gẫm / mại dâm / lừa đảo (Solicitation & Fraud):** Dụ dỗ hẹn hò, dịch vụ tài chính, đa cấp, số đề, cờ bạc.
3. **Độc hại & Bắt nạt (Toxicity & Harassment):** Chửi bới, xúc phạm danh dự, phân biệt vùng miền, đe dọa bạo lực.
4. **Hành vi tự hại nghiêm trọng (Self-harm Emergency):** Nhận diện để hiển thị đường dây nóng hỗ trợ tâm lý thay vì phát hành công khai.

---

## 2. KIẾN TRÚC PIPELINE KIỂM DUYỆT (MODERATION PIPELINE)

```
 [CLIENT UPLOAD AUDIO]
           │
           ▼
 [R2 STAGING BUCKET]
           │
           ▼
 [EDGE FUNCTION / SERVERLESS TRIGGER]
           │
           ├───────────────────────────────────────────┐
           ▼                                           ▼
 [WHISPER API / GEMINI SPEECH-TO-TEXT]       [DIRECT AUDIO CLASSIFICATION]
           │                                           │
           ▼ (Transcript Text)                         │
 [REGEX & PII FILTER]                                  │
   - Quét số điện thoại (10-11 số)                     │
   - Quét URL / @username                              │
           │                                           │
           ▼                                           ▼
 [GEMINI 3.8 FLASH SAFETY EVALUATOR] ◄─────────────────┘
   - Phân tích ngữ cảnh, PII, độ độc hại & Mức độ tổn thương tâm lý
           │
           ├──────────────────────┬──────────────────────────┐
    [PASS / NORMAL]       [HEAVY_DISTRESS / CRISIS]      [VIOLATION]
           │                      │                          │
           ▼                      ▼                          ▼
  Đẩy vào Public Queue   [PSYCH-SUPPORT RAG PIPELINE]   Đánh dấu REJECTED
                           - Embedding câu chuyện       Thông báo nhẹ nhàng
                           - Truy vấn pgvector (PFA)
                           - Sinh "Lá thư ủi an" + Bài tập thở
                           - Gắn Hotline hỗ trợ (111 / Ngày Mai)
                           - (CRISIS: không đẩy ra Public Queue)
```

---

## 3. PROMPT ĐÁNH GIÁ CỦA GEMINI 3.8 FLASH

```markdown
Bạn là Người Gác Đêm mẫn cán tại "Tiệm Băng Nửa Đêm" — một không gian an toàn, ấm áp để mọi người tâm sự ẩn danh.
Nhiệm vụ của bạn là kiểm duyệt văn bản bóc băng (transcript) dưới đây và đưa ra quyết định có cho phép cuộn băng được phát hành hay không.

### QUY TẮC CẤM TUYỆT ĐỐI (VIOLATIONS):
1. PII: Chứa số điện thoại, link mạng xã hội (Facebook, Zalo, Telegram, TikTok), thông tin liên hệ, STK ngân hàng.
2. TOXICITY: Chửi rủa thô tục nhằm vào cá nhân/tập thể, phân biệt vùng miền, thù ghét sắc tộc, xúc phạm tôn giáo.
3. SOLICITATION: Gạ gẫm tình dục, rủ rê hẹn hò ngoài đời, mời chào cờ bạc, đa cấp, vay nợ tài chính.
4. CRIME: Kêu gọi bạo lực, vi phạm pháp luật.

### NỘI DUNG ĐƯỢC CHẤP NHẬN (ALLOWED):
- Than thở áp lực, khóc lóc, buồn bã vì chia tay, bế tắc tài chính, áp lực thi cử, mệt mỏi với gia đình.
- Sử dụng từ ngữ cảm thán buồn bã ("chán quá", "mệt mỏi vcl" ở mức độ tự trách bản thân, không nhắm vào thoá mạ người khác).
- Lời động viên, an ủi, chúc ngủ ngon chân thành.

### ĐỊNH DẠNG ĐẦU RA (JSON BẮT BUỘC):
{
  "verdict": "PASS" | "HEAVY_DISTRESS" | "CRISIS" | "REJECT",
  "reason": "Mô tả lý do ngắn gọn",
  "category": "NONE" | "PII" | "TOXICITY" | "SOLICITATION" | "HEAVY_DEPRESSION" | "SELF_HARM",
  "distressKeywords": ["từ khóa tâm lý để truy vấn RAG"],
  "confidenceScore": 0.0 - 1.0
}
```

---

## 4. HỆ THỐNG RAG HỖ TRỢ TÂM LÝ (PSYCHOLOGICAL FIRST AID RAG)

Khi `verdict` là `HEAVY_DISTRESS` (nội dung nặng nề, kiệt sức tinh thần, bế tắc sâu sắc) hoặc `CRISIS` (có dấu hiệu tự hại), hệ thống tự động chuyển sang pipeline RAG:

1. **Vector Retrieval (`pgvector`):**
   - Tạo embedding từ tóm tắt tâm trạng & `distressKeywords` bằng model **`gemini-embedding-001`** (`outputDimensionality: 768` khớp với `VECTOR(768)`).
   - Truy vấn Top-3 tài liệu từ bảng `psych_knowledge_chunks` (chứa các bài hướng dẫn Sơ cứu tâm lý - PFA, kỹ thuật tiếp đất 5-4-3-2-1, nhịp thở 4-7-8, tái cấu trúc nhận thức CBT cơ bản đã được chuyên gia tâm lý Việt Nam thẩm định; cùng sử dụng `gemini-embedding-001` khi ingest).
2. **Grounded Synthesis (`gemini-3.8-flash`):**
   - Tổng hợp thành một **"Lá thư ủi an từ Gác Đêm"** dài khoảng 120–180 chữ.
   - **Ràng buộc an toàn y khoa (Clinical Guardrails):**
     - Không tự xưng là bác sĩ hay chuyên gia trị liệu.
     - Không chẩn đoán bệnh lý ("bạn bị trầm cảm...") và không kê đơn/khuyên dùng thuốc.
     - Chỉ phản chiếu cảm xúc ấm áp, gợi ý 1 bài tập điều hòa cơ thể tức thời và khuyến khích kết nối chuyên gia/tổng đài.
3. **Chính sách hiển thị:**
   - **Mức `HEAVY_DISTRESS`:** Gửi kèm thẻ "Lá thư ủi an từ Gác Đêm" cho riêng người gửi. Cuộn băng vẫn có thể vào Public Queue nếu không chứa yếu tố gây kích động mạnh (hoặc ẩn nếu user chọn chế độ riêng tư).
   - **Mức `CRISIS`:** **Không** phát hành ra Public Queue để bảo vệ an toàn tâm lý cộng đồng. Hiển thị ngay thẻ hỗ trợ khẩn cấp kèm tổng đài:
     - **Đường dây nóng Ngày Mai (Hỗ trợ người trầm cảm & khủng hoảng tâm lý):** `096 306 1414`
     - **Tổng đài Quốc gia Bảo vệ Trẻ em & Thanh thiếu niên:** `111`
