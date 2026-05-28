import os
from typing import Any, Dict, List, Optional, Text

import torch
from transformers import AutoModelForTokenClassification, AutoTokenizer

from rasa.engine.graph import ExecutionContext, GraphComponent
from rasa.engine.recipes.default_recipe import DefaultV1Recipe
from rasa.engine.storage.resource import Resource
from rasa.engine.storage.storage import ModelStorage
from rasa.nlu.extractors.extractor import EntityExtractorMixin
from rasa.shared.nlu.training_data.message import Message
from rasa.shared.nlu.training_data.training_data import TrainingData

_MODEL_DIR = os.path.join(
    os.path.dirname(__file__),
    "..", "data", "model", "ner_model",
)
_MODEL_DIR = os.path.abspath(_MODEL_DIR)
_GEMINI_EXTRACTOR = "GeminiMetadataEntityExtractor"


@DefaultV1Recipe.register(
    [DefaultV1Recipe.ComponentType.ENTITY_EXTRACTOR], is_trainable=False
)
class PhobertEntityExtractor(EntityExtractorMixin, GraphComponent):
    """Custom entity extractor backed by a fine-tuned PhoBERT NER model."""

    def __init__(self, config: Dict[Text, Any]) -> None:
        self._config = config
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        print(f"[PhobertEntityExtractor] Loading model from: {_MODEL_DIR}")
        self.tokenizer = AutoTokenizer.from_pretrained(_MODEL_DIR)
        self.model = AutoModelForTokenClassification.from_pretrained(_MODEL_DIR)
        self.model.to(self.device)
        self.model.eval()

        self.id2label: Dict[int, str] = {
            int(key): value for key, value in self.model.config.id2label.items()
        }
        print(
            "[PhobertEntityExtractor] Loaded "
            f"{len(self.id2label)} labels: {list(self.id2label.values())}"
        )

    @classmethod
    def create(
        cls,
        config: Dict[Text, Any],
        model_storage: ModelStorage,
        resource: Resource,
        execution_context: ExecutionContext,
    ) -> "PhobertEntityExtractor":
        return cls(config)

    def _tokenize_words(self, words: List[str]) -> tuple[List[int], List[Optional[int]]]:
        """Build manual word alignment because PhoBERT tokenizer has no word_ids()."""
        word_ids_manual: List[Optional[int]] = [None]
        all_token_ids = [self.tokenizer.bos_token_id]

        for word_index, word in enumerate(words):
            token_ids = self.tokenizer.encode(word, add_special_tokens=False)
            for token_id in token_ids:
                all_token_ids.append(token_id)
                word_ids_manual.append(word_index)

        all_token_ids.append(self.tokenizer.eos_token_id)
        word_ids_manual.append(None)

        max_len = 256
        if len(all_token_ids) > max_len:
            all_token_ids = all_token_ids[: max_len - 1] + [self.tokenizer.eos_token_id]
            word_ids_manual = word_ids_manual[: max_len - 1] + [None]

        return all_token_ids, word_ids_manual

    def _align_predictions(
        self,
        words: List[str],
        word_ids: List[Optional[int]],
        label_ids: List[int],
        probs: List[float],
    ) -> List[Dict[str, Any]]:
        """Collapse subword predictions back to the original word sequence."""
        result: List[Dict[str, Any]] = []
        seen_word_ids = set()

        for index, word_id in enumerate(word_ids):
            if word_id is None or word_id in seen_word_ids:
                continue

            seen_word_ids.add(word_id)
            label = self.id2label.get(label_ids[index], "O")
            result.append(
                {
                    "word": words[word_id],
                    "label": label,
                    "prob": probs[index],
                }
            )

        return result

    def _build_entities(
        self, aligned: List[Dict[str, Any]], original_text: str
    ) -> List[Dict[Text, Any]]:
        """Merge BIO tags into full entity spans."""
        entities: List[Dict[Text, Any]] = []
        current_entity_type: Optional[str] = None
        current_tokens: List[str] = []
        current_probs: List[float] = []

        for item in aligned:
            label = item["label"]
            word = item["word"].replace("_", " ")

            if label.startswith("B-"):
                if current_entity_type and current_tokens:
                    entities.append(
                        self._make_entity(
                            current_entity_type,
                            current_tokens,
                            current_probs,
                            original_text,
                        )
                    )
                current_entity_type = label[2:]
                current_tokens = [word]
                current_probs = [item["prob"]]
            elif label.startswith("I-") and current_entity_type == label[2:]:
                current_tokens.append(word)
                current_probs.append(item["prob"])
            else:
                if current_entity_type and current_tokens:
                    entities.append(
                        self._make_entity(
                            current_entity_type,
                            current_tokens,
                            current_probs,
                            original_text,
                        )
                    )
                current_entity_type = None
                current_tokens = []
                current_probs = []

        if current_entity_type and current_tokens:
            entities.append(
                self._make_entity(
                    current_entity_type,
                    current_tokens,
                    current_probs,
                    original_text,
                )
            )

        return entities

    def _make_entity(
        self,
        entity_type: str,
        tokens: List[str],
        probs: List[float],
        original_text: str,
    ) -> Dict[Text, Any]:
        value = " ".join(tokens)
        confidence = sum(probs) / len(probs)

        start = original_text.lower().find(value.lower())
        end = start + len(value) if start != -1 else len(value)

        return {
            "entity": entity_type,
            "value": value,
            "start": max(0, start),
            "end": end,
            "confidence": float(confidence),
            "extractor": "PhobertEntityExtractor",
        }

    def process(self, messages: List[Message]) -> List[Message]:
        for message in messages:
            text = message.get("text")
            if not text or self._has_gemini_entities(message):
                continue

            rasa_tokens = message.get("tokens")
            words = [token.text for token in rasa_tokens] if rasa_tokens else text.split()

            input_ids, word_ids = self._tokenize_words(words)
            input_tensor = torch.tensor([input_ids]).to(self.device)

            with torch.no_grad():
                outputs = self.model(input_ids=input_tensor)
                logits = outputs.logits[0]
                probs_tensor = torch.softmax(logits, dim=-1)
                label_ids = torch.argmax(probs_tensor, dim=-1).tolist()
                top_probs = probs_tensor.max(dim=-1).values.tolist()

            aligned = self._align_predictions(words, word_ids, label_ids, top_probs)
            entities = self._build_entities(aligned, text)

            existing = list(message.get("entities") or [])
            existing.extend(entities)
            message.set("entities", existing, add_to_output=True)

        return messages

    def process_training_data(self, training_data: TrainingData) -> TrainingData:
        self.process(training_data.training_examples)
        return training_data

    @staticmethod
    def _has_gemini_entities(message: Message) -> bool:
        existing_entities = message.get("entities") or []
        if any(entity.get("extractor") == _GEMINI_EXTRACTOR for entity in existing_entities):
            return True

        metadata = message.get("metadata")
        if not isinstance(metadata, dict):
            metadata = getattr(message, "data", {}).get("metadata") or {}

        extracted = metadata.get("geminiEntityExtraction") if isinstance(metadata, dict) else None
        entities = extracted.get("entities") if isinstance(extracted, dict) else None
        return isinstance(entities, list) and len(entities) > 0


