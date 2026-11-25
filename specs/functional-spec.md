# TÀI LIỆU ĐẶC TẢ TÍNH NĂNG (FUNCTIONAL SPECIFICATIONS)
## Dự án: Tiệm Băng Nửa Đêm (Midnight Tapes)

---

## 1. TỔNG QUAN HỆ THỐNG & ĐỐI TƯỢNG NGƯỜI DÙNG

### 1.1. Mục tiêu sản phẩm
"Tiệm Băng Nửa Đêm" là một web app dạng **Ambient Web Experience / Micro-social Cathartic Ritual**. Ứng dụng cung cấp không gian an toàn, ấm áp và hoàn toàn ẩn danh (không cần đăng nhập Gmail/MXH) để người dùng trút bỏ tâm sự vào đêm muộn qua các cuộn băng cát-sét (tối đa **7 phút**) và nhận lại sự lắng nghe, đồng cảm từ những người lạ tốt bụng — hoặc sự nâng đỡ tâm lý từ hệ thống RAG chuyên sâu nếu câu chuyện mang nặng nỗi đau.

### 1.2. Người dùng mục tiêu (Personas)
- **Người cần giải tỏa (The Burden Bearer):** Người trẻ (18 - 35 tuổi), gặp áp lực công việc, tài chính, gia đình, tình cảm. Không muốn đăng story hay than vãn trên Facebook/Instagram vì sợ bị đánh giá, nhưng khao khát được nói ra thành tiếng.
- **Người lắng nghe thầm lặng (The Gentle Stranger):** Thức khuya, muốn tìm kiếm sự kết nối chân thật, thích lắng nghe câu chuyện của cuộc đời người khác và muốn gửi đi một chút ấm áp, ủi an mà không cần để lại danh tính.

---

## 2. CÁC HÀNH TRÌNH TRẢI NGHIỆM CHI TIẾT (USER JOURNEYS)

```
                       ┌─────────────────────────┐
                       │   VÀO TIỆM BĂNG NỬA ĐÊM │
                       └────────────┬────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
       [HÀNH TRÌNH A: TRÚT ÁP LỰC]       [HÀNH TRÌNH B: LẮNG NGHE]
                    │                               │
            Bấm giữ hoặc bấm [REC]          Bấm [Nhặt một cuộn băng]
                    │                               │
       Thu âm tối đa 7 phút (Pause/Resume) Nghe câu chuyện của người lạ
                    │                               │
       Bật/Tắt "Màn che giọng ấm"         ┌─────────┴─────────┐
                    │                     ▼                   ▼
            Chọn 1 nhãn (Tag)     [Gửi tách trà ấm]   [Thu âm hồi đáp ≤3p]
                    │                     │                   │
        Bấm [Thả vào màn đêm]             └─────────┬─────────┘
                    │                               │
        Kiểm duyệt AI & Phân loại                   │
         ┌──────────┴──────────┐                    │
         ▼                     ▼                    │
   [Bình thường]       [Nặng nề / Khủng hoảng]      │
  Đẩy vào Queue        Chuyển sang RAG Hỗ trợ       │
         │             tâm lý & Tổng đài            │
         └─────────────────────┬────────────────────┘
                               ▼
                    [HÀNH TRÌNH C: NHẬN HỒI ÂM]
                                    │
                       Người gửi nghe lời ủi an
                                    │
                         Bấm nút duy nhất [Cảm ơn]
                                    │
                         Tự hủy sau 24h kết thúc
```

---

### 2.1. Hành trình A: Trút áp lực (Ghi âm cuộn băng)

#### Bước 1: Tiếp cận máy ghi âm
- Người dùng truy cập trang chủ, thấy cuộn băng cassette trắng đặt trong khay máy.
- Hệ thống nhắc nhở cấp quyền microphone với lời giải thích dịu dàng: *"Tiệm băng cần mic để lưu lại tiếng lòng của bạn. Mọi âm thanh đều được giữ kín."*

