# 🧠 MDRDR — Medium Reader AI (Fullstack)

Fullstack project: **Node.js v20 + Express (TypeScript)** + **React + Vite** + **PostgreSQL + pgvector** + **OpenAI**.

## Features
- Fetch Medium content via Freedium → Jina.
- AI Summary (HTML): tóm tắt + phân tích + insight + reflection + checklist.
- Store articles to DB, cache by content hash.
- Related articles via pgvector (semantic) + keyword fallback.
- Frontend `/read?url=...` with Ad placeholders (3 slots).

---

## 🧱 Requirements
- Node.js **v20** (LTS)
- Docker (for PostgreSQL)
- OpenAI API key

---

## ⚙️ Setup

```bash
git clone <your-repo> mdrdr
cd mdrdr
```

### 1) Database (PostgreSQL with pgvector)

```bash
docker compose up -d
psql -U postgres -h localhost -d mdrdr -f scripts/migrate.sql
```

If `psql` is not installed, you can enter the container:
```bash
docker exec -it mdrdr-db psql -U postgres -d mdrdr -f /var/lib/postgresql/data/migrate.sql
```

> Or copy file into container first. Easiest is to use host `psql`.

### 2) Backend

```bash
cd server
cp .env.example .env  # update OPENAI_API_KEY, DATABASE_URL
npm install
npm run build
```

### 3) Frontend

```bash
cd ../web
npm install
npm run build
```

### 4) PM2 (Production)

From repo root:
```bash
npm i -g pm2 serve
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5) Nginx (example)

```
server {
  server_name mdrdr.xyz;
  listen 80;

  location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_set_header Host $host;
    proxy_http_version 1.1;
  }

  location / {
    root /var/www/mdrdr/web/dist;
    try_files $uri /index.html;
  }
}
```

---

## 🧪 Dev Mode

```bash
# DB
docker compose up -d
psql -U postgres -h localhost -d mdrdr -f scripts/migrate.sql

# Server
cd server
cp .env.example .env
npm i
npm run dev  # :3001

# Web
cd ../web
npm i
npm run dev  # :5173 (proxy /api to :3001)
```

Open: `http://localhost:5173/read?url=<medium-url>`

---

## 🔒 Env
- `server/.env.example` shows all variables.

---

## 📣 Notes
- Replace Ad placeholders with real AdSense script when ready.
- Domain can change later; update `BASE_URL` in server `.env`.
- Use `EMBED_DIM` based on embedding model (default 1536 for OpenAI text-embedding-3-small).
# mdrdr
# mdrdr
