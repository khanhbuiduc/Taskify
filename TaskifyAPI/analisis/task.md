# Phân tích API Task - TaskifyAPI

## Tổng quan

API Task là phần core của hệ thống Taskify, cung cấp các chức năng CRUD cho việc quản lý công việc. API được chia thành 2 controller:

1. **TaskItemController** - API công khai cho người dùng (yêu cầu JWT authentication)
2. **InternalTaskController** - API nội bộ cho Rasa chatbot (yêu cầu API key)

---

## 1. Model TaskItem

### Entity (TaskItem.cs):

```csharp
public class TaskItem
{
    public int Id { get; set; }              // Primary key
    public string Title { get; set; }         // Max 200 ký tự
    public string Description { get; set; }   // Max 4000 ký tự
    public TaskPriority Priority { get; set; } // Low, Medium, High
    public TaskItemStatus Status { get; set; } // Todo, InProgress, Completed
    public DateTime DueDate { get; set; }      // Ngày hết hạn
    public DateTime CreatedAt { get; set; }    // Ngày tạo
    public string UserId { get; set; }         // Foreign key đến ApplicationUser
}
```

### Enums:

| Enum | Giá trị | Mô tả |
|------|---------|-------|
| **TaskPriority** | `Low (0)`, `Medium (1)`, `High (2)` | Mức độ ưu tiên |
| **TaskItemStatus** | `Todo (0)`, `InProgress (1)`, `Completed (2)` | Trạng thái công việc |

---

## 2. TaskItemController - API công khai

**Base URL:** `/api/TaskItem`  
**Authentication:** JWT Bearer Token (required)  
**Authorization:** Role-based (Admin/User)

### Endpoints:

| Method | Endpoint | Chức năng | Authorization |
|--------|----------|-----------|---------------|
| `GET` | `/api/TaskItem` | Lấy tất cả tasks | Admin: all, User: own tasks |
| `GET` | `/api/TaskItem/{id}` | Lấy task theo ID | Admin: any, User: own only |
| `POST` | `/api/TaskItem` | Tạo task mới | Authenticated user |
| `PUT` | `/api/TaskItem/{id}` | Cập nhật toàn bộ task | Admin: any, User: own only |
| `PATCH` | `/api/TaskItem/{id}/status` | Cập nhật status | Admin: any, User: own only |
| `PATCH` | `/api/TaskItem/{id}/duedate` | Cập nhật due date | Admin: any, User: own only |
| `DELETE` | `/api/TaskItem/{id}` | Xóa task | Admin: any, User: own only |

---

### 2.1 GET /api/TaskItem - Lấy tất cả tasks

**Response:** `List<TaskItemResponseDto>`

```json
[
  {
    "id": "1",
    "title": "Complete report",
    "description": "Finish quarterly report",
    "priority": "high",
    "status": "in-progress",
    "dueDate": "2026-02-10T23:59:59",
    "createdAt": "2026-02-09"
  }
]
```

**Logic:**
- Admin: Trả về tất cả tasks trong hệ thống
- User: Chỉ trả về tasks của chính họ
- Sắp xếp theo `DueDate` tăng dần

---

### 2.2 GET /api/TaskItem/{id} - Lấy task theo ID

**Response:** `TaskItemResponseDto`

**Error cases:**
- `404 Not Found`: Task không tồn tại
- `403 Forbidden`: User không có quyền truy cập task của người khác

---

### 2.3 POST /api/TaskItem - Tạo task mới

**Request Body:** `CreateTaskItemDto`

```json
{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread",
  "priority": "medium",
  "status": "todo",
  "dueDate": "2026-02-15",
  "dueTime": "18:00"  // Optional - nếu null thì mặc định 23:59:59
}
```

**Response:** `201 Created` với `TaskItemResponseDto`

**Logic:**
- Tự động gán `UserId` = current user
- Tự động set `CreatedAt` = UTC now
- Parse `dueDate` + `dueTime` thành `DateTime`

---

### 2.4 PUT /api/TaskItem/{id} - Cập nhật toàn bộ task

**Request Body:** `UpdateTaskItemDto`

