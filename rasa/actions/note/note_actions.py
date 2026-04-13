"""
note/note_actions.py — Tất cả Rasa action liên quan đến Note.

Actions:
    - ActionCreateNote
    - ActionListNotes
    - ActionSearchNotes
    - ActionTogglePinNote
"""

import logging
from typing import Any, Dict, List, Text

import requests
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher

from actions.config import TASKIFY_API_URL, REQUEST_TIMEOUT
from actions.common.api_utils import get_api_headers, split_sender

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# ActionCreateNote
# ---------------------------------------------------------------------------


class ActionCreateNote(Action):
    """Create a standalone note via internal API."""

    def name(self) -> Text:
        return "action_create_note"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        note_title = tracker.get_slot("note_title")
        note_text = tracker.get_slot("note_text")
        user_message = tracker.latest_message.get("text", "").strip()

        # Derive title if missing
        if not note_title:
            note_title = (note_text or user_message or "New note").strip()
            if len(note_title) > 80:
                note_title = note_title[:80]

        payload = {
            "title": note_title,
            "content": note_text or user_message,
        }

        try:
            url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}"
            response = requests.post(url, json=payload, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code in [200, 201]:
                dispatcher.utter_message(text=f"Đã tạo note: **{note_title}**")
            elif response.status_code == 401:
                dispatcher.utter_message(text="Không thể tạo note. Vui lòng đăng nhập lại.")
            else:
                dispatcher.utter_message(text="Không thể tạo note lúc này. Thử lại sau nhé.")
        except Exception as exc:
            logger.exception("Error creating note for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Có lỗi khi tạo note.")

        return []


# ---------------------------------------------------------------------------
# ActionListNotes
# ---------------------------------------------------------------------------


class ActionListNotes(Action):
    """List recent notes for the user."""

    def name(self) -> Text:
        return "action_list_notes"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)

        try:
            url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}?limit=5"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code != 200:
                dispatcher.utter_message(text="Không lấy được danh sách note.")
                return []

            notes = response.json()
            if not notes:
                dispatcher.utter_message(text="Bạn chưa có note nào.")
                return []

            lines = []
            for i, note in enumerate(notes, 1):
                pin = "📌 " if note.get("isPinned") else ""
                title = note.get("title", "Untitled")
                snippet = (note.get("content") or "")[:60]
                snippet = f" - {snippet}..." if snippet else ""
                lines.append(f"{i}. {pin}{title}{snippet}")

            dispatcher.utter_message(
                text="Các note gần đây:\n" + "\n".join(lines),
                json_message={"type": "note_picker", "notes": notes}
            )
        except Exception as exc:
            logger.exception("Error listing notes for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Có lỗi khi lấy note.")

        return []


# ---------------------------------------------------------------------------
# ActionSearchNotes
# ---------------------------------------------------------------------------


class ActionSearchNotes(Action):
    """Search notes by keyword."""

    def name(self) -> Text:
        return "action_search_notes"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        keyword = tracker.get_slot("note_keyword") or tracker.latest_message.get("text", "")
        keyword = keyword.strip()

        if not keyword:
            dispatcher.utter_message(text="Bạn muốn tìm gì trong note?")
            return []

        try:
            url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}?limit=5&search={keyword}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code != 200:
                dispatcher.utter_message(text="Không tìm được note.")
                return []

            notes = response.json()
            if not notes:
                dispatcher.utter_message(text=f'Không có note nào khớp với "{keyword}".')
                return []

            lines = []
            for i, note in enumerate(notes, 1):
                pin = "📌 " if note.get("isPinned") else ""
                title = note.get("title", "Untitled")
                snippet = (note.get("content") or "")[:60]
                snippet = f" - {snippet}..." if snippet else ""
                lines.append(f"{i}. {pin}{title}{snippet}")

            dispatcher.utter_message(
                text="Kết quả tìm kiếm:\n" + "\n".join(lines),
                json_message={"type": "note_picker", "notes": notes}
            )
        except Exception as exc:
            logger.exception("Error searching notes for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Có lỗi khi tìm kiếm note.")

        return []


# ---------------------------------------------------------------------------
# ActionTogglePinNote
# ---------------------------------------------------------------------------


