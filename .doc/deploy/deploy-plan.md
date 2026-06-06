# Taskify Deployment Plan

## Muc tieu kien truc

- `Frontend`: deploy `taskifyView` len Vercel.
- `Backend`: deploy `TaskifyAPI` len Railway.
- `Rasa`: chay local bang Docker tren may cua ban, chi expose `rasa-server` qua Cloudflare Tunnel.
- `Database`: dung Azure SQL cho backend production.

So do dich vu:

```text
Vercel Frontend
  -> Railway Backend (TaskifyAPI)
      -> Cloudflare Tunnel hostname
          -> local Docker Rasa Server
              -> local Docker Rasa Actions
              -> local Docker Duckling
```

## Stage 0 - Chot prerequisites

Muc tieu:
- Co day du tai khoan va secret de deploy tung phan.
- Co domain/subdomain cho Cloudflare Tunnel neu ban muon hostname dep.

Can chuan bi:
- Tai khoan `Vercel`
- Tai khoan `Railway`
- Tai khoan `Cloudflare`
- Tai khoan `Azure`
- `Docker Desktop` tren may local chay Rasa
- `cloudflared` cai tren may local

Secret can co:
- `ConnectionStrings__DefaultConnection` cho Azure SQL
- `JwtSettings__SecretKey`
- `JwtSettings__Issuer`
- `JwtSettings__Audience`
- `Rasa__BaseUrl`
- `Rasa__Token` neu ban bat auth cho Rasa
- `Rasa__ApiKey`
- cac AI secret neu backend hoac actions dang dung

Checkpoint:
- Dang nhap duoc ca 4 nen tang.
- May local co the chay Docker containers on dinh.

## Stage 1 - On dinh kien truc Rasa truoc khi public

Muc tieu:
- Khong expose tung service Rasa le ra Internet.
- Chi public `rasa-server`; `rasa-actions` va `duckling` chi chay noi bo local Docker network.

Khuyen nghi kien truc local:
- `rasa-server` chay port `5005`
- `rasa-actions` chay port `5055`
- `duckling` chay port `8000`
- `cloudflared` forward public hostname vao `http://localhost:5005`

Quyet dinh ky thuat:
- Giu `Duckling` trong Docker, khong public ra ngoai.
- `VnCoreNLP` khong nen la dependency production bat buoc neu no con hardcode duong dan Windows.
- Uu tien huong gian luoc cho production:
  - `PhoBERT` chi dung cho `intent`
  - entity extraction dua ve backend/API hoac heuristic
  - `Duckling` giu de tach ngay gio

Viec can xac nhan truoc khi deploy Rasa:
- `rasa-server` goi duoc `action_endpoint`
- `DucklingEntityExtractor` goi duoc `duckling:8000` trong Docker network
- model intent production da san sang tren may local

Checkpoint:
- Chat local vao `http://localhost:5005/webhooks/rest/webhook` tra loi dung.
- Action custom tao/list task goi duoc backend local hoac backend test.

## Stage 2 - Dong goi Rasa local bang Docker

Muc tieu:
- Co 1 local stack de ban chi can `docker compose up` la Rasa san sang.

Nen co 3 containers:
1. `rasa-server`
2. `rasa-actions`
3. `duckling`

Y tuong cau hinh:
- `rasa-server`
  - command: `rasa run --enable-api --cors "*" --port 5005 --credentials credentials.yml --endpoints endpoints.yml --model models/...`
  - noi bo goi `http://rasa-actions:5055/webhook`
  - noi bo goi `http://duckling:8000`
- `rasa-actions`
  - command: `rasa run actions --port 5055`
  - env `TASKIFY_API_URL`
  - env `RASA_API_KEY`
- `duckling`
  - dung image Duckling co san
  - khong can public port neu compose network da du

Check list implement:
- Tao `docker-compose.yml` cho Rasa stack
- Tach env file rieng cho Rasa local production
- Sua `endpoints.yml` va `config.yml` neu dang hardcode `localhost`
- Neu con giu `VnCoreNLP`, phai chot cach mount jar/resources vao container

Checkpoint:
- `docker compose up -d` len du ca 3 service
- `curl http://localhost:5005/version` tra du lieu
- log `rasa-server` khong bao loi `action_endpoint` hay `duckling`

## Stage 3 - Publish Rasa Server qua Cloudflare Tunnel

Muc tieu:
- Public 1 hostname an toan vao local `rasa-server` ma khong mo port router.

Luong de xuat:
1. Cai `cloudflared`
2. Tao tunnel
3. Gan hostname, vi du `rasa.yourdomain.com`
4. Route hostname -> `http://localhost:5005`
5. Chay tunnel nhu service tren Windows

Lenh/flow can lam:
- Dang nhap Cloudflare tunnel
- Tao named tunnel
- Tao DNS route cho hostname
- Chay:
  - `cloudflared tunnel run <TUNNEL_NAME>`
  - hoac chay bang token
