"""
fallback_actions.py - Dynamic fallback action powered by backend AI fallback proxy.
"""

import logging
from typing import Any, Dict, List, Text

import requests
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher

from actions.common.api_utils import get_api_headers, split_sender
from actions.common.text_utils import get_locale, t
from actions.config import REQUEST_TIMEOUT, TASKIFY_API_URL

logger = logging.getLogger(__name__)


class ActionFallbackGemini(Action):
    def name(self) -> Text:
        return "action_fallback_gemini"

    def _default_fallback(self, locale: str) -> str:
        return t(
            locale,
            "I'm not sure how to help with that. Try asking about your tasks, a weekly summary, or creating a new task.",
            "Toi khong hieu. Hay thu hoi ve task, tom tat tuan, hoac tao task moi.",
        )

    def _call_backend_fallback(self, user_id: str, user_text: str, locale: str) -> str:
        url = f"{TASKIFY_API_URL}/api/internal/ai/fallback/{user_id}"
        response = requests.post(
            url,
            headers=get_api_headers(),
            json={"messageText": user_text, "locale": locale},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        data: Dict[Text, Any] = response.json() or {}
        text = str(data.get("text") or "").strip()
        if not text:
            raise ValueError("Backend AI fallback returned empty text")
        return text

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, _session_id = split_sender(tracker.sender_id)
        locale = get_locale(tracker)
        user_text = (tracker.latest_message or {}).get("text", "").strip()
        default_text = self._default_fallback(locale)

        try:
            answer = self._call_backend_fallback(
                user_id=user_id,
                user_text=user_text,
                locale=locale,
            )
            dispatcher.utter_message(text=answer)
        except Exception as exc:
            logger.exception("AI fallback failed: %s", exc)
            dispatcher.utter_message(text=default_text)

        return []
