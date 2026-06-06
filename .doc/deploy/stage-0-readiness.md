# Stage 0 - Readiness Checklist

## Trang thai hien tai tren may nay

Da kiem tra nhanh:

- `Docker CLI`: da cai
- `Docker daemon`: chua chay
- `cloudflared`: chua co trong `PATH`
- `vercel`: chua co trong `PATH`
- `railway`: chua co trong `PATH`
- `az`: chua co trong `PATH`

Dieu nay co nghia:
- Ban da co nen tang de chay Docker, nhung can mo `Docker Desktop` truoc.
- Cac cong cu CLI cho Cloudflare, Vercel, Railway, Azure chua san sang tren terminal hien tai.

## Muc tieu Stage 0

Hoan thanh 2 dieu kien:

1. Dang nhap duoc ca 4 nen tang
2. May local co the chay Docker containers on dinh

## Phan A - Docker san sang

### A1. Mo Docker Desktop

Thuc hien:
- Mo `Docker Desktop`
- Cho engine khoi dong xong

Command verify:

```powershell
docker info
docker ps
```

Ket qua mong doi:
- `docker info` khong bao loi connect daemon
- `docker ps` tra danh sach container rong hoac co container dang chay

### A2. Bat Linux containers

Rasa/Duckling nen chay voi Linux containers.

Kiem tra:
- Docker Desktop dang o che do Linux containers

Neu chua dung:
- Chuyen sang Linux containers trong Docker Desktop

### A3. Test container co chay on dinh khong

Chay test:

```powershell
docker run --rm hello-world
```

Sau do test network:

```powershell
docker run --rm -p 8080:80 nginx
```

Mo trinh duyet:
- `http://localhost:8080`

Sau khi test xong:

```powershell
docker ps
docker stop <container_id>
```

Ket qua mong doi:
- Pull image thanh cong
- Container start thanh cong
- Truy cap `localhost:8080` duoc

## Phan B - Dang nhap 4 nen tang

Can dang nhap:
- Cloudflare
- Railway
- Vercel
- Azure

### B1. Cai CLI can thiet

Ban can cai:
- `cloudflared`
- `vercel`
- `railway`
- `az`

Sau khi cai, verify:

```powershell
cloudflared --version
vercel --version
railway --version
az version
```

### B2. Dang nhap Cloudflare

Muc tieu:
- Tao va quan ly Cloudflare Tunnel tu may local

Dang nhap:

```powershell
cloudflared tunnel login
```

Ket qua mong doi:
- Trinh duyet mo ra de authorize
- Tao duoc credentials tunnel o may local

Verify:

```powershell
cloudflared tunnel list
```

### B3. Dang nhap Railway

Dang nhap:

```powershell
railway login
```

Verify:

```powershell
railway whoami
```

Ket qua mong doi:
- CLI tra thong tin account

### B4. Dang nhap Vercel

Dang nhap:

```powershell
vercel login
```

Verify:

```powershell
vercel whoami
```

Ket qua mong doi:
- CLI tra email hoac team hien tai

### B5. Dang nhap Azure

Dang nhap:

```powershell
az login
```

Verify:

```powershell
az account show
```

Neu ban co nhieu subscription:

```powershell
az account list --output table
az account set --subscription "<SUBSCRIPTION_NAME_OR_ID>"
```

## Phan C - Kiem ke secret production

Dung file:
- [secrets-inventory.md](/C:/Users/HP%20PC/source/repos/Taskify/.doc/deploy/secrets-inventory.md)

Can di vao tung secret va dien:
- gia tri that
- noi se luu
- service nao se dung

Nguyen tac:
- Khong commit secret that vao Git
- Chi luu secret trong:
  - Railway Variables
  - Vercel Environment Variables
  - local secret manager hoac password manager
  - file local bi ignore neu can

## Dinh nghia done cho Stage 0

Stage 0 duoc xem la xong khi:

- `docker info` chay thanh cong
- `docker run --rm hello-world` chay thanh cong
- `cloudflared tunnel list` chay duoc
- `railway whoami` chay duoc
- `vercel whoami` chay duoc
- `az account show` chay duoc
- file inventory secret da duoc dien day du

## Ghi chu de deploy Taskify

Sau khi Stage 0 xong:
- co the sang Stage 1 dong goi Rasa local bang Docker
- co the tao Azure SQL va Railway service
- co the tao tunnel cho Rasa ma khong phai quay lai setup lai may
