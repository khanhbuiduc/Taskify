# Rasa custom actions for Taskify (phase 2).
# Run from rasa folder: pip install -r actions/requirements.txt && rasa run actions
# Requires: action_endpoint in endpoints.yml and actions in domain.yml to be enabled.

import os
import re
import logging
from typing import Any, Text, Dict, List, Optional, Tuple
from datetime import datetime, timedelta

import requests
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet

# Configuration - can be overridden by environment variables
TASKIFY_API_URL = os.getenv("TASKIFY_API_URL", "http://localhost:5116")
RASA_API_KEY = os.getenv("RASA_API_KEY", "rasa-internal-api-key-taskify-2026")
REQUEST_TIMEOUT = 10  # seconds

logger = logging.getLogger(__name__)

# Trigger phrases that should NOT be used as task titles
TRIGGER_PHRASES = [
    "tạo task", "thêm task", "tạo nhiệm vụ", "thêm nhiệm vụ",
    "nhiệm vụ mới", "task mới", "tôi muốn tạo", "tạo việc mới",
    "thêm công việc", "tạo công việc",
    "create task", "new task", "add task", "create a task",
    "add a task", "i want to create", "i want to add",
    "create a new task", "add a new task", "i want to create a task",
    "i want to add a task"
]


def get_api_headers() -> Dict[str, str]:
    """Get headers for internal API calls."""
    return {
        "Content-Type": "application/json",
        "X-Rasa-Token": RASA_API_KEY
    }


def format_task_list(tasks: List[Dict], max_items: int = 5) -> str:
    """Format a list of tasks for display in chat."""
    if not tasks:
        return "You don't have any tasks yet."
    
    lines = []
    for i, task in enumerate(tasks[:max_items], 1):
        priority_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(task.get("priority", "medium"), "⚪")
        status_emoji = {"completed": "✅", "in-progress": "🔄", "todo": "📋"}.get(task.get("status", "todo"), "📋")
        
        due_date = task.get("dueDate", "")
        if due_date:
            try:
                dt = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
                due_str = dt.strftime("%b %d")
            except:
                due_str = due_date[:10] if len(due_date) >= 10 else due_date
        else:
            due_str = "No date"
        
        overdue_marker = " ⚠️ OVERDUE" if task.get("isOverdue", False) else ""
        lines.append(f"{i}. {status_emoji} {task.get('title', 'Untitled')} {priority_emoji} (Due: {due_str}){overdue_marker}")
    
    if len(tasks) > max_items:
        lines.append(f"... and {len(tasks) - max_items} more tasks")
    
    return "\n".join(lines)


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
        sender_id = tracker.sender_id
        
        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{sender_id}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            
            if response.status_code == 200:
                data = response.json()
                tasks = data.get("tasks", [])
                overdue_count = data.get("overdueCount", 0)
                total_count = data.get("totalCount", 0)
                high_priority_count = data.get("highPriorityCount", 0)
                
                # Check if user asked specifically about overdue tasks
                latest_intent = tracker.latest_message.get("intent", {}).get("name", "")
                
                if latest_intent == "list_overdue_tasks":
                    overdue_tasks = [t for t in tasks if t.get("isOverdue", False)]
                    if overdue_tasks:
                        message = f"⚠️ You have {len(overdue_tasks)} overdue task(s):\n\n{format_task_list(overdue_tasks)}"
                    else:
                        message = "✅ Great news! You don't have any overdue tasks."
                elif latest_intent == "help_prioritize":
                    # Sort by priority (high first) and due date
                    priority_order = {"high": 0, "medium": 1, "low": 2}
                    pending_tasks = [t for t in tasks if t.get("status") != "completed"]
                    sorted_tasks = sorted(pending_tasks, key=lambda t: (priority_order.get(t.get("priority", "medium"), 1), t.get("dueDate", "")))
                    
                    if sorted_tasks:
                        message = f"📊 Here are your tasks prioritized (high priority & earliest due first):\n\n{format_task_list(sorted_tasks)}"
                        if high_priority_count > 0:
                            message += f"\n\n💡 Tip: Focus on your {high_priority_count} high-priority task(s) first!"
                    else:
                        message = "✅ You have no pending tasks. Great job!"
                else:
                    # General task listing
                    if total_count == 0:
                        message = "📋 You don't have any tasks yet. Would you like to create one?"
                    else:
                        summary = f"📋 You have {total_count} task(s)"
                        if overdue_count > 0:
                            summary += f" ({overdue_count} overdue)"
                        summary += ":\n\n"
                        message = summary + format_task_list(tasks)
                
                dispatcher.utter_message(text=message)
            elif response.status_code == 401:
                dispatcher.utter_message(text="I couldn't access your tasks. Please make sure you're logged in.")
            else:
                logger.warning(f"API returned status {response.status_code} for user {sender_id}")
                dispatcher.utter_message(text="I'm having trouble accessing your tasks right now. Please try again later.")
                
        except requests.exceptions.Timeout:
            logger.error(f"Timeout calling TaskifyAPI for user {sender_id}")
            dispatcher.utter_message(text="The request timed out. Please try again.")
        except requests.exceptions.ConnectionError:
            logger.error(f"Connection error calling TaskifyAPI for user {sender_id}")
            dispatcher.utter_message(text="I couldn't connect to the task service. Please make sure the server is running.")
        except Exception as e:
            logger.exception(f"Error in action_list_tasks for user {sender_id}: {e}")
            dispatcher.utter_message(text="Something went wrong. Please try again later.")
        
        return []


