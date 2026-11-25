# TÀI LIỆU ĐẶC TẢ GIAO DIỆN LẬP TRÌNH (API SPECIFICATION)
## Dự án: Tiệm Băng Nửa Đêm (Midnight Tapes)

---

## 1. TIÊU CHUẨN CHUNG (GENERAL CONVENTIONS)

- **Base URL:** `/api/v1`
- **Format:** `application/json` (trừ luồng upload audio binary trực tiếp lên R2 qua S3 Presigned URL).
- **Authentication (Zero-Login):** Header `X-Anonymous-Token` (UUIDv4 lưu ở `localStorage` / `HttpOnly Cookie`). Server tự động trích xuất IP người truy cập và băm một chiều (`ip_hash`) để chống spam (không lưu IP thô, không yêu cầu Gmail/MXH).
- **Mã lỗi chuẩn:**
  - `400 Bad Request`: Thiếu trường dữ liệu hoặc file audio không hợp lệ.
  - `403 Forbidden`: Vi phạm quy tắc nghiệp vụ (ví dụ: tự reply băng của mình, quá hạn 24h).
  - `429 Too Many Requests`: Vượt quá hạn mức rate limit.
  - `500 Internal Server Error`: Lỗi hệ thống.

---

## 2. DANH SÁCH ENDPOINTS CHI TIẾT

### 2.1. Quản lý Phiên ẩn danh (Session)

#### `POST /api/v1/session/init`
Khởi tạo hoặc kiểm tra tính hợp lệ của phiên ẩn danh người dùng.
- **Request Headers:**
  - `X-Anonymous-Token: <UUIDv4>` (tùy chọn, nếu client đã có)
- **Response 200 OK:**
  ```json
  {
    "status": "success",
    "token": "d8c6d313-83cf-48fa-a37c-32555907df58",
    "activeTapesCount": 1,
    "hasUnreadReply": true
  }
  ```

---

### 2.2. Ghi âm & Thả băng (Tape Creation Pipeline)

#### `POST /api/v1/tapes/presigned-url`
Lấy đường dẫn URL upload trực tiếp lên Cloudflare R2 bucket.
- **Request Body:**
  ```json
  {
    "contentType": "audio/webm",
    "fileSizeBytes": 1245760,
    "durationSeconds": 320
  }
  ```
  *(Giới hạn: `durationSeconds` từ 5 đến 420 giây cho băng chính; `fileSizeBytes` tối đa 3,145,728 bytes / 3MB)*
- **Response 200 OK:**
  ```json
  {
    "uploadUrl": "https://s3.r2.cloudflarestorage.com/midnight-tapes-staging/tapes/abc-123.webm?X-Amz-Signature=...",
    "audioPath": "tapes/abc-123.webm",
    "expiresIn": 300
  }
  ```

#### `POST /api/v1/tapes/publish`
Xác nhận đã upload file thành công, đưa vào hàng đợi kiểm duyệt AI.
- **Request Body:**
  ```json
  {
    "audioPath": "tapes/abc-123.webm",
    "durationSeconds": 54,
    "tag": "QUARTER_LIFE",
    "isVoiceMasked": true
  }
  ```
- **Response 201 Created:**
  ```json
  {
    "id": "e4b2d861-1234-4b56-7890-abcdef123456",
    "status": "PENDING_REVIEW",
    "message": "Cuộn băng đang được dọn đường trước khi hòa vào màn đêm.",
    "expiresAt": "2026-11-25T20:39:17.000Z"
  }
  ```

---

### 2.3. Lắng nghe & Nhặt băng (Discovery & Playback)

