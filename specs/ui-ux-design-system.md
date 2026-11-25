# HỆ THỐNG THIẾT KẾ GIAO DIỆN & ÂM THANH (UI/UX & SOUND DESIGN)
## Dự án: Tiệm Băng Nửa Đêm (Midnight Tapes)

---

## 1. TRIẾT LÝ THẨM MỸ (VISUAL PHILOSOPHY)

"Tiệm Băng Nửa Đêm" kết hợp giữa phong cách **Skeuomorphism hoài cổ (thập niên 80-90s)** và vẻ đẹp tĩnh lặng của **Ambient Wabi-Sabi**. Giao diện không mang tính chất của một phần mềm công nghệ khô khan mà mô phỏng lại một căn gác gỗ ấm áp lúc 2 giờ sáng giữa cơn mưa đêm.

```
       [ ĐÈN BÀN VÀNG DỊU ]                     [ CƠN MƯA ĐÊM NGOÀI CỬA ]
                 \                                     /
                  ▼                                   ▼
        ┌───────────────────────────────────────────────────────┐
        │  MẶT BÀN GỖ TỐI (Dark Amber Walnut Texture)          │
        │                                                       │
        │           ┌───────────────────────────────┐           │
        │           │    MÁY CASSETTE TAPE RECORDER │           │
        │           │    ┌─────────────────────┐    │   [ CỐC   │
        │           │    │ [O]  =====Tape==== [O]│  │     TRÀ   │
        │           │    └─────────────────────┘    │   NÓNG ]  │
        │           │    [● REC] [▶ PLAY] [▲ EJECT] │     ♨️    │
        │           └───────────────────────────────┘           │
        │                                                       │
        └───────────────────────────────────────────────────────┘
```

---

## 2. HỆ THỐNG MÀU SẮC & TYPOGRAPHY (DESIGN TOKENS)

### 2.1. Bảng màu (Color Palette)

| Tên Token | Mã Hex | Ứng dụng | Cảm xúc mang lại |
| :--- | :--- | :--- | :--- |
| `midnight-void` | `#080706` | Nền chính màn hình đêm | Tĩnh mịch, cô đặc của đêm muộn |
| `wood-desk-base` | `#161311` | Mặt bàn gỗ tối | Mộc mạc, bình yên, ấm áp |
| `wood-desk-highlight`| `#29231E` | Vệt sáng đèn hắt lên mặt bàn | Ánh sáng vàng dịu phản chiếu |
| `amber-lamp` | `#D97706` | Ánh đèn sợi đốt, viền sáng | Ấm lòng, nâng niu |
| `amber-glow` | `#F59E0B` | Đèn hắt, ánh sáng phản xạ | Che chở, an ủi |
| `tape-ribbon` | `#451A03` | Dải băng từ tính cassette | Hoài niệm, thời gian |
| `sticker-parchment`| `#F3EFE0` | Giấy dán nhãn cuộn băng cũ | Cũ kỹ, chân thật |
| `led-rec-active` | `#EF4444` | Đèn LED báo đang ghi âm | Trạng thái vật lý trực quan |
| `tea-steam` | `#FEF3C7` | Khói trà ấm, hạt bụi lơ lửng | Nhẹ nhàng, thanh lọc tâm trí |

### 2.2. Nghệ thuật chữ (Typography)
- **Tiêu đề & Chữ trên nhãn cuộn băng (Handwritten / Vintage):**
  - Font chữ: `Caveat` hoặc `Patrick Hand` kết hợp `VT323` (cho đồng hồ counter LCD).
  - Thể hiện nét viết tay mộc mạc như ai đó vừa dùng bút lông dầu viết lên băng.
- **Văn bản hệ thống & Nút bấm (Sans-Serif mềm mại):**
  - Font chữ: `Inter` hoặc `Plus Jakarta Sans`, độ đậm `Regular` (400) và `Medium` (500).
  - Không dùng font quá nét góc cạnh để giữ sự êm dịu cho mắt lúc đêm tối.

---

## 3. THIẾT KẾ BỐ CỤC (RESPONSIVE VIEWPORT ADAPTATION)

### 3.1. Phiên bản Desktop (Góc nhìn từ trên xuống - Top-Down Desk POV)
- Tỷ lệ khung nhìn hiển thị toàn cảnh mặt bàn:
  - **Góc trên bên trái:** Ánh đèn bàn hắt xuống tạo quầng sáng tròn vàng ấm, vài hạt bụi li ti chuyển động nhẹ (Canvas particles).
  - **Chính giữa:** Chiếc máy phát băng cassette cổ điển làm bằng kim loại phay xước hoặc nhựa màu be cổ, các nút bấm nổi khối 3D đổ bóng mềm.
  - **Góc phải:** Một cốc trà bốc khói mờ ảo (CSS animation khói trà bay lượn).
  - **Góc dưới:** Nút gạt bật/tắt tiếng mưa đêm và thanh điều chỉnh âm lượng sfx.

### 3.2. Phiên bản Mobile (Trải nghiệm cầm máy Walkman trên tay)
- Khi mở trên điện thoại (iOS / Android):
  - Giao diện tự động co lại đúng bằng tỷ lệ chiếc **Sony Walkman WM-F10**.
  - Người dùng có cảm giác như đang cầm một thiết bị vật lý trong lòng bàn tay.
  - Vị trí nút bấm `REC` và `PLAY` to bản nằm trong tầm với của ngón cái (Thumb zone tối ưu).
  - Mặt kính trong suốt để lộ hai bánh xe băng cassette đang xoay tít.

