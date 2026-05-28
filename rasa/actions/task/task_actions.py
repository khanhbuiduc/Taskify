"""
task/task_actions.py — Tất cả Rasa action liên quan đến Task.

Actions:
    - ActionListTasks
    - ValidateCreateTaskForm
    - ActionCancelCreateTask
    - ActionCreateTask
    - ActionDeleteTask
    - ActionHandleConfirmation
    - ActionSummarizeWeek
"""

import logging
import json
import re
from typing import Any, Dict, List, Optional, Text, Tuple
from datetime import datetime, timedelta

import requests
from rasa_sdk import Action, Tracker
from rasa_sdk.events import SlotSet
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.forms import FormValidationAction

from actions.config import TASKIFY_API_URL, REQUEST_TIMEOUT
from actions.common.api_utils import get_api_headers, split_sender
from actions.common.text_utils import (
    get_locale,
    t,
    clean_task_title,
    extract_task_title_from_message,
    first_entity_value,
    reset_create_task_slots,
)
from actions.common.date_utils import (
    build_due_datetime,
    build_due_datetime_from_latest_message,
    extract_duckling_time_window,
    normalize_priority,
    parse_due_date,
)
from actions.common.delete_match_utils import (
    extract_delete_query,
    pick_task_by_title_fuzzy,
)
from actions.common.format_utils import (
    format_task_list,
    utter_ask_task_title,
    utter_create_task_cancelled,
    utter_ask_delete_title,
)

logger = logging.getLogger(__name__)

FILTER_PAGE_SIZE_DEFAULT = 5


