// server/src/routes/api/articles.ts
import express from "express";
import { requireAuth, requireAuthOptional } from "../../middleware/auth.js";
import { q } from "../../utils/db.js";
import { fetchExtracted } from "../../services/fetchArticle.js";
import { summarizeContent } from "../../services/summarize.js";
import { extractKeywords, createEmbedding, sha256 } from "../../services/embeddings.js";
import { normaliseMediumUrl, buildFreediumUrl } from "../../utils/url.js";

const router = express.Router();

/**
 * ✅ List articles với paging / search / sort
 * GET /api/articles?page=1&limit=20&q=&sort=-created_at
 * Trả về { items, total, page, limit }. Nếu đã đăng nhập, mỗi item có thêm "liked".
 */
router.get("/", requireAuthOptional as any, async (req: any, res) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
    const qtext = (req.query.q ? String(req.query.q) : "").trim();
    const sort  = String(req.query.sort || "-created_at");
    const dir   = sort.startsWith("-") ? "DESC" : "ASC";
    const col   = sort.replace(/^[-+]/, "");
    const allowed = new Set(["id", "created_at", "updated_at", "published_at", "title", "likes"]);
    const orderCol = allowed.has(col) ? col : "created_at";

    const userId = req.user?.id || null;

    const whereSQL: string[] = [];
    const params: any[] = [];
    if (qtext) {
      whereSQL.push(`(title ILIKE $1 OR author ILIKE $1)`);
      params.push(`%${qtext}%`);
    }
    const whereClause = whereSQL.length ? `WHERE ${whereSQL.join(" AND ")}` : "";

    // Tổng số
    const totalRow = (await q<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM articles ${whereClause}`, params
    ))[0];
    const total = totalRow?.total ?? 0;

    // Items
    params.push(limit, (page - 1) * limit);
    const likedSelect = userId
      ? `, EXISTS(SELECT 1 FROM article_likes al WHERE al.article_id = a.id AND al.user_id = $${params.length + 1}) AS liked`
      : `, false AS liked`;

    const items = await q<any>(
      `SELECT a.* ${likedSelect}
         FROM articles a
         ${whereClause}
         ORDER BY ${orderCol} ${dir}, id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      userId ? [...params, userId] : params
    );

    res.json({ items, total, page, limit });
  } catch (err: any) {
    console.error("GET /api/articles error:", err);
    res.status(500).json({ error: "server_error", detail: err.message });
  }
});

/** 🩺 */
router.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * 📥 Ingest (không gắn user → KHÔNG auto-like tại đây)
 */
router.post("/ingest", async (req, res) => {
  try {
    const urlRaw = String(req.query.url || req.body?.url || "");
    if (!urlRaw) return res.status(400).json({ error: "Missing url" });

    const mediumUrl = normaliseMediumUrl(urlRaw);
    const exist = await q<any>(`SELECT * FROM articles WHERE url = $1`, [mediumUrl]);

    const freediumUrl = buildFreediumUrl(mediumUrl);
    const {
      title,
      author,
      contentHtml,
      excerpt,
      publishedAt,
      sourceUsed,
    } = await fetchExtracted(freediumUrl, urlRaw);

    const contentHash = sha256((contentHtml || "") + (title || "") + (author || ""));

    if (exist[0] && exist[0].content_hash === contentHash && exist[0].summary_html) {
      return res.json({ status: "cached", article: exist[0] });
    }

    const summaryHtml = await summarizeContent({ title, excerpt, html: contentHtml, url: mediumUrl });
    const plain = (contentHtml || "").replace(/<[^>]+>/g, " ");
    let kws = await extractKeywords(plain);
    if (!Array.isArray(kws)) kws = [];
    const safeKeywords: string[] = kws.map(String).filter(Boolean).slice(0, 50);

    const embedding = await createEmbedding(plain);
    const embeddingStr = embedding?.length ? `[${embedding.join(",")}]` : null;

    const params = [
      mediumUrl, title, author, publishedAt, excerpt, contentHtml, contentHash,
      summaryHtml, safeKeywords, embeddingStr, sourceUsed || "medium"
    ];

    let rows;
    if (exist[0]) {
      rows = await q<any>(
        `UPDATE articles
           SET title=$2, author=$3, published_at=$4, excerpt=$5, content_html=$6,
               content_hash=$7, summary_html=$8,
               keywords = COALESCE($9::text[], '{}'::text[]),
               embedding = COALESCE(NULLIF($10::text, '')::vector, embedding),
               source_used=$11,
               updated_at=NOW()
         WHERE url=$1
         RETURNING *`,
        params
      );
    } else {
      rows = await q<any>(
        `INSERT INTO articles
           (url, title, author, published_at, excerpt, content_html,
            content_hash, summary_html, keywords, embedding, source_used)
         VALUES
           ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::text[],'{}'::text[]),COALESCE(NULLIF($10::text,'')::vector,NULL),$11)
         RETURNING *`,
        params
      );
    }

    res.json({ status: "ok", article: rows[0] });
  } catch (err: any) {
    console.error("POST /api/articles/ingest error:", err);
    res.status(500).json({ error: "ingest_failed", detail: err.message });
  }
});

