from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

IMPORT_ERROR: ModuleNotFoundError | None = None

try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
except ModuleNotFoundError as exc:
    torch = None  # type: ignore[assignment]
    AutoModelForSequenceClassification = Any  # type: ignore[assignment]
    AutoTokenizer = Any  # type: ignore[assignment]
    IMPORT_ERROR = exc


BASIC_TEST_CASES: dict[str, list[str]] = {
    "nlu_fallback": [
        "mày tên gì",
        "thời tiết hôm nay sao",
        "mấy giờ rồi",
    ],
    "greet": [
        "xin chào",
        "chào bạn",
        "hello",
    ],
    "goodbye": [
        "tạm biệt",
        "bye nha",
        "pp",
    ],
    "affirm": [
        "đúng",
        "chuẩn rồi",
        "ok đúng đó",
    ],
    "deny": [
        "sai rồi",
        "không",
        "không phải",
    ],
    "create_task": [
        "tạo task ngày mai",
        "thêm việc sáng mai",
        "nhắc đi học lúc 7h",
    ],
    "delete_task": [
        "bỏ task",
        "hủy việc",
        "bỏ lịch",
    ],
    "search_tasks": [
        "xem lịch trình",
        "tìm task",
        "hôm nay có việc gì không",
    ],
    "create_note": [
        "tạo ghi chú",
        "note lại",
        "viết note",
    ],
    "delete_note": [
        "xóa note",
        "bỏ note",
        "del note",
    ],
    "search_notes": [
        "tìm ghi chú",
        "xem note",
        "mở note",
    ],
    "create_finance_entry": [
        "chi 50k",
        "thu 10 củ",
        "hôm nay chi 100k",
    ],
    "delete_finance_entry": [
        "xóa khoản chi",
        "bỏ khoản tiêu này",
        "xoá bớt chi tiêu",
    ],
    "search_finance_entries": [
        "tìm khoản chi",
        "xem lại tiền tiêu",
        "xem thu chi",
    ],
}


@dataclass(frozen=True)
class TestCase:
    expected_intent: str
    text: str
    source: str


