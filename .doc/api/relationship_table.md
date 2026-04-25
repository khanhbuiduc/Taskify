# Bảng Quan Hệ Thực Thể (Entity Relationship)

Tài liệu này mô tả cấu trúc các bảng và mối quan hệ giữa chúng trong hệ thống Taskify. (Lưu ý: Đã loại bỏ phần Dotnet Identity Core và thông tin người dùng theo yêu cầu).

## 1. Sơ đồ các Thực thể chính

| Thực thể | Mô tả | Mối quan hệ |
| :--- | :--- | :--- |
| **TaskItem** | Lưu trữ thông tin công việc cần làm. | Nhiều-Nhiều với **Label** |
| **Label** | Thẻ phân loại cho công việc. | Nhiều-Nhiều với **TaskItem** |
| **Note** | Ghi chú cá nhân. | Độc lập |
| **FinanceEntry** | Ghi chép chi tiêu tài chính. | Độc lập (Liên kết logic qua Category Name) |
| **FinanceCategory** | Danh mục tài chính người dùng định nghĩa. | Độc lập (Dùng để gợi ý/kiểm tra cho FinanceEntry) |
| **DailyGoal** | Mục tiêu ngắn hạn trong ngày. | Độc lập |
| **FocusSession** | Phiên làm việc tập trung (Pomodoro). | Độc lập |

---

## 2. Chi tiết cấu trúc Bảng

### A. Công tác & Thẻ (Tasks & Labels)

#### Bảng: `TaskItems`
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| **Id** | int (PK) | Định danh duy nhất |
| **Title** | string(200) | Tiêu đề công việc |
| **Description** | string(4000) | Mô tả chi tiết |
| **Priority** | enum | Độ ưu tiên (Low, Medium, High) |
| **Status** | enum | Trạng thái (Todo, InProgress, Completed) |
| **DueDate** | DateTime | Thời hạn hoàn thành |
| **CreatedAt** | DateTime | Thời gian tạo |
| **IsDeleted** | bool | Cờ xóa mềm (Soft delete) |
| **DeletedAt** | DateTime? | Thời gian xóa |

#### Bảng: `Labels`
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| **Id** | int (PK) | Định danh duy nhất |
| **Name** | string(60) | Tên nhãn |
| **Color** | string(20) | Mã màu (Hex hoặc tên màu) |

> **Mối quan hệ**: `TaskItem` và `Label` có mối quan hệ **Nhiều-Nhiều**. Một Task có thể gắn nhiều Nhãn và một Nhãn có thể thuộc về nhiều Task.

---

### B. Ghi chú (Notes)

#### Bảng: `Notes`
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| **Id** | int (PK) | Định danh duy nhất |
| **Title** | string(200) | Tiêu đề ghi chú |
| **Content** | string(4000) | Nội dung ghi chú |
| **IsPinned** | bool | Cờ ghim ghi chú lên đầu |
| **CreatedAt** | DateTime | Thời gian tạo |
| **UpdatedAt** | DateTime | Thời gian cập nhật cuối |

---

### C. Tài chính (Finance)

#### Bảng: `FinanceEntries`
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| **Id** | int (PK) | Định danh duy nhất |
| **Date** | DateTime | Ngày chi tiêu |
| **Category** | string(60) | Tên danh mục chi tiêu |
| **Description** | string(500) | Ghi chú chi tiêu |
| **Amount** | decimal(18,2) | Số tiền |

#### Bảng: `FinanceCategories`
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| **Id** | int (PK) | Định danh duy nhất |
| **Name** | string(60) | Tên danh mục (Dùng để đối chiếu với FinanceEntry) |

---

### D. Tiện ích khác

#### Bảng: `DailyGoals`
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| **Id** | int (PK) | Định danh duy nhất |
| **Title** | string(500) | Nội dung mục tiêu |
| **IsCompleted** | bool | Trạng thái hoàn thành |

#### Bảng: `FocusSessions`
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| **Id** | int (PK) | Định danh duy nhất |
| **DurationMinutes** | int | Thời lượng phiên (phút) |
| **BreaksTaken** | int | Số lần nghỉ giải lao |
| **IsCompleted** | bool | Hoàn thành phiên hay kết thúc sớm |
| **StartedAt** | DateTime | Thời gian bắt đầu |
| **EndedAt** | DateTime? | Thời gian kết thúc |
