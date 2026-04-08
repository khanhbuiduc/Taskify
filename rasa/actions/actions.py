# Rasa custom actions for Taskify (phase 2).
# Run from rasa folder: pip install -r actions/requirements.txt && rasa run actions
# Requires: action_endpoint in endpoints.yml and actions in domain.yml to be enabled.

import logging
import os
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Text, Tuple

import requests
from rasa_sdk import Action, Tracker
from rasa_sdk.events import ActiveLoop, SlotSet
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.forms import FormValidationAction

# Configuration - can be overridden by environment variables
TASKIFY_API_URL = os.getenv("TASKIFY_API_URL", "http://localhost:5116")
RASA_API_KEY = os.getenv("RASA_API_KEY", "rasa-internal-api-key-taskify-2026")
REQUEST_TIMEOUT = 10  # seconds

logger = logging.getLogger(__name__)

VIETNAMESE_CHAR_PATTERN = re.compile(r"[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]", re.IGNORECASE)
VIETNAMESE_HINT_PATTERN = re.compile(
    r"\b(xin|chao|toi|ban|minh|giup|nhiem|viec|ngay|hom|mai|tuan|tom tat|uu tien|xoa|ghim|ghi chu|khong|tao|them|muon|can)\b",
    re.IGNORECASE,
)


def detect_locale(text: Optional[str]) -> str:
    normalized = normalize_whitespace(text).lower()
    if not normalized:
        return "en"

    if VIETNAMESE_CHAR_PATTERN.search(normalized) or VIETNAMESE_HINT_PATTERN.search(normalized):
        return "vi"

    return "en"


def get_locale(tracker: Tracker) -> str:
    latest_text = tracker.latest_message.get("text", "") if tracker.latest_message else ""
    return detect_locale(latest_text)


def t(locale: str, en: str, vi: str) -> str:
    if locale and locale.lower().startswith("vi"):
        return vi
    return en


def compile_term_pattern(terms: List[str], prefix_only: bool = False) -> re.Pattern[str]:
    escaped_terms = sorted((re.escape(term) for term in terms if term), key=len, reverse=True)
    if prefix_only:
        pattern = rf"^(?:{'|'.join(escaped_terms)})(?=\s|$)"
    else:
        pattern = rf"(?<!\w)(?:{'|'.join(escaped_terms)})(?!\w)"
    return re.compile(pattern, re.IGNORECASE)


TRIGGER_PHRASES = [
    "tạo task",
    "thêm task",
    "tạo nhiệm vụ",
    "thêm nhiệm vụ",
    "nhiệm vụ mới",
    "task mới",
    "tôi muốn tạo",
    "tạo việc mới",
    "thêm công việc",
    "tạo công việc",
    "create task",
    "new task",
    "add task",
    "create a task",
    "add a task",
    "i want to create",
    "i want to add",
    "create a new task",
    "add a new task",
    "i want to create a task",
    "i want to add a task",
]

TITLE_PREFIX_PATTERNS = [
    re.compile(r"^(title\s*(l?|is)?\s*)", re.IGNORECASE),
    re.compile(r"^(task\s*(l?|is)?\s*)", re.IGNORECASE),
    re.compile(r"^(nhiệm vụ\s*(l?)?\s*)", re.IGNORECASE),
    re.compile(r"^(công việc\s*(l?)?\s*)", re.IGNORECASE),
]

METADATA_CONNECTOR_PATTERN = compile_term_pattern(
    [
        "deadline",
        "hạn",
        "due",
        "priority",
        "ưu tiên",
        "set",
        "đặt",
        "mức",
        "độ",
        "with",
        "với",
        "at",
        "lúc",
        "vào",
        "for",
        "by",
        "before",
        "trước",
        "please",
        "giúp",
        "nhé",
    ]
)

TRIGGER_FILLER_PATTERN = compile_term_pattern(
    [
        "một",
        "cái",
        "task",
        "nhiệm vụ",
        "việc",
        "công việc",
        "for",
        "please",
        "cho",
        "để",
    ],
    prefix_only=True,
)

DATE_ONLY_TERMS = {
    "today",
    "tomorrow",
    "next monday",
    "next tuesday",
    "next wednesday",
    "next thursday",
    "next friday",
    "next saturday",
    "next sunday",
    "next week",
    "next month",
    "hôm nay",
    "ngày mai",
    "ngày kia",
    "tuần sau",
    "tháng sau",
    "chiều nay",
    "tối nay",
    "sáng mai",
    "thứ hai",
    "thứ ba",
    "thứ tư",
    "thứ năm",
    "thứ sáu",
    "thứ bảy",
    "chủ nhật",
}

PRIORITY_ONLY_TERMS = {
    "high",
    "medium",
    "low",
    "urgent",
    "critical",
    "important",
    "asap",
    "khẩn cấp",
    "quan trọng",
    "gấp",
    "cao",
    "ưu tiên cao",
    "ưu tiên thấp",
    "thấp",
    "bình thường",
    "trung bình",
}

TIME_ONLY_PATTERN = re.compile(
    r"^(\d{1,2}(h\d{0,2})?|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)|\d{1,2}\s*giờ|sáng|trưa|chiều|tối)(\s*(sáng|trưa|chiều|tối))?$",
    re.IGNORECASE,
)


def get_api_headers() -> Dict[str, str]:
    """Get headers for internal API calls."""
    return {"Content-Type": "application/json", "X-Rasa-Token": RASA_API_KEY}


def split_sender(sender_id: str) -> Tuple[str, Optional[str]]:
    """Split sender id into (user_id, session_id) when formatted as user:session."""
    if ":" in sender_id:
        user, session = sender_id.split(":", 1)
        return user, session
    return sender_id, None


