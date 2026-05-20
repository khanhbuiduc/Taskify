"""
actions/__init__.py — Entry point cho Rasa action server.

Rasa load module `actions` khi khởi động action server.
File này re-export tất cả action class để Rasa có thể discover.
"""

from actions.task.task_actions import (  # noqa: F401
    ActionListTasks,
    ActionFilterTasks,
    ValidateCreateTaskForm,
    ActionCancelCreateTask,
    ActionCreateTask,
    ActionDeleteTask,
    ActionHandleConfirmation,
    ActionSummarizeWeek,
)
from actions.note.note_actions import (  # noqa: F401
    ActionCreateNote,
    ActionListNotes,
    ActionSearchNotes,
    ActionTogglePinNote,
    ActionUpdateNote,
    ActionDeleteNote,
)
from actions.finance.finance_actions import (  # noqa: F401
    ActionCreateFinanceEntry,
    ActionListFinanceEntries,
    ActionSearchFinanceEntries,
    ActionUpdateFinanceEntry,
    ActionDeleteFinanceEntry,
    ActionSummarizeFinance,
    ActionListFinanceCategories,
    ActionCreateFinanceCategory,
    ActionUpdateFinanceCategory,
    ActionDeleteFinanceCategory,
)
from actions.fallback_actions import ActionFallbackGemini  # noqa: F401
