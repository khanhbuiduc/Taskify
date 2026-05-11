"""
fallback_actions.py - Dynamic fallback action powered by Gemini.
"""

import logging
from typing import Any, Dict, List, Text

import requests
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher

from actions.common.text_utils import get_locale, t
from actions.config import GEMINI_API_KEY, GEMINI_API_TIMEOUT, GEMINI_MODEL

logger = logging.getLogger(__name__)


class ActionFallbackGemini(Action):
    def name(self) -> Text:
        return "action_fallback_gemini"

    def _default_fallback(self, locale: str) -> str:
        return t(
            locale,
            "I'm not sure how to help with that. Try asking about your tasks, a weekly summary, or creating a new task.",
            "Tôi không hiểu. Hãy thử hỏi về task, tóm tắt tuần, hoặc tạo task mới.",
        )

    def _build_prompt(self, user_text: str, locale: str) -> str:
        if locale.startswith("vi"):
            return (
                "Bạn là trợ lý của Taskify. Người dùng vừa nói câu nằm ngoài intent hiện có của bot.\n"
                "Hãy trả lời bằng tiếng Việt, đầy đủ ý, dễ hiểu trong 2-4 câu hoàn chỉnh.\n"
                "Không được trả lời dở dang, không kết thúc bằng dấu mở ngoặc hoặc câu chưa trọn nghĩa.\n"
                "Nếu phù hợp, thêm 1 câu gợi ý quay lại chức năng Taskify (tạo task, lọc task, tóm tắt tuần).\n"
                f"Câu người dùng: {user_text}"
            )
        return (
            "You are Taskify assistant. The user's message is out of current bot intents.\n"
            "Reply clearly in 2-4 complete sentences and do not end mid-sentence.\n"
            "If relevant, suggest Taskify features: create task, filter tasks, weekly summary.\n"
            f"User message: {user_text}"
        )

    @staticmethod
    def _looks_truncated(text: str) -> bool:
        if not text or len(text.strip()) < 24:
            return True
        bad_endings = ("(", "[", "{", ":", "-", "—", "…", ",")
        return text.rstrip().endswith(bad_endings)

    def _call_gemini(self, prompt: str) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
        payload: Dict[str, Any] = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1000},
        }
        headers = {"Content-Type": "application/json", "X-goog-api-key": GEMINI_API_KEY}
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=GEMINI_API_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        candidates: List[Dict[str, Any]] = data.get("candidates") or []
        if not candidates:
            raise ValueError("Gemini returned no candidates")
        parts = ((candidates[0].get("content") or {}).get("parts")) or []
        text = "".join(str(p.get("text", "")) for p in parts).strip()
        if not text:
            raise ValueError("Gemini returned empty text")
        return text

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        locale = get_locale(tracker)
        user_text = (tracker.latest_message or {}).get("text", "").strip()
        default_text = self._default_fallback(locale)

        if not GEMINI_API_KEY:
            dispatcher.utter_message(text=default_text)
            return []

        prompt = self._build_prompt(user_text=user_text, locale=locale)
        try:
            answer = self._call_gemini(prompt)
            if self._looks_truncated(answer):
                retry_prompt = (
                    f"{prompt}\n\n"
                    "Trả lời lại đầy đủ hơn. Bắt buộc kết thúc bằng một câu hoàn chỉnh."
                )
                answer_retry = self._call_gemini(retry_prompt)
                if not self._looks_truncated(answer_retry):
                    answer = answer_retry
            dispatcher.utter_message(text=answer)
        except Exception as exc:
            logger.exception("Gemini fallback failed: %s", exc)
            dispatcher.utter_message(text=default_text)

        return []
