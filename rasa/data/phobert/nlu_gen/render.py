from __future__ import annotations

from pathlib import Path
from typing import Dict, Iterable, List, Optional

HEADER = [
    '# NLU training data for Taskify assistant (Vietnamese-first)',
    'version: "3.1"',
    "",
    "nlu:",
]


def render_nlu_document(
    intents: Dict[str, List[str]],
    intent_order: Optional[Iterable[str]] = None,
    synonyms: Optional[List[Dict[str, List[str]]]] = None,
    regex_patterns: Optional[List[Dict[str, List[str]]]] = None,
) -> str:
    lines = list(HEADER)

    order = list(intent_order) if intent_order else list(intents.keys())
    for intent in order:
        lines.append(f"  - intent: {intent}")
        lines.append("    examples: |")
        for ex in intents[intent]:
            lines.append(f"      - {ex}")
        lines.append("")

    for item in synonyms or []:
        lines.append(f"  - synonym: {item['synonym']}")
        lines.append("    examples: |")
        for ex in item["examples"]:
            lines.append(f"      - {ex}")
        lines.append("")

    for item in regex_patterns or []:
        lines.append(f"  - regex: {item['regex']}")
        lines.append("    examples: |")
        for ex in item["examples"]:
            lines.append(f"      - {ex}")
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def write_document(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

