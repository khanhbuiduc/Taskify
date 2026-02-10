# Plan: Improve CreateTask with Entity Extraction

## Overview

This plan outlines the steps to improve the CreateTask functionality by replacing manual string parsing with Rasa's native entity extraction capabilities.

---

## Current Problems

| Issue | Impact |
|-------|--------|
| Manual string parsing in `actions.py` | Hard to maintain, error-prone |
| No entity definitions | Cannot extract task_title, due_date, priority reliably |
| Hardcoded phrase removal | Fails with varied user expressions |
| No slot management | Cannot handle multi-turn conversations for missing info || No time extraction | Cannot handle "trước 16h", "lúc 3pm" |
| Trigger phrases used as title | "tạo task" becomes task title instead of prompting for info |
| No Vietnamese support | Cannot understand "thêm nhiệm vụ", "hạn ngày mai" |
---

## Implementation Plan

### Phase 1: Update NLU Training Data (nlu.yml)

**Goal:** Add annotated entity examples for DIETClassifier to learn

**Tasks:**
- [ ] Add `[entity_value](entity_name)` annotations to existing examples
- [ ] Add more diverse examples covering different patterns
- [ ] Include variations for task_title, due_date, and priority

**Example changes:**
```yaml
- intent: create_task
  examples: |
    # English examples
    - Create a task [finish report](task_title) for [tomorrow](due_date)
    - Add [buy groceries](task_title) with [high](priority) priority
    - New task [call mom](task_title)
    - Create [meeting prep](task_title) due [next Monday](due_date)
    - I want to add a task [submit proposal](task_title) [urgent](priority)
    - Add a [low](priority) priority task [clean room](task_title)
    - Create task [review code](task_title) for [today](due_date)
    - New [high](priority) priority task [fix bug](task_title)
    - [Write documentation](task_title) task with [medium](priority) priority
    - Schedule [team standup](task_title) for [next week](due_date)
    - Create task [send email](task_title) by [3pm](due_time)
    - Add [meeting](task_title) at [14:00](due_time)
    
    # Vietnamese examples with time extraction
    - thêm nhiệm vụ [học thuộc sql interview](task_title) trước [16h](due_time)
    - tạo task [hoàn thành báo cáo](task_title) hạn [ngày mai](due_date)
    - thêm task [gọi điện cho khách](task_title) lúc [10h sáng](due_time)
    - tạo nhiệm vụ [review code](task_title) [khẩn cấp](priority)
    - thêm [dọn phòng](task_title) với độ ưu tiên [thấp](priority)
    - nhiệm vụ mới [nộp đề xuất](task_title) trước [18h30](due_time) [hôm nay](due_date)
    - tạo task [họp team](task_title) vào [thứ hai tuần sau](due_date) lúc [9h](due_time)
    - thêm việc [mua đồ](task_title) [quan trọng](priority) hạn [chiều nay](due_date)
    
    # Trigger-only phrases (NO entity - should prompt for title)
    - tạo task
    - thêm nhiệm vụ
    - tạo nhiệm vụ mới
    - thêm task mới
    - create task
    - new task
    - add task
    - I want to create a task
    - tôi muốn tạo task
```

**Estimated examples needed:** 50-80 annotated examples (bilingual)

**Important:** Trigger-only phrases without entities will be handled by the form flow to prompt for required information.

---

### Phase 2: Update Domain Configuration (domain.yml)

**Goal:** Declare entities, slots, and their mappings

**Tasks:**
- [ ] Add entity declarations
- [ ] Define slots with proper types and mappings
- [ ] Add synonym values for priority

**Changes to add:**
```yaml
entities:
  - task_title
  - due_date
  - due_time    # NEW: for time like "16h", "3pm", "14:00"
  - priority

slots:
  task_title:
    type: text
    influence_conversation: true
    mappings:
      - type: from_entity
        entity: task_title
        
  due_date:
    type: text
    influence_conversation: true
    mappings:
      - type: from_entity
        entity: due_date

  due_time:     # NEW: time slot
    type: text
    influence_conversation: false
    mappings:
      - type: from_entity
        entity: due_time
        
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

---

### Phase 3: Add Entity Synonyms (nlu.yml)

**Goal:** Map alternative expressions to standard values

**Tasks:**
- [ ] Add synonym section for priority levels
- [ ] Add synonym section for common date expressions

**Changes:**
```yaml
nlu:
- synonym: high
  examples: |
    - urgent
    - critical
    - important
    - asap
    - high priority