def _safe_json_loads(raw: Optional[str]) -> Dict[Text, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _first_entity(latest_message: Dict[Text, Any], entity_name: Text) -> Optional[str]:
    return first_entity_value(latest_message, entity_name)


def _normalize_status_from_text(text: str) -> Optional[str]:
    lowered = text.lower()
    if any(phrase in lowered for phrase in ["todo", "to do", "chưa làm", "chua lam"]):
        return "todo"
    if any(phrase in lowered for phrase in ["in-progress", "in progress", "đang làm", "dang lam"]):
        return "in-progress"
    if any(phrase in lowered for phrase in ["completed", "done", "hoàn thành", "hoan thanh"]):
        return "completed"
    return None


def _normalize_status_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    lowered = value.strip().lower()
    if lowered in {"todo", "to do", "chưa làm", "chua lam"}:
        return "todo"
    if lowered in {"in-progress", "in progress", "đang làm", "dang lam"}:
        return "in-progress"
    if lowered in {"completed", "done", "hoàn thành", "hoan thanh"}:
        return "completed"
    return _normalize_status_from_text(lowered)


def _normalize_priority_from_text(text: str) -> Optional[str]:
    lowered = text.lower()
    if any(phrase in lowered for phrase in ["high", "cao", "ưu tiên cao", "uu tien cao"]):
        return "high"
    if any(phrase in lowered for phrase in ["low", "thấp", "thap", "ưu tiên thấp", "uu tien thap"]):
        return "low"
    if any(phrase in lowered for phrase in ["medium", "trung bình", "trung binh"]):
        return "medium"
    return None


def _normalize_priority_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    lowered = value.strip().lower()
    if lowered in {"high", "cao", "ưu tiên cao", "uu tien cao"}:
        return "high"
    if lowered in {"medium", "trung bình", "trung binh"}:
        return "medium"
    if lowered in {"low", "thấp", "thap", "ưu tiên thấp", "uu tien thap"}:
        return "low"
    return _normalize_priority_from_text(lowered)


def _extract_label_from_text(text: str) -> Optional[str]:
    match = re.search(r"(?:label|nhãn|nhan)\s+([^\s,.;!?]+)", text, flags=re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None


def _extract_search_from_text(text: str) -> Optional[str]:
    match = re.search(
        r"(?:chứa|chua|contains|search|tìm|tim)\s+['\"]?([^'\"\n]+?)['\"]?(?:$|,|;|\.)",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    return None


def _has_overdue_filter(latest_message: Dict[Text, Any], text: str) -> bool:
    due_state = (_first_entity(latest_message, "task_due_state") or "").strip().lower()
    lowered = text.lower()
    overdue_terms = [
        "overdue",
        "quá hạn",
        "qua han",
        "trễ hạn",
        "tre han",
        "quá deadline",
        "qua deadline",
        "đã quá deadline",
        "da qua deadline",
    ]
    return any(term in due_state or term in lowered for term in overdue_terms)


def _extract_due_date_phrase(latest_message: Dict[Text, Any], text: str) -> Optional[str]:
    due_date_entity = _first_entity(latest_message, "due_date")
    if due_date_entity:
        return due_date_entity

    match = re.search(
        r"\b(today|tomorrow|day after tomorrow|next week|next month|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday)\b",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1)

    match = re.search(
        r"(hôm nay|ngày mai|ngày kia|tuần sau|tháng sau|chiều nay|tối nay|sáng mai|"
        r"thứ hai|thứ ba|thứ tư|thứ năm|thứ sáu|thứ bảy|chủ nhật|\d{1,2}/\d{1,2}(?:/\d{2,4})?)",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1)

    return None


def _extract_due_window_from_message(
    latest_message: Dict[Text, Any],
    text: str,
) -> Optional[Tuple[Optional[str], Optional[str]]]:
    due_from_entity = _parse_iso_datetime(_first_entity(latest_message, "due_from"))
    due_to_entity = _parse_iso_datetime(_first_entity(latest_message, "due_to"))
    if due_from_entity or due_to_entity:
        return due_from_entity, due_to_entity

    time_window = extract_duckling_time_window(latest_message)
    if time_window:
        window_start, window_end = time_window
        return window_start.isoformat(), window_end.isoformat()

    due_date_phrase = _extract_due_date_phrase(latest_message, text)
    if not due_date_phrase:
        return None

    parsed_date, _inferred_time, had_date = parse_due_date(due_date_phrase, datetime.now())
    if not had_date:
        return None

    window_start = parsed_date.replace(hour=0, minute=0, second=0, microsecond=0)
    window_end = window_start + timedelta(days=1) - timedelta(microseconds=1)
    return window_start.isoformat(), window_end.isoformat()


def _parse_iso_datetime(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# ActionListTasks
# ---------------------------------------------------------------------------


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

                if latest_intent == "help_prioritize":
                    priority_order = {"high": 0, "medium": 1, "low": 2}
                    pending_tasks = [item for item in tasks if item.get("status") != "completed"]
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
                            f"Đây là danh sách task theo mức ưu tiên (ưu tiên cao và gần hạn nhất trước):\n\n{format_task_list(sorted_tasks, locale)}",
                        )
                        if high_priority_count > 0:
                            message += t(
                                locale,
                                f"\n\nTip: Focus on your {high_priority_count} high-priority task(s) first.",
                                f"\n\nGợi ý: Hãy xử lý {high_priority_count} task ưu tiên cao trước.",
                            )
                    else:
                        message = t(
                            locale,
                            "You have no pending tasks. Great job!",
                            "Bạn không còn task chờ xử lý nào. Làm tốt lắm.",
                        )

                else:
                    if total_count == 0:
                        message = t(
                            locale,
                            "You don't have any tasks yet. Would you like to create one?",
                            "Bạn chưa có task nào. Bạn muốn mình tạo một task không?",
                        )
                    else:
                        summary = t(
                            locale,
                            f"You have {total_count} task(s)",
                            f"Bạn có {total_count} task",
                        )
                        if overdue_count > 0:
                            summary += t(
                                locale,
                                f" ({overdue_count} overdue)",
                                f" ({overdue_count} quá hạn)",
                            )
                        message = f"{summary}:\n\n{format_task_list(tasks, locale)}"

                dispatcher.utter_message(text=message)

            elif response.status_code == 401:
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "I couldn't access your tasks. Please make sure you're logged in.",
                        "Mình không truy cập được task của bạn. Hãy kiểm tra lại đăng nhập.",
                    )
                )
            else:
                logger.warning(
                    "API returned status %s for user %s session %s",
                    response.status_code,
                    user_id,
                    session_id,
                )
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "I'm having trouble accessing your tasks right now. Please try again later.",
                        "Mình đang gặp lỗi khi lấy danh sách task. Bạn thử lại sau nhé.",
                    )
                )

        except requests.exceptions.Timeout:
            logger.error("Timeout calling TaskifyAPI for user %s", user_id)
            dispatcher.utter_message(
                text=t(locale, "The request timed out. Please try again.", "Yêu cầu bị hết thời gian. Bạn thử lại nhé.")
            )
        except requests.exceptions.ConnectionError:
            logger.error("Connection error calling TaskifyAPI for user %s", user_id)
            dispatcher.utter_message(
                text=t(
                    locale,
                    "I couldn't connect to the task service. Please make sure the server is running.",
                    "Mình không kết nối được tới dịch vụ task. Hãy kiểm tra server đang chạy.",
                )
            )
        except Exception as exc:
            logger.exception("Error in action_list_tasks for user %s: %s", user_id, exc)
            dispatcher.utter_message(
                text=t(locale, "Something went wrong. Please try again later.", "Có lỗi xảy ra. Bạn thử lại sau nhé.")
            )

        return []


