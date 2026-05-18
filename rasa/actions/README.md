# Taskify Rasa Action Server (Phase 2)

Custom actions that call TaskifyAPI to filter/create/delete tasks, manage notes, and summarize data.

## Setup

- From `rasa/actions`: `pip install -r requirements.txt`
- Run: `rasa run actions` (default port 5055)
- Optional persistent config: edit `rasa/actions/.env` once, then restart `rasa run actions`.

## Gemini fallback (optional)

When Rasa predicts `nlu_fallback`, `action_fallback_gemini` calls the generic internal AI fallback endpoint in `TaskifyAPI`.

- Gemini API keys are stored per user in the backend database.
- Ollama configuration can also be stored per user in the backend.
- Rasa only needs `TASKIFY_API_URL` and `RASA_API_KEY` so it can call the internal endpoint.
- Backend decides whether the active fallback provider for that user is Gemini or Ollama.
- If the selected provider is not configured or the backend call fails, the bot falls back to `utter_default`.

## Enable in Rasa

1. In `rasa/endpoints.yml`, uncomment:
   ```yaml
   action_endpoint:
     url: "http://localhost:5055/webhook"
   ```
2. In `rasa/domain.yml`, keep the `actions:` block in sync with the action classes.
3. Use `filter_tasks` + slots/entities for task list queries such as overdue, by date, status, priority, label, and keyword.
4. Retrain: `rasa train`

## Passing user context

TaskifyAPI proxy can send the user's JWT in request metadata to Rasa. The action server can read it from `tracker.metadata` and call TaskifyAPI with `Authorization: Bearer <token>` so actions are scoped to the current user. This requires extending the proxy to include metadata when calling the Rasa webhook (phase 2).

Alternative: use a single API key or service account for the bot and pass `sender_id` to TaskifyAPI if you add a dedicated endpoint for Rasa-backed requests.