---

## 4. CHI TIẾT TƯƠNG TÁC CƠ HỌC (SKEUOMORPHIC ANATOMY)

### 4.1. Cụm bánh xe cassette (Reels & Tape Ribbon)
- **Hai bánh xe răng cưa:**
  - Được dựng bằng SVG kết hợp CSS `transform: rotate()`.
  - Khi `PLAY` hoặc `REC`: Bánh xe trái quay nhả băng, bánh xe phải quay cuốn băng với tốc độ 33 vòng/phút.
  - Dải băng màu nâu đậm giữa hai bánh xe dày dần ở cuộn nhận khi thời gian trôi qua.
- **Bộ đếm số cơ học (Mechanical Counter):**
  - Đồng hồ 3 số lật kiểu cơ học `000` -> `420` (tương ứng tối đa 7 phút), kèm đồng hồ phụ `07:00` đếm ngược dịu nhẹ.
- **Nút Tạm dừng (Pause/Resume):**
  - Cho phép người dùng tạm dừng giữa chừng khi đang kể câu chuyện dài (tới 7 phút) mà không làm đứt mạch thu âm.

### 4.2. Cần gạt "Màn che giọng ấm" (Voice Mask Switch)
- Mô phỏng một chiếc công tắc gạt kim loại (Chrome toggle switch).
- Khi gạt lên: Âm thanh kim loại nảy nhẹ `CLICK-SNAP`, đèn LED màu hổ phách cạnh chữ "Ấm giọng" sáng lên.

### 4.3. Nút bấm vật lý (Tactile Push Buttons)
- Trạng thái `idle`: Nút nhô cao có đổ bóng phía dưới (`box-shadow: 0 6px 0 #1c1917`).
- Trạng thái `active` (bấm xuống): Nút chìm sâu xuống 4px, tiếng "CẠCH" phát ra tức thì.

### 4.4. Thẻ "Lá thư ủi an từ Gác Đêm" (RAG Psychological Support Card)
Khi nội dung cuộn băng được phân loại là nặng nề / khủng hoảng tâm lý:
- Không hiện thông báo lỗi đỏ gắt. Thay vào đó, một tờ giấy note màu kem ấm (`#F3EFE0`) từ từ trượt ra từ khe bên cạnh máy cassette.
- Hiển thị:
  - Lời hồi đáp đồng cảm được tổng hợp từ RAG tâm lý học.
  - Nút **[Thực hành nhịp thở 4-7-8]** với vòng tròn ánh sáng hổ phách phồng-xẹp dịu dàng hướng dẫn hít vào (4s) - giữ (7s) - thở ra (8s).
  - Số tổng đài hỗ trợ tâm lý miễn phí bấm gọi trực tiếp trên mobile (`tel:0963061414`, `tel:111`).

---

## 5. THIẾT KẾ ÂM THANH (SOUND DESIGN - 60% TRẢI NGHIỆM)

Âm thanh là linh hồn của Tiệm Băng Nửa Đêm. Dự án sử dụng hệ thống âm thanh phân tầng:

```
┌────────────────────────────────────────────────────────┐
│               LAYER 1: AMBIENT SOUNDSCAPE              │
│   - Tiếng mưa rào rơi nhẹ trên mái tôn/cửa kính (Loop)  │
│   - Tiếng xì rè nhẹ của băng từ (Tape hiss noise)      │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│               LAYER 2: TACTILE SFX (CƠ HỌC)            │
│   - sfx_button_press.webm: Tiếng nén lò xo đanh gọn    │
│   - sfx_head_engage.webm: Đầu đọc áp sát dải băng      │
│   - sfx_eject.webm: Bật nắp lò xo khay băng            │
│   - sfx_tea_pour.webm: Tiếng rót nước & chuông gió     │
└────────────────────────────────────────────────────────┘
```

### Danh mục hiệu ứng âm thanh cần chuẩn bị:

| Tên file âm thanh | Định dạng & Size | Thời lượng | Kịch bản kích hoạt |
| :--- | :--- | :--- | :--- |
| `ambience_midnight_rain.opus` | Opus 48kbps (~600KB) | 60s loop | Chạy nền liên tục khi vào web |
| `sfx_tape_hiss.opus` | Opus 32kbps (~120KB) | 15s loop | Chạy khi băng đang quay phát |
| `sfx_rec_click.webm` | WebM (~25KB) | 0.3s | Khi nhấn nút tròn đỏ [REC] |
| `sfx_play_engage.webm` | WebM (~30KB) | 0.4s | Khi bấm nút [PLAY] |
| `sfx_eject_snap.webm` | WebM (~40KB) | 0.6s | Khi nhả băng hoặc bấm [Thả vào đêm] |
| `sfx_tea_hug.webm` | WebM (~50KB) | 1.2s | Khi bấm gửi Tách trà ấm (chuông êm dịu) |
| `sfx_toggle.webm` | WebM (~15KB) | 0.15s | Khi gạt công tắc Voice Mask |
