# Rasa intent-slot plan

Mục tiêu: intent chỉ mô tả thao tác chính; điều kiện chi tiết đi bằng entity/slot để giảm case trùng và tránh model đoán giữa các intent giống nhau.

## Task

| User muốn | Intent | Slot/entity chính | Xử lý |
| --- | --- | --- | --- |
| Xem tất cả task | `filter_tasks` | không có filter | Gọi API danh sách task có phân trang. |
| Xem task quá hạn | `filter_tasks` | `task_due_state=overdue` | Gửi `overdue=true`; API lọc task chưa completed và `DueDate < now`. |
| Xem task theo ngày | `filter_tasks` | `due_date`, `time`, hoặc `due_from/due_to` | Chuẩn hóa thành `dueFrom/dueTo`, rồi gọi cùng action filter. |
| Lọc theo trạng thái | `filter_tasks` | `task_status` | Chuẩn hóa `todo/in-progress/completed`. |
| Lọc theo ưu tiên | `filter_tasks` | `priority` | Chuẩn hóa `low/medium/high`. |
| Lọc theo nhãn | `filter_tasks` | `task_label` | Gửi `label`. |
| Tìm theo keyword | `filter_tasks` | `search_query` | Gửi `search`. |
| Kết hợp nhiều điều kiện | `filter_tasks` | nhiều slot cùng lúc | Gửi tất cả filter hợp lệ trong một request. |
| Tạo task có title trong câu | `create_task` | `task_title` hoặc raw text | Validator tách title từ câu đầu, ví dụ `tạo task học sql` tạo luôn title `học sql`. |
| Tạo task thiếu title | `create_task` | không có title sau khi strip trigger/date/priority | Hỏi lại title. |
| Xóa task | `delete_task` | `task_title` hoặc query từ câu | Tìm fuzzy, xóa ngay nếu rõ; nếu nhiều match trả picker. |
| Undo xóa task | `undo_delete_task` | undo token từ metadata | Gọi API undo. |
| Tóm tắt tuần | `summarize_week` | không cần filter | Giữ intent riêng vì output là phân tích/tổng hợp. |
| Gợi ý ưu tiên | `help_prioritize` | không cần filter | Giữ intent riêng vì output là sắp xếp khuyến nghị. |

## Note

| User muốn | Intent | Slot/entity chính | Xử lý |
| --- | --- | --- | --- |
| Tạo note | `create_note` | `note_title`, `note_text` | Tạo note ngay nếu có title; nếu thiếu action tự phản hồi lỗi thiếu dữ liệu. |
| Xem note | `list_notes` | có thể mở rộng `pin_state` | Liệt kê note, sau này có thể thêm filter pinned. |
| Tìm note | `search_notes` | `note_keyword` | Tìm theo keyword. |
| Ghim/bỏ ghim | `pin_note` | `pin_state`, `note_title` | Toggle hoặc set pin theo state. |
| Sửa note | `update_note` | `note_keyword`, `note_title`, `note_text` | Tìm note rồi cập nhật phần người dùng nêu. |
| Xóa note | `delete_note` | `note_keyword` | Xóa note khớp keyword/title. |

## Quy tắc mở rộng

1. Khi thêm biến thể mới mà vẫn là truy vấn danh sách task, thêm entity/slot cho `filter_tasks`, không tạo intent mới.
2. Chỉ tạo intent mới khi action/output khác bản chất, ví dụ phân tích, tạo, xóa, cập nhật.
3. Generator nên thêm ví dụ theo nhóm slot, tránh copy nguyên một intent mới cho cùng hành vi.
4. Nếu một câu có đủ dữ liệu để hành động, action phải làm luôn; chỉ hỏi lại khi dữ liệu bắt buộc thật sự thiếu.
