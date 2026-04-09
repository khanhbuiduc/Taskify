"""
delete_match_utils.py - Query normalization and fuzzy title matching for delete-task flow.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple


_NON_WORD_PATTERN = re.compile(r"[^0-9a-zA-Z\s]+")
_MULTI_SPACE_PATTERN = re.compile(r"\s+")

_LEADING_DROP_TOKENS = {
    "xin",
    "vui",
    "long",
    "lam",
    "on",
    "please",
    "giup",
    "gium",
    "cho",
    "minh",
    "toi",
    "ban",
    "xoa",
    "delete",
    "remove",
    "task",
    "nhiem",
    "vu",
    "cong",
    "viec",
    "cai",
    "nay",
    "do",
    "dum",
}

_GENERIC_ONLY_QUERIES = {
    "",
    "xoa",
    "delete",
    "remove",
    "task",
    "nhiem vu",
    "cong viec",
}


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def normalize_for_match(value: Optional[str]) -> str:
    text = unicodedata.normalize("NFC", value or "")
    text = _strip_accents(text).lower()
    text = _NON_WORD_PATTERN.sub(" ", text)
    text = _MULTI_SPACE_PATTERN.sub(" ", text).strip()
    return text


def _trim_delete_prefix(value: str) -> str:
    tokens = value.split()
    while tokens and tokens[0] in _LEADING_DROP_TOKENS:
        tokens.pop(0)
    return " ".join(tokens).strip()


def extract_delete_query(latest_message: Dict[str, Any], slot_title: Optional[str]) -> Optional[str]:
    latest_text = latest_message.get("text", "") or ""

    task_title_entity = None
    for entity in latest_message.get("entities", []) or []:
        if entity.get("entity") == "task_title":
            candidate = entity.get("value")
            if isinstance(candidate, str) and candidate.strip():
                task_title_entity = candidate
                break

    candidates = [slot_title, task_title_entity, latest_text]
    for candidate in candidates:
        normalized = normalize_for_match(candidate)
        if not normalized:
            continue
        trimmed = _trim_delete_prefix(normalized)
        if trimmed in _GENERIC_ONLY_QUERIES:
            continue
        if len(trimmed) < 2:
            continue
        return trimmed
    return None


def _levenshtein_ratio(left: str, right: str) -> float:
    if left == right:
        return 1.0
    if not left or not right:
        return 0.0

    rows = len(left) + 1
    cols = len(right) + 1
    distance: List[List[int]] = [[0] * cols for _ in range(rows)]
    for row in range(rows):
        distance[row][0] = row
    for col in range(cols):
        distance[0][col] = col

    for row in range(1, rows):
        for col in range(1, cols):
            cost = 0 if left[row - 1] == right[col - 1] else 1
            distance[row][col] = min(
                distance[row - 1][col] + 1,
                distance[row][col - 1] + 1,
                distance[row - 1][col - 1] + cost,
            )

    edits = distance[-1][-1]
    max_len = max(len(left), len(right))
    return max(0.0, 1.0 - (edits / max_len))


def _token_overlap_ratio(left: str, right: str) -> float:
    left_tokens = set(left.split())
    right_tokens = set(right.split())
    if not left_tokens or not right_tokens:
        return 0.0
    intersection = left_tokens.intersection(right_tokens)
    union = left_tokens.union(right_tokens)
    return len(intersection) / len(union)


def _match_score(query: str, title: str) -> float:
    if not query or not title:
        return 0.0
    if query == title:
        return 1.0

    contains_bonus = 1.0 if (query in title or title in query) else 0.0
    overlap = _token_overlap_ratio(query, title)
    lev_ratio = _levenshtein_ratio(query, title)

    score = (0.5 * lev_ratio) + (0.3 * overlap) + (0.2 * contains_bonus)
    if query in title:
        score += 0.05
    return min(1.0, score)


def pick_task_by_title_fuzzy(
    tasks: List[Dict[str, Any]],
    raw_query: str,
    min_score: float = 0.42,
) -> List[Tuple[Dict[str, Any], float]]:
    query = normalize_for_match(raw_query)
    if not query:
        return []

    scored: List[Tuple[Dict[str, Any], float]] = []
    for task in tasks:
        title = normalize_for_match(str(task.get("title", "")))
        if not title:
            continue
        score = _match_score(query, title)
        if score >= min_score:
            scored.append((task, score))

    scored.sort(
        key=lambda item: (
            item[1],
            len(normalize_for_match(str(item[0].get("title", "")))),
        ),
        reverse=True,
    )
    return scored