- Sau khi on dinh, cai service de tunnel tu khoi dong cung Windows

Luu y:
- Tunnel chi public `rasa-server`
- Khong route `rasa-actions` hay `duckling`
- Neu backend goi Rasa co auth token, nhat quan `Rasa__Token` giua backend va server

Checkpoint:
- Tu Internet goi duoc `https://rasa.yourdomain.com/version`
- Backend Railway sau nay goi duoc `/webhooks/rest/webhook`

## Stage 4 - Deploy backend len Railway

Muc tieu:
- Co `TaskifyAPI` production tro toi Azure SQL va Rasa hostname public qua Cloudflare Tunnel.

Cach deploy:
- Import monorepo vao Railway
- Set `Root Directory` hoac service root la `TaskifyAPI`
- Chon deploy theo `.NET` hoac Docker neu ban muon kiem soat hon

Env production toi thieu:
- `ASPNETCORE_ENVIRONMENT=Production`
- `ConnectionStrings__DefaultConnection=<azure-sql-connection-string>`
- `JwtSettings__SecretKey=<secret>`
- `JwtSettings__Issuer=TaskifyAPI`
- `JwtSettings__Audience=TaskifyClient`
- `Rasa__BaseUrl=https://rasa.yourdomain.com`
- `Rasa__TimeoutSeconds=15`
- `Rasa__ApiKey=<internal-api-key>`
- `Rasa__Token=<neu su dung>`

Viec can lam truoc luc mo frontend:
- Chay migration len Azure SQL
- Kiem tra CORS production cho domain Vercel
- Kiem tra static files neu backend dang phuc vu avatar trong `wwwroot`

Smoke test backend:
- endpoint auth login hoat dong
- endpoint task CRUD hoat dong
- backend goi duoc Rasa qua hostname tunnel

Checkpoint:
- Co 1 Railway URL production cho backend
- Swagger hoac endpoint test tra `200`

## Stage 5 - Deploy frontend len Vercel

Muc tieu:
- Frontend Next.js production goi dung backend Railway.

Cach deploy:
- Import repo vao Vercel
- Chon `Root Directory = taskifyView`
- Framework: `Next.js`

Env production toi thieu:
- `NEXT_PUBLIC_API_URL=https://<backend-railway-domain>`

Can verify:
- login
- load profile
- CRUD task/note/finance
- chat UI goi backend thanh cong

Luu y:
- Neu frontend production van fallback `localhost`, phai bo fallback nay truoc khi public
- Neu dung preview deploy, co the them preview env rieng

Checkpoint:
- Trang login mo duoc
- Sau login vao dashboard khong loi CORS

## Stage 6 - End-to-end validation

Muc tieu:
- Xac nhan ca 3 lop da noi voi nhau dung trong production.

Thu tu test:
1. Frontend -> Backend
2. Backend -> Azure SQL
3. Backend -> Rasa tunnel
4. Rasa server -> Rasa actions
5. Rasa server -> Duckling

Scenario test toi thieu:
- Dang nhap
- Tao task thu cong tren UI
- Tao task qua chat
- Liet ke task qua chat
- Tao note va finance entry qua chat
- Thu cau co ngay gio tu nhien de check Duckling

Dieu kien pass:
- Khong loi CORS
- Khong timeout giua backend va Rasa
- Chat tra loi dung va action custom chay du

## Stage 7 - Van hanh va rollback

Muc tieu:
- Neu 1 phan loi thi rollback nhanh ma khong anh huong toan bo.

Rollback de xuat:
- Frontend: redeploy ban truoc tren Vercel
- Backend: rollback deployment tren Railway
- Rasa: stop tunnel hoac dua tunnel ve hostname maintenance tam thoi

Theo doi sau deploy:
- log Railway
- log Docker cua `rasa-server`, `rasa-actions`, `duckling`
- log `cloudflared`

## Thu tu trien khai de xuat

1. Chuan bi Azure SQL
2. Dong goi va chay on Rasa local bang Docker
3. Mo `rasa-server` qua Cloudflare Tunnel
4. Deploy backend len Railway va noi voi Rasa tunnel
5. Deploy frontend len Vercel va noi voi backend
6. Chay end-to-end smoke test

## Tai lieu tham khao chinh thuc

- Cloudflare Tunnel setup: https://developers.cloudflare.com/tunnel/setup/
- Cloudflare locally managed tunnel: https://developers.cloudflare.com/tunnel/advanced/local-management/create-local-tunnel/
- Cloudflare routing hostnames: https://developers.cloudflare.com/tunnel/routing/
- Railway ASP.NET Core guide: https://docs.railway.com/guides/aspnet-core
- Railway deployments reference: https://docs.railway.com/deployments/reference
- Vercel monorepo docs: https://vercel.com/docs/monorepos/
