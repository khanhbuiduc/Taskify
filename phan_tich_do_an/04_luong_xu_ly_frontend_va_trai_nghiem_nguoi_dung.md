# Luồng xử lý frontend và trải nghiệm người dùng

## Mục tiêu của tài liệu này
Tài liệu này mô tả phía giao diện `taskifyView`: người dùng nhìn thấy gì, thao tác ra sao, state được quản lý như thế nào và các màn hình liên kết với nhau thế nào.

## Tại sao phần này quan trọng
Một hệ thống tốt không chỉ nằm ở backend hay AI mà còn ở trải nghiệm sử dụng. Phần này giúp người đọc hiểu Taskify từ góc nhìn màn hình, hành trình thao tác và cấu trúc state phía client.

## Hành trình người dùng tổng quát
1. Người dùng vào trang `login` hoặc `signup`.
2. Sau khi đăng nhập thành công, token JWT được lưu ở client.
3. Người dùng vào dashboard và truy cập các phân hệ như task, notes, finance, focus, AI, settings.
4. Tùy từng màn hình, frontend nạp dữ liệu bằng store tương ứng.
5. Khi người dùng chat với AI, màn hình AI trở thành điểm điều phối dữ liệu liên phân hệ.

## Các store trạng thái chính
| Store | Vai trò |
| --- | --- |
| `auth-store` | Giữ trạng thái đăng nhập, thông tin user, token lifecycle |
| `task-store` | Quản lý danh sách task, filter, CRUD, status update |
| `note-store` | Quản lý danh sách note và thao tác pin/unpin |
| `finance-store` | Quản lý entries tài chính và refresh summary |
| `finance-category-store` | Quản lý category tài chính |
| `chat-session-store` | Quản lý sessions chat, messages, optimistic send |
| `focus-store` | Quản lý focus sessions và daily goals |
| `notification-store` | Quản lý thông báo cục bộ nếu có |

## Các màn hình chính
| Màn hình | Ý nghĩa | Điểm đáng chú ý |
| --- | --- | --- |
| `tasks/dashboard` | Tổng quan task theo nhóm | Phù hợp quản lý trực quan |
| `tasks/list` | Danh sách tuyến tính | Dễ xem nhanh và thao tác |
| `tasks/calendar` | Xem task theo hạn | Hữu ích với due date |
| `tasks/table` | Bảng dữ liệu | Phù hợp lọc/sắp xếp |
| `notes` | Ghi chú cá nhân | Có editor dialog |
| `finance` | Thu chi và thống kê | Có summary cards, table, calendar |
| `focus` | Tập trung và mục tiêu hằng ngày | Có timer và session panel |
| `ai` | Chat với trợ lý AI | Có hội thoại, voice, điều phối module |
| `admin/users` | Quản trị user | Chỉ admin mới dùng |
| `settings` | Cấu hình hệ thống/AI | Quản lý Gemini, Ollama, sở thích |

## Mô hình tổ chức frontend
- `app/*`: định nghĩa route.
- `components/*`: component theo module.
- `lib/api/*`: client gọi backend.
- `lib/*store.ts`: Zustand store.
- `hooks/*`: logic tái sử dụng như speech recognition, speech synthesis, notifications.

## Điểm đáng chú ý trong trải nghiệm người dùng
### 1. Task có nhiều cách nhìn
Task là cùng một dữ liệu nhưng được thể hiện qua bốn chế độ: dashboard, list, calendar, table. Điều này làm cho Taskify giống một công cụ quản trị công việc linh hoạt hơn là chỉ một todo app đơn giản.

### 2. Optimistic update
Frontend có xu hướng cập nhật UI sớm rồi rollback nếu backend lỗi ở một số luồng, đặc biệt hữu ích trong chat và task actions. Điều này giúp trải nghiệm mượt hơn.

### 3. Chat page là bộ điều phối
Trang `ai/page.tsx` không chỉ hiển thị tin nhắn. Nó còn:
- quản lý session chat,
- mở dialog task,
- mở note editor,
- mở finance dialog,
- làm mới task/finance/category sau khi chat xong,
- hỗ trợ đọc phản hồi bằng giọng nói và nhập giọng nói.

### 4. Voice input và voice output
AI page dùng `use-speech-recognition` và `use-speech-synthesis`, cho thấy hệ thống hướng đến trải nghiệm trợ lý cá nhân chứ không chỉ form nhập text.

## Luồng chat ở frontend
1. Người dùng chọn hoặc tạo `ChatSession`.
2. `chat-session-store` thêm tin nhắn user theo kiểu optimistic.
3. Frontend gọi `chatApi.sendMessage`.
4. Backend trả danh sách message chuẩn hóa.
5. Frontend merge lại lịch sử, xóa temp message, có thể đọc phản hồi thành tiếng.
6. Nếu assistant trả `metadataJson` đặc biệt như delete result hoặc undo result, frontend hiển thị toast hành động.

## Dữ liệu vào/ra của frontend
| Đầu vào | Đầu ra |
| --- | --- |
| Tương tác chuột/bàn phím/giọng nói | Request tới backend |
| JWT token | Header auth |
| JSON response | Render UI, update store, mở dialog, hiển thị toast |

## Thành phần liên quan
- `taskifyView/app/login/page.tsx`, `signup/page.tsx`
- `taskifyView/app/(dashboard)/*`
- `taskifyView/components/*`
- `taskifyView/lib/*store.ts`
- `taskifyView/lib/api/*`

## Luồng xử lý frontend
1. User action phát sinh từ page hoặc component.
2. Store hoặc hook xử lý logic cục bộ.
3. `lib/api/*` gọi backend.
4. Response được chuyển thành state UI.
5. Component phản ánh trạng thái mới.

## Ràng buộc
- Frontend phụ thuộc vào JWT đã lưu đúng.
- Một số màn hình như admin chỉ có ý nghĩa nếu backend xác nhận role admin.
- Chat UI phụ thuộc cả backend chat lẫn các module dữ liệu liên quan.

## Tình huống lỗi
- `401` từ API sẽ xóa token và chuyển hướng về `/login`.
- Nếu chat gửi lỗi, optimistic message bị rollback.
- Nếu speech API của trình duyệt không hỗ trợ, tính năng voice sẽ bị hạn chế.

## Liên hệ file khác
- Để hiểu các API mà frontend gọi, đọc [`05_backend_api_xac_thuc_va_nghiep_vu.md`](C:\Users\HP PC\source\repos\Taskify\phan_tich_do_an\05_backend_api_xac_thuc_va_nghiep_vu.md).
- Để hiểu sâu nhất về chat page và metadata assistant, đọc [`06_he_thong_ai_chat_rasa_va_internal_api.md`](C:\Users\HP PC\source\repos\Taskify\phan_tich_do_an\06_he_thong_ai_chat_rasa_va_internal_api.md).
