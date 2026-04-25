from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, List

from nlu_gen.note import NOTE_INTENT_ORDER, get_note_intents
from nlu_gen.render import render_nlu_document, write_document
from nlu_gen.shared import (
    SHARED_INTENT_ORDER,
    SHARED_REGEX,
    SHARED_SYNONYMS,
    get_shared_intents,
)
from nlu_gen.task import TASK_INTENT_ORDER, get_task_intents


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = ROOT / "data" / "nlu"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate split Rasa NLU files by domain."
    )
    parser.add_argument(
        "--domains",
        default="task,note,shared",
        help="Comma-separated domains to generate. Supported: task,note,shared",
    )
    parser.add_argument(
        "--out",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Output directory for generated domain NLU files.",
    )
    return parser.parse_args()


def _domain_generators():
    return {
        "shared": (
            get_shared_intents,
            SHARED_INTENT_ORDER,
            SHARED_SYNONYMS,
            SHARED_REGEX,
        ),
        "task": (get_task_intents, TASK_INTENT_ORDER, None, None),
        "note": (get_note_intents, NOTE_INTENT_ORDER, None, None),
    }


def _validate_domain(domain: str, supported: Dict[str, object]) -> None:
    if domain not in supported:
        allowed = ", ".join(sorted(supported.keys()))
        raise ValueError(f"Unsupported domain '{domain}'. Allowed: {allowed}")


def main() -> None:
    args = parse_args()
    requested_domains = [x.strip() for x in args.domains.split(",") if x.strip()]
    generators = _domain_generators()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    for domain in requested_domains:
        _validate_domain(domain, generators)
        generator, order, synonyms, regex_patterns = generators[domain]
        intents: Dict[str, List[str]] = generator()
        text = render_nlu_document(
            intents=intents,
            intent_order=order,
            synonyms=synonyms,
            regex_patterns=regex_patterns,
        )
        target = out_dir / f"{domain}.yml"
        write_document(target, text)
        print(f"Generated {target}")


if __name__ == "__main__":
    main()