- synonym: low
  examples: |
    - minor
    - not urgent
    - whenever
    - low priority

- synonym: medium
  examples: |
    - normal
    - regular
    - standard
    - medium priority
    - bình thường
    - trung bình

# Vietnamese priority synonyms
- synonym: high
  examples: |
    - khẩn cấp
    - quan trọng
    - gấp
    - ưu tiên cao

- synonym: low  
  examples: |
    - không gấp
    - ưu tiên thấp
    - khi nào cũng được
```

---

### Phase 4: Add Regex Patterns (nlu.yml)

**Goal:** Improve entity extraction with pattern matching

**Tasks:**
- [ ] Add regex patterns for date formats
- [ ] Add regex patterns for priority keywords

**Changes:**
```yaml
nlu:
- regex: due_date
  examples: |
    - today
    - tomorrow
    - next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)
    - this (week|weekend|month)
    - in \d+ (days?|weeks?|months?)
    - \d{1,2}/\d{1,2}(/\d{2,4})?

- regex: priority
  examples: |
    - (high|medium|low|urgent|critical|important)
    - (khẩn cấp|quan trọng|gấp|bình thường|không gấp)

# NEW: Time extraction regex
- regex: due_time
  examples: |
    - \d{1,2}h(\d{1,2})?
    - \d{1,2}:\d{2}
    - \d{1,2}(am|pm)
    - \d{1,2} (giờ|h)
    - (sáng|chiều|tối|trưa)

# Vietnamese date patterns
- regex: due_date
  examples: |
    - hôm nay
    - ngày mai
    - ngày kia
    - tuần sau
    - tháng sau
    - thứ (hai|ba|tư|năm|sáu|bảy|chủ nhật)
    - cuối tuần
```

---

### Phase 5: Refactor Action (actions.py)

**Goal:** Use Rasa slots instead of manual parsing

**Tasks:**
- [ ] Replace string manipulation with `tracker.get_slot()`
- [ ] Add date parsing utility function
- [ ] Add **time parsing** utility function (NEW)
- [ ] Add fallback prompts for missing required info
- [ ] Handle slot reset after task creation
- [ ] **Detect trigger-only messages** (NEW)

**New action structure:**
```python
import re
from datetime import datetime, timedelta
from typing import Text, Dict, Any, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet

# Trigger phrases that should NOT be used as task titles
TRIGGER_PHRASES = [
    "tạo task", "thêm task", "tạo nhiệm vụ", "thêm nhiệm vụ",
    "nhiệm vụ mới", "task mới", "tôi muốn tạo",
    "create task", "new task", "add task", "create a task",
    "add a task", "i want to create", "i want to add"
]

