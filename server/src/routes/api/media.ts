// server/src/routes/api/media.ts
import express from "express";
import { fetchMediaMeta } from "../../services/fetchMedia.js";
import { q } from "../../utils/db.js";
import { summarizeContent } from "../../services/summarize.js"; // tái dùng nếu muốn có excerpt

const router = express.Router();

router.post("/ingest", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing url" });

    const meta = await fetchMediaMeta(url);

    // chọn URL sẽ lưu ở cột UNIQUE(url)
    const urlForUnique = meta.canonical_url || meta.original_url;

    // Tìm record cũ theo (provider, provider_id) hoặc theo url (UNIQUE)
    const existRows = await q(
      `SELECT id FROM articles
       WHERE (provider = $1 AND provider_id IS NOT DISTINCT FROM $2)
          OR url = $3
       LIMIT 1`,
      [meta.provider, meta.provider_id || null, urlForUnique]
    );

    let item;

    if (existRows.length) {
      const id = existRows[0].id;

      const rows = await q(`
        UPDATE articles SET
          url = $1,
          title = COALESCE($2, title),
          author = COALESCE($3, author),
          original_url = $4,
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
        RETURNING *;
      `, [
        urlForUnique,
        meta.title || null,
        meta.author || null,
        meta.original_url,
        meta.provider,
        meta.provider_id || null,
        meta.content_type,
        meta.embed_html || null,
        meta.thumbnail_url || null,
        meta.media_width || null,
        meta.media_height || null,
        JSON.stringify(meta.extra || {}),
        id
      ]);

      item = rows[0];

    } else {
      const rows = await q(`
        INSERT INTO articles (
          url,
          title,
          author,
          original_url,
          provider,
          provider_id,
          content_type,
          embed_html,
          thumbnail_url,
          media_width,
          media_height,
          extra
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *;
      `, [
        urlForUnique,
        meta.title || null,
        meta.author || null,
        meta.original_url,
        meta.provider,
        meta.provider_id || null,
        meta.content_type,
        meta.embed_html || null,
        meta.thumbnail_url || null,
        meta.media_width || null,
        meta.media_height || null,
        JSON.stringify(meta.extra || {})
      ]);

      item = rows[0];
    }

    if (!item.excerpt && item.title) {
      await q(`UPDATE articles SET excerpt = $1 WHERE id = $2`, [item.title, item.id]);
      item.excerpt = item.title;
    }

    res.json({ item });

  } catch (e: any) {
    console.error("POST /api/media/ingest error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

export default router;
