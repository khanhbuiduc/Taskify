# Luong Chat Khi Fallback Sang Gemini

## Muc tieu

Tai lieu nay mo ta luong chat khi:

- user gui mot cau ma Rasa khong match duoc intent nghiep vu
- Rasa roi vao `nlu_fallback`
- backend dang co `activeProvider = Gemini`

Luu y:

- hien tai endpoint fallback la endpoint generic
- Rasa khong goi Gemini truc tiep nua
- backend tu quyet dinh se dung Gemini hay Ollama
- tai lieu nay chi mo ta nhanh `Gemini`

## Dieu kien de nhanh Gemini duoc su dung

Can dong thoi thoa 2 dieu kien:

1. User da luu Gemini API key hop le trong settings.
2. `activeProvider` cua user dang la `Gemini`.

Neu mot trong hai dieu kien nay khong dung, backend se khong di vao nhanh Gemini.

## So do sequence

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as TaskifyAPI
    participant DB as SQL Server
    participant Rasa as Rasa Server
    participant Action as action_fallback_gemini
    participant AIFB as Internal AI Fallback API
    participant GeminiSvc as GeminiCredentialService
    participant G as Google Gemini API

    U->>FE: Nhap tin nhan chat
    FE->>API: POST /api/Chat/{sessionId}/messages
    API->>DB: Luu user message
    API->>Rasa: POST /webhooks/rest/webhook
    Note over API,Rasa: sender = userId:sessionId

    Rasa->>Rasa: Predict intent

    alt Match duoc intent nghiep vu
        Rasa-->>API: Reply thong thuong
    else Roi vao nlu_fallback
        Rasa->>Action: Goi action_fallback_gemini
        Action->>Action: split sender_id -> userId, sessionId
        Action->>AIFB: POST /api/internal/ai/fallback/{userId}
        Note over Action,AIFB: body = { messageText, locale }

        AIFB->>AIFB: Doc activeProvider cua user

        alt activeProvider = Gemini
            AIFB->>GeminiSvc: GenerateFallbackReplyAsync(...)
            GeminiSvc->>DB: Doc UserGeminiCredentials
            GeminiSvc->>GeminiSvc: Giai ma API key
            GeminiSvc->>GeminiSvc: Build prompt theo locale
            GeminiSvc->>G: generateContent
            G-->>GeminiSvc: text reply

            opt Cau tra loi co ve bi cut
                GeminiSvc->>G: Retry 1 lan voi prompt day du hon
                G-->>GeminiSvc: text reply retry
            end

            GeminiSvc-->>AIFB: text
            AIFB-->>Action: 200 { text, provider = Gemini }
            Action-->>Rasa: utter_message(text=answer)
            Rasa-->>API: assistant reply
        else activeProvider khac Gemini hoac khong hop le
            AIFB-->>Action: 404 / 422 / 502
            Action-->>Rasa: utter_default
            Rasa-->>API: default fallback reply
        end
    end

    API->>DB: Luu assistant reply
    API-->>FE: Tra response chat
    FE-->>U: Hien thi cau tra loi
```

## So do module interaction

```mermaid
flowchart LR
    U[User] --> FE[Frontend Chat UI]
    FE --> CHAT[TaskifyAPI ChatController]
    CHAT --> CHATDB[(ChatSessions / ChatMessages)]
    CHAT --> RPROXY[RasaChatService]
    RPROXY --> RASA[Rasa Server]

    RASA -->|intent thuong| NORMAL[Task/Note Actions]
    RASA -->|nlu_fallback| FALLBACK[action_fallback_gemini]

    FALLBACK --> AIFB[Internal AI Fallback Controller]
    AIFB --> SETTINGS[(UserAiFallbackSettings)]
    AIFB --> GEMINI[GeminiCredentialService]

    GEMINI --> CREDS[(UserGeminiCredentials)]
    GEMINI --> DP[Data Protection]
    GEMINI --> GOOGLE[Google Gemini API]

    GOOGLE --> GEMINI
    GEMINI --> AIFB
    AIFB --> FALLBACK
    FALLBACK --> RASA
    RASA --> RPROXY
    RPROXY --> CHAT
    CHAT --> CHATDB
    CHAT --> FE
```
![Gemini fallback module graph](./img/gemini_fallback_modules.PNG)
## Giai thich tung khoi

- `Frontend Chat UI`
  - gui message len backend
  - nhan reply va hien thi cho user

- `ChatController`
  - lay `userId` tu JWT
  - tao `senderId = userId:sessionId`
  - luu lich su chat
  - proxy message sang Rasa

- `Rasa Server`
  - phan tich intent
  - neu confidence thap hoac khong match thi roi vao `nlu_fallback`

- `action_fallback_gemini`
  - ten action van giu nhu cu
  - nhung ben trong khong goi Gemini truc tiep
  - action nay chi goi endpoint fallback generic o backend

- `Internal AI Fallback Controller`
  - kiem tra `X-Rasa-Token`
  - doc `activeProvider` cua user
  - neu provider dang la `Gemini` thi goi `GeminiCredentialService`

- `GeminiCredentialService`
  - doc key theo user
  - giai ma key
  - build prompt fallback
  - goi Google Gemini API
  - retry neu cau tra loi co dau hieu bi cut

## Cac nhanh loi quan trong

### 1. User chua luu Gemini key

- backend khong tim thay credential hop le
- internal fallback tra `404`
- action tra `utter_default`

### 2. Key da luu nhung khong con hop le

- Gemini tra loi ve loi api key / quyen
- backend cap nhat status key thanh `Invalid`
- internal fallback tra `422`
- action tra `utter_default`

### 3. Key da luu nhung khong giai ma duoc

- Data Protection khong unprotect duoc key
- backend cap nhat status thanh `ValidationFailed`
- internal fallback tra `422`
- action tra `utter_default`

### 4. Gemini runtime loi

- timeout
- malformed JSON
- service tam thoi loi

Khi do:

- internal fallback tra `502`
- action tra `utter_default`

## Tom tat ngan gon

Nhanh Gemini hien tai la:

```text
Frontend
-> TaskifyAPI ChatController
-> Rasa REST webhook
-> action_fallback_gemini
-> TaskifyAPI /api/internal/ai/fallback/{userId}
-> check activeProvider = Gemini
-> GeminiCredentialService
-> UserGeminiCredentials
-> Google Gemini API
-> tra text nguoc ve Rasa
-> TaskifyAPI luu assistant message
-> Frontend hien thi
```

Neu co bat ky loi nao trong nhanh Gemini, chat se khong vo flow ma se roi ve `utter_default`.
