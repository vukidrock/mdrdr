// server/src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import path from "path";
import { fileURLToPath } from "url";

// Routers (ESM + TS: dùng đuôi .js vì chạy ESM sau build)
import api from "./routes/index.js";                 // routes/index.ts -> export default api
import healthRouter from "./routes/health.js";
import articlesListRouter from "./routes/api/articles.js";
import legacyArticleRouter from "./routes/article.js";

// ✅ router mới (OAuth + bookmarks + comments)
import authRouter from "./routes/api/auth.js";
import bookmarksRouter from "./routes/api/bookmarks.js";
import commentsRouter from "./routes/api/comments.js";

// ESM: tự tạo __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("trust proxy", 1);

// ========= Middlewares =========
const RAW_ORIGIN = process.env.PUBLIC_WEB_ORIGIN || "http://mdrdr.xyz";
const ALLOWED_ORIGINS = new Set<string>([
  RAW_ORIGIN,
  "http://mdrdr.xyz",
  "http://www.mdrdr.xyz",
  "http://mdrdr.xyz:3000",
  "http://www.mdrdr.xyz:3000",
  "http://mdrdr.xyz:5173",
  "http://www.mdrdr.xyz:5173",
  "http://103.173.226.89:3000",
  "http://103.173.226.89:5173",
  "http://localhost:3000",
  "http://localhost:5173",
]);

app.use(
  cors({
    origin: true,            // phản chiếu lại Origin gửi lên
    credentials: true,
    methods: ["GET","POST","PUT","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization","X-Client-Id"],
  })
);

app.options("*", cors({ origin: true, credentials: true }));

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(passport.initialize());

// ========= Ping nhanh =========
app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ========= Mount routers =========
// bộ router tổng /api (tags, related, by-tag ở đây)
app.use("/api", api);

// hiện có (giữ nguyên)
app.use("/api/health", healthRouter);         // GET /api/health
app.use("/api/articles", articlesListRouter); // /api/articles
app.use("/api/article", legacyArticleRouter); // /api/article

// mới thêm
app.use("/api", authRouter);       // /api/auth/google, /api/auth/facebook, /api/me, /api/logout
app.use("/api", bookmarksRouter);  // /api/articles/:id/bookmark, /api/me/bookmarks
app.use("/api", commentsRouter);   // /api/articles/:id/comments, /api/comments/:commentId

// ========= Health ngoài /api (tuỳ chọn) =========
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
});

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => {
  console.log(`server listening on http://${host}:${port}`);
});
