// server/src/routes/related.routes.ts
import { Router } from 'express';
import { pool } from '../services/db.js';
const q = (text: string, params?: any[]) => pool.query(text, params);

const router = Router();

/** GET /api/articles/:id/related */
router.get('/:id/related', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Lấy thông tin nền (domain tính từ url)
    const base = await q(
      `SELECT
         id,
         regexp_replace(url, '^https?://([^/]+).*', '\\1') AS domain,
         author
       FROM articles WHERE id=$1`,
      [id]
    );
    if (!base.rowCount) return res.json({ status: 'ok', items: [] });

    const { domain, author } = base.rows[0] as { domain: string|null; author: string|null };

    const sql = `
      WITH base_tags AS (
        SELECT at.tag_id
        FROM article_tags at
        WHERE at.article_id = $1
      ),
      scored AS (
        SELECT
          a.id,
          a.title,
          a.author,
          regexp_replace(a.url, '^https?://([^/]+).*', '\\1') AS domain,
          a.published_at,
          COALESCE(bt.cnt, 0) * 3
          + CASE WHEN regexp_replace(a.url, '^https?://([^/]+).*', '\\1') = $2 THEN 2 ELSE 0 END
          + CASE WHEN a.author = $3 AND a.author IS NOT NULL AND a.author <> '' THEN 1 ELSE 0 END
          AS score
        FROM articles a
        LEFT JOIN (
          SELECT at.article_id, COUNT(*) AS cnt
          FROM article_tags at
          JOIN base_tags b ON b.tag_id = at.tag_id
          WHERE at.article_id <> $1
          GROUP BY at.article_id
        ) bt ON bt.article_id = a.id
        WHERE a.id <> $1
      )
      SELECT id, title, author, domain, published_at
      FROM scored
      WHERE score > 0
      ORDER BY score DESC, published_at DESC NULLS LAST
      LIMIT 10;
    `;
    const r = await q(sql, [id, domain, author || null]);

    if (!r.rowCount) {
      // fallback theo "domain" tính từ url
      const fb = await q(
        `SELECT
           id,
           title,
           author,
           regexp_replace(url, '^https?://([^/]+).*', '\\1') AS domain,
           published_at
         FROM articles
         WHERE id <> $1 AND regexp_replace(url, '^https?://([^/]+).*', '\\1') = $2
         ORDER BY published_at DESC NULLS LAST
         LIMIT 6`,
        [id, domain]
      );
      return res.json({ status: 'ok', items: fb.rows });
    }

    res.json({ status: 'ok', items: r.rows });
  } catch (e) { next(e); }
});

export default router;