#### Bước 2: Thu âm
- **Thao tác:** Bấm nút tròn đỏ `[REC]` để bắt đầu thu (không bắt buộc phải giữ ngón tay liên tục vì câu chuyện có thể dài tới 7 phút).
- **Hỗ trợ Tạm dừng / Tiếp tục (Pause / Resume):** Trong lúc kể chuyện, người dùng có thể bấm `[PAUSE]` để lấy hơi, uống ngụm nước rồi bấm `[REC]` thu tiếp trên cùng một cuộn băng.
- **Phản hồi giao diện & âm thanh:**
  - Tiếng "CẠCH" cơ học của nút REC bấm xuống.
  - Đèn LED đỏ cạnh chữ REC bật sáng nhấp nháy theo nhịp 1Hz.
  - Đồng hồ đếm ngược từ `07:00` về `00:00` (hoặc hiển thị thời gian đã thu `00:00 / 07:00`).
  - Hai bánh xe cassette bắt đầu quay đều; dải băng từ chuyển động từ cuộn trái sang cuộn phải.
  - Sóng âm (VU Meter / Waveform) nhấp nhô theo cao độ giọng nói.
- **Giới hạn thời gian:** Tối đa **7 phút (420 giây)** cho mỗi cuộn băng tâm sự chính. Độ dài tối thiểu hợp lệ: 5 giây. Khi hết thời gian hoặc bấm nút `[STOP]`, quá trình ghi âm kết thúc.

#### Bước 3: Tinh chỉnh & Nghe lại (Preview & Voice Mask)
- Người dùng có thể bấm `[PLAY]` để nghe lại cuộn băng vừa ghi.
- **Tính năng "Màn che giọng ấm" (Voice Mask):**
  - Công tắc gạt vật lý (toggle switch) kiểu vintage.
  - Khi bật: Web Audio API xử lý pitch-shift hạ tone giọng khoảng 2-3 bán âm (semitones) và thêm chút hơi ấm (warm low-pass filter). Giúp người quen không thể nhận diện giọng thật nhưng âm thanh vẫn tự nhiên, không bị méo mó kiểu robot quái dị.
- Nút `[GHI LẠI]` nếu chưa ưng ý (xóa buffer cũ, reset về ban đầu).

#### Bước 4: Dán nhãn (Tagging)
Người dùng bắt buộc chọn 1 trong 5 nhãn cảm xúc để dán lên nhãn giấy của cuộn băng:
1. `🏷️ Cơm áo gạo tiền` (Tài chính, nợ nần, áp lực mưu sinh, thất nghiệp)
2. `🏷️ Chông chênh tuổi 20s` (Mất định hướng, so sánh bản thân, áp lực đồng trang lứa)
3. `🏷️ Gia đình & Người lớn` (Kỳ vọng phụ huynh, rạn nứt gia đình, gánh nặng làm cha mẹ)
4. `🏷️ Một mình (Cô đơn)` (Đêm muộn không ai trò chuyện, lạc lõng giữa phố thị)
5. `🏷️ Chuyện tình dở dang` (Chia tay, tương tư không thành, tan vỡ)

#### Bước 5: Thả băng vào màn đêm
- Bấm nút gạt / cơ học `[Thả vào màn đêm]`.
- **Hiệu ứng:** Máy phát tiếng cạch cơ học `EJECT`. Cuộn băng bật ra khỏi khay và từ từ mờ ảo trôi vào khoảng tối màn đêm.
- Hệ thống tạo một bản ghi ẩn danh lưu trên máy chủ (kèm token quản lý băng lưu tại `localStorage` của người gửi).

---

### 2.2. Hành trình B: Lắng nghe & Hồi âm (Chữa lành)

#### Bước 1: Nhặt băng ngẫu nhiên
- Người dùng chuyển sang tab/chế độ "Lắng nghe".
- Có thể chọn xem tất cả hoặc lọc theo 1 Tag cụ thể.
- Bấm nút `[Nhặt một cuộn băng]`.
- Một cuộn băng cũ kỹ từ trong bóng tối trôi đến và tự động lắp vào máy phát `CLACK`.
- Nhãn băng hiển thị:
  - Tên nhãn (Ví dụ: `#ChôngChênhTuổi20s`).
  - Thời lượng audio (Ví dụ: `0:52s`).
  - Thời gian tự hủy còn lại (Ví dụ: `Còn 18 giờ trước khi tan biến`).
  - Tuyệt đối không hiển thị tên tác giả hay avatar.

