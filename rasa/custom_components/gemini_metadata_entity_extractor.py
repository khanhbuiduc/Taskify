from typing import Any, Dict, List, Optional, Text

from rasa.engine.graph import ExecutionContext, GraphComponent
from rasa.engine.recipes.default_recipe import DefaultV1Recipe
from rasa.engine.storage.resource import Resource
from rasa.engine.storage.storage import ModelStorage
from rasa.nlu.extractors.extractor import EntityExtractorMixin
from rasa.shared.nlu.training_data.message import Message
from rasa.shared.nlu.training_data.training_data import TrainingData


SUPPORTED_ENTITIES = {"object_name", "keyword", "content", "category", "amount"}
EXTRACTOR_NAME = "GeminiMetadataEntityExtractor"


@DefaultV1Recipe.register(
    [DefaultV1Recipe.ComponentType.ENTITY_EXTRACTOR], is_trainable=False
)
class GeminiMetadataEntityExtractor(EntityExtractorMixin, GraphComponent):
    """Inject entities extracted upstream by Gemini from message metadata."""

    def __init__(self, config: Dict[Text, Any]) -> None:
        self._config = config

    @classmethod
    def create(
        cls,
        config: Dict[Text, Any],
        model_storage: ModelStorage,
        resource: Resource,
        execution_context: ExecutionContext,
    ) -> "GeminiMetadataEntityExtractor":
        return cls(config)

    def process(self, messages: List[Message]) -> List[Message]:
        for message in messages:
            metadata = self._get_metadata(message)
            extracted = metadata.get("geminiEntityExtraction") or {}
            entities = extracted.get("entities") or []
            if not isinstance(entities, list) or not entities:
                continue

            existing = list(message.get("entities") or [])
            existing_keys = {self._entity_key(entity) for entity in existing}
            additions: List[Dict[Text, Any]] = []

            for item in entities:
                entity = self._normalize_entity(item)
                if entity is None:
                    continue

                entity_key = self._entity_key(entity)
                if entity_key in existing_keys:
                    continue

                existing_keys.add(entity_key)
                additions.append(entity)

            if additions:
                existing.extend(additions)
                message.set("entities", existing, add_to_output=True)

        return messages

    def process_training_data(self, training_data: TrainingData) -> TrainingData:
        self.process(training_data.training_examples)
        return training_data

    @staticmethod
    def _get_metadata(message: Message) -> Dict[Text, Any]:
        metadata = message.get("metadata")
        if isinstance(metadata, dict):
            return metadata

        raw_data = getattr(message, "data", {}) or {}
        fallback = raw_data.get("metadata")
        return fallback if isinstance(fallback, dict) else {}

    @staticmethod
    def _normalize_entity(item: Any) -> Optional[Dict[Text, Any]]:
        if not isinstance(item, dict):
            return None

        entity_name = str(item.get("entity") or "").strip()
        value = item.get("value")
        start = item.get("start")
        end = item.get("end")

        if entity_name not in SUPPORTED_ENTITIES:
            return None
        if not isinstance(value, str) or not value.strip():
            return None
        if not isinstance(start, int) or not isinstance(end, int) or start < 0 or end <= start:
            return None

        confidence = item.get("confidence", 1.0)
        try:
            confidence_value = float(confidence)
        except (TypeError, ValueError):
            confidence_value = 1.0

        return {
            "entity": entity_name,
            "value": value,
            "start": start,
            "end": end,
            "confidence": confidence_value,
            "extractor": EXTRACTOR_NAME,
        }

    @staticmethod
    def _entity_key(entity: Dict[Text, Any]) -> tuple:
        return (
            entity.get("entity"),
            entity.get("value"),
            entity.get("start"),
            entity.get("end"),
        )
