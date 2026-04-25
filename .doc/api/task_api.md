# Chuc nang API: Quan ly Cong viec (Task)

Tai lieu nay mo ta API Task hien tai trong `TaskifyAPI`.

## 1. Frontend API

| Chuc nang | Method | Endpoint | Mo ta |
| :--- | :--- | :--- | :--- |
| Lay danh sach | `GET` | `/api/TaskItem` | Ho tro filter + phan trang (dual mode). |
| Lay chi tiet | `GET` | `/api/TaskItem/{id}` | Lay 1 task theo ID. |
| Tao moi | `POST` | `/api/TaskItem` | Tao task moi, co the gan labels. |
| Cap nhat toan bo | `PUT` | `/api/TaskItem/{id}` | Cap nhat toan bo task. |
| Cap nhat trang thai | `PATCH` | `/api/TaskItem/{id}/status` | Cap nhat `status`. |
| Cap nhat han | `PATCH` | `/api/TaskItem/{id}/duedate` | Cap nhat `dueDate`, `dueTime`. |
| Xoa mem | `DELETE` | `/api/TaskItem/{id}` | Danh dau xoa mem (`IsDeleted=true`). |

## 2. GET /api/TaskItem - Query params

### Filter params
- `search` (string): tim trong `title`, `description`.
- `status` (string): `todo`, `in-progress`, `completed`.
- `priority` (string): `low`, `medium`, `high`.
- `labelId` (int): loc task co label ID tuong ung.
- `dueFrom` (datetime): loc `DueDate >= dueFrom`.
- `dueTo` (datetime): loc `DueDate <= dueTo`.

### Paging params
- `paged` (bool, mac dinh `false`): bat che do tra ve wrapper phan trang.
- `page` (int, mac dinh `1`): chi dung khi `paged=true`.
- `pageSize` (int, mac dinh `20`, toi da `100`): chi dung khi `paged=true`.

### Validation
- `dueFrom` phai nho hon hoac bang `dueTo`.
- `status`/`priority` sai gia tri -> `400 BadRequest`.

## 3. GET /api/TaskItem - Response shape (Dual mode)

### Mac dinh (`paged=false` hoac khong truyen)
- Response body la mang:
```json
[
  {
    "id": "1",
    "title": "Task A",
    "description": "Desc",
    "priority": "medium",
    "status": "todo",
    "dueDate": "2026-04-26T23:59:59",
    "createdAt": "2026-04-25",
    "labels": []
  }
]
```

### Paged mode (`paged=true`)
- Response body la object:
```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalCount": 0,
  "totalPages": 0,
  "hasPrevious": false,
  "hasNext": false
}
```

## 4. Quy tac du lieu

- Priority: `low`, `medium`, `high`.
- Status: `todo`, `in-progress`, `completed`.
- `dueDate` luu dang `yyyy-MM-ddTHH:mm:ss`.
- Neu khong truyen `dueTime` khi tao/sua han, he thong mac dinh `23:59:59`.

## 5. Internal API (AI/Rasa)

Van giu cac endpoint noi bo trong `InternalTaskController`:
- `/api/internal/tasks/{userId}` (GET): liet ke + thong ke task.
- `/api/internal/tasks/{userId}` (POST): tao nhanh task.
- Ho tro xoa nhieu + undo token.
- Bao mat qua header `X-Rasa-Token`.
