# Chức năng API: Quản lý Tài chính (Finance)

Tài liệu này tổng hợp các chức năng mà API cung cấp để quản lý chi tiêu và danh mục tài chính.

## 1. Ghi chép chi tiêu (Finance Entries)

| Chức năng | Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- | :--- |
| **Danh sách chi tiêu** | `GET` | `/api/FinanceEntries` | Liệt kê các khoản chi (Hỗ trợ lọc theo ngày, danh mục, từ khóa). |
| **Xem chi tiết** | `GET` | `/api/FinanceEntries/{id}` | Lấy thông tin chi tiết một giao dịch. |
| **Thêm khoản chi** | `POST` | `/api/FinanceEntries` | Ghi lại một khoản chi mới (Yêu cầu Danh mục hợp lệ). |
| **Sửa giao dịch** | `PUT` | `/api/FinanceEntries/{id}` | Cập nhật số tiền, ngày hoặc mô tả. |
| **Xóa giao dịch** | `DELETE` | `/api/FinanceEntries/{id}` | Loại bỏ một bản ghi chi tiêu. |
| **Báo cáo tổng hệ** | `GET` | `/api/FinanceEntries/summary`| Trả về tổng chi, số lượng giao dịch, trung bình và biểu đồ hàng ngày. |

---

## 2. Quản lý Danh mục (Finance Categories)

Để đảm bảo tính nhất quán, người dùng quản lý các nhóm chi tiêu (ví dụ: Ăn uống, Di chuyển, Shopping) qua các API sau:

| Chức năng | Phương thức | Endpoint |
| :--- | :--- | :--- |
| **Lấy danh sách nhóm**| `GET` | `/api/FinanceCategories` |
| **Thêm nhóm mới** | `POST` | `/api/FinanceCategories` |
| **Xóa nhóm** | `DELETE` | `/api/FinanceCategories/{id}` |

---

## 3. Các quy tắc nghiệp vụ (Business Rules)

- **Kiểm tra danh mục**: Khi thêm hoặc sửa một khoản chi (`FinanceEntry`), API sẽ kiểm tra xem `Category` đó có tồn tại trong danh sách `FinanceCategories` của người dùng hay không. Nếu không, yêu cầu sẽ bị từ chối (400 Bad Request).
- **Tính toán báo cáo Summary**:
    - Có thể lọc theo khoảng thời gian (`from`, `to`).
    - Có thể lọc theo danh mục cụ thể để xem chi tiết chi tiêu của nhóm đó.
    - Cung cấp dữ liệu `DailyTotals` - danh sách số tiền tổng theo từng ngày, dùng để vẽ biểu đồ line/bar ở frontend.
- **Số tiền**: Chỉ chấp nhận giá trị dương (> 0).
