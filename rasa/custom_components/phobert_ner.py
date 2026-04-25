import os
from typing import Any, Dict, List, Optional, Text

import torch
from transformers import AutoModelForTokenClassification, AutoTokenizer

from rasa.engine.graph import GraphComponent
from rasa.engine.graph import ExecutionContext
from rasa.engine.recipes.default_recipe import DefaultV1Recipe
from rasa.engine.storage.resource import Resource
from rasa.engine.storage.storage import ModelStorage
from rasa.nlu.extractors.extractor import EntityExtractorMixin
from rasa.shared.nlu.training_data.message import Message
from rasa.shared.nlu.training_data.training_data import TrainingData

# Đường dẫn tới ner_model
_MODEL_DIR = os.path.join(
    os.path.dirname(__file__),
    "..", "data", "phobert", "model", "ner_model"
)
_MODEL_DIR = os.path.abspath(_MODEL_DIR)


@DefaultV1Recipe.register(
    [DefaultV1Recipe.ComponentType.ENTITY_EXTRACTOR], is_trainable=False
)
class PhobertEntityExtractor(EntityExtractorMixin, GraphComponent):
    """Custom Entity Extractor dùng PhoBERT đã fine-tune cho NER."""

    def __init__(self, config: Dict[Text, Any]) -> None:
        super().__init__(config)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        print(f"[PhobertEntityExtractor] Đang load model từ: {_MODEL_DIR}")
        self.tokenizer = AutoTokenizer.from_pretrained(_MODEL_DIR)
        self.model = AutoModelForTokenClassification.from_pretrained(_MODEL_DIR)
        self.model.to(self.device)
        self.model.eval()

        # id2label từ config.json của model đã chuẩn xác
        self.id2label: Dict[int, str] = {
            int(k): v for k, v in self.model.config.id2label.items()
        }
        print(f"[PhobertEntityExtractor] Đã load xong. {len(self.id2label)} labels: {list(self.id2label.values())}")

    @classmethod
    def create(
        cls,
        config: Dict[Text, Any],
        model_storage: ModelStorage,
        resource: Resource,
        execution_context: ExecutionContext,
    ) -> "PhobertEntityExtractor":
        return cls(config)

    def _tokenize_words(self, words: List[str]):
        """
        Tokenize thủ công từng từ riêng lẻ để tự xây dựng word_id map
        (PhobertTokenizer là slow tokenizer, không có word_ids()).
        Trả về: (input_ids list, word_ids list)
        """
        word_ids_manual = []
        all_token_ids = [self.tokenizer.bos_token_id]  # [CLS]
        word_ids_manual.append(None)

        for w_idx, word in enumerate(words):
            toks = self.tokenizer.encode(word, add_special_tokens=False)
            for t in toks:
                all_token_ids.append(t)
                word_ids_manual.append(w_idx)

        all_token_ids.append(self.tokenizer.eos_token_id)  # [SEP]
        word_ids_manual.append(None)

        # Cắt nếu vượt max_length
        max_len = 256
        if len(all_token_ids) > max_len:
            all_token_ids = all_token_ids[:max_len - 1] + [self.tokenizer.eos_token_id]
            word_ids_manual = word_ids_manual[:max_len - 1] + [None]

        return all_token_ids, word_ids_manual

    def _align_predictions(
        self,
        words: List[str],
        word_ids: List[Optional[int]],
        label_ids: List[int],
        probs: List[float],
    ) -> List[Dict]:
        """
        Align BPE subword predictions về từ VnCoreNLP gốc.
        Mỗi subword của cùng một từ → dùng prediction của subword đầu tiên (của từ đó).
        """
        result = []
        seen_word_ids = set()
        for i, word_id in enumerate(word_ids):
            if word_id is None:
                # [CLS] hoặc [SEP] token
                continue
            if word_id in seen_word_ids:
                # Subword tiếp theo của từ đã xử lý → bỏ qua
                continue
            seen_word_ids.add(word_id)
            label = self.id2label.get(label_ids[i], "O")
            result.append({
                "word": words[word_id],
                "label": label,
                "prob": probs[i],
            })
        return result

    def _build_entities(
        self, aligned: List[Dict], original_text: str
    ) -> List[Dict[Text, Any]]:
        """
        Nhóm các token B-/I- liên tiếp thành một entity span.
        Map ngược về character offset trong chuỗi gốc.
        """
        entities = []
        current_entity_type = None
        current_tokens = []
        current_probs = []

        for item in aligned:
            label = item["label"]
            word = item["word"].replace("_", " ")  # VnCoreNLP dùng _ trong từ ghép

            if label.startswith("B-"):
                # Lưu entity đang xử lý (nếu có)
                if current_entity_type and current_tokens:
                    entities.append(self._make_entity(
                        current_entity_type, current_tokens, current_probs, original_text
                    ))
                # Bắt đầu entity mới
                current_entity_type = label[2:]
                current_tokens = [word]
                current_probs = [item["prob"]]

            elif label.startswith("I-") and current_entity_type == label[2:]:
                # Tiếp tục entity hiện tại
                current_tokens.append(word)
                current_probs.append(item["prob"])

            else:
                # "O" hoặc I- không khớp → kết thúc entity cũ
                if current_entity_type and current_tokens:
                    entities.append(self._make_entity(
                        current_entity_type, current_tokens, current_probs, original_text
                    ))
                current_entity_type = None
                current_tokens = []
                current_probs = []

        # Kết thúc vòng lặp — lưu entity cuối nếu còn
        if current_entity_type and current_tokens:
            entities.append(self._make_entity(
                current_entity_type, current_tokens, current_probs, original_text
            ))

        return entities

    def _make_entity(
        self,
        entity_type: str,
        tokens: List[str],
        probs: List[float],
        original_text: str,
    ) -> Dict[Text, Any]:
        """Tạo dict entity chuẩn Rasa với start/end offset."""
        value = " ".join(tokens)
        confidence = sum(probs) / len(probs)

        # Tìm vị trí của entity trong chuỗi gốc
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
            if not text:
                continue

            # Lấy tokens từ VnCoreNLPTokenizer (đã lưu dưới dạng list tokens trong message)
            rasa_tokens = message.get("tokens")
            if rasa_tokens:
                words = [t.text for t in rasa_tokens]
            else:
                # Fallback: split bằng khoảng trắng
                words = text.split()

            # Tokenize thủ công để build word_id alignment (slow tokenizer không hỗ trợ word_ids())
            input_ids, word_ids = self._tokenize_words(words)
            input_tensor = torch.tensor([input_ids]).to(self.device)

            with torch.no_grad():
                outputs = self.model(input_ids=input_tensor)
                logits = outputs.logits[0]
                probs_tensor = torch.softmax(logits, dim=-1)
                label_ids = torch.argmax(probs_tensor, dim=-1).tolist()
                top_probs = probs_tensor.max(dim=-1).values.tolist()

            # Align subwords → từ gốc
            aligned = self._align_predictions(words, word_ids, label_ids, top_probs)

            # Nhóm BIO thành entity spans
            entities = self._build_entities(aligned, text)

            # Lấy entities hiện tại (do Duckling vv đã chạy trước) và merge
            existing = message.get("entities") or []
            existing.extend(entities)
            message.set("entities", existing, add_to_output=True)

        return messages

    def process_training_data(self, training_data: TrainingData) -> TrainingData:
        self.process(training_data.training_examples)
        return training_data


