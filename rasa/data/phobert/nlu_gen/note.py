from __future__ import annotations

from typing import Dict, List

from refactor_nlu_v2 import build_dataset

NOTE_INTENT_ORDER: List[str] = [
    "create_note",
    "list_notes",
    "search_notes",
    "pin_note",
    "update_note",
    "delete_note",
]


def get_note_intents() -> Dict[str, List[str]]:
    all_intents = build_dataset()
    return {intent: all_intents[intent] for intent in NOTE_INTENT_ORDER}

