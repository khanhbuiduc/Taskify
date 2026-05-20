from __future__ import annotations

import sys
import unittest
from pathlib import Path

import yaml


PHOBERT_DIR = Path(__file__).resolve().parents[1]
if str(PHOBERT_DIR) not in sys.path:
    sys.path.insert(0, str(PHOBERT_DIR))

from nlu_gen.note import get_note_intents
from nlu_gen.render import render_nlu_document
from nlu_gen.shared import SHARED_INTENT_ORDER, get_shared_intents
from nlu_gen.task import TASK_INTENT_ORDER, get_task_intents


class GenerateNLUTest(unittest.TestCase):
    def _assert_intents_valid(self, intents):
        self.assertTrue(intents)
        for intent, examples in intents.items():
            self.assertTrue(intent)
            self.assertTrue(examples)
            normalized = [x.strip().lower() for x in examples]
            self.assertEqual(len(normalized), len(set(normalized)))

    def test_shared_intents(self):
        intents = get_shared_intents()
        self._assert_intents_valid(intents)
        self.assertEqual(list(intents.keys()), SHARED_INTENT_ORDER)

    def test_task_intents(self):
        intents = get_task_intents()
        self._assert_intents_valid(intents)
        self.assertEqual(list(intents.keys()), TASK_INTENT_ORDER)

    def test_note_intents(self):
        intents = get_note_intents()
        self._assert_intents_valid(intents)

    def test_render_yaml_is_parseable(self):
        text = render_nlu_document(get_task_intents(), TASK_INTENT_ORDER)
        data = yaml.safe_load(text)
        self.assertIn("nlu", data)
        self.assertTrue(any("intent" in item for item in data["nlu"]))


if __name__ == "__main__":
    unittest.main()

