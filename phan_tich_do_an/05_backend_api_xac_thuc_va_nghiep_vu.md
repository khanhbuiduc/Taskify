# Backend API, xác thực và nghiệp vụ của Taskify

## Mục tiêu của tài liệu này
Tài liệu này mô tả lớp backend `TaskifyAPI`: cách xác thực hoạt động, các nhóm controller chính, các quy tắc nghiệp vụ và mối liên hệ giữa API với dữ liệu hệ thống.

## Tại sao phần này quan trọng
Frontend và AI đều phải đi qua backend để tác động lên hệ thống thật. Vì vậy, backend là nơi thể hiện rõ nhất các ràng buộc về quyền truy cập, tính hợp lệ dữ liệu và luồng nghiệp vụ chính thức.

## Nền tảng backend
- Framework: ASP.NET Core 8.
- ORM: Entity Framework Core.
- Auth: ASP.NET Core Identity + JWT Bearer.
- Tổ chức truy cập dữ liệu: Repository Pattern + Unit of Work.
- JSON: enum được serialize dưới dạng string.

## Cơ chế xác thực và phân quyền
| Thành phần | Vai trò |
| --- | --- |
| JWT | Xác thực người dùng giữa frontend và backend |
| Identity | Quản lý user, password, role |
| Authorization policies | Phân tách `AdminOnly`, `UserOnly`, `AdminOrUser` |
| Claim `NameIdentifier` | Xác định `UserId` hiện tại |

### Vòng đời JWT
1. User gọi `register` hoặc `login`.
2. Backend kiểm tra thông tin và sinh JWT.
3. Frontend lưu token ở client.
4. Các request sau đó kèm `Authorization: Bearer {token}`.
5. Khi token hết hạn hoặc user bị ban, backend từ chối.

## Nhóm controller công khai
| Controller | Mục đích | Quyền |
| --- | --- | --- |
| `AuthController` | Đăng ký, đăng nhập, `me`, cập nhật profile, logout | Public cho login/register, JWT cho phần còn lại |
| `TaskItemController` | CRUD task, filter, paging, status update | JWT, có owner check, admin có thể rộng hơn |
| `NotesController` | CRUD ghi chú | JWT, owner-based |
| `FinanceEntriesController` | CRUD khoản thu chi và summary | JWT, owner-based |
| `FinanceCategoriesController` | CRUD category tài chính | JWT, owner-based |
| `FocusSessionController` | Start/end/list/stats focus session | JWT, owner-based |
| `DailyGoalController` | CRUD goal hằng ngày và clear completed | JWT, owner-based |
| `AdminUsersController` | Quản trị người dùng | `AdminOnly` |
| `GeminiSettingsController` | Lưu/xóa/truy vấn Gemini API key | JWT |
| `AiFallbackSettingsController` | Chọn provider fallback, cấu hình Ollama | JWT |
| `ChatController` | Session chat, message thread, gửi chat | JWT |

## Quy tắc nghiệp vụ theo nhóm
### `AuthController`
- Đăng ký tạo user mới với role mặc định `User`.
- Email phải unique.
- Password tuân theo policy của Identity.
- `GetCurrentUser` trả dữ liệu user đang đăng nhập.
- `UpdateProfile` cho phép sửa tên hiển thị và avatar.

### `TaskItemController`
- User thường chỉ thao tác trên task của chính mình.
- Admin có thể xem rộng hơn tùy endpoint.
- Hỗ trợ filter theo status, priority, label, search, due date.
- Hỗ trợ `paged` và non-paged mode.
- Có cập nhật riêng cho status.
- Task hỗ trợ soft delete và liên kết với label.

### `NotesController`
- Note luôn thuộc về một user.
- Hỗ trợ search, filter pinned, paging.
- Có patch pin/unpin.

### `FinanceEntriesController`
- Tạo hoặc sửa entry cần category hợp lệ ở public API.
- `amount` phải lớn hơn 0.
- Có API summary trả total, count, average, dailyTotals.

### `FinanceCategoriesController`
- Category name không được trống.
- Không cho trùng trong cùng user.
- Đổi tên category sẽ cập nhật category name đang dùng trong finance entries.
- Không cho xóa category đang còn được sử dụng.

