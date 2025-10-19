// server/src/routes/api/articles.ts
import express from "express";
import { q } from "../../utils/db.js";
import { fetchExtracted } from "../../services/fetchArticle.js";
import { summarizeContent } from "../../services/summarize.js";
import { extractKeywords, createEmbedding, sha256 } from "../../services/embeddings.js";
import { normaliseMediumUrl, buildFreediumUrl } from "../../utils/url.js";

const router = express.Router();

/** Helper: lấy client id từ header (để trả về cờ liked) */
function getClientId(req: express.Request): string {
  return String(req.get("x-client-id") || "").trim().slice(0, 200);
}

/**
 * ✅ List articles với paging / search / sort
 * GET /api/articles?page=1&limit=20&q=&sort=-created_at
 * Trả về { items, total, page, limit }. Mỗi item có thêm "liked" nếu kèm X-Client-Id.
 */
router.get("/", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
    const qtext = (req.query.q ? String(req.query.q) : "").trim();
    const sort  = String(req.query.sort || "-created_at");
    const dir   = sort.startsWith("-") ? "DESC" : "ASC";
    const col   = sort.replace(/^[-+]/, "");
    const allowed = new Set(["id", "created_at", "updated_at", "published_at", "title", "likes"]);
    const orderCol = allowed.has(col) ? col : "created_at";
    const clientId = getClientId(req);

    const whereSQL: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (qtext) {
      whereSQL.push(`(title ILIKE $${i} OR author ILIKE $${i})`);
      params.push(`%${qtext}%`);
      i++;
    }
    const whereClause = whereSQL.length ? `WHERE ${whereSQL.join(" AND ")}` : "";

    // Tổng số
    const totalRows = await q<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM articles ${whereClause}`,
      params
    );
    const total = totalRows[0]?.total ?? 0;

    // Items
    params.push(limit, (page - 1) * limit);
    let likedSelect = `, false AS liked`;
    if (clientId) {
      likedSelect = `, EXISTS(SELECT 1 FROM article_likes al WHERE al.article_id = a.id AND al.client_id = $${i + 2}) AS liked`;
    }
    const items = await q<any>(
      `SELECT a.*
             ${likedSelect}
         FROM articles a
         ${whereClause}
         ORDER BY ${orderCol} ${dir}, id DESC
         LIMIT $${i} OFFSET $${i + 1}`,
      clientId ? [...params, clientId] : params
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
 * 📥 Ingest
 * POST /api/articles/ingest?url=<medium_url>  (cũng nhận body.url)
 * Dùng cột `url` làm canonical key
 */
router.post("/ingest", async (req, res) => {
  try {
    const urlRaw = String(req.query.url || req.body?.url || "");
    if (!urlRaw) return res.status(400).json({ error: "Missing url" });

    // 1) Chuẩn hoá Medium URL
    const mediumUrl = normaliseMediumUrl(urlRaw);

    // 2) Check cache theo cột `url`
    const exist = await q<any>(`SELECT * FROM articles WHERE url = $1`, [mediumUrl]);

    // 3) Fetch nội dung (freedium để lấy full HTML nếu có)
    const freediumUrl = buildFreediumUrl(mediumUrl);
    const {
      title,
      author,
      contentHtml,
      excerpt,
      publishedAt,
      sourceUsed,
    } = await fetchExtracted(freediumUrl, urlRaw);

    // 4) Hash nội dung
    const contentHash = sha256((contentHtml || "") + (title || "") + (author || ""));

    if (exist[0] && exist[0].content_hash === contentHash && exist[0].summary_html) {
      return res.json({ status: "cached", article: exist[0] });
    }

    // 5) Tóm tắt + keywords -> JSONB
    const summaryHtml = await summarizeContent({ title, excerpt, html: contentHtml, url: mediumUrl });
    const plain = (contentHtml || "").replace(/<[^>]+>/g, " ");
    let kws = await extractKeywords(plain);
    if (!Array.isArray(kws)) kws = [];
    const safeKeywords: string[] = kws.map(String).filter(Boolean).slice(0, 50);
    const keywordsJson = JSON.stringify(safeKeywords); // <-- lưu dạng JSON string

    // 6) Embedding -> vector
    const embedding = await createEmbedding(plain);
    const embeddingStr = embedding?.length ? `[${embedding.join(",")}]` : null;

    // 7) Upsert theo cột `url`
    const params = [
      mediumUrl,               // $1 url (canonical)
      title,                   // $2
      author,                  // $3
      publishedAt,             // $4
      excerpt,                 // $5
      contentHtml,             // $6
      contentHash,             // $7
      summaryHtml,             // $8
      keywordsJson,            // $9 (JSON string) -> ::jsonb
      embeddingStr,            // $10 (string '[..]' | null) -> ::vector
      sourceUsed || "medium",  // $11
    ];

    let rows;
    if (exist[0]) {
      rows = await q<any>(
        `UPDATE articles
           SET title=$2, author=$3, published_at=$4, excerpt=$5, content_html=$6,
               content_hash=$7, summary_html=$8,
               keywords = COALESCE($9::jsonb, '[]'::jsonb),
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
           ($1,  $2,    $3,     $4,           $5,     $6,
            $7,   $8,   COALESCE($9::jsonb, '[]'::jsonb),
            COALESCE(NULLIF($10::text, '')::vector, NULL),
            $11)
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

/** ✅ GET 1 bài để trang đọc */
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
  try {
    const clientId = getClientId(req);
    const rows = await q<any>(
      `SELECT a.*,
              ${clientId ? `EXISTS(SELECT 1 FROM article_likes al WHERE al.article_id=a.id AND al.client_id=$2)` : "false"} AS liked
       FROM articles a
       WHERE a.id = $1`,
      clientId ? [id, clientId] : [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (err: any) {
    console.error("GET /api/articles/:id error:", err);
    res.status(500).json({ error: "server_error", detail: err.message });
  }
});

/** ❤️ LIKE (+1 nếu trước đó chưa like) */
router.post("/:id/like", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

  const clientId = getClientId(req);
  if (!clientId) return res.status(400).json({ error: "missing_client_id" });

  try {
    const rows = await q<{ liked: boolean; likes: number }>(`
      WITH ins AS (
        INSERT INTO article_likes (article_id, client_id)
        VALUES ($1, $2)
        ON CONFLICT (article_id, client_id) DO NOTHING
        RETURNING 1
      ),
      liked AS (
        SELECT EXISTS(
          SELECT 1 FROM article_likes WHERE article_id = $1 AND client_id = $2
        ) AS liked
      ),
      agg AS (
        SELECT COUNT(*)::int AS likes
        FROM article_likes
        WHERE article_id = $1
      )
      UPDATE articles a
      SET likes = agg.likes
      FROM agg
      WHERE a.id = $1
      RETURNING (SELECT liked FROM liked) AS liked, agg.likes;
    `, [id, clientId]);

    const liked = rows[0]?.liked ?? true;
    const likes = rows[0]?.likes ?? 0;
    return res.json({ ok: true, id, liked, likes });
  } catch (err: any) {
    console.error("POST /api/articles/:id/like error:", err);
    return res.status(500).json({ error: "like_failed", detail: err.message });
  }
});

/** 💔 UNLIKE (-1 nếu đang like) */
router.delete("/:id/like", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

  const clientId = getClientId(req);
  if (!clientId) return res.status(400).json({ error: "missing_client_id" });

  try {
    const rows = await q<{ liked: boolean; likes: number }>(`
      WITH del AS (
        DELETE FROM article_likes
        WHERE article_id = $1 AND client_id = $2
        RETURNING 1
      ),
      liked AS (
        SELECT EXISTS(
          SELECT 1 FROM article_likes WHERE article_id = $1 AND client_id = $2
        ) AS liked
      ),
      agg AS (
        SELECT COUNT(*)::int AS likes
        FROM article_likes
        WHERE article_id = $1
      )
      UPDATE articles a
      SET likes = agg.likes
      FROM agg
      WHERE a.id = $1
      RETURNING (SELECT liked FROM liked) AS liked, agg.likes;
    `, [id, clientId]);

    const liked = rows[0]?.liked ?? false;
    const likes = rows[0]?.likes ?? 0;
    return res.json({ ok: true, id, liked, likes });
  } catch (err: any) {
    console.error("DELETE /api/articles/:id/like error:", err);
    return res.status(500).json({ error: "unlike_failed", detail: err.message });
  }
});

export default router;
