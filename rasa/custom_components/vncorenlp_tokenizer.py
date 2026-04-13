from typing import Any, Dict, List, Text

from rasa.engine.graph import ExecutionContext
from rasa.engine.recipes.default_recipe import DefaultV1Recipe
from rasa.engine.storage.resource import Resource
from rasa.engine.storage.storage import ModelStorage
from rasa.nlu.tokenizers.tokenizer import Token, Tokenizer
from rasa.shared.nlu.training_data.message import Message

# NOTE: Bạn cần cài đặt vncorenlp qua pip: `pip install vncorenlp`
# và tải vncorenlp từ github: `https://github.com/vncorenlp/VnCoreNLP`
try:
    from vncorenlp import VnCoreNLP
except ImportError:
    VnCoreNLP = None

@DefaultV1Recipe.register(
    [DefaultV1Recipe.ComponentType.MESSAGE_TOKENIZER], is_trainable=False
)
class VnCoreNLPTokenizer(Tokenizer):
    """Một tokenizer tuỳ chỉnh sử dụng thư viện VnCoreNLP cho Word Segmentation tiếng Việt."""

    def __init__(self, config: Dict[Text, Any]) -> None:
        """Khởi tạo tokenizer."""
        super().__init__(config)
        # Giả sử file JAR của vncorenlp nằm trong folder "vncorenlp" cùng cấp
        # Bạn có thể điều chỉnh đường dẫn cho phù hợp.
        # Ở đây chúng ta chỉ cần module Word Segmentation ("wseg")
        if VnCoreNLP is not None:
            # Sử dụng VnCoreNLP-1.2.jar (bản mới hơn) dùng chuẩn tên thư mục DOS (HPPC~1) để tránh lỗi Java không hỗ trợ dấu cách
            jar_path = r"C:\Users\HPPC~1\VnCoreNLP\VnCoreNLP-1.2.jar"
            self.rdrsegmenter = VnCoreNLP(jar_path, annotators="wseg", max_heap_size='-Xmx500m')
        else:
            self.rdrsegmenter = None
            print("CẢNH BÁO: Không tìm thấy thư viện vncorenlp. Hãy pip install vncorenlp.")

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
        
        # Nếu chưa load được model, fallback tạm về split space
        if not self.rdrsegmenter:
            words = text.split()
            tokens = self._words_to_tokens(words, text)
            return tokens

        # Gọi VnCoreNLP để tách từ (word segmentation)
        # tokenize trả về List[List[str]] cho các câu
        sentences = self.rdrsegmenter.tokenize(text)
        words = []
        for sentence in sentences:
            words.extend(sentence)

        # Chuyển đổi thành dạng Token của Rasa
        tokens = self._words_to_tokens(words, text)

        return tokens

    def _words_to_tokens(self, words: List[Text], text: Text) -> List[Token]:
        tokens = []
        offset = 0
        for word in words:
            # word segment của vncorenlp dùng '_' nối các âm tiết
            # Nếu cần map đúng vị trí gốc (không chứa '_'), bạn sẽ cần xử lý logic offset phức tạp hơn.
            # Ở mức cơ bản, chúng ta gán qua hàm Token
            word_len = len(word.replace('_', ' ')) 
            start = text.find(word.replace('_', ' '), offset)
            
            if start == -1:
                # Nếu không map được đúng offset, có thể do khoảng trắng
                start = offset

            end = start + word_len
            tokens.append(Token(word, start, end))
            offset = end

        return tokens
