# Taskify Rasa Assistant

Rasa chatbot for Taskify. Receives messages via REST webhook (proxied by TaskifyAPI).

## Setup

- Python 3.8-3.11
- Create virtualenv and install: `pip install rasa`
- Generate domain NLU files: `python data/phobert/generate_nlu.py`
- Prepare PhoBERT data from split NLU files: `python data/phobert/prepare_data.py`
- Train: `rasa train`
- Run server: `rasa run --enable-api` (default port 5005)
- Optional auth: `rasa run --enable-api --auth-token YOUR_TOKEN`

## NLU Data Layout

- Domain files live in `data/nlu/*.yml` (current domains: `shared`, `task`, `note`).
- Naming convention for new domains:
  - file: `<domain>.yml`
  - intent: `<domain>_<action>` when needed to avoid collisions.
- Non-training files should use excluded suffixes, for example:
  - `*_draft.yml`
  - `*_disabled.yml`

## Endpoint

- TaskifyAPI proxies chat to: `POST http://localhost:5005/webhooks/rest/webhook`
- Body: `{ "sender": "<userId>", "message": "<text>" }`
- Response: `[{ "recipient_id", "text" }, ...]`

## Phase 2 (optional)

- Uncomment custom actions in `domain.yml` and add `action_endpoint` in `endpoints.yml`
- Implement action server (Python) and run: `rasa run actions`
- Actions can call TaskifyAPI to list/create tasks