# === QUICK TEST (chạy trực tiếp: python phobert_ner.py) ===
if __name__ == "__main__":
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(_MODEL_DIR)
    model = AutoModelForTokenClassification.from_pretrained(_MODEL_DIR)
    model.to(device)
    model.eval()
    id2label = {int(k): v for k, v in model.config.id2label.items()}

    test_cases = [
        ("tạo task họp team ngày_mai 9h", ["tạo", "task", "họp", "team", "ngày_mai", "9h"]),
        ("thêm nhiệm_vụ viết báo_cáo ưu_tiên cao", ["thêm", "nhiệm_vụ", "viết", "báo_cáo", "ưu_tiên", "cao"]),
        ("xoá task học bài", ["xoá", "task", "học", "bài"]),
    ]

    print("\n=== TEST NER ===")
    for text, words in test_cases:
        encoding = tokenizer(words, is_split_into_words=True, return_tensors="pt",
                             max_length=256, truncation=True, padding=True)
        word_ids = encoding.word_ids(batch_index=0)
        inputs = {k: v.to(device) for k, v in encoding.items()}
        with torch.no_grad():
            logits = model(**inputs).logits[0]
            probs = torch.softmax(logits, dim=-1)
            label_ids = torch.argmax(probs, dim=-1).tolist()
            top_probs = probs.max(dim=-1).values.tolist()

        seen = set()
        print(f"\n  Input: '{text}'")
        for i, wid in enumerate(word_ids):
            if wid is None or wid in seen:
                continue
            seen.add(wid)
            label = id2label.get(label_ids[i], "O")
            if label != "O":
                print(f"    → [{top_probs[i]:.2%}] '{words[wid]}' = {label}")
