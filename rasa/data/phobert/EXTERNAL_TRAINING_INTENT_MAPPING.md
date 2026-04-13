# External PhoBERT Intent Training Record

## Purpose
This file is the source-of-truth note for intent label mapping trained outside this repository.
It exists to prevent id-to-intent mismatch when loading PhoBERT checkpoints into Rasa.

## Dataset Version Note
- Since 2026-04-12, NLU data was refactored to **remove `inform_task_fields`** and cut over to `create_task`.
- Current in-repo NLU intent set is now **20 intents**.
- The existing deployed PhoBERT intent checkpoint may still be based on the old 21-intent set.
- You must retrain external PhoBERT on the new dataset and export a new `id2label` mapping before using the new data in production.

## Record Metadata
- Record created at: 2026-04-12 (Asia/Saigon)
- Training location: Outside project repository
- Training timestamp: NOT PROVIDED (to be updated by model owner)
- Training script/source: NOT PROVIDED (to be updated by model owner)
- Base checkpoint: `rasa/data/phobert/model/intent_model` (runtime load path in this repo)
- Transformers version used at training: NOT PROVIDED
- Torch version used at training: NOT PROVIDED

## Canonical Intent Mapping (id -> intent, old checkpoint)
```json
{
  "0": "update_note",
  "1": "nlu_fallback",
  "2": "confirm_delete_selection",
  "3": "search_notes",
  "4": "list_overdue_tasks",
  "5": "affirm",
  "6": "deny",
  "7": "ask_howcanhelp",
  "8": "pin_note",
  "9": "inform_task_fields",
  "10": "delete_note",
  "11": "create_task",
  "12": "undo_delete_task",
  "13": "help_prioritize",
  "14": "create_note",
  "15": "goodbye",
  "16": "list_notes",
  "17": "greet",
  "18": "delete_task",
  "19": "summarize_week",
  "20": "list_tasks_by_date"
}
```

## Latest Canonical Intent Mapping (id -> intent, current 20-intent checkpoint)
```json
{
  "0": "create_note",
  "1": "create_task",
  "2": "search_notes",
  "3": "list_overdue_tasks",
  "4": "undo_delete_task",
  "5": "delete_note",
  "6": "delete_task",
  "7": "confirm_delete_selection",
  "8": "pin_note",
  "9": "help_prioritize",
  "10": "deny",
  "11": "goodbye",
  "12": "summarize_week",
  "13": "nlu_fallback",
  "14": "greet",
  "15": "list_notes",
  "16": "affirm",
  "17": "update_note",
  "18": "ask_howcanhelp",
  "19": "list_tasks_by_date"
}
```

## Target Intent Set After Refactor (20 intents)
1. greet
2. goodbye
3. affirm
4. deny
5. ask_howcanhelp
6. list_overdue_tasks
7. list_tasks_by_date
8. summarize_week
9. help_prioritize
10. create_task
11. create_note
12. list_notes
13. search_notes
14. pin_note
15. update_note
16. delete_note
17. delete_task
18. confirm_delete_selection
19. undo_delete_task
20. nlu_fallback

Do not use `sorted()` when building label ids. Export and keep the exact training-order mapping from the external training script.

## Regenerate/Sync Notes
1. Export `id2label` from the external training run right after training finishes.
2. Update `rasa/data/phobert/model/intent_model/intent_labels.json` to match exactly.
3. Keep ids continuous from `0..num_labels-1` with no missing keys.
4. Ensure `num_labels` equals the current intent count (20 after refactor).
5. Run quick smoke test (`rasa/test_phobert.py`) to verify predicted ids map to expected intent names.
6. Update this file with training timestamp, script path, and dependency versions.
