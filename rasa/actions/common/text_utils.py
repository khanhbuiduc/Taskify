"""
common/text_utils.py — Xử lý text, phát hiện ngôn ngữ, entity extraction,
                        và làm sạch tiêu đề task từ NLU message.
"""

import re
from typing import Any, Dict, List, Optional, Text, Tuple

from rasa_sdk import Tracker
from rasa_sdk.events import ActiveLoop, SlotSet

from actions.config import VIETNAMESE_CHAR_PATTERN, VIETNAMESE_HINT_PATTERN

# ---------------------------------------------------------------------------
# Locale detection
# ---------------------------------------------------------------------------


def normalize_whitespace(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip(" \t\r\n-:,.\"'")


def normalize_lower(value: Optional[str]) -> str:
    return normalize_whitespace(value).lower()


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
    """Return Vietnamese string if locale is 'vi', otherwise English."""
    if locale and locale.lower().startswith("vi"):
        return vi
    return en


# ---------------------------------------------------------------------------
# Regex pattern builder
# ---------------------------------------------------------------------------


def compile_term_pattern(terms: List[str], prefix_only: bool = False) -> re.Pattern:
    escaped_terms = sorted((re.escape(term) for term in terms if term), key=len, reverse=True)
    if prefix_only:
        pattern = rf"^(?:{'|'.join(escaped_terms)})(?=\s|$)"
    else:
        pattern = rf"(?<!\w)(?:{'|'.join(escaped_terms)})(?!\w)"
    return re.compile(pattern, re.IGNORECASE)


# ---------------------------------------------------------------------------
# Constants for title / metadata detection
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# Title stripping helpers
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Entity span utilities
# ---------------------------------------------------------------------------


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


def strip_entity_spans(
    text: str, entities: List[Dict[str, Any]], excluded_entities: Optional[set] = None
) -> str:
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


# ---------------------------------------------------------------------------
# Metadata / trigger detection
# ---------------------------------------------------------------------------


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
    return (
        stripped in DATE_ONLY_TERMS
        or stripped in PRIORITY_ONLY_TERMS
        or TIME_ONLY_PATTERN.fullmatch(stripped) is not None
    )


# ---------------------------------------------------------------------------
# Task title extraction
# ---------------------------------------------------------------------------


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


def extract_task_title_from_message(
    latest_message: Dict[str, Any], fallback: Optional[str] = None
) -> Optional[str]:
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


# ---------------------------------------------------------------------------
# Slot reset helper
# ---------------------------------------------------------------------------


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
