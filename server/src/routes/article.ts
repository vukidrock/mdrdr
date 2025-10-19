import { Router } from "express";
import { getOrCreateArticle, listArticles } from "../services/fetchArticle.js";
import { q } from "../utils/db.js";

const router = Router();

/**
 * POST /api/article  (legacy) — tạo/fetch bài từ URL
 * Body: { url }
 */
router.post("/", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  try {
    const article = await getOrCreateArticle(url);
    res.json(article);
  } catch (err) {
    console.error("POST /api/article error:", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * GET /api/article  (legacy) — trả list dạng { status, articles }
 */
router.get("/", async (_req, res) => {
  try {
    const articles = await listArticles();
    res.json({ status: "ok", articles });
  } catch (err) {
    console.error("GET /api/article error:", err);
    res.status(500).json({ error: "server error" });
  }
});

/**
 * (tuỳ chọn) GET /api/article/:id — xem 1 bài theo id
 */
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
  try {
    const rows = await q<any>(`SELECT * FROM articles WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (err: any) {
    console.error("GET /api/article/:id error:", err);
    res.status(500).json({ error: "server error", detail: err.message });
  }
});

/**
 * DELETE /api/article/:id — xoá bài (trả JSON để client không lỗi parse body rỗng)
 */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
  try {
    const r = await q<{ id: number }>(`DELETE FROM articles WHERE id = $1 RETURNING id`, [id]);
    if (!r[0]) return res.status(404).json({ error: "not found" });
    res.json({ ok: true, id });
  } catch (err: any) {
    console.error("DELETE /api/article/:id error:", err);
    res.status(500).json({ error: "server error", detail: err.message });
  }
});

/**
 * PATCH /api/article/:id — cập nhật bài
 * - Nhận cả "medium_url" và "url", nhưng GHI vào cột DB: url
 * - keywords: tự phát hiện jsonb/text[] rồi cast phù hợp
 */
router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

  const allowed = new Set([
    "title",
    "author",
    "excerpt",
    "content_html",
    "summary_html",
    "published_at",
    "keywords",
    "medium_url", // client có thể gửi field này
    "url",        // hoặc gửi thẳng url
  ]);

  // Lọc payload
  const payload: Record<string, any> = {};
  for (const [k, v] of Object.entries(req.body ?? {})) {
    if (allowed.has(k)) payload[k] = v;
  }
  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "no updatable fields" });
  }

  try {
    // Phát hiện kiểu cột 'keywords'
    let kwCast = "";
    let kwValueForBind: any = undefined;

    if ("keywords" in payload) {
      const meta = await q<{ udt_name: string }>(
        `SELECT udt_name
           FROM information_schema.columns
          WHERE table_name = 'articles' AND column_name = 'keywords'
          LIMIT 1`
      );
      const udt = meta[0]?.udt_name || "";

      // Chuẩn hóa input về array hoặc null
      let arr: string[] | null = null;
      if (Array.isArray(payload.keywords)) {
        arr = payload.keywords.map((s: any) => String(s)).filter(Boolean);
      } else if (typeof payload.keywords === "string") {
        // chấp nhận "a,b,c" hoặc JSON string '["a","b"]'
        const s = payload.keywords.trim();
        if (!s) arr = [];
        else if (s.startsWith("[") && s.endsWith("]")) {
          try { arr = (JSON.parse(s) as any[]).map(String).filter(Boolean); }
          catch { arr = s.split(",").map(x => x.trim()).filter(Boolean); }
        } else {
          arr = s.split(",").map(x => x.trim()).filter(Boolean);
        }
      } else if (payload.keywords == null) {
        arr = null;
      } else {
        return res.status(400).json({ error: "keywords must be string[] or comma-separated string" });
      }

      if (udt === "jsonb") {
        kwCast = "::jsonb";
        kwValueForBind = (arr == null) ? null : JSON.stringify(arr); // stringify cho jsonb
      } else if (udt === "_text") {
        kwCast = "::text[]";
        kwValueForBind = arr; // mảng JS cho text[]
      } else {
        // fallback: coi như jsonb
        kwCast = "::jsonb";
        kwValueForBind = (arr == null) ? null : JSON.stringify(arr);
      }
    }

    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const [k, v] of Object.entries(payload)) {
      if (k === "keywords") {
        sets.push(`keywords = $${i}${kwCast}`);
        values.push(kwValueForBind);
        i++;
      } else if (k === "published_at") {
        sets.push(`published_at = $${i}`);
        values.push(v ?? null);
        i++;
      } else if (k === "medium_url" || k === "url") {
        // map medium_url → cột url
        sets.push(`url = $${i}`);
        values.push(v);
        i++;
      } else {
        sets.push(`${k} = $${i}`);
        values.push(v);
        i++;
      }
    }

    sets.push(`updated_at = NOW()`);

    const sql = `UPDATE articles SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`;
    values.push(id);

    const updated = await q<any>(sql, values);
    if (!updated[0]) return res.status(404).json({ error: "not found" });
    res.json(updated[0]);
  } catch (err: any) {
    console.error("PATCH /api/article/:id error:", err);
    res.status(500).json({ error: "server error", detail: err.message });
  }
});

export default router;
