from __future__ import annotations

import argparse
import fnmatch
import io
import json
import re
import sys
from glob import glob
from pathlib import Path
from typing import Iterable, List, Tuple

import yaml

try:
    from vncorenlp import VnCoreNLP
except ImportError:
    print("Vui lòng cài thư viện: pip install vncorenlp")
    sys.exit(1)


DEFAULT_JAR_PATH = Path(r"C:\Users\HPPC~1\VnCoreNLP\VnCoreNLP-1.2.jar")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Prepare PhoBERT training data from split Rasa NLU files "
            "(intent_train.json + ner_train.txt)."
        )
    )
    parser.add_argument(
        "--input-glob",
        default="../nlu/*.yml",
        help=(
            "Glob pattern relative to this script folder (or absolute). "
            "Default: ../nlu/*.yml"
        ),
    )
    parser.add_argument(
        "--exclude-pattern",
        action="append",
        default=["*_draft.yml", "*_disabled.yml"],
        help=(
            "File pattern to exclude. Can be repeated. "
            "Default includes *_draft.yml and *_disabled.yml"
        ),
    )
    parser.add_argument(
        "--legacy-input",
        default="../nlu.yml",
        help=(
            "Legacy fallback file if --input-glob does not match anything. "
            "Default: ../nlu.yml"
        ),
    )
    parser.add_argument(
        "--intent-output",
        default="intent_train.json",
        help="Output path for intent JSON (relative to this script by default).",
    )
    parser.add_argument(
        "--ner-output",
        default="ner_train.txt",
        help="Output path for NER BIO text file (relative to this script by default).",
    )
    parser.add_argument(
        "--jar-path",
        default=str(DEFAULT_JAR_PATH),
        help="Path to VnCoreNLP jar.",
    )
    return parser.parse_args()


def resolve_path(base_dir: Path, raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (base_dir / path).resolve()


def resolve_input_files(
    base_dir: Path, input_glob: str, exclude_patterns: Iterable[str], legacy_input: str
) -> List[Path]:
    if Path(input_glob).is_absolute():
        candidates = sorted(Path(p).resolve() for p in glob(input_glob))
    else:
        candidates = sorted(base_dir.glob(input_glob))

    excluded = set()
    for f in candidates:
        for pattern in exclude_patterns:
            if fnmatch.fnmatch(f.name, pattern):
                excluded.add(f)
                break

    selected = [f for f in candidates if f not in excluded and f.is_file()]
    if selected:
        return selected

    legacy = resolve_path(base_dir, legacy_input)
    if legacy.exists() and legacy.is_file():
        return [legacy]

    return []


def extract_entities(example_text: str) -> Tuple[str, List[dict]]:
    entities = []
    clean_text = ""
    last_end = 0

    for match in re.finditer(r"\[(.*?)\]\((.*?)\)", example_text):
        start_match = match.start()
        end_match = match.end()
        value = match.group(1)
        entity_name = match.group(2)

        clean_text += example_text[last_end:start_match]
        ent_start = len(clean_text)
        clean_text += value
        ent_end = len(clean_text)

        entities.append(
            {
                "start": ent_start,
                "end": ent_end,
                "entity": entity_name,
                "value": value,
            }
        )
        last_end = end_match

    clean_text += example_text[last_end:]
    clean_text = re.sub(r"\s+", " ", clean_text).strip()
    return clean_text, entities


def align_tokens_to_entities(words: List[str], clean_text: str, entities: List[dict]):
    tokens = []
    tags = []
    current_offset = 0

    for word in words:
        word_str = word.replace("_", " ")
        start_pos = clean_text.lower().find(word_str.lower(), current_offset)

        if start_pos != -1:
            end_pos = start_pos + len(word_str)
            current_offset = end_pos
        else:
            start_pos = current_offset
            end_pos = start_pos + len(word_str)

        tag = "O"
        for ent in entities:
            ent_start = ent["start"]
            ent_end = ent["end"]
            overlap = (
                (start_pos >= ent_start and start_pos < ent_end)
                or (end_pos > ent_start and end_pos <= ent_end)
                or (start_pos <= ent_start and end_pos >= ent_end)
            )
            if not overlap:
                continue

            if len(tags) == 0 or not tags[-1].endswith(ent["entity"]):
                tag = f"B-{ent['entity']}"
            else:
                tag = f"I-{ent['entity']}"
            break

        tokens.append(word)
        tags.append(tag)

    return tokens, tags


def _extract_examples(example_block: str) -> List[str]:
    lines = []
    for line in example_block.strip().split("\n"):
        value = line.strip()
        if not value:
            continue
        if value.startswith("- "):
            value = value[2:].strip()
        lines.append(value)
    return lines


def process_nlu_sources(file_paths: List[Path], rdrsegmenter):
    intent_data = []
    ner_data = []

    for file_path in file_paths:
        with file_path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        for item in data.get("nlu", []):
            if "intent" not in item or "examples" not in item:
                continue

            intent_name = item["intent"]
            examples = _extract_examples(item["examples"])

            for example in examples:
                clean_text, entities = extract_entities(example)

                sentences = rdrsegmenter.tokenize(clean_text)
                words = []
                for sentence in sentences:
                    words.extend(sentence)

                segmented_text = " ".join(words)
                intent_data.append({"text": segmented_text, "intent": intent_name})

                if words:
                    tokens_list, tags_list = align_tokens_to_entities(
                        words, clean_text, entities
                    )
                    ner_data.append((tokens_list, tags_list))

    return intent_data, ner_data


def save_intent_json(data, output_path: Path):
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(data)} intent rows -> {output_path}")


def save_ner_txt(data, output_path: Path):
    with output_path.open("w", encoding="utf-8") as f:
        for tokens, tags in data:
            for token, tag in zip(tokens, tags):
                f.write(f"{token} {tag}\n")
            f.write("\n")
    print(f"Saved {len(data)} NER rows -> {output_path}")


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    args = parse_args()

    current_dir = Path(__file__).resolve().parent
    input_files = resolve_input_files(
        current_dir,
        args.input_glob,
        args.exclude_pattern,
        args.legacy_input,
    )
    if not input_files:
        print("No input NLU files found.")
        sys.exit(1)

    print("Input files:")
    for file_path in input_files:
        print(f"  - {file_path}")

    jar_path = resolve_path(current_dir, args.jar_path)
    if not jar_path.exists():
        print(f"Missing VnCoreNLP jar: {jar_path}")
        sys.exit(1)

    print(f"Initializing VnCoreNLP from {jar_path} ...")
    rdrsegmenter = VnCoreNLP(
        str(jar_path), annotators="wseg", max_heap_size="-Xmx2g", quiet=False
    )

    intent_data, ner_data = process_nlu_sources(input_files, rdrsegmenter)

    intent_output = resolve_path(current_dir, args.intent_output)
    ner_output = resolve_path(current_dir, args.ner_output)
    save_intent_json(intent_data, intent_output)
    save_ner_txt(ner_data, ner_output)
    print("Done: PhoBERT data prepared.")


if __name__ == "__main__":
    main()
