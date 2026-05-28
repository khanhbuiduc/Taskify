from __future__ import annotations

from pathlib import Path

from build_intent_train import run


DEFAULT_INPUT_DIR = Path("../intent/intent_validate")
DEFAULT_OUTPUT_FILE = Path("../train/intent_validate.json")
DEFAULT_DESCRIPTION = (
    "Build PhoBERT intent validation data from split intent JSON files "
    "using VnCoreNLP word segmentation."
)


def main() -> int:
    return run(
        default_input_dir=DEFAULT_INPUT_DIR,
        default_output_file=DEFAULT_OUTPUT_FILE,
        description=DEFAULT_DESCRIPTION,
    )


if __name__ == "__main__":
    raise SystemExit(main())