def configure_console_utf8() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8")
            except Exception:
                pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Test PhoBERT intent classifier with basic curated samples "
            "or samples loaded from intent_examples/*.json."
        )
    )
    parser.add_argument(
        "--mode",
        choices=("basic", "examples", "all"),
        default="basic",
        help="basic: only built-in basic samples; examples: only JSON samples; all: combine both.",
    )
    parser.add_argument(
        "--examples-per-intent",
        type=int,
        default=3,
        help="How many samples to read from each JSON file when mode is examples/all.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=3,
        help="How many top predictions to print for each sentence.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict | list:
    with path.open("r", encoding="utf-8-sig") as file_obj:
        return json.load(file_obj)


def resolve_paths() -> tuple[Path, Path, Path]:
    base_dir = Path(__file__).resolve().parent
    data_dir = base_dir.parent.parent
    model_dir = data_dir / "model" / "intent_model"
    examples_dir = base_dir / "intent_examples"
    intent_map_file = base_dir / "intent.json"
    return model_dir, examples_dir, intent_map_file


def load_id2label(model_dir: Path) -> dict[int, str]:
    payload = load_json(model_dir / "intent_labels.json")
    if not isinstance(payload, dict):
        raise ValueError("intent_labels.json must be a JSON object.")
    return {int(key): value for key, value in payload.items()}


def load_expected_intents(intent_map_file: Path, id2label: dict[int, str]) -> list[str]:
    if intent_map_file.exists():
        payload = load_json(intent_map_file)
        if isinstance(payload, dict):
            return [str(value).strip() for _, value in sorted(payload.items(), key=lambda item: int(item[0]))]
    return [label for _, label in sorted(id2label.items())]


def build_basic_cases(expected_intents: list[str]) -> list[TestCase]:
    cases: list[TestCase] = []
    for intent_name in expected_intents:
        for text in BASIC_TEST_CASES.get(intent_name, []):
            cases.append(TestCase(expected_intent=intent_name, text=text, source="basic"))
    return cases


def load_example_cases(examples_dir: Path, limit_per_intent: int) -> list[TestCase]:
    cases: list[TestCase] = []
    if not examples_dir.exists():
        return cases

    for file_path in sorted(examples_dir.glob("*.json")):
        payload = load_json(file_path)
        if not isinstance(payload, dict):
            continue

        intent_name = payload.get("intent")
        sentences = payload.get("sentences", [])
        if not isinstance(intent_name, str) or not isinstance(sentences, list):
            continue

        taken = 0
        for sentence in sentences:
            if not isinstance(sentence, str):
                continue
            cleaned = sentence.strip()
            if not cleaned:
                continue
            cases.append(
                TestCase(
                    expected_intent=intent_name.strip(),
                    text=cleaned,
                    source=file_path.name,
                )
            )
            taken += 1
            if limit_per_intent > 0 and taken >= limit_per_intent:
                break
    return cases


def dedupe_cases(cases: list[TestCase]) -> list[TestCase]:
    deduped: list[TestCase] = []
    seen: set[tuple[str, str]] = set()

    for case in cases:
        key = (case.expected_intent, case.text.casefold())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(case)
    return deduped


def predict_intent(
    text: str,
    tokenizer: AutoTokenizer,
    model: AutoModelForSequenceClassification,
    device: torch.device,
    id2label: dict[int, str],
    top_k: int,
) -> tuple[str, float, list[tuple[str, float]]]:
    inputs = tokenizer(
        text,
        return_tensors="pt",
        max_length=256,
        truncation=True,
        padding=True,
    )
    inputs = {key: value.to(device) for key, value in inputs.items()}

    with torch.no_grad():
        probabilities = torch.softmax(model(**inputs).logits, dim=-1)[0]

    safe_top_k = max(1, min(top_k, len(id2label)))
    sorted_indices = torch.argsort(probabilities, descending=True)[:safe_top_k].tolist()
    ranking = [
        (id2label[index], float(probabilities[index].item()))
        for index in sorted_indices
    ]
    return ranking[0][0], ranking[0][1], ranking


def group_cases_by_intent(cases: list[TestCase], intent_names: list[str]) -> dict[str, list[TestCase]]:
    grouped = {intent_name: [] for intent_name in intent_names}
    for case in cases:
        grouped.setdefault(case.expected_intent, []).append(case)
    return grouped


def validate_coverage(expected_intents: list[str], cases: list[TestCase]) -> list[str]:
    covered = {case.expected_intent for case in cases}
    return [intent_name for intent_name in expected_intents if intent_name not in covered]


def main() -> int:
    configure_console_utf8()
    args = parse_args()

    if IMPORT_ERROR is not None or torch is None:
        print(
            "Thiếu thư viện để chạy test PhoBERT. "
            "Hãy dùng môi trường có sẵn của Rasa, ví dụ:"
        )
        print(r"  rasa\venv\Scripts\python.exe rasa\data\phobert\intent\test_intent.py")
        print(f"Lỗi gốc: {IMPORT_ERROR}")
        return 1

    model_dir, examples_dir, intent_map_file = resolve_paths()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    model.to(device)
    model.eval()

    id2label = load_id2label(model_dir)
    expected_intents = load_expected_intents(intent_map_file, id2label)

    basic_cases = build_basic_cases(expected_intents) if args.mode in {"basic", "all"} else []
    example_cases = (
        load_example_cases(examples_dir, args.examples_per_intent)
        if args.mode in {"examples", "all"}
        else []
    )
    cases = dedupe_cases([*basic_cases, *example_cases])

    missing_intents = validate_coverage(expected_intents, cases)
    if missing_intents:
        print("Thiếu mẫu test cho các intent sau:")
        for intent_name in missing_intents:
            print(f"  - {intent_name}")
        return 1

    grouped_cases = group_cases_by_intent(cases, expected_intents)
    total_cases = 0
    total_passed = 0

    print("=== PHOBERT INTENT TEST ===")
    print(f"Model dir : {model_dir}")
    print(f"Mode      : {args.mode}")
    print(f"Device    : {device}")
    print(f"Intents   : {len(expected_intents)}")
    print(f"Samples   : {len(cases)}")

    for intent_name in expected_intents:
        intent_cases = grouped_cases.get(intent_name, [])
        passed_for_intent = 0

        print(f"\n[{intent_name}]")
        for case in intent_cases:
            predicted, confidence, ranking = predict_intent(
                text=case.text,
                tokenizer=tokenizer,
                model=model,
                device=device,
                id2label=id2label,
                top_k=args.top_k,
            )
            is_pass = predicted == case.expected_intent
            status = "PASS" if is_pass else "FAIL"
            ranking_text = ", ".join(
                f"{label}:{score:.1%}" for label, score in ranking
            )
            print(
                f"  [{status}] {case.text!r} -> {predicted} ({confidence:.1%}) "
                f"| expected={case.expected_intent} | source={case.source}"
            )
            print(f"         top{len(ranking)}: {ranking_text}")

            total_cases += 1
            if is_pass:
                passed_for_intent += 1
                total_passed += 1

        print(
            f"  Summary: {passed_for_intent}/{len(intent_cases)} đúng "
            f"({(passed_for_intent / len(intent_cases)):.1%})"
        )

    accuracy = (total_passed / total_cases) if total_cases else 0.0
    print("\n=== SUMMARY ===")
    print(f"Total    : {total_passed}/{total_cases} đúng ({accuracy:.1%})")
    print(f"Mismatch : {total_cases - total_passed}")

    return 0 if total_passed == total_cases else 1


if __name__ == "__main__":
    raise SystemExit(main())
