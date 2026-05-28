import json
import os
import sys

import requests

sys.stdout.reconfigure(encoding="utf-8")

RASA_BASE_URL = os.getenv("RASA_BASE_URL", "http://localhost:5005").rstrip("/")
RASA_AUTH_TOKEN = os.getenv("RASA_AUTH_TOKEN")
RASA_SENDER_ID = os.getenv("RASA_SENDER_ID", "test_queries")
REQUEST_TIMEOUT = 10

TEST_CASES = [
    ("DELETE INTENT", "xóa cho tôi công việc mua thức ăn"),
    (
        "UPDATE INTENT",
        "sửa task gọi điện cho khách hàng thành hoàn thành",
    ),
]


def _request_params():
    if not RASA_AUTH_TOKEN:
        return None
    return {"token": RASA_AUTH_TOKEN}


def _post_json(url, payload):
    response = requests.post(
        url,
        json=payload,
        params=_request_params(),
        timeout=REQUEST_TIMEOUT,
    )
    return response


def query_rasa(text):
    parse_url = f"{RASA_BASE_URL}/model/parse"
    parse_response = _post_json(parse_url, {"text": text})
    if parse_response.status_code != 404:
        parse_response.raise_for_status()
        return parse_url, parse_response.json()

    webhook_url = f"{RASA_BASE_URL}/webhooks/rest/webhook"
    webhook_response = _post_json(
        webhook_url,
        {"sender": RASA_SENDER_ID, "message": text},
    )
    webhook_response.raise_for_status()
    return webhook_url, webhook_response.json()


def main():
    try:
        for title, text in TEST_CASES:
            endpoint, data = query_rasa(text)
            print(f"=== {title} ===")
            print(f"Input: {text}")
            print(f"Endpoint: {endpoint}")
            print(json.dumps(data, ensure_ascii=False, indent=2))
            print()
    except requests.RequestException as exc:
        print("Không gọi được Rasa API.", file=sys.stderr)
        print(f"Base URL: {RASA_BASE_URL}", file=sys.stderr)
        print(f"Chi tiết: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
