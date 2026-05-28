from __future__ import annotations

import argparse
import ctypes
import json
import os
import sys
from pathlib import Path
from typing import Iterable

import py_vncorenlp


DEFAULT_INPUT_DIR = Path("../intent/intent_examples")
DEFAULT_OUTPUT_FILE = Path("../train/intent_train.json")
DEFAULT_VNCORENLP_DIR = Path("./vncorenlp")
DEFAULT_JAR_NAME = "VnCoreNLP-1.2.jar"
DEFAULT_DESCRIPTION = (
    "Build PhoBERT intent training data from split intent JSON files "
    "using VnCoreNLP word segmentation."
)


def parse_args(
    default_input_dir: Path = DEFAULT_INPUT_DIR,
    default_output_file: Path = DEFAULT_OUTPUT_FILE,
    description: str = DEFAULT_DESCRIPTION,
) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=description
    )
    parser.add_argument(
        "--input-dir",
        default=str(default_input_dir),
        help=f"Input directory relative to this script. Default: {default_input_dir}",
    )
    parser.add_argument(
        "--output-file",
        default=str(default_output_file),
        help=f"Output JSON file relative to this script. Default: {default_output_file}",
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


def configure_console_utf8() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8")
            except Exception:
                pass


def resolve_path(base_dir: Path, raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return Path(os.path.abspath(str(path)))
    return Path(os.path.abspath(str(base_dir / path)))


def validate_input_dir(input_dir: Path) -> list[Path]:
    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory does not exist: {input_dir}")
    if not input_dir.is_dir():
        raise NotADirectoryError(f"Input path is not a directory: {input_dir}")

    json_files = sorted(path for path in input_dir.glob("*.json") if path.is_file())
    if not json_files:
        raise FileNotFoundError(f"No JSON files found in input directory: {input_dir}")
    return json_files


def resolve_vncorenlp_dir(
    base_dir: Path, vncorenlp_dir_raw: str, jar_path_raw: str | None
) -> Path:
    if jar_path_raw:
        jar_path = resolve_path(base_dir, jar_path_raw)
        if not jar_path.exists():
            raise FileNotFoundError(f"VnCoreNLP jar file does not exist: {jar_path}")
        if not jar_path.is_file():
            raise FileNotFoundError(f"VnCoreNLP jar path is not a file: {jar_path}")
        return jar_path.parent

    return resolve_path(base_dir, vncorenlp_dir_raw)


def validate_vncorenlp_dir(vncorenlp_dir: Path) -> None:
    jar_path = vncorenlp_dir / DEFAULT_JAR_NAME
    models_dir = vncorenlp_dir / "models"

    if not vncorenlp_dir.exists():
        raise FileNotFoundError(
            f"VnCoreNLP directory does not exist: {vncorenlp_dir}"
        )
    if not vncorenlp_dir.is_dir():
        raise NotADirectoryError(
            f"VnCoreNLP path is not a directory: {vncorenlp_dir}"
        )
    if not jar_path.exists():
        raise FileNotFoundError(
            f"Missing VnCoreNLP jar file: {jar_path}"
        )
    if not models_dir.exists() or not models_dir.is_dir():
        raise FileNotFoundError(
            f"Missing VnCoreNLP models directory: {models_dir}"
        )


def get_segmenter_save_dir(vncorenlp_dir: Path) -> str:
    if sys.platform != "win32":
        return str(vncorenlp_dir)

    get_short_path_name = getattr(ctypes.windll.kernel32, "GetShortPathNameW", None)
    if get_short_path_name is None:
        return str(vncorenlp_dir)

    buffer_size = 4096
    output_buffer = ctypes.create_unicode_buffer(buffer_size)
    result = get_short_path_name(str(vncorenlp_dir), output_buffer, buffer_size)
    if result == 0 or not output_buffer.value:
        return str(vncorenlp_dir)

    return output_buffer.value


def load_intent_examples(file_path: Path) -> tuple[str | None, list[str]]:
    with file_path.open("r", encoding="utf-8-sig") as file_obj:
        payload = json.load(file_obj)

    intent_name = payload.get("intent")
    sentences = payload.get("sentences", [])

    if not isinstance(intent_name, str) or not intent_name.strip():
        return None, []
    if not isinstance(sentences, list):
        return intent_name.strip(), []

    cleaned_sentences = [
        sentence.strip()
        for sentence in sentences
        if isinstance(sentence, str) and sentence.strip()
    ]
    return intent_name.strip(), cleaned_sentences


def segment_text(segmenter: py_vncorenlp.VnCoreNLP, text: str) -> str:
    segmented_sentences = segmenter.word_segment(text)
    return " ".join(part.strip() for part in segmented_sentences if part.strip())


def dedupe_rows(rows: Iterable[dict[str, str]]) -> list[dict[str, str]]:
    deduped_rows: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for row in rows:
        key = (row["intent"], row["text"])
        if key in seen:
            continue
        seen.add(key)
        deduped_rows.append(row)

    return deduped_rows


def build_intent_rows(
    json_files: Iterable[Path], segmenter: py_vncorenlp.VnCoreNLP
) -> tuple[list[dict[str, str]], int, int]:
    rows: list[dict[str, str]] = []
    files_read = 0
    sentences_processed = 0

    for file_path in json_files:
        try:
            intent_name, sentences = load_intent_examples(file_path)
        except json.JSONDecodeError as exc:
            print(f"Skipping invalid JSON file: {file_path} ({exc})", file=sys.stderr)
            continue

        files_read += 1
        if not intent_name or not sentences:
            continue

        for sentence in sentences:
            segmented_text = segment_text(segmenter, sentence)
            if not segmented_text:
                continue

            rows.append({"text": segmented_text, "intent": intent_name})
            sentences_processed += 1

    return rows, files_read, sentences_processed


def write_output(rows: list[dict[str, str]], output_file: Path) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", encoding="utf-8") as file_obj:
        json.dump(rows, file_obj, ensure_ascii=False, indent=2)
        file_obj.write("\n")


def run(
    default_input_dir: Path = DEFAULT_INPUT_DIR,
    default_output_file: Path = DEFAULT_OUTPUT_FILE,
    description: str = DEFAULT_DESCRIPTION,
) -> int:
    configure_console_utf8()
    args = parse_args(
        default_input_dir=default_input_dir,
        default_output_file=default_output_file,
        description=description,
    )
    base_dir = Path(__file__).resolve().parent

    try:
        input_dir = resolve_path(base_dir, args.input_dir)
        output_file = resolve_path(base_dir, args.output_file)
        vncorenlp_dir = resolve_vncorenlp_dir(
            base_dir, args.vncorenlp_dir, args.jar_path
        )

        json_files = validate_input_dir(input_dir)
        validate_vncorenlp_dir(vncorenlp_dir)

        segmenter = py_vncorenlp.VnCoreNLP(
            save_dir=get_segmenter_save_dir(vncorenlp_dir),
            annotators=["wseg"],
        )
        rows, files_read, sentences_processed = build_intent_rows(
            json_files, segmenter
        )
        deduped_rows = dedupe_rows(rows)
        write_output(deduped_rows, output_file)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Intent files discovered: {len(json_files)}")
    print(f"Intent files read: {files_read}")
    print(f"Sentences processed: {sentences_processed}")
    print(f"Rows after dedupe: {len(deduped_rows)}")
    print(f"Output file: {output_file}")
    return 0


def main() -> int:
    return run()


if __name__ == "__main__":
    raise SystemExit(main())