def pick_task_by_title(tasks: List[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
    """Return tasks whose title contains the query (case-insensitive)."""
    q = (query or "").lower().strip()
    if not q:
        return []
    return [t for t in tasks if q in t.get("title", "").lower()]


def format_task_list(tasks: List[Dict[str, Any]], locale: str, max_items: int = 5) -> str:
    """Format a list of tasks for display in chat."""
    if not tasks:
        return t(locale, "You don't have any tasks yet.", "B\u1ea1n ch\u01b0a c\u00f3 task n\u00e0o.")

    lines: List[str] = []
    for i, task in enumerate(tasks[:max_items], 1):
        priority_mark = {"high": "!", "medium": "~", "low": "-"}.get(task.get("priority", "medium"), "-")
        status_mark = {"completed": "[x]", "in-progress": "[~]", "todo": "[ ]"}.get(task.get("status", "todo"), "[ ]")

        due_date = task.get("dueDate", "")
        if due_date:
            try:
                dt = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
                due_str = dt.strftime("%b %d")
            except ValueError:
                due_str = due_date[:10] if len(due_date) >= 10 else due_date
        else:
            due_str = t(locale, "No date", "Ch\u01b0a c\u00f3 h\u1ea1n")

        overdue_marker = t(locale, " OVERDUE", " QU\u00c1 H\u1ea0N") if task.get("isOverdue", False) else ""
        due_label = t(locale, "Due", "H\u1ea1n")
        untitled = t(locale, "Untitled", "Ch\u01b0a \u0111\u1eb7t t\u00ean")
        lines.append(f"{i}. {status_mark} {task.get('title', untitled)} {priority_mark} ({due_label}: {due_str}){overdue_marker}")

    if len(tasks) > max_items:
        lines.append(
            t(
                locale,
                f"... and {len(tasks) - max_items} more tasks",
                f"... v\u00e0 c\u00f2n {len(tasks) - max_items} task kh\u00e1c",
            )
        )

    return "\n".join(lines)


def utter_ask_task_title(dispatcher: CollectingDispatcher, locale: str) -> None:
    dispatcher.utter_message(
        text=t(
            locale,
            "What would you like to name this task?",
            "B\u1ea1n mu\u1ed1n \u0111\u1eb7t t\u00ean task n\u00e0y l\u00e0 g\u00ec?",
        )
    )


def utter_create_task_cancelled(dispatcher: CollectingDispatcher, locale: str) -> None:
    dispatcher.utter_message(text=t(locale, "Cancelled task creation.", "\u0110\u00e3 h\u1ee7y t\u1ea1o task."))


def utter_ask_delete_title(dispatcher: CollectingDispatcher, locale: str) -> None:
    dispatcher.utter_message(
        text=t(
            locale,
            "Which task should I delete? Please give the title.",
            "B\u1ea1n mu\u1ed1n x\u00f3a task n\u00e0o? H\u00e3y cho m\u00ecnh t\u00ean task.",
        )
    )


def utter_confirm_delete(dispatcher: CollectingDispatcher, locale: str, task_title: str) -> None:
    dispatcher.utter_message(
        text=t(
            locale,
            f'Are you sure you want to delete "{task_title}"?',
            f'B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a "{task_title}" kh\u00f4ng?',
        )
    )


def normalize_whitespace(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip(" \t\r\n-:,.\"'")


def normalize_lower(value: Optional[str]) -> str:
    return normalize_whitespace(value).lower()


def strip_trigger_prefix(value: str) -> str:
    candidate = normalize_whitespace(value)
    candidate_lower = candidate.lower()

    changed = True
    while changed and candidate:
        changed = False
        for phrase in sorted(TRIGGER_PHRASES, key=len, reverse=True):
            if candidate_lower.startswith(phrase):
                candidate = normalize_whitespace(candidate[len(phrase):])
                candidate_lower = candidate.lower()
                changed = True
                break
        if changed:
            continue
        candidate = TRIGGER_FILLER_PATTERN.sub("", candidate, count=1)
        candidate = normalize_whitespace(candidate)
        candidate_lower = candidate.lower()

    return candidate


def strip_title_prefixes(value: str) -> str:
    candidate = normalize_whitespace(value)
    previous = None
    while candidate and candidate != previous:
        previous = candidate
        candidate = strip_trigger_prefix(candidate)
        for pattern in TITLE_PREFIX_PATTERNS:
            candidate = pattern.sub("", candidate)
        candidate = normalize_whitespace(candidate)
    return candidate


def merge_spans(spans: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
    if not spans:
        return []
    spans = sorted(spans)
    merged = [spans[0]]
    for start, end in spans[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def strip_entity_spans(text: str, entities: List[Dict[str, Any]], excluded_entities: Optional[set] = None) -> str:
    spans: List[Tuple[int, int]] = []
    excluded_entities = excluded_entities or set()
    for entity in entities:
        if entity.get("entity") in excluded_entities:
            continue
        start = entity.get("start")
        end = entity.get("end")
        if isinstance(start, int) and isinstance(end, int):
            spans.append((start, end))
    if not spans:
        return text

    parts: List[str] = []
    cursor = 0
    for start, end in merge_spans(spans):
        parts.append(text[cursor:start])
        cursor = end
    parts.append(text[cursor:])
    return normalize_whitespace(" ".join(parts))


def is_trigger_only(message: Optional[str]) -> bool:
    candidate = normalize_lower(message)
    if not candidate:
        return True

    for phrase in TRIGGER_PHRASES:
        if candidate == phrase:
            return True
        if candidate.startswith(phrase):
            remaining = normalize_lower(candidate[len(phrase):])
            if remaining in {"", "một", "cái", "task", "nhiệm vụ", "việc", "công việc"}:
                return True
    return False


def is_metadata_only(message: Optional[str]) -> bool:
    candidate = normalize_lower(message)
    if not candidate:
        return True
    if candidate in DATE_ONLY_TERMS or candidate in PRIORITY_ONLY_TERMS:
        return True
    if TIME_ONLY_PATTERN.fullmatch(candidate):
        return True

    stripped = normalize_whitespace(METADATA_CONNECTOR_PATTERN.sub(" ", candidate)).lower()
    if not stripped:
        return True
    return stripped in DATE_ONLY_TERMS or stripped in PRIORITY_ONLY_TERMS or TIME_ONLY_PATTERN.fullmatch(stripped) is not None


def clean_task_title(candidate: Optional[str]) -> Optional[str]:
    value = strip_title_prefixes(candidate or "")
    value = normalize_whitespace(value)
    if not value:
        return None
    if is_trigger_only(value) or is_metadata_only(value):
        return None
    return value


def first_entity_value(latest_message: Dict[str, Any], entity_name: str) -> Optional[str]:
    for entity in latest_message.get("entities", []) or []:
        if entity.get("entity") == entity_name:
            value = entity.get("value")
            if isinstance(value, str) and normalize_whitespace(value):
                return value
    return None


def extract_task_title_from_message(latest_message: Dict[str, Any], fallback: Optional[str] = None) -> Optional[str]:
    text = latest_message.get("text", "") or ""
    entities = latest_message.get("entities", []) or []
    text_without_metadata = strip_entity_spans(text, entities, excluded_entities={"task_title"})
    derived_title = clean_task_title(text_without_metadata)
    if derived_title:
        return derived_title

    explicit_title = clean_task_title(first_entity_value(latest_message, "task_title"))
    if explicit_title:
        return explicit_title

    return clean_task_title(fallback)


def reset_create_task_slots(deactivate_loop: bool = False) -> List[Dict[Text, Any]]:
    events: List[Dict[Text, Any]] = []
    if deactivate_loop:
        events.append(ActiveLoop(None))
    events.extend(
        [
            SlotSet("task_title", None),
            SlotSet("due_date", None),
            SlotSet("due_time", None),
            SlotSet("priority", None),
            SlotSet("requested_slot", None),
        ]
    )
    return events


def next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def parse_time(time_str: Optional[str]) -> Optional[Tuple[int, int]]:
    if not time_str:
        return None

    value = normalize_lower(time_str)
    if not value:
        return None

    if "sáng" in value or "morning" in value:
        match = re.search(r"(\d{1,2})", value)
        if match:
            hour = int(match.group(1))
            return (hour, 0) if 0 <= hour <= 11 else None
        return (9, 0)
    if "trưa" in value or "noon" in value:
        return (12, 0)
    if "chiều" in value or "afternoon" in value:
        match = re.search(r"(\d{1,2})", value)
        if match:
            hour = int(match.group(1))
            if hour < 12:
                hour += 12
            return (hour, 0) if hour <= 23 else None
        return (14, 0)
    if "tối" in value or "evening" in value or "night" in value:
        match = re.search(r"(\d{1,2})", value)
        if match:
            hour = int(match.group(1))
            if hour < 12:
                hour += 12
            return (hour, 0) if hour <= 23 else None
        return (19, 0)

    match = re.fullmatch(r"(\d{1,2})h(\d{1,2})?", value)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return (hour, minute)

    match = re.fullmatch(r"(\d{1,2}):(\d{2})", value)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2))
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return (hour, minute)

    match = re.fullmatch(r"(\d{1,2})\s*(am|pm)", value)
    if match:
        hour = int(match.group(1))
        if match.group(2) == "pm" and hour != 12:
            hour += 12
        elif match.group(2) == "am" and hour == 12:
            hour = 0
        if 0 <= hour <= 23:
            return (hour, 0)

    return None


def parse_due_date(date_str: Optional[str], now: datetime) -> Tuple[datetime, Optional[Tuple[int, int]], bool]:
    result_date = now
    inferred_time: Optional[Tuple[int, int]] = None
    had_date = False

    if not date_str:
        return result_date, inferred_time, had_date

    value = normalize_lower(date_str)
    if not value:
        return result_date, inferred_time, had_date

    had_date = True
    if value in {"today", "hôm nay"}:
        result_date = now
    elif value in {"tomorrow", "ngày mai"}:
        result_date = now + timedelta(days=1)
    elif value in {"ngày kia", "day after tomorrow"}:
        result_date = now + timedelta(days=2)
    elif value in {"next week", "tuần sau"}:
        result_date = now + timedelta(days=7)
    elif value in {"next month", "tháng sau"}:
        result_date = now + timedelta(days=30)
    elif value == "chiều nay":
        result_date = now
        inferred_time = (14, 0)
    elif value == "tối nay":
        result_date = now
        inferred_time = (19, 0)
    elif value == "sáng mai":
        result_date = now + timedelta(days=1)
        inferred_time = (9, 0)
    elif "thứ hai" in value or "monday" in value:
        result_date = next_weekday(now, 0)
    elif "thứ ba" in value or "tuesday" in value:
        result_date = next_weekday(now, 1)
    elif "thứ tư" in value or "wednesday" in value:
        result_date = next_weekday(now, 2)
    elif "thứ năm" in value or "thursday" in value:
        result_date = next_weekday(now, 3)
    elif "thứ sáu" in value or "friday" in value:
        result_date = next_weekday(now, 4)
    elif "thứ bảy" in value or "saturday" in value:
        result_date = next_weekday(now, 5)
    elif "chủ nhật" in value or "sunday" in value:
        result_date = next_weekday(now, 6)
    else:
        for date_format in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%d/%m"):
            try:
                parsed = datetime.strptime(value, date_format)
                if date_format == "%d/%m":
                    parsed = parsed.replace(year=now.year)
                    if parsed.date() < now.date():
                        parsed = parsed.replace(year=now.year + 1)
                result_date = now.replace(year=parsed.year, month=parsed.month, day=parsed.day)
                break
            except ValueError:
                continue

    return result_date, inferred_time, had_date


def build_due_datetime(date_str: Optional[str], time_str: Optional[str]) -> datetime:
    now = datetime.now()
    result_date, inferred_time, had_date = parse_due_date(date_str, now)
    parsed_time = parse_time(time_str) if time_str else None
    final_time = parsed_time or inferred_time

    if final_time:
        return result_date.replace(hour=final_time[0], minute=final_time[1], second=0, microsecond=0)
    if had_date:
        return result_date.replace(hour=23, minute=59, second=59, microsecond=0)
    return now.replace(hour=23, minute=59, second=59, microsecond=0)


def normalize_priority(priority: Optional[str]) -> str:
    if not priority:
        return "medium"

    value = normalize_lower(priority)
    high_synonyms = {
        "high",
        "urgent",
        "critical",
        "important",
        "asap",
        "khẩn cấp",
        "quan trọng",
        "gấp",
        "cao",
        "ưu tiên cao",
    }
    low_synonyms = {
        "low",
        "minor",
        "not urgent",
        "whenever",
        "không gấp",
        "thấp",
        "ưu tiên thấp",
        "khi nào cũng được",
    }
    if value in high_synonyms:
        return "high"
    if value in low_synonyms:
        return "low"
    return "medium"


class ActionListTasks(Action):
    """Fetch and display user's tasks from TaskifyAPI."""

    def name(self) -> Text:
        return "action_list_tasks"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, session_id = split_sender(tracker.sender_id)
        locale = get_locale(tracker)

        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{user_id}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)

            if response.status_code == 200:
                data = response.json()
                tasks = data.get("tasks", [])
                overdue_count = data.get("overdueCount", 0)
                total_count = data.get("totalCount", 0)
                high_priority_count = data.get("highPriorityCount", 0)

                latest_intent = tracker.latest_message.get("intent", {}).get("name", "")

                if latest_intent == "list_overdue_tasks":
                    overdue_tasks = [t_item for t_item in tasks if t_item.get("isOverdue", False)]
                    if overdue_tasks:
                        message = t(
                            locale,
                            f"You have {len(overdue_tasks)} overdue task(s):\n\n{format_task_list(overdue_tasks, locale)}",
                            f"B\u1ea1n c\u00f3 {len(overdue_tasks)} task qu\u00e1 h\u1ea1n:\n\n{format_task_list(overdue_tasks, locale)}",
                        )
                    else:
                        message = t(locale, "Great news! You don't have any overdue tasks.", "Tin t\u1ed1t l\u00e0 b\u1ea1n kh\u00f4ng c\u00f3 task qu\u00e1 h\u1ea1n n\u00e0o.")
                elif latest_intent == "help_prioritize":
                    priority_order = {"high": 0, "medium": 1, "low": 2}
                    pending_tasks = [t_item for t_item in tasks if t_item.get("status") != "completed"]
                    sorted_tasks = sorted(
                        pending_tasks,
                        key=lambda task_item: (
                            priority_order.get(task_item.get("priority", "medium"), 1),
                            task_item.get("dueDate", ""),
                        ),
                    )

                    if sorted_tasks:
                        message = t(
                            locale,
                            f"Here are your tasks prioritized (high priority and earliest due first):\n\n{format_task_list(sorted_tasks, locale)}",
                            f"\u0110\u00e2y l\u00e0 danh s\u00e1ch task theo m\u1ee9c \u01b0u ti\u00ean (\u01b0u ti\u00ean cao v\u00e0 g\u1ea7n h\u1ea1n nh\u1ea5t tr\u01b0\u1edbc):\n\n{format_task_list(sorted_tasks, locale)}",
                        )
                        if high_priority_count > 0:
                            message += t(
                                locale,
                                f"\n\nTip: Focus on your {high_priority_count} high-priority task(s) first.",
                                f"\n\nG\u1ee3i \u00fd: H\u00e3y x\u1eed l\u00fd {high_priority_count} task \u01b0u ti\u00ean cao tr\u01b0\u1edbc.",
                            )
                    else:
                        message = t(locale, "You have no pending tasks. Great job!", "B\u1ea1n kh\u00f4ng c\u00f2n task ch\u1edd x\u1eed l\u00fd n\u00e0o. L\u00e0m t\u1ed1t l\u1eafm.")
                else:
                    if total_count == 0:
                        message = t(locale, "You don't have any tasks yet. Would you like to create one?", "B\u1ea1n ch\u01b0a c\u00f3 task n\u00e0o. B\u1ea1n mu\u1ed1n m\u00ecnh t\u1ea1o m\u1ed9t task kh\u00f4ng?")
                    else:
                        summary = t(locale, f"You have {total_count} task(s)", f"B\u1ea1n c\u00f3 {total_count} task")
                        if overdue_count > 0:
                            summary += t(locale, f" ({overdue_count} overdue)", f" ({overdue_count} qu\u00e1 h\u1ea1n)")
                        message = f"{summary}:\n\n{format_task_list(tasks, locale)}"

                dispatcher.utter_message(text=message)
            elif response.status_code == 401:
                dispatcher.utter_message(text=t(locale, "I couldn't access your tasks. Please make sure you're logged in.", "M\u00ecnh kh\u00f4ng truy c\u1eadp \u0111\u01b0\u1ee3c task c\u1ee7a b\u1ea1n. H\u00e3y ki\u1ec3m tra l\u1ea1i \u0111\u0103ng nh\u1eadp."))
            else:
                logger.warning(
                    "API returned status %s for user %s session %s",
                    response.status_code,
                    user_id,
                    session_id,
                )
                dispatcher.utter_message(text=t(locale, "I'm having trouble accessing your tasks right now. Please try again later.", "M\u00ecnh \u0111ang g\u1eb7p l\u1ed7i khi l\u1ea5y danh s\u00e1ch task. B\u1ea1n th\u1eed l\u1ea1i sau nh\u00e9."))

        except requests.exceptions.Timeout:
            logger.error("Timeout calling TaskifyAPI for user %s", user_id)
            dispatcher.utter_message(text=t(locale, "The request timed out. Please try again.", "Y\u00eau c\u1ea7u b\u1ecb h\u1ebft th\u1eddi gian. B\u1ea1n th\u1eed l\u1ea1i nh\u00e9."))
        except requests.exceptions.ConnectionError:
            logger.error("Connection error calling TaskifyAPI for user %s", user_id)
            dispatcher.utter_message(text=t(locale, "I couldn't connect to the task service. Please make sure the server is running.", "M\u00ecnh kh\u00f4ng k\u1ebft n\u1ed1i \u0111\u01b0\u1ee3c t\u1edbi d\u1ecbch v\u1ee5 task. H\u00e3y ki\u1ec3m tra server \u0111ang ch\u1ea1y."))
        except Exception as exc:
            logger.exception("Error in action_list_tasks for user %s: %s", user_id, exc)
            dispatcher.utter_message(text=t(locale, "Something went wrong. Please try again later.", "C\u00f3 l\u1ed7i x\u1ea3y ra. B\u1ea1n th\u1eed l\u1ea1i sau nh\u00e9."))

        return []


class ValidateCreateTaskForm(FormValidationAction):
    """Validate create-task form input and keep metadata slots intact."""

    def name(self) -> Text:
        return "validate_create_task_form"

    def validate_task_title(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> Dict[Text, Any]:
        locale = get_locale(tracker)
        candidate = extract_task_title_from_message(tracker.latest_message, str(slot_value) if slot_value else None)
        if candidate:
            return {"task_title": candidate}

        utter_ask_task_title(dispatcher, locale)
        return {"task_title": None}


class ActionCancelCreateTask(Action):
    """Cancel the active create-task flow and clear draft slots."""

    def name(self) -> Text:
        return "action_cancel_create_task"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        utter_create_task_cancelled(dispatcher, get_locale(tracker))
        return reset_create_task_slots(deactivate_loop=True)


class ActionCreateTask(Action):
    """Create a new task via TaskifyAPI using slots gathered by the form."""

    def name(self) -> Text:
        return "action_create_task"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, session_id = split_sender(tracker.sender_id)
        locale = get_locale(tracker)

        task_title = clean_task_title(tracker.get_slot("task_title"))
        if not task_title:
            task_title = extract_task_title_from_message(tracker.latest_message)

        if not task_title:
            utter_ask_task_title(dispatcher, locale)
            return reset_create_task_slots()

        due_date_str = tracker.get_slot("due_date")
        due_time_str = tracker.get_slot("due_time")
        priority = normalize_priority(tracker.get_slot("priority"))
        due_datetime = build_due_datetime(due_date_str, due_time_str)
        display_title = task_title[0].upper() + task_title[1:] if task_title else "New Task"

        priority_mark = {"high": "!", "medium": "~", "low": "-"}.get(priority, "~")
        priority_label = t(
            locale,
            {"high": "High", "medium": "Medium", "low": "Low"}.get(priority, "Medium"),
            {"high": "Cao", "medium": "Trung b\u00ecnh", "low": "Th\u1ea5p"}.get(priority, "Trung b\u00ecnh"),
        )

        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{user_id}"
            payload = {
                "title": display_title,
                "description": "Created via AI assistant",
                "priority": priority,
                "dueDate": due_datetime.isoformat(),
            }

            response = requests.post(url, json=payload, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)

            if response.status_code in (200, 201):
                task = response.json()
                task_title_response = task.get("title", display_title)
                dispatcher.utter_message(
                    text=(
                        t(locale, f"Created task: **{task_title_response}**", f"\u0110\u00e3 t\u1ea1o task: **{task_title_response}**")
                        + "\n"
                        + t(locale, f"Due: {due_datetime.strftime('%H:%M %d/%m/%Y')}", f"H\u1ea1n: {due_datetime.strftime('%H:%M %d/%m/%Y')}")
                        + "\n"
                        + f"{priority_mark} "
                        + t(locale, f"Priority: {priority_label}", f"\u0110\u1ed9 \u01b0u ti\u00ean: {priority_label}")
                    )
                )
            elif response.status_code == 401:
                dispatcher.utter_message(text=t(locale, "I couldn't create the task. Please log in again.", "Kh\u00f4ng th\u1ec3 t\u1ea1o task. Vui l\u00f2ng \u0111\u0103ng nh\u1eadp l\u1ea1i."))
            else:
                logger.warning(
                    "API returned status %s when creating task for user %s session %s",
                    response.status_code,
                    user_id,
                    session_id,
                )
                dispatcher.utter_message(text=t(locale, "I couldn't create the task right now. Please try again later.", "Kh\u00f4ng th\u1ec3 t\u1ea1o task. Vui l\u00f2ng th\u1eed l\u1ea1i sau."))

        except requests.exceptions.Timeout:
            logger.error("Timeout calling TaskifyAPI for user %s", user_id)
            dispatcher.utter_message(text=t(locale, "The request timed out. Please try again.", "Y\u00eau c\u1ea7u b\u1ecb h\u1ebft th\u1eddi gian. Vui l\u00f2ng th\u1eed l\u1ea1i."))
        except requests.exceptions.ConnectionError:
            logger.error("Connection error calling TaskifyAPI for user %s", user_id)
            dispatcher.utter_message(text=t(locale, "I couldn't connect to the server. Please check the connection.", "Kh\u00f4ng k\u1ebft n\u1ed1i \u0111\u01b0\u1ee3c server. Vui l\u00f2ng ki\u1ec3m tra k\u1ebft n\u1ed1i."))
        except Exception as exc:
            logger.exception("Error in action_create_task for user %s: %s", user_id, exc)
            dispatcher.utter_message(text=t(locale, "Something went wrong. Please try again later.", "C\u00f3 l\u1ed7i x\u1ea3y ra. Vui l\u00f2ng th\u1eed l\u1ea1i sau."))

        return reset_create_task_slots()


class ActionDeleteTask(Action):
    """Delete a task via TaskifyAPI with confirmation."""

    def name(self) -> Text:
        return "action_delete_task"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, session_id = split_sender(tracker.sender_id)
        locale = get_locale(tracker)
        latest_intent = tracker.latest_message.get("intent", {}).get("name")
        target_id = tracker.get_slot("delete_task_id")
        target_title = tracker.get_slot("task_title")

        if latest_intent == "affirm" and target_id:
            return self._delete_and_reply(dispatcher, user_id, session_id, target_id, target_title, locale)

        tasks = self._fetch_tasks(user_id)
        if tasks is None:
            dispatcher.utter_message(text=t(locale, "I couldn't fetch tasks to delete right now.", "M\u00ecnh ch\u01b0a l\u1ea5y \u0111\u01b0\u1ee3c danh s\u00e1ch task \u0111\u1ec3 x\u00f3a l\u00fac n\u00e0y."))
            return []

        if not target_title:
            utter_ask_delete_title(dispatcher, locale)
            return []

        matches = pick_task_by_title(tasks, target_title)

        if len(matches) == 0:
            dispatcher.utter_message(text=t(locale, "I couldn't find a matching task to delete.", "M\u00ecnh kh\u00f4ng t\u00ecm th\u1ea5y task n\u00e0o kh\u1edbp \u0111\u1ec3 x\u00f3a."))
            return []

        if len(matches) > 1:
            preview = "\n".join([f"- {task_item.get('title', 'Untitled')}" for task_item in matches[:5]])
            dispatcher.utter_message(
                text=t(
                    locale,
                    f"I found {len(matches)} matching tasks:\n{preview}\nPlease be more specific about which task should be deleted.",
                    f"M\u00ecnh th\u1ea5y {len(matches)} task kh\u1edbp:\n{preview}\nH\u00e3y n\u00f3i r\u00f5 h\u01a1n task n\u00e0o c\u1ea7n x\u00f3a.",
                )
            )
            return []

        match = matches[0]
        utter_confirm_delete(dispatcher, locale, match.get("title", ""))
        return [SlotSet("delete_task_id", str(match.get("id"))), SlotSet("task_title", match.get("title"))]

    def _fetch_tasks(self, user_id: str) -> Optional[List[Dict[str, Any]]]:
        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{user_id}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code != 200:
                logger.warning(f"DeleteTask: failed to fetch tasks for user {user_id} status {response.status_code}")
                return None
            data = response.json()
            return data.get("tasks", [])
        except Exception as exc:
            logger.exception(f"DeleteTask: error fetching tasks for user {user_id}: {exc}")
            return None

    def _delete_and_reply(
        self,
        dispatcher: CollectingDispatcher,
        user_id: str,
        session_id: Optional[str],
        task_id: str,
        task_title: Optional[str],
        locale: str,
    ) -> List[Dict[Text, Any]]:
        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{user_id}/{task_id}"
            response = requests.delete(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code in (200, 204):
                dispatcher.utter_message(text=t(locale, f'Deleted "{task_title or "task"}".', f'\u0110\u00e3 x\u00f3a task "{task_title or "task"}".'))
            elif response.status_code == 404:
                dispatcher.utter_message(text=t(locale, "I couldn't find that task to delete.", "M\u00ecnh kh\u00f4ng t\u00ecm th\u1ea5y task \u0111\u00f3 \u0111\u1ec3 x\u00f3a."))
            else:
                dispatcher.utter_message(text=t(locale, "I couldn't delete the task right now. Please try again later.", "Kh\u00f4ng x\u00f3a \u0111\u01b0\u1ee3c task l\u00fac n\u00e0y, th\u1eed l\u1ea1i sau nh\u00e9."))
                logger.warning(f"DeleteTask: delete failed for user {user_id} task {task_id} status {response.status_code}")
        except requests.exceptions.Timeout:
            dispatcher.utter_message(text=t(locale, "The delete request timed out. Please try again.", "Y\u00eau c\u1ea7u x\u00f3a b\u1ecb timeout, th\u1eed l\u1ea1i nh\u00e9."))
        except requests.exceptions.ConnectionError:
            dispatcher.utter_message(text=t(locale, "I couldn't connect to the server to delete the task.", "Kh\u00f4ng k\u1ebft n\u1ed1i \u0111\u01b0\u1ee3c server \u0111\u1ec3 x\u00f3a task."))
        except Exception as exc:
            logger.exception(f"DeleteTask error for user {user_id}: {exc}")
            dispatcher.utter_message(text=t(locale, "Something went wrong while deleting the task.", "C\u00f3 l\u1ed7i khi x\u00f3a task."))

        return [
            SlotSet("delete_task_id", None),
            SlotSet("task_title", None),
            SlotSet("due_date", None),
            SlotSet("due_time", None),
            SlotSet("priority", None),
        ]


class ActionHandleConfirmation(Action):
    """Fallback handler for generic confirmations (affirm/deny)."""

    def name(self) -> Text:
        return "action_handle_confirmation"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        locale = get_locale(tracker)
        intent = tracker.latest_message.get("intent", {}).get("name")
        if intent == "affirm":
            dispatcher.utter_message(text=t(locale, "Got it.", "\u0110\u00e3 ghi nh\u1eadn nh\u00e9."))
        elif intent == "deny":
            dispatcher.utter_message(text=t(locale, "Cancelled as requested.", "\u0110\u00e3 h\u1ee7y theo y\u00eau c\u1ea7u."))
        else:
            dispatcher.utter_message(text=t(locale, "I've noted that.", "M\u00ecnh \u0111\u00e3 ghi nh\u1eadn."))
        return []


class ActionSummarizeWeek(Action):
    """Provide a weekly summary of user's tasks."""

    def name(self) -> Text:
        return "action_summarize_week"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, session_id = split_sender(tracker.sender_id)
        locale = get_locale(tracker)

        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{user_id}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)

            if response.status_code == 200:
                data = response.json()
                overdue_count = data.get("overdueCount", 0)
                completed_this_week = data.get("completedThisWeek", 0)
                pending_count = data.get("pendingCount", 0)
                high_priority_count = data.get("highPriorityCount", 0)

                lines = [t(locale, "**Your Weekly Summary**", "**T\u00f3m t\u1eaft tu\u1ea7n c\u1ee7a b\u1ea1n**"), ""]

                if completed_this_week > 0:
                    lines.append(t(locale, f"Completed this week: {completed_this_week} task(s)", f"\u0110\u00e3 ho\u00e0n th\u00e0nh tu\u1ea7n n\u00e0y: {completed_this_week} task"))
                else:
                    lines.append(t(locale, "No tasks completed this week yet", "Tu\u1ea7n n\u00e0y b\u1ea1n ch\u01b0a ho\u00e0n th\u00e0nh task n\u00e0o"))

                if pending_count > 0:
                    lines.append(t(locale, f"Pending tasks: {pending_count}", f"Task \u0111ang ch\u1edd x\u1eed l\u00fd: {pending_count}"))
                else:
                    lines.append(t(locale, "No pending tasks", "Kh\u00f4ng c\u00f2n task ch\u1edd x\u1eed l\u00fd"))

                if overdue_count > 0:
                    lines.append(t(locale, f"Overdue: {overdue_count} task(s) that need attention", f"Qu\u00e1 h\u1ea1n: {overdue_count} task c\u1ea7n x\u1eed l\u00fd s\u1edbm"))

                if high_priority_count > 0:
                    lines.append(t(locale, f"High priority pending: {high_priority_count}", f"Task \u01b0u ti\u00ean cao c\u00f2n l\u1ea1i: {high_priority_count}"))

                if overdue_count > 0:
                    tip = t(locale, "Tip: Clear your overdue tasks first.", "G\u1ee3i \u00fd: H\u00e3y x\u1eed l\u00fd c\u00e1c task qu\u00e1 h\u1ea1n tr\u01b0\u1edbc.")
                elif high_priority_count > 0:
                    tip = t(locale, "Tip: Focus on high-priority work first.", "G\u1ee3i \u00fd: H\u00e3y \u01b0u ti\u00ean c\u00e1c task m\u1ee9c cao tr\u01b0\u1edbc.")
                elif pending_count > 0:
                    tip = t(locale, "Tip: Keep moving through your remaining task list.", "G\u1ee3i \u00fd: H\u00e3y ti\u1ebfp t\u1ee5c x\u1eed l\u00fd d\u1ea7n danh s\u00e1ch task c\u00f2n l\u1ea1i.")
                else:
                    tip = t(locale, "Tip: Great job. You can plan your next tasks now.", "G\u1ee3i \u00fd: B\u1ea1n \u0111ang l\u00e0m r\u1ea5t t\u1ed1t. C\u00f3 th\u1ec3 l\u00ean k\u1ebf ho\u1ea1ch cho c\u00e1c task ti\u1ebfp theo.")

                lines.extend(["", tip])
                dispatcher.utter_message(text="\n".join(lines))
            elif response.status_code == 401:
                dispatcher.utter_message(text=t(locale, "I couldn't access your tasks. Please make sure you're logged in.", "M\u00ecnh kh\u00f4ng truy c\u1eadp \u0111\u01b0\u1ee3c task c\u1ee7a b\u1ea1n. H\u00e3y ki\u1ec3m tra l\u1ea1i \u0111\u0103ng nh\u1eadp."))
            else:
                logger.warning(f"API returned status {response.status_code} for user {user_id} session {session_id}")
                dispatcher.utter_message(text=t(locale, "I'm having trouble getting your summary right now. Please try again later.", "M\u00ecnh \u0111ang g\u1eb7p l\u1ed7i khi l\u1ea5y ph\u1ea7n t\u00f3m t\u1eaft tu\u1ea7n. B\u1ea1n th\u1eed l\u1ea1i sau nh\u00e9."))

        except requests.exceptions.Timeout:
            logger.error(f"Timeout calling TaskifyAPI for user {user_id}")
            dispatcher.utter_message(text=t(locale, "The request timed out. Please try again.", "Y\u00eau c\u1ea7u b\u1ecb h\u1ebft th\u1eddi gian. B\u1ea1n th\u1eed l\u1ea1i nh\u00e9."))
        except requests.exceptions.ConnectionError:
            logger.error(f"Connection error calling TaskifyAPI for user {user_id}")
            dispatcher.utter_message(text=t(locale, "I couldn't connect to the task service. Please make sure the server is running.", "M\u00ecnh kh\u00f4ng k\u1ebft n\u1ed1i \u0111\u01b0\u1ee3c t\u1edbi d\u1ecbch v\u1ee5 task. H\u00e3y ki\u1ec3m tra server \u0111ang ch\u1ea1y."))
        except Exception as exc:
            logger.exception(f"Error in action_summarize_week for user {user_id}: {exc}")
            dispatcher.utter_message(text=t(locale, "Something went wrong. Please try again later.", "C\u00f3 l\u1ed7i x\u1ea3y ra. B\u1ea1n th\u1eed l\u1ea1i sau nh\u00e9."))

        return []


class ActionCreateNote(Action):
    """Create a standalone note via internal API."""

    def name(self) -> Text:
        return "action_create_note"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        note_title = tracker.get_slot("note_title")
        note_text = tracker.get_slot("note_text")
        user_message = tracker.latest_message.get("text", "").strip()

        # Derive title if missing
        if not note_title:
            note_title = (note_text or user_message or "New note").strip()
            if len(note_title) > 80:
                note_title = note_title[:80]

        payload = {
            "title": note_title,
            "content": note_text or user_message,
        }

        try:
            url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}"
            response = requests.post(url, json=payload, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code in [200, 201]:
                dispatcher.utter_message(text=f"Đã tạo note: **{note_title}**")
            elif response.status_code == 401:
                dispatcher.utter_message(text="Không thể tạo note. Vui lòng đăng nhập lại.")
            else:
                dispatcher.utter_message(text="Không thể tạo note lúc này. Thử lại sau nhé.")
        except Exception as e:
            logger.exception("Error creating note for user %s: %s", user_id, e)
            dispatcher.utter_message(text="Có lỗi khi tạo note.")

        return []


class ActionListNotes(Action):
    """List recent notes for the user."""

    def name(self) -> Text:
        return "action_list_notes"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)

        try:
            url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}?limit=5"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code != 200:
                dispatcher.utter_message(text="Không lấy được danh sách note.")
                return []

            notes = response.json()
            if not notes:
                dispatcher.utter_message(text="Bạn chưa có note nào.")
                return []

            lines = []
            for i, note in enumerate(notes, 1):
                pin = "📌 " if note.get("isPinned") else ""
                title = note.get("title", "Untitled")
                snippet = (note.get("content") or "")[:60]
                snippet = f" - {snippet}..." if snippet else ""
                lines.append(f"{i}. {pin}{title}{snippet}")

            dispatcher.utter_message(text="Các note gần đây:\n" + "\n".join(lines))
        except Exception as e:
            logger.exception("Error listing notes for user %s: %s", user_id, e)
            dispatcher.utter_message(text="Có lỗi khi lấy note.")

        return []


class ActionSearchNotes(Action):
    """Search notes by keyword."""

    def name(self) -> Text:
        return "action_search_notes"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        keyword = tracker.get_slot("note_keyword") or tracker.latest_message.get("text", "")
        keyword = keyword.strip()

        if not keyword:
            dispatcher.utter_message(text="Bạn muốn tìm gì trong note?")
            return []

        try:
            url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}?limit=5&search={keyword}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code != 200:
                dispatcher.utter_message(text="Không tìm được note.")
                return []

            notes = response.json()
            if not notes:
                dispatcher.utter_message(text=f"Không có note nào khớp với \"{keyword}\".")
                return []

            lines = []
            for i, note in enumerate(notes, 1):
                pin = "📌 " if note.get("isPinned") else ""
                title = note.get("title", "Untitled")
                snippet = (note.get("content") or "")[:60]
                snippet = f" - {snippet}..." if snippet else ""
                lines.append(f"{i}. {pin}{title}{snippet}")

            dispatcher.utter_message(text="Kết quả tìm kiếm:\n" + "\n".join(lines))
        except Exception as e:
            logger.exception("Error searching notes for user %s: %s", user_id, e)
            dispatcher.utter_message(text="Có lỗi khi tìm kiếm note.")

        return []


