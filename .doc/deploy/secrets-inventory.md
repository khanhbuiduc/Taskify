# Taskify Production Secrets Inventory

## Cach dung

- Dien gia tri that vao noi luu an toan cua ban, khong dien vao Git neu file nay duoc commit.
- Co the copy bang nay ra password manager, Notion private, hoac file local khong track.
- O day uu tien ghi:
  - secret name
  - dung cho service nao
  - format mong doi
  - noi se luu

## Backend - bat buoc

| Secret | Bat buoc | Dung cho | Gia tri / format | Noi luu de xuat |
|---|---|---|---|---|
| `ConnectionStrings__DefaultConnection` | Yes | Railway backend | Azure SQL connection string | Railway Variables |
| `JwtSettings__SecretKey` | Yes | Railway backend | Chuoi random dai it nhat 32 ky tu | Railway Variables |
| `JwtSettings__Issuer` | Yes | Railway backend | Vi du `TaskifyAPI` | Railway Variables |
| `JwtSettings__Audience` | Yes | Railway backend | Vi du `TaskifyClient` | Railway Variables |
| `Rasa__BaseUrl` | Yes | Railway backend | Vi du `https://rasa.example.com` | Railway Variables |
| `Rasa__ApiKey` | Yes | Railway backend + Rasa actions | Shared internal key | Railway Variables + local env |

## Rasa - tuy chon / theo cau hinh

| Secret | Bat buoc | Dung cho | Gia tri / format | Noi luu de xuat |
|---|---|---|---|---|
| `Rasa__Token` | Optional | Railway backend -> Rasa server | Token neu bat auth cho Rasa | Railway Variables |
| `TASKIFY_API_URL` | Yes | Rasa actions local | Railway backend public URL | local env |
| `RASA_API_KEY` | Yes | Rasa actions local | Giong `Rasa__ApiKey` | local env |

## Frontend

| Secret | Bat buoc | Dung cho | Gia tri / format | Noi luu de xuat |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Vercel frontend | Railway backend public URL | Vercel Env Vars |

## AI secrets

Chi can neu backend/actions dung den production AI provider.

| Secret | Bat buoc | Dung cho | Gia tri / format | Noi luu de xuat |
|---|---|---|---|---|
| `GEMINI_API_KEY` hoac equivalent | Optional | Backend hoac fallback service | API key | Railway Variables |
| cac secret AI khac | Optional | Backend/actions | Theo provider | Railway Variables / local env |

## Gia tri goi y

### `JwtSettings__Issuer`

Gia tri de xuat:

```text
TaskifyAPI
```

### `JwtSettings__Audience`

Gia tri de xuat:

```text
TaskifyClient
```

### `JwtSettings__SecretKey`

Yeu cau:
- dai toi thieu 32 ky tu
- random
- khong dung secret mau trong `appsettings.json`

Vi du format:

```text
<64-char-random-secret>
```

### `Rasa__BaseUrl`

Vi du:

```text
https://rasa.yourdomain.com
```

### `ConnectionStrings__DefaultConnection`

Vi du Azure SQL:

```text
Server=tcp:<server-name>.database.windows.net,1433;Initial Catalog=TaskifyDb;Persist Security Info=False;User ID=<user>;Password=<password>;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

## Noi luu cu the theo service

### Railway

Nen set:
- `ConnectionStrings__DefaultConnection`
- `JwtSettings__SecretKey`
- `JwtSettings__Issuer`
- `JwtSettings__Audience`
- `Rasa__BaseUrl`
- `Rasa__Token` neu dung
- `Rasa__ApiKey`
- AI secrets production

### Vercel

Nen set:
- `NEXT_PUBLIC_API_URL`

### Local Rasa env

Nen set:
- `TASKIFY_API_URL`
- `RASA_API_KEY`
- cac AI secret neu `rasa-actions` dung truc tiep

## Checklist dien xong

- [ ] Co Azure SQL connection string production
- [ ] Co JWT secret moi, khong dung secret dev
- [ ] Co issuer va audience production
- [ ] Co hostname tunnel cho Rasa
- [ ] Co internal API key giua backend va Rasa actions
- [ ] Co backend public URL de dien vao frontend
- [ ] Co quyet dinh ro ve AI secrets co dung production hay khong
