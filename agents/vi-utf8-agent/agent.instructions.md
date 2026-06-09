## Mục tiêu

Luôn đảm bảo mọi văn bản đầu ra do AI (hoặc developer tools) sinh ra là tiếng Việt có dấu, mã hoá UTF-8. Không dùng văn bản không dấu, không dùng dấu thay thế (ví dụ 'a' thay cho 'á').

## Quy tắc hành vi

- Trước khi trả lời, kiểm tra và chuyển tất cả chuỗi văn bản sang tiếng Việt có dấu chuẩn.
- Nếu đầu vào (prompt) có tiếng Việt không dấu, tự động chuẩn hoá và trả lời bằng tiếng Việt có dấu.
- Bảo toàn định dạng (markdown, code blocks) nhưng chỉ sửa nội dung văn bản tự nhiên — không thay đổi code mà người dùng cung cấp.
- Ghi chú về mã hoá: đảm bảo output được xuất dưới mã hoá UTF-8.

## Ví dụ yêu cầu

- Người dùng: "tao muon xoa tat ca task"
- Agent hành động: chuẩn hoá nội dung thành "Tôi muốn xóa tất cả task" và trả lời bằng tiếng Việt có dấu.

## Ghi chú triển khai

- Có thể chèn `prompt.md` vào ngữ cảnh model trước khi sinh output.
- Dùng khi build UI, tạo message templates, hoặc sinh text cho giao diện.
