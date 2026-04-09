"""
common/date_utils.py — Xử lý ngày giờ, parse duckling entity,
                        và chuẩn hóa độ ưu tiên.
"""

import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from actions.common.text_utils import normalize_lower


# ---------------------------------------------------------------------------
# Weekday helper
# ---------------------------------------------------------------------------


def next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Return the next occurrence of ``weekday`` (0=Mon…6=Sun) after start_date."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


# ---------------------------------------------------------------------------
# Time parsing
# ---------------------------------------------------------------------------


def parse_time(time_str: Optional[str]) -> Optional[Tuple[int, int]]:
    """Parse a time string and return (hour, minute) or None."""
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


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def parse_due_date(
    date_str: Optional[str], now: datetime
) -> Tuple[datetime, Optional[Tuple[int, int]], bool]:
    """Parse a natural-language date string.

    Returns:
        (result_date, inferred_time, had_date)
    """
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
    """Combine a date string and a time string into a datetime."""
    now = datetime.now()
    result_date, inferred_time, had_date = parse_due_date(date_str, now)
    parsed_time = parse_time(time_str) if time_str else None
    final_time = parsed_time or inferred_time

    if final_time:
        return result_date.replace(hour=final_time[0], minute=final_time[1], second=0, microsecond=0)
    if had_date:
        return result_date.replace(hour=23, minute=59, second=59, microsecond=0)
    return now.replace(hour=23, minute=59, second=59, microsecond=0)


# ---------------------------------------------------------------------------
# Priority normalization
# ---------------------------------------------------------------------------


def normalize_priority(priority: Optional[str]) -> str:
    """Map Vietnamese / English priority synonyms to 'high' | 'medium' | 'low'."""
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


# ---------------------------------------------------------------------------
# Duckling / datetime value parsing
# ---------------------------------------------------------------------------


def parse_datetime_value(raw_value: Any) -> Optional[datetime]:
    if not isinstance(raw_value, str):
        return None

    candidate = raw_value.strip()
    if not candidate:
        return None

    try:
        parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError:
        return None

    if parsed.tzinfo is not None:
        return parsed.astimezone().replace(tzinfo=None)
    return parsed


def parse_time_interval_from_entity(
    entity: Dict[str, Any],
) -> Optional[Tuple[datetime, datetime]]:
    additional_info = entity.get("additional_info")
    if isinstance(additional_info, dict):
        if additional_info.get("type") == "interval":
            from_info = additional_info.get("from")
            to_info = additional_info.get("to")
            from_value = from_info.get("value") if isinstance(from_info, dict) else from_info
            to_value = to_info.get("value") if isinstance(to_info, dict) else to_info
            from_dt = parse_datetime_value(from_value)
            to_dt = parse_datetime_value(to_value)
            if from_dt and to_dt:
                return from_dt, to_dt

        if additional_info.get("type") == "value":
            value_dt = parse_datetime_value(additional_info.get("value"))
            if value_dt:
                start = value_dt.replace(hour=0, minute=0, second=0, microsecond=0)
                return start, start + timedelta(days=1)

    value = entity.get("value")
    if isinstance(value, dict):
        from_info = value.get("from")
        to_info = value.get("to")
        from_value = from_info.get("value") if isinstance(from_info, dict) else from_info
        to_value = to_info.get("value") if isinstance(to_info, dict) else to_info
        from_dt = parse_datetime_value(from_value)
        to_dt = parse_datetime_value(to_value)
        if from_dt and to_dt:
            return from_dt, to_dt

    value_dt = parse_datetime_value(value)
    if value_dt:
        start = value_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, start + timedelta(days=1)

    return None


def extract_duckling_time_window(
    latest_message: Dict[str, Any],
) -> Optional[Tuple[datetime, datetime]]:
    entities = latest_message.get("entities", []) or []
    for entity in entities:
        if entity.get("entity") != "time":
            continue
        interval = parse_time_interval_from_entity(entity)
        if interval:
            return interval
    return None


def parse_task_due_datetime(task: Dict[str, Any]) -> Optional[datetime]:
    due_date = task.get("dueDate")
    return parse_datetime_value(due_date)


def filter_tasks_due_in_window(
    tasks: List[Dict[str, Any]],
    window_start: datetime,
    window_end: datetime,
) -> List[Dict[str, Any]]:
    filtered: List[Dict[str, Any]] = []
    for task in tasks:
        if task.get("status") == "completed":
            continue
        due_dt = parse_task_due_datetime(task)
        if not due_dt:
            continue
        if window_start <= due_dt < window_end:
            filtered.append(task)
    return filtered
