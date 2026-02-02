# Rasa custom actions for Taskify (phase 2).
# Run from rasa folder: pip install -r actions/requirements.txt && rasa run actions
# Requires: action_endpoint in endpoints.yml and actions in domain.yml to be enabled.

import os
import logging
from typing import Any, Text, Dict, List
from datetime import datetime

import requests
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet

# Configuration - can be overridden by environment variables
TASKIFY_API_URL = os.getenv("TASKIFY_API_URL", "http://localhost:5116")
RASA_API_KEY = os.getenv("RASA_API_KEY", "rasa-internal-api-key-taskify-2026")
REQUEST_TIMEOUT = 10  # seconds

logger = logging.getLogger(__name__)


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
    """Create a new task via TaskifyAPI."""

    def name(self) -> Text:
        return "action_create_task"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        sender_id = tracker.sender_id
        
        # For now, we'll create a simple task with a default title
        # In the future, we could use entity extraction to get task details from the message
        user_message = tracker.latest_message.get("text", "")
        
        # Simple extraction: if message contains "for tomorrow", set due date accordingly
        tomorrow = datetime.now().replace(hour=23, minute=59, second=0)
        from datetime import timedelta
        tomorrow = tomorrow + timedelta(days=1)
        
        # Try to extract a task title from the message
        # Remove common phrases to get potential title
        title = user_message
        for phrase in ["create a task", "create task", "add a task", "add task", "new task", "i want to", "please", "for tomorrow", "for today"]:
            title = title.lower().replace(phrase, "").strip()
        
        # If we couldn't extract a meaningful title, use a default
        if not title or len(title) < 3:
            dispatcher.utter_message(
                text="I'd be happy to create a task for you! Please tell me:\n"
                     "- What's the task title?\n"
                     "- When is it due?\n\n"
                     "Or you can create it directly from the task form in the app."
            )
            return []
        
        # Capitalize first letter
        title = title[0].upper() + title[1:] if title else "New Task"
        
        try:
            url = f"{TASKIFY_API_URL}/api/internal/tasks/{sender_id}"
            payload = {
                "title": title,
                "description": f"Created via AI assistant",
                "priority": "medium",
                "dueDate": tomorrow.isoformat()
            }
            
            response = requests.post(url, json=payload, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            
            if response.status_code in [200, 201]:
                task = response.json()
                task_title = task.get("title", title)
                dispatcher.utter_message(
                    text=f"✅ I've created a new task: **{task_title}**\n"
                         f"📅 Due: Tomorrow\n"
                         f"🟡 Priority: Medium\n\n"
                         f"You can edit the details in your task list."
                )
            elif response.status_code == 401:
                dispatcher.utter_message(text="I couldn't create the task. Please make sure you're logged in.")
            else:
                logger.warning(f"API returned status {response.status_code} when creating task for user {sender_id}")
                dispatcher.utter_message(text="I couldn't create the task right now. Please try using the task form instead.")
                
        except requests.exceptions.Timeout:
            logger.error(f"Timeout calling TaskifyAPI for user {sender_id}")
            dispatcher.utter_message(text="The request timed out. Please try again.")
        except requests.exceptions.ConnectionError:
            logger.error(f"Connection error calling TaskifyAPI for user {sender_id}")
            dispatcher.utter_message(text="I couldn't connect to the task service. Please make sure the server is running.")
        except Exception as e:
            logger.exception(f"Error in action_create_task for user {sender_id}: {e}")
            dispatcher.utter_message(text="Something went wrong. Please try again later.")
        
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