/** ✅ GET 1 bài (kèm liked theo user_id nếu đã đăng nhập) */
router.get("/:id", requireAuthOptional as any, async (req: any, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
  try {
    const userId = req.user?.id || null;
    const rows = await q<any>(
      `SELECT a.*,
              ${userId ? `EXISTS(SELECT 1 FROM article_likes al WHERE al.article_id=a.id AND al.user_id=$2)` : "false"} AS liked
       FROM articles a
       WHERE a.id = $1`,
      userId ? [id, userId] : [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (err: any) {
    console.error("GET /api/articles/:id error:", err);
    res.status(500).json({ error: "server_error", detail: err.message });
  }
});

/** 👥 GET /:id/likes — chỉ người dùng thật (user_id). Trả count + 8 likers mới nhất + liked_by_me */
router.get("/:id/likes", requireAuthOptional as any, async (req: any, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
  try {
    const { count } = (await q<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM article_likes WHERE article_id=$1`, [id]
    ))[0] || { count: 0 };

    const likers = await q<{id:number;display_name:string;avatar_url:string|null}>(
      `SELECT u.id, u.display_name, u.avatar_url
         FROM article_likes al
         JOIN users u ON u.id = al.user_id
        WHERE al.article_id=$1
        ORDER BY al.created_at DESC
        LIMIT 8`,
      [id]
    );

    let liked_by_me = false;
    if (req.user?.id) {
      const row = (await q<{ liked: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM article_likes WHERE article_id=$1 AND user_id=$2) AS liked`,
        [id, req.user.id]
      ))[0];
      liked_by_me = !!row?.liked;
    }

    res.json({ ok:true, count, likers, liked_by_me });
  } catch (err:any) {
    console.error("GET /api/articles/:id/likes error:", err);
    res.status(500).json({ ok:false, error:"server_error", detail: err.message });
  }
});

/** ❤️ POST /:id/like — bắt buộc đăng nhập */
router.post("/:id/like", requireAuth as any, async (req: any, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
  try {
    await q(
      `INSERT INTO article_likes(article_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (article_id, user_id) DO NOTHING`,
      [id, req.user.id]
    );

    const { count } = (await q<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM article_likes WHERE article_id=$1`, [id]
    ))[0] || { count: 0 };

    await q(`UPDATE articles SET likes=$1 WHERE id=$2`, [count, id]);

    const likers = await q<{id:number;display_name:string;avatar_url:string|null}>(
      `SELECT u.id, u.display_name, u.avatar_url
         FROM article_likes al JOIN users u ON u.id=al.user_id
        WHERE al.article_id=$1
        ORDER BY al.created_at DESC
        LIMIT 8`,
      [id]
    );

    res.json({ ok:true, id, liked:true, likes: count, likers });
  } catch (err: any) {
    console.error("POST /api/articles/:id/like error:", err);
    return res.status(500).json({ error: "like_failed", detail: err.message });
  }
});

/** 💔 DELETE /:id/like — bắt buộc đăng nhập */
router.delete("/:id/like", requireAuth as any, async (req: any, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
  try {
    await q(`DELETE FROM article_likes WHERE article_id=$1 AND user_id=$2`, [id, req.user.id]);

    const { count } = (await q<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM article_likes WHERE article_id=$1`, [id]
    ))[0] || { count: 0 };

    await q(`UPDATE articles SET likes=$1 WHERE id=$2`, [count, id]);

    const likers = await q<{id:number;display_name:string;avatar_url:string|null}>(
      `SELECT u.id, u.display_name, u.avatar_url
         FROM article_likes al JOIN users u ON u.id=al.user_id
        WHERE al.article_id=$1
        ORDER BY al.created_at DESC
        LIMIT 8`,
      [id]
    );

    return res.json({ ok: true, id, liked: false, likes: count, likers });
  } catch (err: any) {
    console.error("DELETE /api/articles/:id/like error:", err);
    return res.status(500).json({ error: "unlike_failed", detail: err.message });
  }
});

export default router;
