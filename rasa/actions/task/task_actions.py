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
from typing import Any, Dict, List, Optional, Text

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
    reset_create_task_slots,
)
from actions.common.date_utils import (
    build_due_datetime,
    extract_duckling_time_window,
    filter_tasks_due_in_window,
    normalize_priority,
)
from actions.common.format_utils import (
    format_task_list,
    pick_task_by_title,
    utter_ask_task_title,
    utter_create_task_cancelled,
    utter_ask_delete_title,
    utter_confirm_delete,
)

logger = logging.getLogger(__name__)


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

                if latest_intent == "list_tasks_by_date":
                    time_window = extract_duckling_time_window(tracker.latest_message or {})
                    if not time_window:
                        message = t(
                            locale,
                            "I couldn't understand the date. Try: today, tomorrow, day after tomorrow, yesterday, two days ago, or 30/4.",
                            "Mình chưa hiểu mốc ngày. Bạn thử nói: hôm nay, ngày mai, ngày kia, hôm qua, hôm kia, hoặc 30/4.",
                        )
                    else:
                        window_start, window_end = time_window
                        tasks_for_date = filter_tasks_due_in_window(tasks, window_start, window_end)
                        target_day = window_start.strftime("%d/%m/%Y")

                        if tasks_for_date:
                            message = t(
                                locale,
                                f"Tasks due on {target_day} ({len(tasks_for_date)}):\n\n{format_task_list(tasks_for_date, locale)}",
                                f"Task hạn ngày {target_day} ({len(tasks_for_date)}):\n\n{format_task_list(tasks_for_date, locale)}",
                            )
                        else:
                            message = t(
                                locale,
                                f"You have no pending tasks due on {target_day}.",
                                f"Bạn không có task chưa hoàn thành nào hạn ngày {target_day}.",
                            )

                elif latest_intent == "list_overdue_tasks":
                    overdue_tasks = [item for item in tasks if item.get("isOverdue", False)]
                    if overdue_tasks:
                        message = t(
                            locale,
                            f"You have {len(overdue_tasks)} overdue task(s):\n\n{format_task_list(overdue_tasks, locale)}",
                            f"Bạn có {len(overdue_tasks)} task quá hạn:\n\n{format_task_list(overdue_tasks, locale)}",
                        )
                    else:
                        message = t(
                            locale,
                            "Great news! You don't have any overdue tasks.",
                            "Tin tốt là bạn không có task quá hạn nào.",
                        )

                elif latest_intent == "help_prioritize":
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
            dispatcher.utter_message(
                text=t(locale, "I couldn't fetch tasks to delete right now.", "Mình chưa lấy được danh sách task để xóa lúc này.")
            )
            return []

        if not target_title:
            utter_ask_delete_title(dispatcher, locale)
            return []

        matches = pick_task_by_title(tasks, target_title)

        if len(matches) == 0:
            dispatcher.utter_message(
                text=t(locale, "I couldn't find a matching task to delete.", "Mình không tìm thấy task nào khớp để xóa.")
            )
            return []

        if len(matches) > 1:
            preview = "\n".join([f"- {item.get('title', 'Untitled')}" for item in matches[:5]])
            dispatcher.utter_message(
                text=t(
                    locale,
                    f"I found {len(matches)} matching tasks:\n{preview}\nPlease be more specific about which task should be deleted.",
                    f"Mình thấy {len(matches)} task khớp:\n{preview}\nHãy nói rõ hơn task nào cần xóa.",
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
                logger.warning("DeleteTask: failed to fetch tasks for user %s status %s", user_id, response.status_code)
                return None
            data = response.json()
            return data.get("tasks", [])
        except Exception as exc:
            logger.exception("DeleteTask: error fetching tasks for user %s: %s", user_id, exc)
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
                dispatcher.utter_message(
                    text=t(locale, f'Deleted "{task_title or "task"}".', f'Đã xóa task "{task_title or "task"}".')
                )
            elif response.status_code == 404:
                dispatcher.utter_message(
                    text=t(locale, "I couldn't find that task to delete.", "Mình không tìm thấy task đó để xóa.")
                )
            else:
                dispatcher.utter_message(
                    text=t(locale, "I couldn't delete the task right now. Please try again later.", "Không xóa được task lúc này, thử lại sau nhé.")
                )
                logger.warning("DeleteTask: delete failed for user %s task %s status %s", user_id, task_id, response.status_code)
        except requests.exceptions.Timeout:
            dispatcher.utter_message(text=t(locale, "The delete request timed out. Please try again.", "Yêu cầu xóa bị timeout, thử lại nhé."))
        except requests.exceptions.ConnectionError:
            dispatcher.utter_message(text=t(locale, "I couldn't connect to the server to delete the task.", "Không kết nối được server để xóa task."))
        except Exception as exc:
            logger.exception("DeleteTask error for user %s: %s", user_id, exc)
            dispatcher.utter_message(text=t(locale, "Something went wrong while deleting the task.", "Có lỗi khi xóa task."))

        return [
            SlotSet("delete_task_id", None),
            SlotSet("task_title", None),
            SlotSet("due_date", None),
            SlotSet("due_time", None),
            SlotSet("priority", None),
        ]


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
