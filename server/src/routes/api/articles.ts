// server/src/routes/api/articles.ts
import express from "express";
import { requireAuth, requireAuthOptional } from "../../middleware/auth.js";
import { q } from "../../utils/db.js";
import { fetchExtracted } from "../../services/fetchArticle.js";
import { summarizeContent } from "../../services/summarize.js";
import { extractKeywords, createEmbedding, sha256 } from "../../services/embeddings.js";
import { normaliseMediumUrl, buildFreediumUrl } from "../../utils/url.js";
import { detectProvider } from "../../services/detectMedia.js";
import { fetchMediaMeta } from "../../services/fetchMedia.js";

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

    const totalRow = (await q<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM articles ${whereClause}`, params
    ))[0];
    const total = totalRow?.total ?? 0;

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
 * 📥 Ingest
 * - MEDIA (video/music/social): ingest & SKIP summarize (tiết kiệm AI)
 * - ARTICLE: fetch + summarize
 * - Nếu user đăng nhập → auto-like sau create/update
 */
router.post("/ingest", requireAuthOptional as any, async (req: any, res) => {
  try {
    const urlRaw = String(req.query.url || req.body?.url || "").trim();
    if (!urlRaw) return res.status(400).json({ error: "Missing url" });

    // ===== NHÁNH MEDIA (YouTube/Spotify/TikTok/Instagram/X/SoundCloud …) =====
    const det = detectProvider(urlRaw);
    if (det.provider && det.content_type && det.content_type !== "article") {
      const meta: any = await fetchMediaMeta(urlRaw);
      const urlForUnique = meta.canonical_url || meta.original_url || urlRaw;

      // Tìm record cũ theo (provider,provider_id) hoặc trùng url/original_url (canonical/raw)
      const existRows = await q<any>(
        `SELECT id FROM articles
         WHERE (provider = $1 AND provider_id IS NOT DISTINCT FROM $2)
            OR url IN ($3, $4)
            OR original_url IN ($3, $4)
         ORDER BY updated_at DESC NULLS LAST, id DESC
         LIMIT 1`,
        [meta.provider, meta.provider_id || null, urlForUnique, meta.original_url || urlRaw]
      );

      let item: any;
      if (existRows.length) {
        // UPDATE
        const id = existRows[0].id;
        const rows = await q<any>(
          `UPDATE articles SET
             url = $1,
             original_url = $2,
             title = COALESCE($3, title),
             author = COALESCE($4, author),
             provider = $5,
             provider_id = $6,
             content_type = $7,
             embed_html = COALESCE($8, embed_html),
             thumbnail_url = COALESCE($9, thumbnail_url),
             media_width = COALESCE($10, media_width),
             media_height = COALESCE($11, media_height),
             extra = COALESCE(extra, '{}'::jsonb) || $12::jsonb,
             updated_at = NOW()
           WHERE id = $13
           RETURNING *`,
          [
            urlForUnique,                              // $1
            meta.original_url || urlRaw,               // $2
            meta.title || null,                        // $3
            meta.author || null,                       // $4
            meta.provider,                             // $5
            meta.provider_id || null,                  // $6
            meta.content_type,                         // $7
            meta.embed_html || null,                   // $8
            meta.thumbnail_url || null,                // $9
            meta.media_width || null,                  // $10
            meta.media_height || null,                 // $11
            JSON.stringify(meta.extra || {}),          // $12
            id                                         // $13
          ]
        );
        item = rows[0];
      } else {
        // INSERT
        const rows = await q<any>(
          `INSERT INTO articles (
             url, original_url, title, author,
             provider, provider_id, content_type,
             embed_html, thumbnail_url, media_width, media_height, extra
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING *`,
          [
            urlForUnique,                              // $1
            meta.original_url || urlRaw,               // $2
            meta.title || null,                        // $3
            meta.author || null,                       // $4
            meta.provider,                             // $5
            meta.provider_id || null,                  // $6
            meta.content_type,                         // $7
            meta.embed_html || null,                   // $8
            meta.thumbnail_url || null,                // $9
            meta.media_width || null,                  // $10
            meta.media_height || null,                 // $11
            JSON.stringify(meta.extra || {})           // $12
          ]
        );
        item = rows[0];
      }

      if (!item.excerpt && item.title) {
        await q(`UPDATE articles SET excerpt=$1 WHERE id=$2`, [item.title, item.id]);
        item.excerpt = item.title;
      }

      // --- AUTO-LIKE nếu user đăng nhập ---
      if (req.user?.id && item?.id) {
        try {
          await q(
            `INSERT INTO article_likes(article_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (article_id, user_id) DO NOTHING`,
            [item.id, req.user.id]
          );
          const { count } = (await q<{ count: number }>(
            `SELECT COUNT(*)::int AS count FROM article_likes WHERE article_id=$1`, [item.id]
          ))[0] || { count: 0 };
          await q(`UPDATE articles SET likes=$1, updated_at=NOW() WHERE id=$2`, [count, item.id]);
          item.likes = count;
          (item as any).liked = true;
        } catch (e) { console.warn("auto-like failed:", e); }
      }

      return res.json({ status: "ok", article: item });
    }

    // ===== NHÁNH BÀI VIẾT (fetch + summarize) =====
    const mediumUrl = normaliseMediumUrl(urlRaw);
    const exist = await q<any>(`SELECT * FROM articles WHERE url = $1`, [mediumUrl]);

    const freediumUrl = buildFreediumUrl(mediumUrl);
    const { title, author, contentHtml, excerpt, publishedAt, sourceUsed } =
      await fetchExtracted(freediumUrl, urlRaw);

    const contentHash = sha256((contentHtml || "") + (title || "") + (author || ""));
    if (exist[0] && exist[0].content_hash === contentHash && exist[0].summary_html) {
      let item = exist[0];

      // Auto-like cho bản cached nếu cần
      if (req.user?.id && item?.id) {
        try {
          await q(
            `INSERT INTO article_likes(article_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (article_id, user_id) DO NOTHING`,
            [item.id, req.user.id]
          );
          const { count } = (await q<{ count: number }>(
            `SELECT COUNT(*)::int AS count FROM article_likes WHERE article_id=$1`, [item.id]
          ))[0] || { count: 0 };
          await q(`UPDATE articles SET likes=$1, updated_at=NOW() WHERE id=$2`, [count, item.id]);
          item.likes = count;
          (item as any).liked = true;
        } catch (e) { console.warn("auto-like failed (cached):", e); }
      }

      return res.json({ status: "cached", article: item });
    }

    const summaryHtml = await summarizeContent({ title, excerpt, html: contentHtml, url: mediumUrl });
    const plain = (contentHtml || "").replace(/<[^>]+>/g, " ");
    let kws = await extractKeywords(plain);
    if (!Array.isArray(kws)) kws = [];
    const safeKeywords: string[] = kws.map(String).filter(Boolean).slice(0, 50);

    const embedding = await createEmbedding(plain);
    const embeddingStr = embedding?.length ? `[${embedding.join(",")}]` : null;

    // keywords là JSONB trong DB
    const keywordsJson = JSON.stringify(safeKeywords);

    let item: any;
    if (exist[0]) {
      const rows = await q<any>(
        `UPDATE articles
           SET title=$2, author=$3, published_at=$4, excerpt=$5, content_html=$6,
               content_hash=$7, summary_html=$8,
               keywords = COALESCE($9::jsonb, '[]'::jsonb),
               embedding = COALESCE(NULLIF($10::text, '')::vector, embedding),
               source_used=$11,
               updated_at=NOW()
         WHERE url=$1
         RETURNING *`,
        [
          mediumUrl,                // $1
          title,                    // $2
          author,                   // $3
          publishedAt,              // $4
          excerpt,                  // $5
          contentHtml,              // $6
          contentHash,              // $7
          summaryHtml,              // $8
          keywordsJson,             // $9
          embeddingStr,             // $10
          sourceUsed || "medium"    // $11
        ]
      );
      item = rows[0];
    } else {
      const rows = await q<any>(
        `INSERT INTO articles
           (url, title, author, published_at, excerpt, content_html,
            content_hash, summary_html, keywords, embedding, source_used)
         VALUES
           ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::jsonb,'[]'::jsonb),COALESCE(NULLIF($10::text,'')::vector,NULL),$11)
         RETURNING *`,
        [
          mediumUrl,                // $1
          title,                    // $2
          author,                   // $3
          publishedAt,              // $4
          excerpt,                  // $5
          contentHtml,              // $6
          contentHash,              // $7
          summaryHtml,              // $8
          keywordsJson,             // $9
          embeddingStr,             // $10
          sourceUsed || "medium"    // $11
        ]
      );
      item = rows[0];
    }

    // --- AUTO-LIKE nếu user đăng nhập ---
    if (req.user?.id && item?.id) {
      try {
        await q(
          `INSERT INTO article_likes(article_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (article_id, user_id) DO NOTHING`,
          [item.id, req.user.id]
        );
        const { count } = (await q<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM article_likes WHERE article_id=$1`, [item.id]
        ))[0] || { count: 0 };
        await q(`UPDATE articles SET likes=$1, updated_at=NOW() WHERE id=$2`, [count, item.id]);
        item.likes = count;
        (item as any).liked = true;
      } catch (e) { console.warn("auto-like failed (article):", e); }
    }

    res.json({ status: "ok", article: item });
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

/** 👥 GET /:id/likes — count + 8 likers + liked_by_me */
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
    console.error("POST /:id/like error:", err);
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
    console.error("DELETE /:id/like error:", err);
    return res.status(500).json({ error: "unlike_failed", detail: err.message });
  }
});

export default router;