# ---------------------------------------------------------------------------
# ActionFilterTasks
# ---------------------------------------------------------------------------


class ActionFilterTasks(Action):
    """Filter tasks with pagination via internal API and return typed payload."""

    def name(self) -> Text:
        return "action_filter_tasks"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, session_id = split_sender(tracker.sender_id)
        locale = get_locale(tracker)
        latest_message = tracker.latest_message or {}
        metadata = latest_message.get("metadata") or {}
        latest_text = str(latest_message.get("text") or "").strip()

        state = _safe_json_loads(tracker.get_slot("filter_query_state"))
        state.setdefault("page", 1)
        state.setdefault("pageSize", int(tracker.get_slot("filter_page_size") or FILTER_PAGE_SIZE_DEFAULT))

        action_name = str(metadata.get("action") or "").strip().lower()
        is_paging_action = action_name == "task_filter_page"

        if is_paging_action:
            direction = str(metadata.get("direction") or "").strip().lower()
            current_page = int(state.get("page") or 1)
            if direction == "next":
                state["page"] = current_page + 1
            elif direction == "prev":
                state["page"] = max(1, current_page - 1)
        else:
            # New filter request from text/intent.
            state = self._build_filter_state_from_message(tracker, latest_message, latest_text, state)
            state["page"] = 1
            state["pageSize"] = int(state.get("pageSize") or FILTER_PAGE_SIZE_DEFAULT)

        params = {
            "paged": "true",
            "page": int(state.get("page") or 1),
            "pageSize": int(state.get("pageSize") or FILTER_PAGE_SIZE_DEFAULT),
        }

        for key in ("search", "status", "priority", "label", "dueFrom", "dueTo", "overdue"):
            value = state.get(key)
            if value is not None and value != "":
                params[key] = value

        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{user_id}"
            response = requests.get(
                url,
                params=params,
                headers=get_api_headers(),
                timeout=REQUEST_TIMEOUT,
            )

            if response.status_code == 200:
                data = response.json() or {}
                page = int(data.get("page") or params["page"])
                page_size = int(data.get("pageSize") or params["pageSize"])
                total_count = int(data.get("totalCount") or 0)
                total_pages = int(data.get("totalPages") or 0)
                has_next = bool(data.get("hasNext", False))
                has_prev = bool(data.get("hasPrev", False))
                tasks = data.get("tasks") or []

                # Clamp page if stale paging request crossed boundary.
                if total_pages > 0 and page > total_pages:
                    page = total_pages
                    state["page"] = total_pages
                else:
                    state["page"] = page

                state["pageSize"] = page_size
                payload = {
                    "type": "task_list_page",
                    "tasks": [self._map_task_payload(item) for item in tasks],
                    "page": page,
                    "pageSize": page_size,
                    "totalCount": total_count,
                    "totalPages": total_pages,
                    "hasNext": has_next,
                    "hasPrev": has_prev,
                    "appliedFilters": {
                        "search": state.get("search"),
                        "status": state.get("status"),
                        "priority": state.get("priority"),
                        "label": state.get("label"),
                        "dueFrom": state.get("dueFrom"),
                        "dueTo": state.get("dueTo"),
                        "overdue": state.get("overdue"),
                    },
                }

                if total_count == 0:
                    text = t(
                        locale,
                        "No tasks found for the selected filters.",
                        "Không tìm thấy task nào với bộ lọc hiện tại.",
                    )
                else:
                    text = t(
                        locale,
                        f"Filtered tasks: {total_count} total (page {page}/{max(total_pages, 1)}).",
                        f"Kết quả lọc: {total_count} task (trang {page}/{max(total_pages, 1)}).",
                    )

                dispatcher.utter_message(text=text, json_message=payload)
                return [
                    SlotSet("filter_page", page),
                    SlotSet("filter_page_size", page_size),
                    SlotSet("filter_query_state", json.dumps(state, ensure_ascii=False)),
                ]

            if response.status_code == 401:
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "I couldn't access your tasks. Please make sure you're logged in.",
                        "Mình không truy cập được task của bạn. Hãy kiểm tra lại đăng nhập.",
                    )
                )
            elif response.status_code == 400:
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "The filter is invalid. Try status (todo/in-progress/completed), priority (low/medium/high), or a simpler query.",
                        "Bộ lọc chưa hợp lệ. Bạn thử status (todo/in-progress/completed), priority (low/medium/high), hoặc câu đơn giản hơn nhé.",
                    )
                )
            else:
                logger.warning(
                    "FilterTasks API returned status %s for user %s session %s",
                    response.status_code,
                    user_id,
                    session_id,
                )
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "I couldn't filter tasks right now. Please try again later.",
                        "Mình chưa lọc được task lúc này. Bạn thử lại sau nhé.",
                    )
                )

        except requests.exceptions.Timeout:
            logger.error("Timeout calling TaskifyAPI for filtered tasks user %s", user_id)
            dispatcher.utter_message(
                text=t(locale, "The request timed out. Please try again.", "Yêu cầu bị hết thời gian. Bạn thử lại nhé.")
            )
        except requests.exceptions.ConnectionError:
            logger.error("Connection error calling TaskifyAPI for filtered tasks user %s", user_id)
            dispatcher.utter_message(
                text=t(
                    locale,
                    "I couldn't connect to the task service. Please make sure the server is running.",
                    "Mình không kết nối được tới dịch vụ task. Hãy kiểm tra server đang chạy.",
                )
            )
        except Exception as exc:
            logger.exception("Error in action_filter_tasks for user %s: %s", user_id, exc)
            dispatcher.utter_message(
                text=t(locale, "Something went wrong. Please try again later.", "Có lỗi xảy ra. Bạn thử lại sau nhé.")
            )

        return []

    def _map_task_payload(self, task: Dict[Text, Any]) -> Dict[Text, Any]:
        return {
            "id": str(task.get("id", "")),
            "title": task.get("title", ""),
            "description": task.get("description", ""),
            "priority": task.get("priority", "medium"),
            "status": task.get("status", "todo"),
            "dueDate": task.get("dueDate"),
            "createdAt": task.get("createdAt"),
            "isOverdue": bool(task.get("isOverdue", False)),
            "labels": task.get("labels", []),
        }

    def _build_filter_state_from_message(
        self,
        tracker: Tracker,
        latest_message: Dict[Text, Any],
        latest_text: str,
        previous_state: Dict[Text, Any],
    ) -> Dict[Text, Any]:
        merged = {
            "search": None,
            "status": None,
            "priority": None,
            "label": None,
            "dueFrom": None,
            "dueTo": None,
            "overdue": None,
            "page": 1,
            "pageSize": int(previous_state.get("pageSize") or FILTER_PAGE_SIZE_DEFAULT),
        }

        status_entity = _first_entity(latest_message, "task_status")
        priority_entity = _first_entity(latest_message, "priority")
        label_entity = _first_entity(latest_message, "task_label")
        search_entity = _first_entity(latest_message, "search_query")
        merged["status"] = _normalize_status_value(status_entity) or _normalize_status_from_text(latest_text)
        merged["priority"] = _normalize_priority_value(priority_entity) or _normalize_priority_from_text(latest_text)
        merged["label"] = label_entity or _extract_label_from_text(latest_text)
        merged["search"] = search_entity or _extract_search_from_text(latest_text)
        merged["overdue"] = True if _has_overdue_filter(latest_message, latest_text) else None

        due_window = _extract_due_window_from_message(latest_message, latest_text)
        if due_window:
            merged["dueFrom"], merged["dueTo"] = due_window

        # If no new filter was extracted, keep previous state for better UX.
        has_any_filter = any(
            merged.get(key) for key in ("search", "status", "priority", "label", "dueFrom", "dueTo", "overdue")
        )
        if not has_any_filter and previous_state:
            for key in ("search", "status", "priority", "label", "dueFrom", "dueTo", "overdue"):
                merged[key] = previous_state.get(key)

        return merged