class ActionTogglePinNote(Action):
    """Toggle or set pin state for a note."""

    def name(self) -> Text:
        return "action_toggle_pin_note"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        pin_state_text = (tracker.get_slot("pin_state") or "").lower()
        desired_pin = None
        if "bỏ" in pin_state_text or "unpin" in pin_state_text or "off" in pin_state_text:
            desired_pin = False
        elif "ghim" in pin_state_text or "pin" in pin_state_text or "on" in pin_state_text:
            desired_pin = True

        keyword = tracker.get_slot("note_title") or tracker.get_slot("note_keyword") or ""

        try:
            # find candidate notes
            search_param = keyword.strip() if keyword else ""
            url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}?limit=3"
            if search_param:
                url += f"&search={search_param}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code != 200:
                dispatcher.utter_message(text="Không tìm thấy note để ghim.")
                return []

            notes = response.json()
            if not notes:
                dispatcher.utter_message(text="Không có note nào khớp.")
                return []

            target = notes[0]
            note_id = target.get("id")
            note_title = target.get("title", "note")

            patch_url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}/{note_id}/pin"
            response = requests.patch(patch_url, json=desired_pin, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code in [200, 201]:
                state_text = "đã ghim" if (desired_pin if desired_pin is not None else not target.get("isPinned", False)) else "đã bỏ ghim"
                dispatcher.utter_message(text=f"{state_text} **{note_title}**")
            else:
                dispatcher.utter_message(text="Không cập nhật được trạng thái ghim.")
        except Exception as e:
            logger.exception("Error pinning note for user %s: %s", user_id, e)
            dispatcher.utter_message(text="Có lỗi khi ghim note.")

        return []
