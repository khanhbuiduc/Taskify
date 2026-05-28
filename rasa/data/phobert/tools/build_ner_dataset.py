from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Iterable

import py_vncorenlp

from build_intent_train import (
    DEFAULT_VNCORENLP_DIR,
    configure_console_utf8,
    get_segmenter_save_dir,
    resolve_path,
    resolve_vncorenlp_dir,
    validate_vncorenlp_dir,
)


ALLOWED_ENTITIES = {"object_name", "keyword", "content", "category", "amount"}
DEFAULT_INPUT_ROOT = Path("../entity/object")
DEFAULT_TRAIN_INPUT_DIR = DEFAULT_INPUT_ROOT / "train"
DEFAULT_VALIDATE_INPUT_DIR = DEFAULT_INPUT_ROOT / "validate"
DEFAULT_TRAIN_OUTPUT_FILE = Path("../train/ner_train.txt")
DEFAULT_VALIDATE_OUTPUT_FILE = Path("../train/ner_validate.txt")
ANNOTATION_PATTERN = re.compile(r"\[(.*?)\]\((.*?)\)")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build PhoBERT NER datasets from split entity JSON files using "
            "VnCoreNLP word segmentation. Without --input-dir/--output-file, "
            "the script builds both train and validate outputs."
        )
    )
    parser.add_argument(
        "--input-dir",
        default=None,
        help="Optional single input directory relative to this script.",
    )
    parser.add_argument(
        "--output-file",
        default=None,
        help="Optional single BIO output file relative to this script.",
    )
    parser.add_argument(
        "--vncorenlp-dir",
        default=str(DEFAULT_VNCORENLP_DIR),
        help="VnCoreNLP resource directory relative to this script. Default: ./vncorenlp",
    )
    parser.add_argument(
        "--jar-path",
        default=None,
        help=(
            "Optional VnCoreNLP jar path relative to this script. "
            "If provided, its parent directory is used as the VnCoreNLP resource directory."
        ),
    )
    return parser.parse_args()


def validate_input_dir(input_dir: Path) -> list[Path]:
    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory does not exist: {input_dir}")
    if not input_dir.is_dir():
        raise NotADirectoryError(f"Input path is not a directory: {input_dir}")

    json_files = sorted(path for path in input_dir.glob("*.json") if path.is_file())
    if not json_files:
        raise FileNotFoundError(f"No JSON files found in input directory: {input_dir}")
    return json_files


def load_entity_payload(file_path: Path) -> tuple[str, list[str]]:
    with file_path.open("r", encoding="utf-8-sig") as file_obj:
        payload = json.load(file_obj)

    entity_name = payload.get("entity")
    sentences = payload.get("sentences")

    if entity_name not in ALLOWED_ENTITIES:
        raise ValueError(
            f"Unsupported entity '{entity_name}' in {file_path}. "
            f"Allowed entities: {sorted(ALLOWED_ENTITIES)}"
        )
    if file_path.stem != entity_name:
        raise ValueError(
            f"Filename '{file_path.name}' must match entity '{entity_name}'."
        )
    if not isinstance(sentences, list) or not sentences:
        raise ValueError(f"'sentences' must be a non-empty list in {file_path}")

    cleaned_sentences = [
        sentence.strip()
        for sentence in sentences
        if isinstance(sentence, str) and sentence.strip()
    ]
    if not cleaned_sentences:
        raise ValueError(f"No usable sentences found in {file_path}")

    return entity_name, cleaned_sentences


def extract_entities(
    annotated_text: str, expected_entity: str
) -> tuple[str, list[dict[str, int | str]]]:
    entities: list[dict[str, int | str]] = []
    clean_text = ""
    last_end = 0

    for match in ANNOTATION_PATTERN.finditer(annotated_text):
        start_match = match.start()
        end_match = match.end()
        value = match.group(1).strip()
        entity_name = match.group(2).strip()

        if entity_name != expected_entity:
            raise ValueError(
                f"Sentence uses entity '{entity_name}' but file expects '{expected_entity}': {annotated_text}"
            )
        if not value:
            raise ValueError(f"Empty entity value in sentence: {annotated_text}")

        clean_text += annotated_text[last_end:start_match]
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

    if not entities:
        raise ValueError(
            f"Sentence must contain at least one [{expected_entity}] annotation: {annotated_text}"
        )

    clean_text += annotated_text[last_end:]
    clean_text = re.sub(r"\s+", " ", clean_text).strip()
    if not clean_text:
        raise ValueError(f"Sentence became empty after stripping annotations: {annotated_text}")

    return clean_text, entities