# ---------------------------------------------------------------------------
# ValidateCreateTaskForm
# ---------------------------------------------------------------------------


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
        candidate = extract_task_title_from_message(
            tracker.latest_message, str(slot_value) if slot_value else None
        )
        if candidate:
            return {"task_title": candidate}

        utter_ask_task_title(dispatcher, locale)
        return {"task_title": None}


# ---------------------------------------------------------------------------
# ActionCancelCreateTask
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# ActionCreateTask
# ---------------------------------------------------------------------------


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
        latest_message = tracker.latest_message or {}
        latest_text = latest_message.get("text", "")

        task_title = clean_task_title(tracker.get_slot("task_title"))
        if not task_title:
            task_title = extract_task_title_from_message(latest_message)

        if not task_title:
            utter_ask_task_title(dispatcher, locale)
            return reset_create_task_slots()

        due_date_str = tracker.get_slot("due_date")
        due_time_str = tracker.get_slot("due_time")
        priority = normalize_priority(
            tracker.get_slot("priority")
            or _first_entity(latest_message, "priority")
            or _normalize_priority_from_text(latest_text)
        )
        due_datetime = build_due_datetime_from_latest_message(
            latest_message, due_date_str, due_time_str
        )
        display_title = task_title[0].upper() + task_title[1:] if task_title else "New Task"

        priority_mark = {"high": "!", "medium": "~", "low": "-"}.get(priority, "~")
        priority_label = t(
            locale,
            {"high": "High", "medium": "Medium", "low": "Low"}.get(priority, "Medium"),
            {"high": "Cao", "medium": "Trung bình", "low": "Thấp"}.get(priority, "Trung bình"),
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
                        t(locale, f"Created task: **{task_title_response}**", f"Đã tạo task: **{task_title_response}**")
                        + "\n"
                        + t(locale, f"Due: {due_datetime.strftime('%H:%M %d/%m/%Y')}", f"Hạn: {due_datetime.strftime('%H:%M %d/%m/%Y')}")
                        + "\n"
                        + f"{priority_mark} "
                        + t(locale, f"Priority: {priority_label}", f"Độ ưu tiên: {priority_label}")
                    )
                )
            elif response.status_code == 401:
                dispatcher.utter_message(
                    text=t(locale, "I couldn't create the task. Please log in again.", "Không thể tạo task. Vui lòng đăng nhập lại.")
                )
            else:
                logger.warning(
                    "API returned status %s when creating task for user %s session %s",
                    response.status_code,
                    user_id,
                    session_id,
                )
                dispatcher.utter_message(
                    text=t(locale, "I couldn't create the task right now. Please try again later.", "Không thể tạo task. Vui lòng thử lại sau.")
                )

        except requests.exceptions.Timeout:
            logger.error("Timeout calling TaskifyAPI for user %s", user_id)
            dispatcher.utter_message(
                text=t(locale, "The request timed out. Please try again.", "Yêu cầu bị hết thời gian. Vui lòng thử lại.")
            )
        except requests.exceptions.ConnectionError:
            logger.error("Connection error calling TaskifyAPI for user %s", user_id)
            dispatcher.utter_message(
                text=t(locale, "I couldn't connect to the server. Please check the connection.", "Không kết nối được server. Vui lòng kiểm tra kết nối.")
            )
        except Exception as exc:
            logger.exception("Error in action_create_task for user %s: %s", user_id, exc)
            dispatcher.utter_message(
                text=t(locale, "Something went wrong. Please try again later.", "Có lỗi xảy ra. Vui lòng thử lại sau.")
            )

        return reset_create_task_slots()


