# Taskify Rasa Assistant

Rasa chatbot for Taskify. Receives messages via REST webhook (proxied by TaskifyAPI).

## Setup

- Python 3.8–3.11
- Create virtualenv and install: `pip install rasa`
- Train: `rasa train`
- Run server: `rasa run --enable-api` (default port 5005)
- Optional auth: `rasa run --enable-api --auth-token YOUR_TOKEN`

## Endpoint

- TaskifyAPI proxies chat to: `POST http://localhost:5005/webhooks/rest/webhook`
- Body: `{ "sender": "<userId>", "message": "<text>" }`
- Response: `[{ "recipient_id", "text" }, ...]`

## Phase 2 (optional)

- Uncomment custom actions in `domain.yml` and add `action_endpoint` in `endpoints.yml`
- Implement action server (Python) and run: `rasa run actions`
- Actions can call TaskifyAPI to list/create tasks
