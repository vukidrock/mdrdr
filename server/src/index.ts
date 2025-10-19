// server/src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import api from "./routes/index.js";                 // routes/index.ts -> export default api

// ESM: tự tạo __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Routers (ESM + TS: dùng đuôi .js vì chạy ESM sau build)
import healthRouter from "./routes/health.js";
import articlesListRouter from "./routes/api/articles.js";
import legacyArticleRouter from "./routes/article.js";

const app = express();

// 🔹 Middlewares phải đứng TRƯỚC khi mount routes
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// 🔹 Endpoint ping để test nhanh
app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// 🔹 Mount bộ router tổng /api (tags, related, by-tag ở đây)
app.use("/api", api);

// 🔹 Các route hiện có (giữ nguyên)
app.use("/api/health", healthRouter);         // GET /api/health
app.use("/api/articles", articlesListRouter); // GET /api/articles
app.use("/api/article", legacyArticleRouter); // GET/POST /api/article

// 🔹 Health probe ngoài /api (tuỳ chọn)
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
});

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "0.0.0.0";   // đảm bảo listen public
app.listen(port, host, () => {
  console.log(`server listening on http://${host}:${port}`);
});
