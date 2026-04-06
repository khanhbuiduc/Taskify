# Chatbox quản lý task (local-first)

- **Tạo**: Gõ tự nhiên, ví dụ `tạo task "Viết báo cáo"`. Nếu không nói gì thêm, hệ thống dùng `priority=medium`, `status=todo`, hạn cuối 23:59 hôm nay. Bạn có thể nêu ưu tiên/trạng thái/ngày hạn ngay trong câu.
- **Xem / tìm**: Hỏi “danh sách task …” hoặc “list task báo cáo”. Bot trả thẻ task kèm checkbox để chọn nhanh.
- **Cập nhật**: Nói “cập nhật …” kèm tiêu đề gần đúng; đổi được `status`, `priority`, `dueDate`, `title`, `description`. Ví dụ: `cập nhật task báo cáo: priority cao, status in-progress, hạn mai`. Nếu trùng nhiều, bot sẽ yêu cầu bạn chọn.
- **Xóa (có xác nhận)**: Nói “xóa …” kèm tiêu đề. Bot liệt kê task khớp, bạn tick checkbox rồi bấm **Confirm** hoặc trả lời `yes/xác nhận` để xóa; `cancel/no/hủy` để dừng.
- **Không phải CRUD**: Bot chuyển câu hỏi sang trợ lý AI backend như trước.
 