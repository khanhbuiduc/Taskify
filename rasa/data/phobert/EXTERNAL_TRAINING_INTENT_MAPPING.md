# External PhoBERT Intent Training Record

## Purpose
This file is the source-of-truth note for intent label mapping trained outside this repository.
It exists to prevent id-to-intent mismatch when loading PhoBERT checkpoints into Rasa.

## Dataset Version Note
- Since 2026-04-12, NLU data was refactored to **remove `inform_task_fields`** and cut over to `create_task`.
- Since 2026-05-17, task listing variants were merged into **`filter_tasks` + slots/entities**. `list_overdue_tasks` and `list_tasks_by_date` are no longer canonical intents.
- Current in-repo NLU intent set is now **19 intents**.
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

## Latest Canonical Intent Mapping (id -> intent, stale 20-intent checkpoint)
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

## Target Intent Set After Refactor (19 intents)
1. greet
2. goodbye
3. affirm
4. deny
5. ask_howcanhelp
6. summarize_week
7. help_prioritize
8. filter_tasks
9. create_task
10. create_note
11. list_notes
12. search_notes
13. pin_note
14. update_note
15. delete_note
16. delete_task
17. confirm_delete_selection
18. undo_delete_task
19. nlu_fallback

Do not use `sorted()` when building label ids. Export and keep the exact training-order mapping from the external training script.

## Regenerate/Sync Notes
1. Export `id2label` from the external training run right after training finishes.
2. Update `rasa/data/phobert/model/intent_model/intent_labels.json` to match exactly.
3. Keep ids continuous from `0..num_labels-1` with no missing keys.
4. Ensure `num_labels` equals the current intent count (19 after refactor).
5. Run quick smoke test (`rasa/test_phobert.py`) to verify predicted ids map to expected intent names.
6. Update this file with training timestamp, script path, and dependency versions.
