from __future__ import annotations

from typing import Dict, List

from refactor_nlu_v2 import build_dataset

SHARED_INTENT_ORDER: List[str] = [
    "greet",
    "goodbye",
    "affirm",
    "deny",
    "ask_howcanhelp",
    "nlu_fallback",
]

SHARED_SYNONYMS = [
    {
        "synonym": "high",
        "examples": [
            "urgent",
            "critical",
            "important",
            "asap",
            "high priority",
            "khẩn cấp",
            "quan trọng",
            "gấp",
            "ưu tiên cao",
            "cao",
        ],
    },
    {
        "synonym": "low",
        "examples": [
            "minor",
            "not urgent",
            "whenever",
            "low priority",
            "không gấp",
            "ưu tiên thấp",
            "khi nào cũng được",
            "thấp",
        ],
    },
    {
        "synonym": "medium",
        "examples": [
            "normal",
            "regular",
            "standard",
            "medium priority",
            "bình thường",
            "trung bình",
        ],
    },
]

SHARED_REGEX = [
    {
        "regex": "due_time",
        "examples": [
            r"\d{1,2}h\d{0,2}",
            r"\d{1,2}:\d{2}",
            r"\d{1,2}(am|pm)",
            r"\d{1,2} giờ",
            r"\d{1,2}h sáng",
            r"\d{1,2}h chiều",
        ],
    },
    {
        "regex": "due_date",
        "examples": [
            "today",
            "tomorrow",
            "next monday",
            "next week",
            "hôm nay",
            "ngày mai",
            "ngày kia",
            "tuần sau",
            "tháng sau",
            "chiều nay",
            "tối nay",
            "sáng mai",
        ],
    },
]


def get_shared_intents() -> Dict[str, List[str]]:
    all_intents = build_dataset()
    return {intent: all_intents[intent] for intent in SHARED_INTENT_ORDER}

