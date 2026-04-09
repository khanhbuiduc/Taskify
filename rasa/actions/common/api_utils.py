"""
common/api_utils.py — Tiện ích gọi HTTP API nội bộ.
"""

from typing import Dict, Optional, Tuple

from actions.config import RASA_API_KEY


def get_api_headers() -> Dict[str, str]:
    """Get headers for internal API calls."""
    return {"Content-Type": "application/json", "X-Rasa-Token": RASA_API_KEY}


def split_sender(sender_id: str) -> Tuple[str, Optional[str]]:
    """Split sender id into (user_id, session_id) when formatted as user:session."""
    if ":" in sender_id:
        user, session = sender_id.split(":", 1)
        return user, session
    return sender_id, None