class ActionCreateTask(Action):
    """Create a new task via TaskifyAPI with entity extraction."""

    def name(self) -> Text:
        return "action_create_task"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        sender_id = tracker.sender_id
        user_message = tracker.latest_message.get("text", "").strip().lower()
        
        # Extract from slots (filled by entity extraction)
        task_title = tracker.get_slot("task_title")
        due_date_str = tracker.get_slot("due_date")
        due_time_str = tracker.get_slot("due_time")
        priority = tracker.get_slot("priority") or "medium"
        
        # Check if user only sent trigger phrase without task info
        if self._is_trigger_only(user_message, task_title):
            dispatcher.utter_message(
                text="Bạn muốn tạo task gì? Vui lòng cho tôi biết tiêu đề task.\n"
                     "Ví dụ: 'thêm nhiệm vụ học SQL trước 16h'"
            )
            return [
                SlotSet("task_title", None),
                SlotSet("due_date", None),
                SlotSet("due_time", None),
                SlotSet("priority", None)
            ]
        
        # Validate required fields
        if not task_title or len(task_title.strip()) < 2:
            dispatcher.utter_message(
                text="Task cần có tiêu đề. Tên task là gì vậy bạn?\n"
                     "What would you like to name this task?"
            )
            return []
        
        # Capitalize first letter
        task_title = task_title.strip()
        task_title = task_title[0].upper() + task_title[1:] if task_title else "New Task"
        
        # Parse due datetime (date + time)
        due_datetime = self._parse_due_datetime(due_date_str, due_time_str)
        
        # Normalize priority
        priority = self._normalize_priority(priority)
        
        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{sender_id}"
            payload = {
                "title": task_title,
                "description": "Created via AI assistant",
                "priority": priority,
                "dueDate": due_datetime.isoformat() if due_datetime else None
            }
            
            response = requests.post(url, json=payload, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            
            if response.status_code in [200, 201]:
                task = response.json()
                task_title_response = task.get("title", task_title)
                
                # Build response message
                time_info = ""
                if due_datetime:
                    time_info = f"\n📅 Hạn: {due_datetime.strftime('%H:%M %d/%m/%Y')}"
                
                priority_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(priority, "🟡")
                priority_vn = {"high": "Cao", "medium": "Trung bình", "low": "Thấp"}.get(priority, "Trung bình")
                
                dispatcher.utter_message(
                    text=f"✅ Đã tạo task: **{task_title_response}**{time_info}\n"
                         f"{priority_emoji} Độ ưu tiên: {priority_vn}"
                )
            elif response.status_code == 401:
                dispatcher.utter_message(text="Không thể tạo task. Vui lòng đăng nhập lại.")
            else:
                logger.warning(f"API returned status {response.status_code} when creating task for user {sender_id}")
                dispatcher.utter_message(text="Không thể tạo task. Vui lòng thử lại sau.")
                
        except requests.exceptions.Timeout:
            logger.error(f"Timeout calling TaskifyAPI for user {sender_id}")
            dispatcher.utter_message(text="Yêu cầu hết thời gian. Vui lòng thử lại.")
        except requests.exceptions.ConnectionError:
            logger.error(f"Connection error calling TaskifyAPI for user {sender_id}")
            dispatcher.utter_message(text="Không kết nối được server. Vui lòng kiểm tra kết nối.")
        except Exception as e:
            logger.exception(f"Error in action_create_task for user {sender_id}: {e}")
            dispatcher.utter_message(text="Có lỗi xảy ra. Vui lòng thử lại sau.")
        
        # Reset slots for next task
        return [
            SlotSet("task_title", None),
            SlotSet("due_date", None),
            SlotSet("due_time", None),
            SlotSet("priority", None)
        ]
    
    def _is_trigger_only(self, message: str, extracted_title: Optional[str]) -> bool:
        """
        Check if message is just a trigger phrase without actual task info.
        Examples: "tạo task", "thêm nhiệm vụ", "new task"
        """
        message = message.lower().strip()
        
        # If we extracted a title, check if it's just the trigger phrase itself
        if extracted_title:
            title_lower = extracted_title.lower().strip()
            for phrase in TRIGGER_PHRASES:
                if title_lower == phrase or phrase == title_lower:
                    return True
            return False
        
        # No title extracted - check if message is just trigger
        for phrase in TRIGGER_PHRASES:
            if message == phrase:
                return True
            # Check if message starts with trigger and has minimal content after
            if message.startswith(phrase):
                remaining = message[len(phrase):].strip()
                # Remove common filler words
                for filler in ["một", "cái", "a", "the", "for", "cho", "để"]:
                    remaining = remaining.replace(filler, "").strip()
                if len(remaining) < 3:
                    return True
        
        return not extracted_title
    
    def _parse_due_datetime(self, date_str: Optional[str], time_str: Optional[str]) -> Optional[datetime]:
        """
        Parse both date and time into a single datetime.
        Handles: "16h", "16h30", "3pm", "14:00", "chiều nay"
        """
        today = datetime.now()
        result_date = today
        result_time = None
        
        # Parse date
        if date_str:
            date_lower = date_str.lower().strip()
            if date_lower in ["today", "hôm nay"]:
                result_date = today
            elif date_lower in ["tomorrow", "ngày mai"]:
                result_date = today + timedelta(days=1)
            elif date_lower in ["ngày kia", "day after tomorrow"]:
                result_date = today + timedelta(days=2)
            elif "tuần sau" in date_lower or "next week" in date_lower:
                result_date = today + timedelta(days=7)
            elif "tháng sau" in date_lower or "next month" in date_lower:
                result_date = today + timedelta(days=30)
            elif "chiều nay" in date_lower:
                result_date = today
                result_time = (14, 0)
            elif "tối nay" in date_lower:
                result_date = today
                result_time = (19, 0)
            elif "sáng mai" in date_lower:
                result_date = today + timedelta(days=1)
                result_time = (9, 0)
            # Handle weekdays
            elif "thứ hai" in date_lower or "monday" in date_lower:
                result_date = self._next_weekday(today, 0)
            elif "thứ ba" in date_lower or "tuesday" in date_lower:
                result_date = self._next_weekday(today, 1)
            elif "thứ tư" in date_lower or "wednesday" in date_lower:
                result_date = self._next_weekday(today, 2)
            elif "thứ năm" in date_lower or "thursday" in date_lower:
                result_date = self._next_weekday(today, 3)
            elif "thứ sáu" in date_lower or "friday" in date_lower:
                result_date = self._next_weekday(today, 4)
            elif "thứ bảy" in date_lower or "saturday" in date_lower:
                result_date = self._next_weekday(today, 5)
            elif "chủ nhật" in date_lower or "sunday" in date_lower:
                result_date = self._next_weekday(today, 6)
        
        # Parse time - overrides time from date parsing if both exist
        if time_str:
            parsed_time = self._parse_time(time_str)
            if parsed_time:
                result_time = parsed_time
        
        # Combine date and time
        if result_time:
            return result_date.replace(
                hour=result_time[0],
                minute=result_time[1],
                second=0,
                microsecond=0
            )
        
        # Default to end of day if only date is provided
        if date_str and not time_str:
            return result_date.replace(hour=23, minute=59, second=0, microsecond=0)
        
        # If only time is provided, use today
        if time_str and not date_str and result_time:
            return today.replace(
                hour=result_time[0],
                minute=result_time[1],
                second=0,
                microsecond=0
            )
        
        return None
    
    def _next_weekday(self, start_date: datetime, weekday: int) -> datetime:
        """Get next occurrence of weekday (0=Monday, 6=Sunday)."""
        days_ahead = weekday - start_date.weekday()
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        return start_date + timedelta(days=days_ahead)
    
    def _normalize_priority(self, priority: str) -> str:
        """Normalize priority value to one of: high, medium, low."""
        if not priority:
            return "medium"
        priority = priority.lower().strip()
        high_synonyms = {"high", "urgent", "critical", "important", "asap",
                         "khẩn cấp", "quan trọng", "gấp", "cao", "ưu tiên cao"}
        low_synonyms = {"low", "minor", "not urgent", "whenever",
                        "không gấp", "thấp", "ưu tiên thấp", "khi nào cũng được"}
        if priority in high_synonyms:
            return "high"
        if priority in low_synonyms:
            return "low"
        return "medium"

    def _parse_time(self, time_str: str) -> Optional[Tuple[int, int]]:
        """
        Parse time string to (hour, minute) tuple.
        Handles Vietnamese and English formats.
        """
        if not time_str:
            return None
            
        time_str = time_str.lower().strip()
        
        # Check for Vietnamese time qualifiers FIRST (sáng/chiều/tối/trưa)
        # Pattern: "10h sáng", "3h chiều", "tối nay"
        if 'sáng' in time_str:
            match = re.search(r'(\d{1,2})', time_str)
            if match:
                hour = int(match.group(1))
                return (hour, 0) if 0 <= hour <= 12 else None
            return (9, 0)  # Default morning
        elif 'trưa' in time_str:
            match = re.search(r'(\d{1,2})', time_str)
            if match:
                return (12, 0)
            return (12, 0)
        elif 'chiều' in time_str:
            match = re.search(r'(\d{1,2})', time_str)
            if match:
                hour = int(match.group(1))
                if hour < 12:
                    hour += 12
                return (hour, 0) if hour <= 23 else None
            return (14, 0)  # Default afternoon
        elif 'tối' in time_str:
            match = re.search(r'(\d{1,2})', time_str)
            if match:
                hour = int(match.group(1))
                if hour < 12:
                    hour += 12
                return (hour, 0) if hour <= 23 else None
            return (19, 0)  # Default evening
        
        # Pattern: "16h" or "16h30" (simple 24-hour format without qualifier)
        match = re.match(r'(\d{1,2})h(\d{1,2})?$', time_str)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2)) if match.group(2) else 0
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return (hour, minute)
        
        # Pattern: "14:00" or "2:30"
        match = re.match(r'(\d{1,2}):(\d{2})', time_str)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return (hour, minute)
        
        # Pattern: "3pm" or "3am"
        match = re.match(r'(\d{1,2})\s*(am|pm)', time_str)
        if match:
            hour = int(match.group(1))
            if match.group(2) == 'pm' and hour != 12:
                hour += 12
            elif match.group(2) == 'am' and hour == 12:
                hour = 0
            if 0 <= hour <= 23:
                return (hour, 0)
        
        return None


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
        sender_id = tracker.sender_id
        
        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{sender_id}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            
            if response.status_code == 200:
                data = response.json()
                total_count = data.get("totalCount", 0)
                overdue_count = data.get("overdueCount", 0)
                completed_this_week = data.get("completedThisWeek", 0)
                pending_count = data.get("pendingCount", 0)
                high_priority_count = data.get("highPriorityCount", 0)
                
                # Build summary message
                lines = ["📊 **Your Weekly Summary**\n"]
                
                # Completion stats
                if completed_this_week > 0:
                    lines.append(f"✅ Completed this week: {completed_this_week} task(s)")
                else:
                    lines.append("📝 No tasks completed this week yet")
                
                # Pending stats
                if pending_count > 0:
                    lines.append(f"📋 Pending tasks: {pending_count}")
                else:
                    lines.append("🎉 No pending tasks!")
                
                # Overdue warning
                if overdue_count > 0:
                    lines.append(f"⚠️ Overdue: {overdue_count} task(s) - these need attention!")
                
                # High priority
                if high_priority_count > 0:
                    lines.append(f"🔴 High priority pending: {high_priority_count}")
                
                # Productivity tip
                lines.append("\n💡 **Tip**: ")
                if overdue_count > 0:
                    lines.append("Focus on clearing your overdue tasks first!")
                elif high_priority_count > 0:
                    lines.append("Tackle your high-priority tasks to stay on track!")
                elif pending_count > 0:
                    lines.append("You're doing well! Keep working through your task list.")
                else:
                    lines.append("Amazing! You've cleared all your tasks. Time to plan ahead!")
                
                message = "\n".join(lines)
                dispatcher.utter_message(text=message)
                
            elif response.status_code == 401:
                dispatcher.utter_message(text="I couldn't access your tasks. Please make sure you're logged in.")
            else:
                logger.warning(f"API returned status {response.status_code} for user {sender_id}")
                dispatcher.utter_message(text="I'm having trouble getting your summary right now. Please try again later.")
                
        except requests.exceptions.Timeout:
            logger.error(f"Timeout calling TaskifyAPI for user {sender_id}")
            dispatcher.utter_message(text="The request timed out. Please try again.")
        except requests.exceptions.ConnectionError:
            logger.error(f"Connection error calling TaskifyAPI for user {sender_id}")
            dispatcher.utter_message(text="I couldn't connect to the task service. Please make sure the server is running.")
        except Exception as e:
            logger.exception(f"Error in action_summarize_week for user {sender_id}: {e}")
            dispatcher.utter_message(text="Something went wrong. Please try again later.")
        
        return []