```json
{
  "title": "Buy groceries (updated)",
  "description": "Milk, eggs, bread, butter",
  "priority": "high",
  "status": "in-progress",
  "dueDate": "2026-02-16",
  "dueTime": "12:00"
}
```

**Response:** `200 OK` với updated `TaskItemResponseDto`

---

### 2.5 PATCH /api/TaskItem/{id}/status - Cập nhật status

**Request Body:** `UpdateTaskStatusDto`

```json
{
  "status": "completed"
}
```

**Giá trị hợp lệ:** `todo`, `in-progress`, `completed`

---

### 2.6 PATCH /api/TaskItem/{id}/duedate - Cập nhật due date

**Request Body:** `UpdateTaskDueDateDto`

```json
{
  "dueDate": "2026-02-20",
  "dueTime": "09:00"
}
```

---

### 2.7 DELETE /api/TaskItem/{id} - Xóa task

**Response:** `204 No Content`

---

## 3. InternalTaskController - API cho Rasa

**Base URL:** `/api/internal/tasks`  
**Authentication:** API Key via `X-Rasa-Token` header

### Mục đích:
Cho phép Rasa action server truy cập và tạo tasks cho users qua chatbot.

### Endpoints:

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| `GET` | `/api/internal/tasks/{userId}` | Lấy tasks của user + thống kê |
| `POST` | `/api/internal/tasks/{userId}` | Tạo task mới cho user |

---

### 3.1 GET /api/internal/tasks/{userId}

**Response:** `InternalTaskListResponse`

```json
{
  "tasks": [
    {
      "id": 1,
      "title": "Complete report",
      "description": "...",
      "priority": "high",
      "status": "in-progress",
      "dueDate": "2026-02-10T23:59:59",
      "createdAt": "2026-02-09T10:00:00",
      "isOverdue": false
    }
  ],
  "totalCount": 5,
  "overdueCount": 1,
  "completedThisWeek": 3,
  "pendingCount": 2,
  "highPriorityCount": 1
}
```

**Thống kê bao gồm:**
- `totalCount`: Tổng số tasks
- `overdueCount`: Số tasks quá hạn (chưa hoàn thành)
- `completedThisWeek`: Số tasks hoàn thành trong tuần này
- `pendingCount`: Số tasks đang pending (todo + in-progress)
- `highPriorityCount`: Số tasks priority cao chưa hoàn thành

---

### 3.2 POST /api/internal/tasks/{userId}

**Request Body:** `InternalCreateTaskDto`

```json
{
  "title": "New task from chatbot",
  "description": "Created via AI assistant",
  "priority": "medium",
  "dueDate": "2026-02-10T23:59:00"
}
```

**Response:** `201 Created` với `InternalTaskDto`

---

## 4. TaskRepository - Data Access Layer

### Interface ITaskRepository:

| Method | Mô tả |
|--------|-------|
| `GetByStatusAsync(status)` | Lấy tasks theo status |
| `GetByPriorityAsync(priority)` | Lấy tasks theo priority |
| `GetOverdueTasksAsync(date)` | Lấy tasks quá hạn |
| `GetAllOrderedByDueDateAsync()` | Lấy tất cả, sắp xếp theo due date |
| `GetAllOrderedByDueDateAsync(userId)` | Lấy theo user, sắp xếp theo due date |
| `GetByUserIdAsync(userId)` | Lấy tasks của user cụ thể |

### Kế thừa từ Repository<T>:

| Method | Mô tả |
|--------|-------|
| `GetAllAsync()` | Lấy tất cả entities |
| `GetByIdAsync(id)` | Lấy entity theo ID |
| `AddAsync(entity)` | Thêm entity mới |
| `Update(entity)` | Cập nhật entity |
| `Remove(entity)` | Xóa entity |

---

## 5. DTOs (Data Transfer Objects)

### Request DTOs:

| DTO | Sử dụng cho | Fields |
|-----|-------------|--------|
| `CreateTaskItemDto` | POST /api/TaskItem | title, description, priority, status, dueDate, dueTime |
| `UpdateTaskItemDto` | PUT /api/TaskItem/{id} | title, description, priority, status, dueDate, dueTime |
| `UpdateTaskStatusDto` | PATCH .../status | status |
| `UpdateTaskDueDateDto` | PATCH .../duedate | dueDate, dueTime |
| `InternalCreateTaskDto` | POST /api/internal/... | title, description, priority, dueDate |

