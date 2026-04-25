from __future__ import annotations

from typing import Dict, List

from refactor_nlu_v2 import build_dataset

TASK_INTENT_ORDER: List[str] = [
    "list_overdue_tasks",
    "list_tasks_by_date",
    "summarize_week",
    "help_prioritize",
    "create_task",
    "delete_task",
    "confirm_delete_selection",
    "undo_delete_task",
]


def get_task_intents() -> Dict[str, List[str]]:
    all_intents = build_dataset()
    return {intent: all_intents[intent] for intent in TASK_INTENT_ORDER}