# ---------------------------------------------------------------------------
# ActionDeleteTask
# ---------------------------------------------------------------------------


class ActionDeleteTask(Action):
    """Delete task(s) via TaskifyAPI with typed payloads for picker + undo."""

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
        latest_message = tracker.latest_message or {}
        metadata = latest_message.get("metadata") or {}
        action_name = str(metadata.get("action") or "").strip().lower()

        if action_name == "confirm_delete_selection":
            selected_ids = self._coerce_task_ids(metadata.get("taskIds") or [])
            if not selected_ids:
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "No task was selected for deletion.",
                        "Bạn chưa chọn task nào để xóa.",
                    )
                )
                return []
            return self._delete_ids_and_reply(
                dispatcher, user_id, session_id, selected_ids, locale
            )

        if action_name == "undo_delete":
            undo_token = str(metadata.get("undoToken") or "").strip()
            if not undo_token:
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "I couldn't find an undo token for this request.",
                        "Mình không tìm thấy undo token cho yêu cầu này.",
                    )
                )
                return []
            return self._undo_delete_and_reply(
                dispatcher, user_id, session_id, undo_token, locale
            )

        tasks = self._fetch_tasks(user_id)
        if tasks is None:
            dispatcher.utter_message(
                text=t(
                    locale,
                    "I couldn't fetch tasks to delete right now.",
                    "Mình chưa lấy được danh sách task để xóa lúc này.",
                )
            )
            return []

        target_title = extract_delete_query(
            latest_message,
            clean_task_title(tracker.get_slot("task_title"))
            or clean_task_title(extract_task_title_from_message(latest_message)),
        )

        if not target_title:
            utter_ask_delete_title(dispatcher, locale)
            return []

        scored_matches = pick_task_by_title_fuzzy(tasks, target_title)
        matches = [task for task, _score in scored_matches]
        if scored_matches:
            top_scored = "; ".join(
                [
                    f"{item.get('title', '')} ({score:.2f})"
                    for item, score in scored_matches[:5]
                ]
            )
            logger.info("DeleteTask query '%s' scored matches: %s", target_title, top_scored)

        if len(matches) == 0:
            dispatcher.utter_message(
                text=t(
                    locale,
                    "I couldn't find a clear matching task to delete. Please provide a more specific title.",
                    "Mình không tìm thấy task nào khớp để xóa.",
                )
            )
            return []

        if len(matches) == 1:
            task_id = matches[0].get("id")
            if task_id is None:
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "I couldn't identify that task for deletion.",
                        "Mình chưa xác định được task đó để xóa.",
                    )
                )
                return []
            return self._delete_ids_and_reply(
                dispatcher,
                user_id,
                session_id,
                [int(task_id)],
                locale,
            )

        top_matches = matches[:12]
        payload = {
            "type": "task_picker",
            "prompt": t(
                locale,
                f'I found {len(matches)} tasks matching "{target_title}". Select one or more tasks to delete:',
                f'Mình tìm thấy {len(matches)} task khớp "{target_title}". Bạn chọn một hoặc nhiều task để xóa:',
            ),
            "tasks": [
                {
                    "id": str(item.get("id")),
                    "title": item.get("title", ""),
                    "priority": item.get("priority", "medium"),
                    "status": item.get("status", "todo"),
                    "dueDate": item.get("dueDate"),
                    "isOverdue": bool(item.get("isOverdue", False)),
                }
                for item in top_matches
                if item.get("id") is not None
            ],
        }

        preview = "\n".join([f"- {item.get('title', 'Untitled')}" for item in top_matches[:5]])
        dispatcher.utter_message(
            json_message=payload,
        )
        return []

    def _coerce_task_ids(self, raw_ids: Any) -> List[int]:
        if not isinstance(raw_ids, list):
            return []

        ids: List[int] = []
        for value in raw_ids:
            try:
                ids.append(int(str(value)))
            except (TypeError, ValueError):
                continue

        return sorted(set(ids))

    def _fetch_tasks(self, user_id: str) -> Optional[List[Dict[str, Any]]]:
        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{user_id}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code != 200:
                logger.warning(
                    "DeleteTask: failed to fetch tasks for user %s status %s",
                    user_id,
                    response.status_code,
                )
                return None
            data = response.json()
            return data.get("tasks", [])
        except Exception as exc:
            logger.exception("DeleteTask: error fetching tasks for user %s: %s", user_id, exc)
            return None

    def _delete_ids_and_reply(
        self,
        dispatcher: CollectingDispatcher,
        user_id: str,
        session_id: Optional[str],
        task_ids: List[int],
        locale: str,
    ) -> List[Dict[Text, Any]]:
        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{user_id}/delete"
            payload = {"taskIds": task_ids, "sessionId": session_id}
            response = requests.post(url, json=payload, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)

            if response.status_code == 200:
                body = response.json() or {}
                deleted_count = int(body.get("deletedCount", 0))
                deleted_ids = [str(item) for item in body.get("deletedTaskIds", [])]
                deleted_titles = [
                    item.get("title", "")
                    for item in body.get("deletedTasks", [])
                    if isinstance(item, dict)
                ]
                undo_token = str(body.get("undoToken", ""))
                expires_at = str(body.get("expiresAtUtc", ""))

                dispatcher.utter_message(
                    json_message={
                        "type": "delete_result",
                        "deletedCount": deleted_count,
                        "deletedTaskIds": deleted_ids,
                        "deletedTaskTitles": deleted_titles,
                        "undoToken": undo_token,
                        "expiresAtUtc": expires_at,
                    },
                )
            elif response.status_code == 404:
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "I couldn't find matching tasks to delete.",
                        "Mình không tìm thấy task phù hợp để xóa.",
                    )
                )
            else:
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "I couldn't delete tasks right now. Please try again later.",
                        "Không xóa được task lúc này, bạn thử lại sau nhé.",
                    )
                )
                logger.warning(
                    "DeleteTask: batch delete failed for user %s tasks %s status %s",
                    user_id,
                    task_ids,
                    response.status_code,
                )
        except requests.exceptions.Timeout:
            dispatcher.utter_message(
                text=t(
                    locale,
                    "The delete request timed out. Please try again.",
                    "Yêu cầu xóa bị timeout, thử lại nhé.",
                )
            )
        except requests.exceptions.ConnectionError:
            dispatcher.utter_message(
                text=t(
                    locale,
                    "I couldn't connect to the server to delete tasks.",
                    "Không kết nối được server để xóa task.",
                )
            )
        except Exception as exc:
            logger.exception("DeleteTask error for user %s: %s", user_id, exc)
            dispatcher.utter_message(
                text=t(
                    locale,
                    "Something went wrong while deleting tasks.",
                    "Có lỗi khi xóa task.",
                )
            )

        return [
            SlotSet("delete_task_id", None),
            SlotSet("task_title", None),
            SlotSet("due_date", None),
            SlotSet("due_time", None),
            SlotSet("priority", None),
        ]

    def _undo_delete_and_reply(
        self,
        dispatcher: CollectingDispatcher,
        user_id: str,
        session_id: Optional[str],
        undo_token: str,
        locale: str,
    ) -> List[Dict[Text, Any]]:
        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{user_id}/undo-delete"
            payload = {"undoToken": undo_token, "sessionId": session_id}
            response = requests.post(url, json=payload, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)

            if response.status_code == 200:
                body = response.json() or {}
                restored_count = int(body.get("restoredCount", 0))
                restored_ids = [str(item) for item in body.get("restoredTaskIds", [])]
                dispatcher.utter_message(
                    json_message={
                        "type": "undo_result",
                        "restoredCount": restored_count,
                        "restoredTaskIds": restored_ids,
                    },
                )
            elif response.status_code in (400, 404):
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "Undo is no longer available for that delete action.",
                        "Không thể undo thao tác xóa này (có thể đã hết hạn).",
                    )
                )
            else:
                dispatcher.utter_message(
                    text=t(
                        locale,
                        "I couldn't undo the delete right now. Please try again later.",
                        "Không undo được lúc này, bạn thử lại sau nhé.",
                    )
                )
                logger.warning(
                    "UndoDelete: failed for user %s token %s status %s",
                    user_id,
                    undo_token,
                    response.status_code,
                )
        except requests.exceptions.Timeout:
            dispatcher.utter_message(
                text=t(
                    locale,
                    "The undo request timed out. Please try again.",
                    "Yêu cầu undo bị timeout, thử lại nhé.",
                )
            )
        except requests.exceptions.ConnectionError:
            dispatcher.utter_message(
                text=t(
                    locale,
                    "I couldn't connect to the server to undo deletion.",
                    "Không kết nối được server để undo xóa task.",
                )
            )
        except Exception as exc:
            logger.exception("UndoDelete error for user %s token %s: %s", user_id, undo_token, exc)
            dispatcher.utter_message(
                text=t(
                    locale,
                    "Something went wrong while undoing deletion.",
                    "Có lỗi khi undo xóa task.",
                )
            )

        return []

