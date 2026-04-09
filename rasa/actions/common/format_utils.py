"""
common/format_utils.py — Format output cho chat và các hàm utter_* dùng chung.
"""

from datetime import datetime
from typing import Any, Dict, List

from rasa_sdk.executor import CollectingDispatcher

from actions.common.text_utils import t


# ---------------------------------------------------------------------------
# Task list formatting
# ---------------------------------------------------------------------------


def format_task_list(tasks: List[Dict[str, Any]], locale: str, max_items: int = 5) -> str:
    """Format a list of tasks for display in chat."""
    if not tasks:
        return t(locale, "You don't have any tasks yet.", "Bạn chưa có task nào.")

    lines: List[str] = []
    for i, task in enumerate(tasks[:max_items], 1):
        priority_mark = {"high": "!", "medium": "~", "low": "-"}.get(
            task.get("priority", "medium"), "-"
        )
        status_mark = {"completed": "[x]", "in-progress": "[~]", "todo": "[ ]"}.get(
            task.get("status", "todo"), "[ ]"
        )

        due_date = task.get("dueDate", "")
        if due_date:
            try:
                dt = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
                due_str = dt.strftime("%b %d")
            except ValueError:
                due_str = due_date[:10] if len(due_date) >= 10 else due_date
        else:
            due_str = t(locale, "No date", "Chưa có hạn")

        overdue_marker = (
            t(locale, " OVERDUE", " QUÁ HẠN") if task.get("isOverdue", False) else ""
        )
        due_label = t(locale, "Due", "Hạn")
        untitled = t(locale, "Untitled", "Chưa đặt tên")
        lines.append(
            f"{i}. {status_mark} {task.get('title', untitled)} {priority_mark}"
            f" ({due_label}: {due_str}){overdue_marker}"
        )

    if len(tasks) > max_items:
        lines.append(
            t(
                locale,
                f"... and {len(tasks) - max_items} more tasks",
                f"... và còn {len(tasks) - max_items} task khác",
            )
        )

    return "\n".join(lines)


def pick_task_by_title(tasks: List[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
    """Return tasks whose title contains the query (case-insensitive)."""
    q = (query or "").lower().strip()
    if not q:
        return []
    return [task for task in tasks if q in task.get("title", "").lower()]


# ---------------------------------------------------------------------------
# Shared utter helpers
# ---------------------------------------------------------------------------


def utter_ask_task_title(dispatcher: CollectingDispatcher, locale: str) -> None:
    dispatcher.utter_message(
        text=t(
            locale,
            "What would you like to name this task?",
            "Bạn muốn đặt tên task này là gì?",
        )
    )


def utter_create_task_cancelled(dispatcher: CollectingDispatcher, locale: str) -> None:
    dispatcher.utter_message(text=t(locale, "Cancelled task creation.", "Đã hủy tạo task."))


def utter_ask_delete_title(dispatcher: CollectingDispatcher, locale: str) -> None:
    dispatcher.utter_message(
        text=t(
            locale,
            "Which task should I delete? Please give the title.",
            "Bạn muốn xóa task nào? Hãy cho mình tên task.",
        )
    )


def utter_confirm_delete(
    dispatcher: CollectingDispatcher, locale: str, task_title: str
) -> None:
    dispatcher.utter_message(
        text=t(
            locale,
            f'Are you sure you want to delete "{task_title}"?',
            f'Bạn có chắc muốn xóa "{task_title}" không?',
        )
    )