#### Bước 2: Lắng nghe
- Bấm `[PLAY]`. Tiếng rít nhẹ của đầu từ cassette (tape hiss) nổi lên trong tích tắc, sau đó giọng nói người lạ vang lên.
- Hai bánh xe cassette quay đều, thanh tiến trình hiển thị dưới dạng dải băng từ di chuyển.
- Bấm `[PAUSE]` để tạm dừng nếu cần.
- Nếu không phù hợp: Bấm `[Đổi cuộn băng khác]` (giới hạn tích lũy đồng thời: tối đa **5 lượt đổi trong 10 phút** và tối đa **15 lượt nhặt trong 1 giờ** để tránh lướt quẹt vô tội vạ).

#### Bước 3: Lựa chọn hình thức hồi âm
Sau khi nghe xong ít nhất 70% thời lượng cuộn băng, 2 nút hồi âm sẽ được mở khóa:

* **Cách 1: Gửi một tách trà ấm (Quick Hug):**
  - Dành cho người muốn thể hiện sự đồng cảm nhưng không tiện nói.
  - Bấm icon tách trà -> Hiệu ứng khói trà ấm bay lên kèm âm thanh chuông gió nhẹ nhàng ngân vang.
  - Bộ đếm tách trà của cuộn băng tăng lên +1.
  
* **Cách 2: Thu âm hồi đáp (Voice Reply):**
  - Dành cho người muốn tâm sự, chia sẻ lời khuyên hoặc an ủi.
  - Bấm nút mic để thu âm tối đa **3 phút (180 giây)** (có hỗ trợ Pause/Resume).
  - Có thể nghe lại trước khi gửi.
  - Khi bấm `[Gửi lời ủi an]`: Lời hồi đáp được gửi thẳng về hộp thư của cuộn băng đó.
  - **Lưu ý:** Mỗi cuộn băng chỉ cho phép nhận tối đa **1 Voice Reply duy nhất** từ một người lạ để giữ trọn vẹn sự quý giá và riêng tư.

---

### 2.3. Hành trình C: Nhật ký cuộn băng 24h & Nhận hồi đáp

- **Nhật ký cuộn băng đã gửi (Trong vòng 24h):**
  - Khi người trút áp lực quay lại trang web (hoặc đang mở tab), hệ thống tự động đồng bộ từ `GET /api/v1/tapes/my-mailbox` (kèm bản lưu cục bộ `localStorage` để đối chiếu) và hiển thị rõ trạng thái từng cuộn băng đã gửi:
    - *Đang kiểm duyệt* (`PENDING_REVIEW`)
    - *Đang trôi trong màn đêm* (`ACTIVE` — kèm số lượt nghe & số tách trà ấm)
    - *Chưa thể phát hành* (`REJECTED` — kèm lý do dịu dàng nếu vi phạm PII/toxic, tránh cảm giác "băng tự nhiên biến mất")
    - *Đã tan biến* (nếu đã quá 24 giờ, hiện thông điệp nhẹ nhàng thay vì trống trơn).
- **Nhận hồi đáp từ người lạ:**
  - Khay cassette xuất hiện thông báo dịu dàng: *"Một người lạ đã ghé qua cuộn băng của bạn."*
  - Nếu là Tách trà: Hiệu ứng cốc trà tỏa khói ấm áp xuất hiện bên cạnh máy cassette cùng lời nhắn mặc định: *"Người lạ gửi cho bạn một tách trà ấm và mong lòng bạn nhẹ bớt."*
  - Nếu là Voice Reply: Xuất hiện cuộn băng hồi âm màu hổ phách. Người dùng bấm `[PLAY]` để nghe lời an ủi.