# ---------------------------------------------------------------------------
# ActionHandleConfirmation
# ---------------------------------------------------------------------------


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
            dispatcher.utter_message(text=t(locale, "Got it.", "Đã ghi nhận nhé."))
        elif intent == "deny":
            dispatcher.utter_message(text=t(locale, "Cancelled as requested.", "Đã hủy theo yêu cầu."))
        else:
            dispatcher.utter_message(text=t(locale, "I've noted that.", "Mình đã ghi nhận."))
        return []


# ---------------------------------------------------------------------------
# ActionSummarizeWeek
# ---------------------------------------------------------------------------


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

                lines = [t(locale, "**Your Weekly Summary**", "**Tóm tắt tuần của bạn**"), ""]

                if completed_this_week > 0:
                    lines.append(t(locale, f"Completed this week: {completed_this_week} task(s)", f"Đã hoàn thành tuần này: {completed_this_week} task"))
                else:
                    lines.append(t(locale, "No tasks completed this week yet", "Tuần này bạn chưa hoàn thành task nào"))

                if pending_count > 0:
                    lines.append(t(locale, f"Pending tasks: {pending_count}", f"Task đang chờ xử lý: {pending_count}"))
                else:
                    lines.append(t(locale, "No pending tasks", "Không còn task chờ xử lý"))

                if overdue_count > 0:
                    lines.append(t(locale, f"Overdue: {overdue_count} task(s) that need attention", f"Quá hạn: {overdue_count} task cần xử lý sớm"))

                if high_priority_count > 0:
                    lines.append(t(locale, f"High priority pending: {high_priority_count}", f"Task ưu tiên cao còn lại: {high_priority_count}"))

                if overdue_count > 0:
                    tip = t(locale, "Tip: Clear your overdue tasks first.", "Gợi ý: Hãy xử lý các task quá hạn trước.")
                elif high_priority_count > 0:
                    tip = t(locale, "Tip: Focus on high-priority work first.", "Gợi ý: Hãy ưu tiên các task mức cao trước.")
                elif pending_count > 0:
                    tip = t(locale, "Tip: Keep moving through your remaining task list.", "Gợi ý: Hãy tiếp tục xử lý dần danh sách task còn lại.")
                else:
                    tip = t(locale, "Tip: Great job. You can plan your next tasks now.", "Gợi ý: Bạn đang làm rất tốt. Có thể lên kế hoạch cho các task tiếp theo.")

                lines.extend(["", tip])
                dispatcher.utter_message(text="\n".join(lines))

            elif response.status_code == 401:
                dispatcher.utter_message(
                    text=t(locale, "I couldn't access your tasks. Please make sure you're logged in.", "Mình không truy cập được task của bạn. Hãy kiểm tra lại đăng nhập.")
                )
            else:
                logger.warning("API returned status %s for user %s session %s", response.status_code, user_id, session_id)
                dispatcher.utter_message(
                    text=t(locale, "I'm having trouble getting your summary right now. Please try again later.", "Mình đang gặp lỗi khi lấy phần tóm tắt tuần. Bạn thử lại sau nhé.")
                )

        except requests.exceptions.Timeout:
            logger.error("Timeout calling TaskifyAPI for user %s", user_id)
            dispatcher.utter_message(text=t(locale, "The request timed out. Please try again.", "Yêu cầu bị hết thời gian. Bạn thử lại nhé."))
        except requests.exceptions.ConnectionError:
            logger.error("Connection error calling TaskifyAPI for user %s", user_id)
            dispatcher.utter_message(
                text=t(locale, "I couldn't connect to the task service. Please make sure the server is running.", "Mình không kết nối được tới dịch vụ task. Hãy kiểm tra server đang chạy.")
            )
        except Exception as exc:
            logger.exception("Error in action_summarize_week for user %s: %s", user_id, exc)
            dispatcher.utter_message(text=t(locale, "Something went wrong. Please try again later.", "Có lỗi xảy ra. Bạn thử lại sau nhé."))

        return []