class ActionCreateTask(Action):
    def name(self) -> Text:
        return "action_create_task"

    def run(self, dispatcher: CollectingDispatcher, 
            tracker: Tracker, 
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        sender_id = tracker.sender_id
        user_message = tracker.latest_message.get("text", "").strip().lower()
        
        # Extract from slots (filled by entity extraction)
        task_title = tracker.get_slot("task_title")
        due_date_str = tracker.get_slot("due_date")
        due_time_str = tracker.get_slot("due_time")  # NEW: time slot
        priority = tracker.get_slot("priority") or "medium"
        
        # === NEW: Check if user only sent trigger phrase ===
        if self._is_trigger_only(user_message, task_title):
            dispatcher.utter_message(
                text="Bạn muốn tạo task gì? Vui lòng cho tôi biết tiêu đề task.\n"
                     "Ví dụ: 'thêm nhiệm vụ học SQL trước 16h'"
            )
            return [SlotSet("requested_slot", "task_title")]
        
        # Validate required fields
        if not task_title:
            dispatcher.utter_message(
                text="Task cần có tiêu đề. Vui lòng cho biết tên task của bạn?"
            )
            return [SlotSet("requested_slot", "task_title")]
        
        # Parse due date AND time
        due_datetime = self._parse_due_datetime(due_date_str, due_time_str)
        
        # Map priority synonyms
        priority = self._normalize_priority(priority)
        
        # Call API
        payload = {
            "title": task_title,
            "description": "Created via AI assistant",
            "priority": priority,
            "dueDate": due_datetime.isoformat() if due_datetime else None
        }
        
        response = requests.post(
            f"{API_BASE}/api/internal/tasks/{sender_id}",
            json=payload
        )
        
        if response.status_code == 201:
            time_info = f" (hạn: {due_datetime.strftime('%H:%M %d/%m')})" if due_datetime else ""
            dispatcher.utter_message(
                text=f"✅ Đã tạo task: {task_title}{time_info}"
            )
        else:
            dispatcher.utter_message(
                text="Xin lỗi, không thể tạo task. Vui lòng thử lại."
            )
        
        # Reset slots for next task
        return [
            SlotSet("task_title", None),
            SlotSet("due_date", None),
            SlotSet("due_time", None),  # NEW
            SlotSet("priority", None),
            SlotSet("requested_slot", None)
        ]
    
    def _is_trigger_only(self, message: str, extracted_title: str) -> bool:
        """
        Check if message is just a trigger phrase without actual task info.
        Examples: "tạo task", "thêm nhiệm vụ", "new task"
        """
        # If we extracted a title that's not just the trigger, it's valid
        if extracted_title:
            title_lower = extracted_title.lower().strip()
            # Check if extracted title IS the trigger phrase itself
            for phrase in TRIGGER_PHRASES:
                if title_lower == phrase or phrase in title_lower:
                    return True
            return False
        
        # No title extracted - check if message is just trigger
        for phrase in TRIGGER_PHRASES:
            if message == phrase or message.startswith(phrase + " "):
                # Check if there's meaningful content after trigger
                remaining = message.replace(phrase, "").strip()
                if len(remaining) < 3:
                    return True
        
        return not extracted_title
    
    def _parse_due_datetime(self, date_str: str, time_str: str) -> datetime:
        """
        Parse both date and time into a single datetime.
        Handles: "16h", "16h30", "3pm", "14:00", "chiều nay"
        """
        today = datetime.now()
        result_date = today
        result_time = None
        
        # Parse date
        if date_str:
            date_lower = date_str.lower()
            if date_lower in ["today", "hôm nay"]:
                result_date = today
            elif date_lower in ["tomorrow", "ngày mai"]:
                result_date = today + timedelta(days=1)
            elif date_lower in ["ngày kia", "day after tomorrow"]:
                result_date = today + timedelta(days=2)
            # ... more date parsing
        
        # Parse time - NEW!
        if time_str:
            result_time = self._parse_time(time_str)
        
        # Combine date and time
        if result_time:
            return result_date.replace(
                hour=result_time[0], 
                minute=result_time[1],
                second=0,
                microsecond=0
            )
        
        return result_date if date_str else None
    
    def _parse_time(self, time_str: str) -> tuple:
        """
        Parse time string to (hour, minute) tuple.
        Handles Vietnamese and English formats.
        """
        if not time_str:
            return None
            
        time_str = time_str.lower().strip()
        
        # Pattern: "16h" or "16h30"
        match = re.match(r'(\d{1,2})h(\d{1,2})?', time_str)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2)) if match.group(2) else 0
            return (hour, minute)
        
        # Pattern: "14:00" or "2:30"
        match = re.match(r'(\d{1,2}):(\d{2})', time_str)
        if match:
            return (int(match.group(1)), int(match.group(2)))
        
        # Pattern: "3pm" or "3am"
        match = re.match(r'(\d{1,2})(am|pm)', time_str)
        if match:
            hour = int(match.group(1))
            if match.group(2) == 'pm' and hour != 12:
                hour += 12
            elif match.group(2) == 'am' and hour == 12:
                hour = 0
            return (hour, 0)
        
        # Vietnamese time periods
        if 'sáng' in time_str:
            return (9, 0)  # Default morning
        elif 'trưa' in time_str:
            return (12, 0)
        elif 'chiều' in time_str:
            return (14, 0)  # Default afternoon
        elif 'tối' in time_str:
            return (19, 0)  # Default evening
        
        return None
    
    def _normalize_priority(self, priority: str) -> str:
        """Normalize priority to API expected values (bilingual)"""
        if not priority:
            return "medium"
            
        priority_map = {
            # English
            "urgent": "high",
            "critical": "high", 
            "important": "high",
            "asap": "high",
            "normal": "medium",
            "regular": "medium",
            "minor": "low",
            "whenever": "low",
            # Vietnamese
            "khẩn cấp": "high",
            "quan trọng": "high",
            "gấp": "high",
            "ưu tiên cao": "high",
            "bình thường": "medium",
            "trung bình": "medium",
            "không gấp": "low",
            "ưu tiên thấp": "low",
            "thấp": "low",
            "cao": "high"
        }
        return priority_map.get(priority.lower(), priority.lower())
```
```

---

### Phase 6: Add Form for Multi-turn Collection (Optional)

