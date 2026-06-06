# Tổng quan nghiệp vụ và phạm vi hệ thống Taskify

## Mục tiêu của tài liệu này
Tài liệu này mô tả Taskify dưới góc nhìn sản phẩm và nghiệp vụ: hệ thống giải quyết bài toán gì, người dùng nào tham gia, các phân hệ hiện có và phạm vi mà hệ thống đang bao phủ.

## Tại sao phần này quan trọng
Khi viết Word hoặc luận văn, phần đầu thường cần trả lời câu hỏi “hệ thống này sinh ra để làm gì”. Nếu không chốt phần này trước, các phần kiến trúc và API phía sau sẽ bị rời rạc.

## Bài toán hệ thống giải quyết
Taskify được xây dựng để hỗ trợ người dùng quản lý công việc cá nhân theo nhiều góc nhìn thay vì chỉ một danh sách đơn giản. Hệ thống giải quyết đồng thời các nhu cầu sau:

- Theo dõi task với mức ưu tiên, trạng thái và hạn xử lý.
- Xem cùng một tập task qua nhiều chế độ: dashboard, list, calendar, table.
- Quản lý ghi chú cá nhân song song với task.
- Ghi nhận và tổng hợp dữ liệu tài chính cá nhân.
- Theo dõi phiên tập trung và mục tiêu trong ngày.
- Tương tác với hệ thống bằng ngôn ngữ tự nhiên thông qua AI chat.
- Cung cấp khu vực quản trị người dùng cho quản trị viên.

## Vai trò người dùng
| Vai trò | Mục đích sử dụng | Quyền chính |
| --- | --- | --- |
| `User` | Người dùng cuối của hệ thống | Quản lý dữ liệu cá nhân: task, note, finance, focus, chat |
| `Admin` | Người quản trị | Có thêm quyền xem/quản lý người dùng và quản trị tài khoản |

## Các phân hệ hiện có
| Phân hệ | Mục tiêu nghiệp vụ | Tình trạng tổng quát |
| --- | --- | --- |
| Auth | Đăng ký, đăng nhập, lấy thông tin người dùng, cập nhật hồ sơ | Hoàn chỉnh ở mức ứng dụng nội bộ |
| Task | Quản lý công việc đa góc nhìn | Là phân hệ trung tâm và hoàn chỉnh nhất |
| Note | Ghi chú cá nhân | Hoạt động ổn định, tích hợp với AI chat |
| Finance | Ghi nhận thu chi và thống kê | Hoàn chỉnh ở mức cá nhân, có category và summary |
| Focus | Theo dõi phiên tập trung và thống kê tập trung | Hoạt động như phân hệ hỗ trợ năng suất |
| Daily Goal | Theo dõi mục tiêu trong ngày | Phân hệ nhỏ hỗ trợ focus |
| AI Chat | Giao tiếp tự nhiên với hệ thống | Là phân hệ nổi bật, kết nối Rasa và internal API |
| Admin | Quản trị người dùng | Chỉ dành cho admin |
| Settings | Cấu hình AI như Gemini/Ollama | Phục vụ AI fallback và cá nhân hóa |

## Phân hệ nào là trọng tâm
- Trọng tâm nghiệp vụ: `Task`, `AI Chat`.
- Phân hệ bổ trợ mạnh: `Note`, `Finance`, `Focus`.
- Phân hệ quản trị: `Auth`, `Admin`, `Settings`.
- Phân hệ hỗ trợ thói quen: `Daily Goal`.

## Giá trị nổi bật của Taskify
1. Cùng một dữ liệu task nhưng hiển thị qua nhiều góc nhìn để phù hợp nhiều cách làm việc.
2. Chatbot không chỉ phản hồi văn bản mà có thể tạo, tìm, xóa hoặc cập nhật dữ liệu thật.
3. Hệ thống lưu lịch sử hội thoại thành `ChatSession` và `ChatMessage`, cho phép theo dõi ngữ cảnh chat.
4. Có cơ chế `AI fallback` để mở rộng khả năng xử lý khi cần nhà cung cấp AI ngoài Rasa.

## Phạm vi nghiệp vụ hiện tại
### Trong phạm vi
- Quản lý dữ liệu cá nhân theo user ownership.
- Xác thực JWT.
- Quản trị người dùng theo role.
- Chat tiếng Việt và tiếng Anh ở mức lệnh/task-note-finance phổ biến.
- Soft delete cho task và hỗ trợ undo trong một số luồng.

### Ngoài phạm vi hoặc chưa thấy hoàn thiện mạnh
- Cộng tác nhóm nhiều người trên cùng một task/project.
- Workflow phê duyệt hoặc phân công liên phòng ban.
- Đồng bộ thời gian thực đa client.
- Tích hợp email, calendar ngoài hệ thống, hoặc notification server-side nâng cao.
- AI tổng quát cấp doanh nghiệp hoặc tri thức ngoài phạm vi dữ liệu cá nhân.

## Thành phần liên quan
- `taskifyView/app/(dashboard)/*`: các màn hình nghiệp vụ.
- `TaskifyAPI/Controllers/*`: lớp API cho từng phân hệ.
- `rasa/actions/*`: xử lý chat và hành động hội thoại.

## Luồng xử lý ở mức nghiệp vụ
1. Người dùng đăng nhập để lấy quyền truy cập.
2. Người dùng thao tác trực tiếp trên các module hoặc đi qua màn hình AI.
3. Dữ liệu cá nhân được lưu riêng theo `UserId`.
4. Khi chat, hệ thống chuyển câu nói tự nhiên thành intent, entity và hành động cụ thể.
5. Kết quả thao tác được phản hồi lại cho người dùng dưới dạng UI hoặc tin nhắn.

## Dữ liệu vào/ra
- Đầu vào chính: câu lệnh người dùng, dữ liệu form, token JWT.
- Đầu ra chính: task, note, finance entries, thống kê focus, lịch sử chat, dữ liệu người dùng.

## Ràng buộc
- Hầu hết dữ liệu mang tính cá nhân, phải gắn chặt với `UserId`.
- Admin có quyền rộng hơn nhưng vẫn đi qua backend authorization.
- AI chat không trực tiếp truy cập database, mà phải đi qua `TaskifyAPI`.

## Tình huống lỗi
- Người dùng không có JWT hoặc token hết hạn sẽ bị chuyển về đăng nhập.
- Nếu Rasa hoặc action server không sẵn sàng, AI chat chỉ hoạt động hạn chế hoặc trả lời fallback.
- Nếu category tài chính không tồn tại, hệ thống chặn tạo bản ghi tài chính từ public API.

## Liên hệ file khác
- Để hiểu hệ thống được chia tầng như thế nào, đọc [`02_kien_truc_tong_the_va_thanh_phan.md`](C:\Users\HP PC\source\repos\Taskify\phan_tich_do_an\02_kien_truc_tong_the_va_thanh_phan.md).
- Để xem các kịch bản nghiệp vụ đầy đủ, đọc [`07_luong_nghiep_vu_chinh_theo_kich_ban.md`](C:\Users\HP PC\source\repos\Taskify\phan_tich_do_an\07_luong_nghiep_vu_chinh_theo_kich_ban.md).
