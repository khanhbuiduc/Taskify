# Phân tích cách Rasa nhận diện Intent và Entity để tạo Task

## Tổng quan

Tài liệu này phân tích cách Rasa NLU hoạt động để nhận diện ý định (intent) và trích xuất thông tin (entities) từ tin nhắn người dùng khi tạo task trong Taskify.

---

## 1. Pipeline NLU (config.yml)

```
User Message → Tokenization → Featurization → Classification → Intent + Entities
```

### Các component trong pipeline:

| Component | Chức năng |
|-----------|-----------|
| **WhitespaceTokenizer** | Tách message thành các từ riêng lẻ |
| **RegexFeaturizer** | Nhận diện pattern (regex) được định nghĩa sẵn |
| **LexicalSyntacticFeaturizer** | Tạo features từ cấu trúc ngữ pháp (từ trước/sau, POS tags) |
| **CountVectorsFeaturizer** | Chuyển text thành vector số (bag-of-words) |
| **CountVectorsFeaturizer (char_wb)** | Tạo n-grams ký tự (1-4 chars) để xử lý từ chưa gặp/typos |
| **DIETClassifier** | **Bộ phận chính** - phân loại intent + trích xuất entity cùng lúc |
| **FallbackClassifier** | Nếu confidence < 0.7 → trả về `nlu_fallback` |

### Cấu hình hiện tại (config.yml):

```yaml
pipeline:
- name: WhitespaceTokenizer
- name: RegexFeaturizer
- name: LexicalSyntacticFeaturizer
- name: CountVectorsFeaturizer
- name: CountVectorsFeaturizer
  analyzer: char_wb
  min_ngram: 1
  max_ngram: 4
- name: DIETClassifier
  epochs: 100
  constrain_similarities: true
- name: EntitySynonymMapper
- name: ResponseSelector
  epochs: 100
- name: FallbackClassifier
  threshold: 0.7
  ambiguity_threshold: 0.1
```

---

## 2. Cách nhận diện Intent `create_task`

### Training Data (nlu.yml):

```yaml
- intent: create_task
  examples: |
    - Create a new task for tomorrow
    - I want to create a task
    - Add a new task
    - Create a task
    - New task
```

### Quy trình xử lý:

Khi user nhập: **"Create a task for my project"**

1. **Tokenize**: `["Create", "a", "task", "for", "my", "project"]`
2. **Featurize**: Tạo word vectors + character n-grams
3. **DIETClassifier**: So sánh với training data, tính confidence score cho mỗi intent
4. **Kết quả**: Intent = `create_task` (confidence: ~0.95)

### Story mapping (stories.yml):

```yaml
- story: create task
  steps:
  - intent: create_task
  - action: action_create_task
```

---

## 3. Entity Extraction - Trạng thái hiện tại

### Vấn đề:

Hiện tại, **chưa định nghĩa entities** trong NLU training data. Việc trích xuất thông tin task đang dùng **string manipulation** thủ công trong `actions.py`:

```python
# Cách hiện tại - không dùng entity extraction của Rasa
user_message = tracker.latest_message.get("text", "")

title = user_message
for phrase in ["create a task", "create task", "add a task", "add task", 
               "new task", "i want to", "please", "for tomorrow", "for today"]:
    title = title.lower().replace(phrase, "").strip()

# Nếu không tìm được title có nghĩa
if not title or len(title) < 3:
    dispatcher.utter_message(text="Please tell me the task title...")
    return []
```

### Hạn chế của cách làm hiện tại:

- Không linh hoạt với các cách diễn đạt khác nhau
- Phải maintain danh sách phrases thủ công
- Không extract được priority, due date chính xác
- Dễ lỗi với câu phức tạp

---

## 4. Cải thiện: Thêm Entity Extraction

### a) Cập nhật nlu.yml với annotated entities:

```yaml
- intent: create_task
  examples: |
    - Create a task [finish report](task_title) for [tomorrow](due_date)
    - Add [buy groceries](task_title) with [high](priority) priority
    - New task [call mom](task_title)
    - Create [meeting prep](task_title) due [next Monday](due_date)
    - I want to add a task [submit proposal](task_title) [urgent](priority)
    - Add a [low](priority) priority task [clean room](task_title)
    - Create task [review code](task_title) for [today](due_date)
    - New [high](priority) priority task [fix bug](task_title)
```

### b) Khai báo trong domain.yml:

```yaml
entities:
  - task_title
  - due_date
  - priority

slots:
  task_title:
    type: text
    influence_conversation: false
    mappings:
      - type: from_entity
        entity: task_title
  due_date:
    type: text
    influence_conversation: false
    mappings:
      - type: from_entity
        entity: due_date
  priority:
    type: categorical
    values:
      - low
      - medium
      - high
    influence_conversation: false
    mappings:
      - type: from_entity
        entity: priority
```

### c) Cập nhật action_create_task trong actions.py:

```python
class ActionCreateTask(Action):
    def name(self) -> Text:
        return "action_create_task"

    def run(self, dispatcher, tracker, domain):
        sender_id = tracker.sender_id
        
        # Lấy entities từ Rasa NLU (thay vì parse thủ công)
        task_title = tracker.get_slot("task_title")
        due_date_str = tracker.get_slot("due_date")
        priority = tracker.get_slot("priority") or "medium"
        
        # Parse due_date string to datetime
        due_date = self._parse_due_date(due_date_str)
        
        if not task_title:
            dispatcher.utter_message(
                text="What would you like to name this task?"
            )
            return []
        
        # Call API to create task
        payload = {
            "title": task_title,
            "description": "Created via AI assistant",
            "priority": priority,
            "dueDate": due_date.isoformat()
        }
        # ... rest of API call logic
```

---

## 5. Luồng hoạt động tổng thể

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER MESSAGE                                 │
│            "Create a task finish report for tomorrow"                │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RASA NLU PIPELINE                               │
│  1. Tokenize → ["Create", "a", "task", "finish", "report", ...]     │
│  2. Featurize → Word vectors + char n-grams                          │
│  3. DIETClassifier → Intent: create_task (conf: 0.95)                │
│                    → Entities: task_title="finish report"            │
│                                due_date="tomorrow"                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RASA DIALOGUE MANAGER                             │
│  - Kiểm tra stories.yml                                              │
│  - Story matched: create_task → action_create_task                   │
│  - Fill slots từ extracted entities                                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   ACTION_CREATE_TASK (actions.py)                    │
│  - tracker.get_slot("task_title") → "finish report"                 │
│  - tracker.get_slot("due_date") → "tomorrow"                        │
│  - Call TaskifyAPI: POST /api/internal/tasks/{userId}               │
│  - Return success message to user                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. DIETClassifier - Chi tiết kỹ thuật

**DIET** = **D**ual **I**ntent and **E**ntity **T**ransformer

### Kiến trúc:

- Sử dụng Transformer architecture
- Xử lý đồng thời Intent Classification + Entity Extraction
- Shared representation giúp cả 2 tasks hỗ trợ lẫn nhau

### Cách hoạt động:

```
Input: "Create task buy milk for tomorrow"

1. Token embeddings:
   [Create] [task] [buy] [milk] [for] [tomorrow]
   
2. Transformer layers:
   - Self-attention học context relationships
   - "buy milk" gần "task" → likely task_title
   - "tomorrow" sau "for" → likely due_date

3. Classification heads:
   - Intent head: softmax over all intents → create_task
   - Entity head: BIO tagging per token
     B-task_title I-task_title O B-due_date
     [buy]        [milk]       [for] [tomorrow]
```

---

## 7. Tóm tắt các thành phần

| Thành phần | File | Vai trò |
|------------|------|---------|
| **NLU Training Data** | `data/nlu.yml` | Định nghĩa intents + entity examples |
| **DIETClassifier** | `config.yml` | Model ML để classify intent & extract entities |
| **Domain** | `domain.yml` | Khai báo intents, entities, slots, actions |
| **Stories** | `data/stories.yml` | Mapping intent → action trong conversation |
| **Custom Actions** | `actions/actions.py` | Xử lý business logic, gọi API |
| **Rules** | `data/rules.yml` | Single-turn responses không cần context |

---

## 8. Checklist cải thiện

- [ ] Thêm annotated entities vào `nlu.yml`
- [ ] Khai báo entities và slots trong `domain.yml`
- [ ] Cập nhật `action_create_task` để dùng `tracker.get_slot()`
- [ ] Thêm date parsing utility cho due_date
- [ ] Thêm synonym mapping cho priority (urgent → high, etc.)
- [ ] Train lại model: `rasa train`
- [ ] Test với: `rasa shell` hoặc `rasa test`