def segment_text(
    segmenter: py_vncorenlp.VnCoreNLP, clean_text: str
) -> list[str]:
    segmented_sentences = segmenter.word_segment(clean_text)
    words: list[str] = []
    for segmented_sentence in segmented_sentences:
        words.extend(part for part in segmented_sentence.split() if part.strip())
    return words


def align_tokens_to_entities(
    words: list[str], clean_text: str, entities: list[dict[str, int | str]]
) -> tuple[list[str], list[str]]:
    tokens: list[str] = []
    tags: list[str] = []
    current_offset = 0

    for word in words:
        word_text = word.replace("_", " ")
        start_pos = clean_text.lower().find(word_text.lower(), current_offset)
        if start_pos != -1:
            end_pos = start_pos + len(word_text)
            current_offset = end_pos
        else:
            start_pos = current_offset
            end_pos = start_pos + len(word_text)

        tag = "O"
        for entity in entities:
            ent_start = int(entity["start"])
            ent_end = int(entity["end"])
            overlap = (
                (start_pos >= ent_start and start_pos < ent_end)
                or (end_pos > ent_start and end_pos <= ent_end)
                or (start_pos <= ent_start and end_pos >= ent_end)
            )
            if not overlap:
                continue

            entity_name = str(entity["entity"])
            if not tags or not tags[-1].endswith(entity_name):
                tag = f"B-{entity_name}"
            else:
                tag = f"I-{entity_name}"
            break

        tokens.append(word)
        tags.append(tag)

    return tokens, tags


def write_output(rows: list[tuple[list[str], list[str]]], output_file: Path) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", encoding="utf-8") as file_obj:
        for tokens, tags in rows:
            for token, tag in zip(tokens, tags):
                file_obj.write(f"{token} {tag}\n")
            file_obj.write("\n")


def build_split(
    input_dir: Path,
    output_file: Path,
    segmenter: py_vncorenlp.VnCoreNLP,
) -> tuple[int, Counter[str], int]:
    json_files = validate_input_dir(input_dir)
    rows: list[tuple[list[str], list[str]]] = []
    counts: Counter[str] = Counter()
    seen_sentences: set[str] = set()
    duplicate_count = 0

    for file_path in json_files:
        entity_name, sentences = load_entity_payload(file_path)
        for annotated_text in sentences:
            dedupe_key = annotated_text.strip()
            if dedupe_key in seen_sentences:
                duplicate_count += 1
                continue
            seen_sentences.add(dedupe_key)

            clean_text, entities = extract_entities(annotated_text, entity_name)
            words = segment_text(segmenter, clean_text)
            if not words:
                continue

            rows.append(align_tokens_to_entities(words, clean_text, entities))
            counts[entity_name] += 1

    if not rows:
        raise ValueError(f"No usable NER rows were built from {input_dir}")

    write_output(rows, output_file)
    return len(rows), counts, duplicate_count


def run_build(
    input_dir: Path,
    output_file: Path,
    segmenter: py_vncorenlp.VnCoreNLP,
    label: str,
) -> None:
    row_count, counts, duplicate_count = build_split(input_dir, output_file, segmenter)
    print(f"[{label}] Input directory: {input_dir}")
    print(f"[{label}] Output file: {output_file}")
    print(f"[{label}] Rows written: {row_count}")
    print(f"[{label}] Duplicate annotated sentences skipped: {duplicate_count}")
    for entity_name in sorted(counts):
        print(f"[{label}] {entity_name}: {counts[entity_name]}")


def main() -> int:
    configure_console_utf8()
    args = parse_args()
    base_dir = Path(__file__).resolve().parent

    try:
        vncorenlp_dir = resolve_vncorenlp_dir(
            base_dir, args.vncorenlp_dir, args.jar_path
        )
        validate_vncorenlp_dir(vncorenlp_dir)
        segmenter = py_vncorenlp.VnCoreNLP(
            save_dir=get_segmenter_save_dir(vncorenlp_dir),
            annotators=["wseg"],
        )

        if bool(args.input_dir) != bool(args.output_file):
            raise ValueError(
                "--input-dir and --output-file must be provided together when building a single split."
            )

        if args.input_dir and args.output_file:
            input_dir = resolve_path(base_dir, args.input_dir)
            output_file = resolve_path(base_dir, args.output_file)
            run_build(input_dir, output_file, segmenter, label="custom")
            return 0

        run_build(
            resolve_path(base_dir, str(DEFAULT_TRAIN_INPUT_DIR)),
            resolve_path(base_dir, str(DEFAULT_TRAIN_OUTPUT_FILE)),
            segmenter,
            label="train",
        )
        run_build(
            resolve_path(base_dir, str(DEFAULT_VALIDATE_INPUT_DIR)),
            resolve_path(base_dir, str(DEFAULT_VALIDATE_OUTPUT_FILE)),
            segmenter,
            label="validate",
        )
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
