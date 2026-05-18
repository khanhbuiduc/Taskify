"""
config.py — Cấu hình toàn cục cho Rasa actions.
Đọc từ biến môi trường, dùng chung bởi tất cả module.
"""

import logging
import os
import re
from pathlib import Path


def _load_dotenv() -> None:
    """
    Load environment variables from .env near the actions package.
    Existing process env values are preserved.
    """
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv()

# ---------------------------------------------------------------------------
# API configuration
# ---------------------------------------------------------------------------
TASKIFY_API_URL = os.getenv("TASKIFY_API_URL", "http://localhost:5116")
RASA_API_KEY = os.getenv("RASA_API_KEY", "rasa-internal-api-key-taskify-2026")
# The backend may fan out to slower local providers such as Ollama, so
# the action server should wait longer than the provider-level timeout.
REQUEST_TIMEOUT = int(os.getenv("TASKIFY_API_TIMEOUT", "60"))  # seconds

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Vietnamese language detection patterns
# ---------------------------------------------------------------------------
VIETNAMESE_CHAR_PATTERN = re.compile(
    r"[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]",
    re.IGNORECASE,
)
VIETNAMESE_HINT_PATTERN = re.compile(
    r"\b(xin|chao|toi|ban|minh|giup|nhiem|viec|ngay|hom|mai|tuan|tom tat|uu tien|xoa|ghim|ghi chu|khong|tao|them|muon|can)\b",
    re.IGNORECASE,
)
