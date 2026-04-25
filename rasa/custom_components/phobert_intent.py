import json
import os
from typing import Any, Dict, List, Text

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from rasa.engine.graph import GraphComponent
from rasa.engine.graph import ExecutionContext
from rasa.engine.recipes.default_recipe import DefaultV1Recipe
from rasa.engine.storage.resource import Resource
from rasa.engine.storage.storage import ModelStorage
from rasa.nlu.classifiers.classifier import IntentClassifier
from rasa.shared.nlu.training_data.message import Message
from rasa.shared.nlu.training_data.training_data import TrainingData

# Path to fine-tuned intent model directory.
_MODEL_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "data",
    "phobert",
    "model",
    "intent_model",
)
_MODEL_DIR = os.path.abspath(_MODEL_DIR)


@DefaultV1Recipe.register(
    [DefaultV1Recipe.ComponentType.INTENT_CLASSIFIER], is_trainable=False
)
class PhobertIntentClassifier(IntentClassifier, GraphComponent):
    """Custom Intent Classifier using fine-tuned PhoBERT."""

    def __init__(self, config: Dict[Text, Any]) -> None:
        super().__init__(config)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        print(f"[PhobertIntentClassifier] Loading model from: {_MODEL_DIR}")
        self.tokenizer = AutoTokenizer.from_pretrained(_MODEL_DIR)
        self.model = AutoModelForSequenceClassification.from_pretrained(_MODEL_DIR)
        self.model.to(self.device)
        self.model.eval()

        labels_path = os.path.join(_MODEL_DIR, "intent_labels.json")
        with open(labels_path, "r", encoding="utf-8-sig") as f:
            raw_id2label: Dict[str, str] = json.load(f)

        self.id2label = self._validate_and_normalize_id2label(raw_id2label)
        print(f"[PhobertIntentClassifier] Loaded {len(self.id2label)} intents.")

    def _validate_and_normalize_id2label(
        self, raw_id2label: Dict[str, str]
    ) -> Dict[int, str]:
        """Validate label mapping against model num_labels and enforce strict ids."""
        if not isinstance(raw_id2label, dict):
            raise ValueError(
                "[PhobertIntentClassifier] intent_labels.json must be a JSON object."
            )

        normalized: Dict[int, str] = {}
        for key, value in raw_id2label.items():
            if not str(key).isdigit():
                raise ValueError(
                    f"[PhobertIntentClassifier] Invalid label key '{key}'. "
                    "Keys must be integer strings."
                )
            normalized[int(key)] = value

        expected_num_labels = int(self.model.config.num_labels)
        expected_keys = list(range(expected_num_labels))
        actual_keys = sorted(normalized.keys())

        if len(normalized) != expected_num_labels:
            raise ValueError(
                "[PhobertIntentClassifier] intent label count mismatch: "
                f"model.config.num_labels={expected_num_labels}, "
                f"mapping_count={len(normalized)}"
            )

        if actual_keys != expected_keys:
            raise ValueError(
                "[PhobertIntentClassifier] intent label ids must be continuous from "
                f"0 to {expected_num_labels - 1}. actual_keys={actual_keys}"
            )

        return normalized

    @classmethod
    def create(
        cls,
        config: Dict[Text, Any],
        model_storage: ModelStorage,
        resource: Resource,
        execution_context: ExecutionContext,
    ) -> "PhobertIntentClassifier":
        return cls(config)

    def process(self, messages: List[Message]) -> List[Message]:
        for message in messages:
            text = message.get("text")
            if not text:
                continue

            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                max_length=256,
                truncation=True,
                padding=True,
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self.model(**inputs)
                probs = torch.softmax(outputs.logits, dim=-1)[0]

            sorted_indices = torch.argsort(probs, descending=True)

            top_id = sorted_indices[0].item()
            top_name = self.id2label[top_id]
            top_conf = probs[top_id].item()

            intent_ranking = [
                {
                    "name": self.id2label[idx.item()],
                    "confidence": probs[idx.item()].item(),
                }
                for idx in sorted_indices
            ]

            message.set(
                "intent",
                {"name": top_name, "confidence": top_conf},
                add_to_output=True,
            )
            message.set("intent_ranking", intent_ranking, add_to_output=True)

        return messages

    def process_training_data(self, training_data: TrainingData) -> TrainingData:
        self.process(training_data.training_examples)
        return training_data


# Quick test: python phobert_intent.py
if __name__ == "__main__":
    import io
    import sys

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(_MODEL_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(_MODEL_DIR)
    model.to(device)
    model.eval()

    labels_path = os.path.join(_MODEL_DIR, "intent_labels.json")
    with open(labels_path, "r", encoding="utf-8-sig") as f:
        id2label = {int(k): v for k, v in json.load(f).items()}

    test_sentences = [
        "xin chao",
        "tao task hop team ngay_mai 9h",
        "xoa task hoc bai",
        "tom_tat tuan",
        "viet bao_cao ngay_mai uu_tien cao",
    ]

    print("\n=== TEST INTENT CLASSIFICATION ===")
    for sent in test_sentences:
        inputs = tokenizer(
            sent,
            return_tensors="pt",
            max_length=256,
            truncation=True,
            padding=True,
        )
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            probs = torch.softmax(model(**inputs).logits, dim=-1)[0]

        top_id = torch.argmax(probs).item()
        print(f"  [{probs[top_id]:.2%}] '{sent}' => {id2label[top_id]}")