if __name__ == "__main__":
    import io
    import sys

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(_MODEL_DIR)
    model = AutoModelForTokenClassification.from_pretrained(_MODEL_DIR)
    model.to(device)
    model.eval()
    id2label = {int(key): value for key, value in model.config.id2label.items()}

    test_cases = [
        ("tao task hop team ngay_mai 9h", ["tao", "task", "hop", "team", "ngay_mai", "9h"]),
        (
            "them nhiem_vu viet bao_cao uu_tien cao",
            ["them", "nhiem_vu", "viet", "bao_cao", "uu_tien", "cao"],
        ),
        ("xoa task hoc bai", ["xoa", "task", "hoc", "bai"]),
    ]

    print("\n=== TEST NER ===")
    for text, words in test_cases:
        encoding = tokenizer(
            words,
            is_split_into_words=True,
            return_tensors="pt",
            max_length=256,
            truncation=True,
            padding=True,
        )
        word_ids = encoding.word_ids(batch_index=0)
        inputs = {key: value.to(device) for key, value in encoding.items()}
        with torch.no_grad():
            logits = model(**inputs).logits[0]
            probs = torch.softmax(logits, dim=-1)
            label_ids = torch.argmax(probs, dim=-1).tolist()
            top_probs = probs.max(dim=-1).values.tolist()

        seen = set()
        print(f"\n  Input: '{text}'")
        for index, word_id in enumerate(word_ids):
            if word_id is None or word_id in seen:
                continue
            seen.add(word_id)
            label = id2label.get(label_ids[index], "O")
            if label != "O":
                print(f"    -> [{top_probs[index]:.2%}] '{words[word_id]}' = {label}")