### `FocusSessionController`
- Cho phép start session, end session, lấy sessions hôm nay, lấy stats.
- Stats gồm số phiên, số phút, số break theo ngày và tuần.

### `DailyGoalController`
- Mục tiêu gắn với user hiện tại.
- Có thể toggle hoàn thành.
- Có API xóa toàn bộ mục tiêu hoàn thành trong ngày.

### `AdminUsersController`
- Chỉ admin truy cập.
- Có filter theo role, status, search.
- Có thể tạo, sửa, ban/bỏ ban user theo logic hiện có.
- Không cho admin tự hạ quyền mình nếu gây mất admin cuối cùng đang hoạt động.

### `GeminiSettingsController`
- Cho phép lưu API key Gemini theo user.
- Khi lưu sẽ validate key.
- Xóa key có thể kéo theo việc vô hiệu hóa provider fallback hiện tại.

### `AiFallbackSettingsController`
- Trả cấu hình fallback hiện tại.
- Cho phép chọn provider `Gemini` hoặc `Ollama`.
- Cho phép load danh sách model Ollama từ base URL.
- Lưu hoặc xóa cấu hình Ollama.

## `ChatController` là điểm nối đặc biệt
`ChatController` không chỉ là API gửi nhận text. Đây là controller trung tâm của phân hệ AI chat:

1. Lấy danh sách `ChatSession` của user.
2. Lấy messages theo session với phân trang.
3. Tự tạo session nếu chưa có khi user gửi tin đầu tiên.
4. Lưu `ChatMessage` của user vào database.
5. Gọi `AiFallbackService.NormalizeContextAsync` để chuẩn hóa ngữ cảnh.
6. Gọi `RasaChatService.ParseIntentAsync` để phân tích ý định.
7. Gọi `RasaChatService.SendMessageAsync` để đẩy sang Rasa.
8. Lưu assistant messages trả về.
9. Trả lại thread response cho frontend.

## Dữ liệu vào/ra điển hình
| Nhóm | Đầu vào | Đầu ra |
| --- | --- | --- |
| Auth | email, password, profile data | token, user info |
| Task | create/update/filter params | task DTO, paged result |
| Notes | title, content, pinned | note DTO |
| Finance | date, category, amount | entry DTO, summary DTO |
| Focus | duration, completion info | focus session DTO, stats DTO |
| Chat | sessionId, message, metadataJson | session + messages |

## Thành phần liên quan
- `TaskifyAPI/Program.cs`
- `TaskifyAPI/Controllers/*`
- `TaskifyAPI/Repositories/*`
- `TaskifyAPI/Services/*`

## Luồng xử lý backend
1. Backend nhận request.
2. Middleware auth kiểm tra token.
3. Controller lấy `UserId` từ claim.
4. Controller kiểm tra quyền và điều kiện dữ liệu.
5. Repository/DbContext truy cập database.
6. DTO response trả về frontend hoặc action server.

## Ràng buộc
- Backend là nguồn chân lý duy nhất cho dữ liệu thật.
- Phần lớn controller đều kiểm tra ownership ở mức user.
- Public API và internal API có cơ chế bảo vệ khác nhau.

## Tình huống lỗi
- `400`: dữ liệu không hợp lệ, category sai, role sai, provider sai.
- `401`: không có token hoặc token không hợp lệ.
- `403`: user không có quyền với tài nguyên.
- `404`: tài nguyên không tồn tại hoặc không thuộc owner.
- `502` hoặc fallback message: lỗi từ nhà cung cấp AI ngoài hoặc Rasa.

## Liên hệ file khác
- Để xem các entity mà backend thao tác, đọc [`03_du_lieu_va_mo_hinh_mien_nghiep_vu.md`](C:\Users\HP PC\source\repos\Taskify\phan_tich_do_an\03_du_lieu_va_mo_hinh_mien_nghiep_vu.md).
- Để xem riêng chuỗi xử lý chat, đọc [`06_he_thong_ai_chat_rasa_va_internal_api.md`](C:\Users\HP PC\source\repos\Taskify\phan_tich_do_an\06_he_thong_ai_chat_rasa_va_internal_api.md).
