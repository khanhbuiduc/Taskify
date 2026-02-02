# Taskify Rasa Action Server (Phase 2)

Custom actions that call TaskifyAPI to list/create tasks and summarize data.

## Setup

- From `rasa/actions`: `pip install -r requirements.txt`
- Run: `rasa run actions` (default port 5055)

## Enable in Rasa

1. In `rasa/endpoints.yml`, uncomment:
   ```yaml
   action_endpoint:
     url: "http://localhost:5055/webhook"
   ```
2. In `rasa/domain.yml`, uncomment the `actions:` block (action_list_tasks, action_create_task, action_summarize_week).
3. Update `rasa/data/stories.yml` to use these actions instead of utter_* for list_overdue_tasks, create_task, summarize_week.
4. Retrain: `rasa train`

## Passing user context

TaskifyAPI proxy can send the user's JWT in request metadata to Rasa. The action server can read it from `tracker.metadata` and call TaskifyAPI with `Authorization: Bearer <token>` so actions are scoped to the current user. This requires extending the proxy to include metadata when calling the Rasa webhook (phase 2).

Alternative: use a single API key or service account for the bot and pass `sender_id` to TaskifyAPI if you add a dedicated endpoint for Rasa-backed requests.