class ActionTogglePinNote(Action):
    """Toggle or set pin state for a note."""

    def name(self) -> Text:
        return "action_toggle_pin_note"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        pin_state_text = (tracker.get_slot("pin_state") or "").lower()
        desired_pin = None
        if "bỏ" in pin_state_text or "unpin" in pin_state_text or "off" in pin_state_text:
            desired_pin = False
        elif "ghim" in pin_state_text or "pin" in pin_state_text or "on" in pin_state_text:
            desired_pin = True

        keyword = tracker.get_slot("note_title") or tracker.get_slot("note_keyword") or ""

        try:
            search_param = keyword.strip() if keyword else ""
            url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}?limit=3"
            if search_param:
                url += f"&search={search_param}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code != 200:
                dispatcher.utter_message(text="Không tìm thấy note để ghim.")
                return []

            notes = response.json()
            if not notes:
                dispatcher.utter_message(text="Không có note nào khớp.")
                return []

            target = notes[0]
            note_id = target.get("id")
            note_title = target.get("title", "note")

            patch_url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}/{note_id}/pin"
            response = requests.patch(patch_url, json=desired_pin, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code in [200, 201]:
                effective_pin = desired_pin if desired_pin is not None else not target.get("isPinned", False)
                state_text = "đã ghim" if effective_pin else "đã bỏ ghim"
                dispatcher.utter_message(text=f"{state_text} **{note_title}**")
            else:
                dispatcher.utter_message(text="Không cập nhật được trạng thái ghim.")
        except Exception as exc:
            logger.exception("Error pinning note for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Có lỗi khi ghim note.")

        return []

# ---------------------------------------------------------------------------
# ActionUpdateNote
# ---------------------------------------------------------------------------


class ActionUpdateNote(Action):
    """Update a note by ID or keyword."""

    def name(self) -> Text:
        return "action_update_note"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        keyword = tracker.get_slot("note_keyword") or tracker.get_slot("note_title") or ""
        new_title = tracker.get_slot("note_title")
        new_text = tracker.get_slot("note_text")

        try:
            url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}?limit=3&search={keyword.strip()}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code != 200 or not response.json():
                dispatcher.utter_message(text="Không tìm thấy note để cập nhật.")
                return []

            target = response.json()[0]
            note_id = target.get("id")

            payload = {}
            if new_title: payload["title"] = new_title
            if new_text: payload["content"] = new_text

            if not payload:
                dispatcher.utter_message(text="Bạn muốn cập nhật nội dung gì cho note này?")
                return []

            patch_url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}/{note_id}"
            response = requests.put(patch_url, json=payload, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code in [200, 201]:
                dispatcher.utter_message(text=f"Đã cập nhật note thành công.")
            else:
                dispatcher.utter_message(text="Không thể cập nhật note lúc này.")
        except Exception as exc:
            logger.exception("Error updating note for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Có lỗi khi cập nhật note.")

        return []

# ---------------------------------------------------------------------------
# ActionDeleteNote
# ---------------------------------------------------------------------------


class ActionDeleteNote(Action):
    """Delete a note."""

    def name(self) -> Text:
        return "action_delete_note"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        
        # Check metadata from frontend delete intent first
        metadata = tracker.latest_message.get("metadata") or {}
        action_name = str(metadata.get("action") or "").strip().lower()

        if action_name == "confirm_delete_note":
            note_ids = metadata.get("noteIds") or []
            if note_ids:
                try:
                    for nid in note_ids:
                        delete_url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}/{nid}"
                        requests.delete(delete_url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
                    dispatcher.utter_message(text=f"Đã xoá {len(note_ids)} note thành công.")
                    return []
                except Exception as exc:
                    logger.exception("Error deleting note via UI for user %s: %s", user_id, exc)
                    dispatcher.utter_message(text="Có lỗi khi xóa note.")
                    return []

        keyword = tracker.get_slot("note_keyword") or tracker.get_slot("note_title") or tracker.latest_message.get("text", "")

        try:
            url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}?limit=3&search={keyword.strip()}"
            response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code != 200 or not response.json():
                dispatcher.utter_message(text="Không tìm thấy note để xoá.")
                return []

            target = response.json()[0]
            note_id = target.get("id")

            delete_url = f"{TASKIFY_API_URL}/api/internal/notes/{user_id}/{note_id}"
            response = requests.delete(delete_url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code in [200, 204]:
                dispatcher.utter_message(text=f"Đã xoá note thành công.")
            else:
                dispatcher.utter_message(text="Không thể xoá note lúc này.")
        except Exception as exc:
            logger.exception("Error deleting note for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Có lỗi khi xoá note.")

        return []