- **Hành động cuối cùng:**
  - Người dùng bấm nút duy nhất: `[Gửi lời Cảm ơn]`.
  - Hệ thống gửi tín hiệu "Người nhận đã nghe và mỉm cười cảm ơn" đến người lạ đã hồi âm.
  - **Không có bất kỳ ô chat nào để nhắn thêm.** Vòng tròn kết nối hoàn tất trọn vẹn trong yên bình.

---

### 2.4. Hành trình D: Nâng đỡ tâm lý qua RAG (Khi nội dung quá nặng nề)

Nếu pipeline kiểm duyệt AI phát hiện cuộn băng chứa đựng nỗi đau quá lớn, dấu hiệu trầm cảm nặng hoặc khủng hoảng tinh thần (`HEAVY_DISTRESS` / `CRISIS`):
1. **Bảo vệ hai chiều:** Cuộn băng ở mức `CRISIS` sẽ **không** được thả vào hàng đợi ngẫu nhiên (tránh kích hoạt tâm lý tiêu cực dây chuyền cho người lạ khác). Với mức `HEAVY_DISTRESS`, hệ thống có thể giữ riêng tư hoặc gắn cảnh báo nhẹ.
2. **Kích hoạt RAG Sơ cứu tâm lý (Psychological First Aid):**
   - Hệ thống trích xuất chủ đề cốt lõi từ transcript và truy vấn cơ sở tri thức tâm lý học đã kiểm chứng (`pgvector`).
   - Sinh ra một **"Lá thư ủi an từ Gác Đêm"** mang tính đồng cảm sâu sắc, không phán xét, kèm theo 1 bài tập điều hòa (ví dụ: hít thở 4-7-8 hoặc kỹ thuật tiếp đất 5-4-3-2-1) phù hợp đúng với hoàn cảnh người nói.
   - Đính kèm danh sách tổng đài hỗ trợ tâm lý miễn phí tại Việt Nam (`096 306 1414`, `111`).
3. **Vẫn giữ quy tắc Một lần:** Không mở ra khung chat AI liên tục để tránh gây lệ thuộc cảm xúc vào bot.

---

## 3. BẢNG QUY TẮC NGHIỆP VỤ & RÀNG BUỘC (BUSINESS RULES & CONSTRAINTS)

| Mã quy tắc | Tên quy tắc | Nội dung đặc tả |
| :--- | :--- | :--- |
| **BR-01** | Giới hạn độ dài audio | Cuộn băng chính: 5 giây – 7 phút (420s). Voice Reply: 5 giây – 3 phút (180s). |
| **BR-02** | Khóa chat 2 chiều | Nghiêm cấm mọi hình thức trao đổi văn bản hoặc gửi thêm voice sau lượt đầu tiên. |
| **BR-03** | Quy tắc một Voice Reply | 1 cuộn băng gốc chỉ chấp nhận 1 Voice Reply đầu tiên được gửi tới. Người khác chỉ có thể gửi Tách trà ấm. |
| **BR-04** | Vòng đời 24 giờ | Đúng 24 giờ kể từ thời điểm `published_at`, cuộn băng và mọi phản hồi liên quan bị xóa hoàn toàn khỏi DB và Storage. |
| **BR-05** | Rate Limit tạo băng | 1 phiên / `ip_hash` tối đa tạo 3 cuộn băng / 24 giờ để tránh spam bot. |
| **BR-06** | Rate Limit nhặt băng | Áp dụng đồng thời (cumulative): tối đa **15 lượt nhặt / 1 giờ**, trong đó tối đa **5 lượt đổi băng / 10 phút**. |
| **BR-07** | Không nghe lại băng của mình | Hệ thống loại trừ `creator_hash` khỏi thuật toán nhặt băng ngẫu nhiên. |
| **BR-08** | Lọc kiểm duyệt & RAG | 100% audio phải qua AI kiểm duyệt. Nội dung vi phạm bị từ chối; nội dung quá nặng nề được chuyển hướng sang RAG hỗ trợ tâm lý. |
| **BR-09** | Zero-Login (UUID + IP Hash) | Không yêu cầu Gmail/MXH. Dùng Session UUID làm khóa hộp thư cá nhân, kết hợp IP Hash ở backend để chống spam. |