**Goal:** Gracefully collect missing information

**Tasks:**
- [ ] Create a form in domain.yml for task creation
- [ ] Add form validation action
- [ ] Update stories to use form

**Form definition:**
```yaml
forms:
  task_form:
    required_slots:
      - task_title
    
slots:
  requested_slot:
    type: text
    influence_conversation: true
    mappings:
      - type: custom

responses:
  utter_ask_task_title:
    - text: "Bạn muốn tạo task gì? Vui lòng cho tôi biết tiêu đề task."
    - text: "Tên task là gì vậy bạn?"
    - text: "What would you like to name this task?"
```

**Story with form:**
```yaml
- story: create task with form
  steps:
  - intent: create_task
  - action: task_form
  - active_loop: task_form
  - active_loop: null
  - action: action_create_task
```

---

### Phase 7: Testing

**Tasks:**
- [ ] Train new model: `rasa train`
- [ ] Test entity extraction: `rasa shell nlu`
- [ ] Test full conversation: `rasa shell`
- [ ] Write test stories in `tests/`
- [ ] Run automated tests: `rasa test`

**Test cases:**

**English tests:**
1. "Create a task finish report for tomorrow" → title="finish report", due_date="tomorrow"
2. "Add urgent task call client" → title="call client", priority="high"
3. "New task" → Should prompt for title ✅
4. "Create task review PR with low priority for next monday" → All three entities
5. "Add meeting at 3pm" → title="meeting", due_time="3pm" (15:00)

**Vietnamese tests (NEW):**
6. "thêm nhiệm vụ học thuộc sql interview trước 16h" → title="học thuộc sql interview", due_time="16h" (16:00) ✅
7. "tạo task" → Should prompt for title (NOT create task with title "tạo task") ✅
8. "thêm nhiệm vụ" → Should prompt for title ✅
9. "tạo task hoàn thành báo cáo hạn ngày mai lúc 10h" → title="hoàn thành báo cáo", due_date="ngày mai", due_time="10h"
10. "nhiệm vụ mới gọi khách hàng quan trọng" → title="gọi khách hàng", priority="high"
11. "thêm task review code chiều nay" → title="review code", due_date="hôm nay", due_time="chiều" (14:00)
12. "tạo nhiệm vụ mới" → Should prompt for title ✅

**Edge cases:**
13. "create" → Should NOT trigger create_task (fallback)
14. "task" → Should NOT trigger create_task (fallback)
15. "thêm việc mua sữa trước 18h30" → title="mua sữa", due_time="18h30" (18:30)

---

## File Changes Summary

| File | Changes |
|------|---------|
| `data/nlu.yml` | Add annotated entities, synonyms, regex patterns, Vietnamese examples |
| `domain.yml` | Add entities, slots (including `due_time`), forms |
| `data/stories.yml` | Update stories for form flow, Vietnamese scenarios |
| `actions/actions.py` | Refactor to use slots, add time parsing, trigger detection |
| `tests/test_stories.yml` | Add test cases (Vietnamese + English) |

---

## Execution Order

1. ✅ Create improvement plan (this document)
2. ⬜ Update `nlu.yml` with entity annotations and synonyms
3. ⬜ Update `domain.yml` with entities, slots, `due_time`
4. ⬜ Refactor `actions.py` to use slot extraction
5. ⬜ Add date AND time parsing utilities
6. ⬜ Add trigger phrase detection logic
7. ⬜ Train model: `rasa train`
8. ⬜ Test Vietnamese scenarios with `rasa shell`
9. ⬜ Add automated test stories
10. ⬜ (Optional) Add form for multi-turn collection

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Entity extraction accuracy | ~60% (manual) | ~90%+ |
| Supported input variations | Limited | Flexible |
| Maintainability | Poor | Good |
| Multi-turn support | None | Full |
| Error handling | Basic | Graceful prompts |
| Time extraction | None | ✅ "16h", "3pm", "14:00" |
| Trigger phrase handling | Creates bad tasks | ✅ Prompts for info |
| Vietnamese support | None | ✅ Full bilingual |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Insufficient training data | Start with 50-80 annotated examples (bilingual) |
| Date/time parsing edge cases | Use library like `dateparser` or custom regex |
| Entity overlap/confusion | Add lookup tables for disambiguation |
| Breaking existing functionality | Test extensively before deploy |
| Trigger phrase as entity | Explicit check in action + separate training examples |
| Time zone issues | Use server timezone, document clearly |
