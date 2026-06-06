"""
finance/finance_actions.py - Rasa actions for Taskify finance.
"""

import logging
import re
import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional, Text

import requests
from rasa_sdk import Action, Tracker
from rasa_sdk.events import SlotSet
from rasa_sdk.executor import CollectingDispatcher

from actions.config import TASKIFY_API_URL, REQUEST_TIMEOUT
from actions.common.api_utils import get_api_headers, split_sender
from actions.common.date_utils import extract_duckling_date_value, parse_finance_date
from actions.common.text_utils import first_entity_value, tracker_slot_or_entity

logger = logging.getLogger(__name__)


def _reset_finance_slots() -> List[Dict[Text, Any]]:
    return [
        SlotSet("finance_amount", None),
        SlotSet("finance_category", None),
        SlotSet("finance_description", None),
        SlotSet("finance_date", None),
        SlotSet("finance_keyword", None),
    ]


def _first_entity(tracker: Tracker, entity_name: Text) -> Optional[str]:
    return first_entity_value(tracker.latest_message or {}, entity_name)


def _fold(value: str) -> str:
    return (
        unicodedata.normalize("NFD", value.lower())
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
    )


def _parse_amount(raw: Optional[str], text: str) -> Optional[float]:
    candidates = [raw or ""]
    matches = re.findall(
        r"(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(k|nghin|ngan|tr|trieu|m|vnd|dong|d|₫)?",
        _fold(text),
    )
    candidates.extend(f"{number}{suffix}" for number, suffix in matches)

    for candidate in candidates:
        value = _fold(candidate)
        if not value:
            continue
        match = re.search(r"(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)(k|nghin|ngan|tr|trieu|m|vnd|dong|d)?", value)
        if not match:
            continue

        number_text = match.group(1)
        if "," in number_text and "." in number_text:
            number_text = number_text.replace(".", "").replace(",", ".")
        elif "," in number_text:
            parts = number_text.split(",")
            number_text = "".join(parts) if len(parts[-1]) == 3 else number_text.replace(",", ".")
        elif number_text.count(".") > 1:
            number_text = number_text.replace(".", "")

        try:
            amount = float(number_text)
        except ValueError:
            continue

        suffix = match.group(2) or ""
        if suffix in {"k", "nghin", "ngan"}:
            amount *= 1_000
        elif suffix in {"tr", "trieu", "m"}:
            amount *= 1_000_000

        if amount > 0:
            return round(amount, 2)

    return None


def _parse_date(raw: Optional[str], text: str) -> str:
    phrase = raw or ""
    if not phrase:
        match = re.search(
            r"(hom nay|ngay mai|ngay kia|tuan sau|thang sau|\d{1,2}/\d{1,2}(?:/\d{2,4})?|\b\d{1,2}\b)",
            _fold(text),
        )
        phrase = match.group(1) if match else ""

    now = datetime.now()
    if phrase:
        parsed, had_date = parse_finance_date(phrase, now)
        if had_date:
            return parsed.date().isoformat()

    return now.date().isoformat()


def _resolve_date_value(tracker: Tracker, text: str) -> str:
    duckling_date = extract_duckling_date_value(tracker.latest_message or {})
    if duckling_date:
        return duckling_date

    raw_date = tracker_slot_or_entity(tracker, "finance_date")
    return _parse_date(raw_date, text)


def _extract_after_keywords(text: str, keywords: List[str]) -> Optional[str]:
    folded = _fold(text)
    for keyword in keywords:
        index = folded.find(keyword)
        if index >= 0:
            value = text[index + len(keyword):].strip(" :,-.")
            return value[:120].strip() if value else None
    return None


def _entry_label(entry: Dict[str, Any]) -> str:
    date_text = str(entry.get("date") or "")[:10]
    description = entry.get("description") or "không có mô tả"
    return f"{date_text} - {entry.get('category', 'Khác')} - {description} - {entry.get('amount', 0):,.0f} VND"


