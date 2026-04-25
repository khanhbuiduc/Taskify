from typing import Any, Dict, List, Text

from rasa.engine.graph import ExecutionContext
from rasa.engine.recipes.default_recipe import DefaultV1Recipe
from rasa.engine.storage.resource import Resource
from rasa.engine.storage.storage import ModelStorage
from rasa.nlu.tokenizers.tokenizer import Token, Tokenizer
from rasa.shared.nlu.training_data.message import Message

try:
    from vncorenlp import VnCoreNLP
except ImportError:
    VnCoreNLP = None


@DefaultV1Recipe.register(
    [DefaultV1Recipe.ComponentType.MESSAGE_TOKENIZER], is_trainable=False
)
class VnCoreNLPTokenizer(Tokenizer):
    """Vietnamese tokenizer based on VnCoreNLP word segmentation."""

    @staticmethod
    def get_default_config() -> Dict[Text, Any]:
        return {
            "intent_tokenization_flag": False,
            "intent_split_symbol": "_",
            "token_pattern": None,
        }

    def __init__(self, config: Dict[Text, Any]) -> None:
        super().__init__(config)
        if VnCoreNLP is not None:
            jar_path = r"C:\Users\HPPC~1\VnCoreNLP\VnCoreNLP-1.2.jar"
            self.rdrsegmenter = VnCoreNLP(
                jar_path,
                annotators="wseg",
                max_heap_size="-Xmx500m",
            )
        else:
            self.rdrsegmenter = None
            print("WARNING: vncorenlp not installed. Falling back to whitespace split.")

    @classmethod
    def create(
        cls,
        config: Dict[Text, Any],
        model_storage: ModelStorage,
        resource: Resource,
        execution_context: ExecutionContext,
    ) -> "VnCoreNLPTokenizer":
        return cls(config)

    def tokenize(self, message: Message, attribute: Text) -> List[Token]:
        text = message.get(attribute)
        if not text:
            return []

        if not self.rdrsegmenter:
            return self._words_to_tokens(text.split(), text)

        sentences = self.rdrsegmenter.tokenize(text)
        words: List[str] = []
        for sentence in sentences:
            words.extend(sentence)

        return self._words_to_tokens(words, text)

    def _words_to_tokens(self, words: List[Text], text: Text) -> List[Token]:
        tokens = []
        offset = 0
        for word in words:
            plain_word = word.replace("_", " ")
            word_len = len(plain_word)
            start = text.find(plain_word, offset)
            if start == -1:
                start = offset
            end = start + word_len
            tokens.append(Token(word, start, end))
            offset = end
        return tokens
