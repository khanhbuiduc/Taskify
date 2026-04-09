"""
config.py — Cấu hình toàn cục cho Rasa actions.
Đọc từ biến môi trường, dùng chung bởi tất cả module.
"""

import logging
import os
import re

# ---------------------------------------------------------------------------
# API configuration
# ---------------------------------------------------------------------------
TASKIFY_API_URL = os.getenv("TASKIFY_API_URL", "http://localhost:5116")
RASA_API_KEY = os.getenv("RASA_API_KEY", "rasa-internal-api-key-taskify-2026")
REQUEST_TIMEOUT = 10  # seconds

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