class ActionCreateFinanceEntry(Action):
    def name(self) -> Text:
        return "action_create_finance_entry"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        text = tracker.latest_message.get("text", "").strip()
        amount = _parse_amount(tracker_slot_or_entity(tracker, "finance_amount"), text)
        category = tracker_slot_or_entity(tracker, "finance_category") or "Khác"
        description = tracker_slot_or_entity(tracker, "finance_description")
        date_value = _resolve_date_value(tracker, text)

        if amount is None:
            dispatcher.utter_message(text="Bạn muốn ghi nhận số tiền bao nhiêu?")
            return []

        if not description:
            description = _extract_after_keywords(text, ["cho ", "mua ", "ăn ", "uống ", "nội dung ", "mô tả "]) or text

        payload = {
            "date": date_value,
            "category": category.strip(),
            "description": description.strip(),
            "amount": amount,
        }

        try:
            url = f"{TASKIFY_API_URL}/api/internal/finance/{user_id}/entries"
            response = requests.post(url, json=payload, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code in [200, 201]:
                entry = response.json()
                dispatcher.utter_message(
                    text=f"Đã thêm chi phí: {_entry_label(entry)}",
                    json_message={"type": "finance_entry_list", "entries": [entry]},
                )
            else:
                dispatcher.utter_message(text="Không thể tạo mục tài chính lúc này.")
        except Exception as exc:
            logger.exception("Error creating finance entry for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Có lỗi khi tạo mục tài chính.")
        return _reset_finance_slots()


class ActionListFinanceEntries(Action):
    def name(self) -> Text:
        return "action_list_finance_entries"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        return _reply_with_entries(dispatcher, user_id, tracker, "Các mục chi tiêu gần đây:")


class ActionSearchFinanceEntries(Action):
    def name(self) -> Text:
        return "action_search_finance_entries"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        return _reply_with_entries(dispatcher, user_id, tracker, "Kết quả tìm kiếm:")


def _build_entry_query(tracker: Tracker) -> Dict[str, Any]:
    text = tracker.latest_message.get("text", "").strip()
    params: Dict[str, Any] = {"page": 1, "pageSize": 10}

    category = tracker_slot_or_entity(tracker, "finance_category")
    keyword = tracker_slot_or_entity(tracker, "finance_keyword")
    if category:
        params["category"] = category.strip()
    if keyword:
        params["search"] = keyword.strip()

    date_phrase = tracker_slot_or_entity(tracker, "finance_date")
    folded = _fold(text)
    duckling_date = extract_duckling_date_value(tracker.latest_message or {})
    if duckling_date or date_phrase or any(term in folded for term in ["hom nay", "ngay mai", "ngay kia", "tuan sau", "thang sau"]) or re.search(r"\b\d{1,2}(?:/\d{1,2}(?:/\d{2,4})?)?\b", folded):
        date_value = duckling_date or _parse_date(date_phrase, text)
        params["from"] = date_value
        params["to"] = date_value

    return params


def _reply_with_entries(
    dispatcher: CollectingDispatcher,
    user_id: str,
    tracker: Tracker,
    heading: str,
) -> List[Dict[Text, Any]]:
    try:
        url = f"{TASKIFY_API_URL}/api/internal/finance/{user_id}/entries"
        response = requests.get(url, params=_build_entry_query(tracker), headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
        if response.status_code != 200:
            dispatcher.utter_message(text="Không lấy được danh sách tài chính.")
            return _reset_finance_slots()

        entries = response.json()
        if not entries:
            dispatcher.utter_message(text="Chưa có mục tài chính nào phù hợp.")
            return _reset_finance_slots()

        lines = [f"{index}. {_entry_label(entry)}" for index, entry in enumerate(entries[:10], 1)]
        dispatcher.utter_message(
            text=heading + "\n" + "\n".join(lines),
            json_message={"type": "finance_entry_list", "entries": entries},
        )
    except Exception as exc:
        logger.exception("Error listing finance entries for user %s: %s", user_id, exc)
        dispatcher.utter_message(text="Có lỗi khi lấy danh sách tài chính.")
    return _reset_finance_slots()


class ActionUpdateFinanceEntry(Action):
    def name(self) -> Text:
        return "action_update_finance_entry"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        text = tracker.latest_message.get("text", "").strip()
        target = _find_first_entry(user_id, tracker)
        if target is None:
            dispatcher.utter_message(text="Không tìm thấy mục tài chính để cập nhật.")
            return _reset_finance_slots()

        amount = _parse_amount(tracker_slot_or_entity(tracker, "finance_amount"), text)
        category = tracker_slot_or_entity(tracker, "finance_category") or target.get("category")
        description = tracker_slot_or_entity(tracker, "finance_description") or target.get("description")
        raw_date = tracker_slot_or_entity(tracker, "finance_date")
        date_value = str(target.get("date", ""))[:10]
        duckling_date = extract_duckling_date_value(tracker.latest_message or {})
        if duckling_date or raw_date or any(term in _fold(text) for term in ["hom nay", "ngay mai", "ngay kia", "tuan sau", "thang sau"]) or re.search(r"\b\d{1,2}(?:/\d{1,2}(?:/\d{2,4})?)?\b", _fold(text)):
            date_value = duckling_date or _parse_date(raw_date, text)

        payload = {
            "date": date_value,
            "category": category,
            "description": description,
            "amount": amount if amount is not None else target.get("amount", 0),
        }

        try:
            url = f"{TASKIFY_API_URL}/api/internal/finance/{user_id}/entries/{target.get('id')}"
            response = requests.put(url, json=payload, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code == 200:
                entry = response.json()
                dispatcher.utter_message(
                    text=f"Đã cập nhật mục tài chính: {_entry_label(entry)}",
                    json_message={"type": "finance_entry_list", "entries": [entry]},
                )
            else:
                dispatcher.utter_message(text="Không thể cập nhật mục tài chính lúc này.")
        except Exception as exc:
            logger.exception("Error updating finance entry for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Có lỗi khi cập nhật mục tài chính.")
        return _reset_finance_slots()


class ActionDeleteFinanceEntry(Action):
    def name(self) -> Text:
        return "action_delete_finance_entry"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        metadata = tracker.latest_message.get("metadata") or {}
        action_name = str(metadata.get("action") or "").strip().lower()

        if action_name == "confirm_delete_finance_entry":
            entry_ids = metadata.get("entryIds") or []
            deleted = _delete_entry_ids(user_id, entry_ids)
            dispatcher.utter_message(text=f"Đã xóa {deleted} mục tài chính.")
            return _reset_finance_slots()

        entries = _fetch_entries(user_id, tracker)
        if not entries:
            dispatcher.utter_message(text="Không tìm thấy mục tài chính để xóa.")
            return _reset_finance_slots()

        if len(entries) == 1:
            deleted = _delete_entry_ids(user_id, [entries[0].get("id")])
            dispatcher.utter_message(text=f"Đã xóa {deleted} mục tài chính.")
            return _reset_finance_slots()

        dispatcher.utter_message(
            text="Mình tìm thấy nhiều mục phù hợp, hãy chọn mục cần xóa.",
            json_message={
                "type": "finance_entry_picker",
                "prompt": "Chọn mục tài chính cần xóa:",
                "entries": entries[:10],
            },
        )
        return _reset_finance_slots()


def _fetch_entries(user_id: str, tracker: Tracker) -> List[Dict[str, Any]]:
    try:
        url = f"{TASKIFY_API_URL}/api/internal/finance/{user_id}/entries"
        response = requests.get(url, params=_build_entry_query(tracker), headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
        if response.status_code != 200:
            return []
        return response.json() or []
    except Exception:
        logger.exception("Error fetching finance entries for user %s", user_id)
        return []


def _find_first_entry(user_id: str, tracker: Tracker) -> Optional[Dict[str, Any]]:
    entries = _fetch_entries(user_id, tracker)
    return entries[0] if entries else None


def _delete_entry_ids(user_id: str, entry_ids: Any) -> int:
    if not isinstance(entry_ids, list):
        return 0

    deleted = 0
    for raw_id in entry_ids:
        try:
            entry_id = int(str(raw_id))
        except (TypeError, ValueError):
            continue
        url = f"{TASKIFY_API_URL}/api/internal/finance/{user_id}/entries/{entry_id}"
        response = requests.delete(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
        if response.status_code in [200, 204]:
            deleted += 1
    return deleted


class ActionSummarizeFinance(Action):
    def name(self) -> Text:
        return "action_summarize_finance"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        params = _build_entry_query(tracker)
        params.pop("page", None)
        params.pop("pageSize", None)
        if "search" in params:
            params.pop("search", None)

        try:
            url = f"{TASKIFY_API_URL}/api/internal/finance/{user_id}/summary"
            response = requests.get(url, params=params, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code != 200:
                dispatcher.utter_message(text="Khong lay duoc tong ket tai chinh.")
                return _reset_finance_slots()

            summary = response.json()
            dispatcher.utter_message(
                text=(
                    "Tong ket tai chinh:\n"
                    f"- Tong chi: {summary.get('totalAmount', 0):,.0f} VND\n"
                    f"- So giao dich: {summary.get('count', 0)}\n"
                    f"- Trung binh: {summary.get('averageAmount', 0):,.0f} VND"
                ),
                json_message={"type": "finance_summary", "summary": summary},
            )
        except Exception as exc:
            logger.exception("Error summarizing finance for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Co loi khi tong ket tai chinh.")
        return _reset_finance_slots()


class ActionListFinanceCategories(Action):
    def name(self) -> Text:
        return "action_list_finance_categories"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        categories = _fetch_categories(user_id)
        if not categories:
            dispatcher.utter_message(text="Ban chua co danh muc tai chinh nao.")
            return _reset_finance_slots()

        lines = [f"{index}. {item.get('name')}" for index, item in enumerate(categories, 1)]
        dispatcher.utter_message(
            text="Danh muc tai chinh:\n" + "\n".join(lines),
            json_message={"type": "finance_category_list", "categories": categories},
        )
        return _reset_finance_slots()


class ActionCreateFinanceCategory(Action):
    def name(self) -> Text:
        return "action_create_finance_category"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        name = tracker_slot_or_entity(tracker, "finance_category")
        if not name:
            dispatcher.utter_message(text="Ban muon tao danh muc tai chinh ten gi?")
            return []

        try:
            url = f"{TASKIFY_API_URL}/api/internal/finance/{user_id}/categories"
            response = requests.post(url, json={"name": name.strip()}, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code in [200, 201]:
                dispatcher.utter_message(text=f"Da tao danh muc tai chinh: {name.strip()}")
            else:
                dispatcher.utter_message(text="Khong tao duoc danh muc tai chinh luc nay.")
        except Exception as exc:
            logger.exception("Error creating finance category for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Co loi khi tao danh muc tai chinh.")
        return _reset_finance_slots()


class ActionUpdateFinanceCategory(Action):
    def name(self) -> Text:
        return "action_update_finance_category"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        old_name = tracker_slot_or_entity(tracker, "finance_keyword")
        new_name = tracker_slot_or_entity(tracker, "finance_category")
        if not old_name or not new_name:
            dispatcher.utter_message(text="Hay cho minh biet danh muc cu va ten moi.")
            return []

        categories = _fetch_categories(user_id)
        target = next((item for item in categories if _fold(item.get("name", "")) == _fold(old_name)), None)
        if not target:
            dispatcher.utter_message(text="Khong tim thay danh muc tai chinh de cap nhat.")
            return _reset_finance_slots()

        try:
            url = f"{TASKIFY_API_URL}/api/internal/finance/{user_id}/categories/{target.get('id')}"
            response = requests.put(url, json={"name": new_name.strip()}, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code == 200:
                dispatcher.utter_message(text=f"Da doi danh muc {old_name} thanh {new_name.strip()}.")
            else:
                dispatcher.utter_message(text="Khong cap nhat duoc danh muc tai chinh luc nay.")
        except Exception as exc:
            logger.exception("Error updating finance category for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Co loi khi cap nhat danh muc tai chinh.")
        return _reset_finance_slots()


class ActionDeleteFinanceCategory(Action):
    def name(self) -> Text:
        return "action_delete_finance_category"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_id, _ = split_sender(tracker.sender_id)
        name = (
            tracker_slot_or_entity(tracker, "finance_keyword")
            or tracker_slot_or_entity(tracker, "finance_category")
        )
        if not name:
            dispatcher.utter_message(text="Ban muon xoa danh muc tai chinh nao?")
            return []

        categories = _fetch_categories(user_id)
        target = next((item for item in categories if _fold(item.get("name", "")) == _fold(name)), None)
        if not target:
            dispatcher.utter_message(text="Khong tim thay danh muc tai chinh de xoa.")
            return _reset_finance_slots()

        try:
            url = f"{TASKIFY_API_URL}/api/internal/finance/{user_id}/categories/{target.get('id')}"
            response = requests.delete(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
            if response.status_code in [200, 204]:
                dispatcher.utter_message(text=f"Da xoa danh muc tai chinh: {name}.")
            elif response.status_code == 409:
                dispatcher.utter_message(text="Danh muc nay dang duoc su dung, chua the xoa.")
            else:
                dispatcher.utter_message(text="Khong xoa duoc danh muc tai chinh luc nay.")
        except Exception as exc:
            logger.exception("Error deleting finance category for user %s: %s", user_id, exc)
            dispatcher.utter_message(text="Co loi khi xoa danh muc tai chinh.")
        return _reset_finance_slots()


def _fetch_categories(user_id: str) -> List[Dict[str, Any]]:
    try:
        url = f"{TASKIFY_API_URL}/api/internal/finance/{user_id}/categories"
        response = requests.get(url, headers=get_api_headers(), timeout=REQUEST_TIMEOUT)
        if response.status_code != 200:
            return []
        return response.json() or []
    except Exception:
        logger.exception("Error fetching finance categories for user %s", user_id)
        return []