#### `POST /api/v1/tapes/pick`
Nhặt ngẫu nhiên một cuộn băng của người lạ theo thuật toán công bằng.
- **Request Body:**
  ```json
  {
    "tagFilter": "ALL" // hoặc 'FINANCE', 'QUARTER_LIFE', 'FAMILY', 'LONELY', 'LOVE'
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "tape": {
      "id": "f8901234-abcd-5678-ef01-23456789abcd",
      "tag": "LONELY",
      "tagDisplayName": "Một mình (Cô đơn)",
      "durationSeconds": 48,
      "audioUrl": "https://cdn.midnighttapes.com/tapes/f8901234.webm",
      "listenCount": 0,
      "teaCount": 2,
      "hasReply": false,
      "remainingHours": 18
    }
  }
  ```
- **Response 404 Not Found:** Không còn cuộn băng nào phù hợp tại thời điểm này.

---

### 2.4. Hồi âm (Responses & Hugs)

#### `POST /api/v1/tapes/:id/react-tea`
Gửi một tách trà ấm (Quick Hug).
- **Request Params:** `id` (Tape ID)
- **Response 200 OK:**
  ```json
  {
    "status": "success",
    "teaCount": 3,
    "message": "Tách trà ấm đã được trao đi trong tĩnh lặng."
  }
  ```

#### `POST /api/v1/tapes/:id/reply/presigned-url`
Lấy presigned URL upload Voice Reply cho cuộn băng chỉ định.
- **Response 200 OK:**
  ```json
  {
    "uploadUrl": "https://s3.r2.cloudflarestorage.com/.../replies/xyz-789.webm",
    "audioPath": "replies/xyz-789.webm"
  }
  ```

#### `POST /api/v1/tapes/:id/reply/publish`
Hoàn tất việc gửi lời ủi an bằng giọng nói (Voice Reply duy nhất).
- **Request Body:**
  ```json
  {
    "audioPath": "replies/xyz-789.webm",
    "durationSeconds": 58
  }
  ```
- **Response 201 Created:**
  ```json
  {
    "replyId": "r987-123",
    "status": "PENDING_REVIEW",
    "message": "Lời ủi an đang trên đường đến với người nhận."
  }
  ```

---

### 2.5. Người gửi kiểm tra hộp thư & Cảm ơn (Receiver Flow)

#### `GET /api/v1/tapes/my-mailbox`
Lấy toàn bộ nhật ký các cuộn băng do chính người dùng đã gửi trong 24 giờ qua (bao gồm trạng thái đang duyệt, đang trôi trong đêm, bị từ chối kèm lý do, thẻ RAG hỗ trợ tâm lý, tách trà và hồi âm nhận được) để người dùng quay lại luôn thấy rõ tình trạng băng của mình.
- **Response 200 OK:**
  ```json
  {
    "tapes": [
      {
        "id": "e4b2d861-1234-4b56-7890-abcdef123456",
        "tag": "QUARTER_LIFE",
        "status": "ACTIVE",
        "rejectReason": null,
        "durationSeconds": 320,
        "listenCount": 3,
        "teaCount": 4,
        "severity": "HEAVY_DISTRESS",
        "ragSupport": {
          "letter": "Đêm nay hẳn đã rất nặng nề với bạn khi phải một mình gồng gánh áp lực...",
          "exerciseType": "BREATHING_478",
          "hotlines": [
            { "name": "Đường dây nóng Ngày Mai", "number": "0963061414" },
            { "name": "Tổng đài Quốc gia", "number": "111" }
          ]
        },
        "reply": {
          "id": "r987-123",
          "audioUrl": "https://cdn.midnighttapes.com/replies/xyz-789.webm",
          "durationSeconds": 58,
          "isThanked": false,
          "createdAt": "2026-11-24T22:15:00.000Z"
        },
        "createdAt": "2026-11-24T20:39:17.000Z",
        "expiresAt": "2026-11-25T20:39:17.000Z"
      }
    ]
  }
  ```

#### `POST /api/v1/tapes/replies/:replyId/thank`
Bấm nút cảm ơn sau khi nghe xong lời hồi âm.
- **Response 200 OK:**
  ```json
  {
    "status": "success",
    "message": "Lời cảm ơn chân thành đã được gửi tới người lạ."
  }
  ```