### Response DTOs:

| DTO | Response từ | Fields |
|-----|-------------|--------|
| `TaskItemResponseDto` | TaskItemController | id, title, description, priority, status, dueDate, createdAt |
| `InternalTaskDto` | InternalTaskController | id, title, description, priority, status, dueDate, createdAt, isOverdue |
| `InternalTaskListResponse` | GET /api/internal/... | tasks[], totalCount, overdueCount, completedThisWeek, pendingCount, highPriorityCount |

---

## 6. Luồng hoạt động

### 6.1 Tạo task từ Frontend:

```
┌─────────────┐     POST /api/TaskItem     ┌──────────────────┐
│   Frontend  │ ─────────────────────────► │ TaskItemController│
│  (Next.js)  │    + JWT Token             │                  │
└─────────────┘                            └────────┬─────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │  TaskRepository  │
                                           │  (AddAsync)      │
                                           └────────┬─────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │    Database      │
                                           │ (TaskItems table)│
                                           └──────────────────┘
```

### 6.2 Tạo task từ Rasa Chatbot:

```
┌─────────────┐   User message    ┌──────────────┐
│    User     │ ────────────────► │     Rasa     │
│             │                   │  NLU + Core  │
└─────────────┘                   └──────┬───────┘
                                         │ intent: create_task
                                         ▼
                               ┌──────────────────┐
                               │ action_create_task│
                               │  (actions.py)    │
                               └────────┬─────────┘
                                        │ POST /api/internal/tasks/{userId}
                                        │ + X-Rasa-Token header
                                        ▼
                               ┌──────────────────┐
                               │InternalTaskController│
                               └────────┬─────────┘
                                        │
                                        ▼
                               ┌──────────────────┐
                               │    Database      │
                               └──────────────────┘
```

---

## 7. Security

### Authentication:

| Controller | Method |
|------------|--------|
| TaskItemController | JWT Bearer Token (`[Authorize]` attribute) |
| InternalTaskController | API Key (`X-Rasa-Token` header) |

### Authorization Rules:

| Role | Quyền hạn |
|------|-----------|
| **Admin** | CRUD tất cả tasks trong hệ thống |
| **User** | CRUD chỉ tasks của chính mình |

### API Key Configuration:

```json
// appsettings.json
{
  "Rasa": {
    "ApiKey": "rasa-internal-api-key-taskify-2026"
  }
}
```

---

## 8. Validation

### Title:
- Required
- Max 200 ký tự

### Description:
- Optional
- Max 4000 ký tự

### Priority:
- Required
- Giá trị hợp lệ: `low`, `medium`, `high`
- Default: `medium`

### Status:
- Required
- Giá trị hợp lệ: `todo`, `in-progress`, `completed`
- Default: `todo`

### DueDate:
- Required
- Format: `yyyy-MM-dd`

### DueTime:
- Optional
- Format: `HH:mm`
- Default: `23:59:59` nếu không cung cấp

---

## 9. Tính năng nổi bật

| Tính năng | Mô tả |
|-----------|-------|
| **Role-based Access Control** | Admin vs User permissions |
| **Partial Updates** | PATCH endpoints cho status và duedate riêng |
| **Flexible Due Time** | Hỗ trợ thời gian cụ thể hoặc mặc định cuối ngày |
| **Overdue Detection** | Tự động tính toán tasks quá hạn |
| **Statistics** | API internal cung cấp thống kê cho chatbot |
| **Rasa Integration** | API riêng cho AI chatbot với API key auth |
| **Sorted Results** | Tasks luôn được sắp xếp theo due date |

---

## 10. Cải tiến tiềm năng

- [ ] Thêm pagination cho GET all tasks
- [ ] Thêm filtering (by status, priority, date range)
- [ ] Thêm search by title/description
- [ ] Thêm soft delete thay vì hard delete
- [ ] Thêm task categories/tags
- [ ] Thêm recurring tasks
- [ ] Thêm task assignments (multiple users)
- [ ] Thêm subtasks
- [ ] Thêm comments/notes trên task
- [ ] Thêm file attachments
