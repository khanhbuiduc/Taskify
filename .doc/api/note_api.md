# Chức năng API: Quản lý Ghi chú (Note)

Tài liệu này tổng hợp các chức năng mà API cung cấp để quản lý ghi chú cá nhân.

## 1. Chức năng chính (Frontend API)

| Chức năng | Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- | :--- |
| **Lấy danh sách** | `GET` | `/api/Notes` | Lấy danh sách ghi chú (Hỗ trợ phân trang, tìm kiếm, lọc theo ghim). |
| **Chi tiết** | `GET` | `/api/Notes/{id}` | Xem nội dung chi tiết một ghi chú. |
| **Tạo mới** | `POST` | `/api/Notes` | Tạo ghi chú mới với tiêu đề và nội dung. |
| **Cập nhật** | `PUT` | `/api/Notes/{id}` | Sửa đổi nội dung hoặc tiêu đề ghi chú. |
| **Ghim / Bỏ ghim** | `PATCH` | `/api/Notes/{id}/pin` | Thay đổi trạng thái ưu tiên hiển thị của ghi chú. |
| **Xóa vĩnh viễn** | `DELETE` | `/api/Notes/{id}` | Xóa bỏ hoàn toàn ghi chú khỏi hệ thống. |

---

## 2. Khả năng tìm kiếm & Lọc

Endpoint `GET /api/Notes` hỗ trợ các tham số truy vấn:
- `search`: Tìm kiếm từ khóa trong tiêu đề hoặc nội dung.
- `pinned`: Lọc riêng các ghi chú đã ghim (`true`) hoặc chưa ghim (`false`).
- `page` & `pageSize`: Phân trang dữ liệu (Mặc định 20 bản ghi/trang).

---

## 3. Chức năng nâng cao (Internal API - Dùng cho AI/Rasa)

Dành cho việc quản lý ghi chú thông qua hội thoại chat:

- **Lấy ghi chú gần đây**: `/api/internal/notes/{userId}?limit=5`
    - Tối ưu cho việc hiển thị nhanh trong khung chat.
- **Tìm kiếm nhanh**: `/api/internal/notes/{userId}?search={query}`
    - Giúp AI tìm đúng thông tin người dùng đang hỏi.
- **Tạo & Cập nhật qua Chat**: 
    - AI có thể tạo ghi chú từ câu nói: "Note lại giúp tôi địa chỉ này..."
    - Tiêu đề sẽ được tự động trích xuất từ nội dung nếu không được chỉ định rõ.
- **Bảo mật**: Xác thực qua token nội bộ giữa Rasa Action Server và Web API.
