// server/src/routes/articles-by-tag.routes.ts
import { Router } from 'express';
import { pool } from '../services/db.js';
const q = (text: string, params?: any[]) => pool.query(text, params);

const router = Router();

/** GET /api/articles/by-tag?tag=react  hoặc ?tags=react,typescript */
router.get('/by-tag', async (req, res, next) => {
  try {
    const tagParam = (req.query.tags as string) || (req.query.tag as string) || '';
    const tags = tagParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!tags.length) return res.json({ status: 'ok', items: [] });

    const inParams = tags.map((_, i) => `$${i+1}`).join(',');
    const sql = `
      WITH t AS (SELECT id FROM tags WHERE name IN (${inParams}))
      SELECT
        a.id,
        a.url,
        regexp_replace(a.url, '^https?://([^/]+).*', '\\1') AS domain,
        a.title,
        a.author,
        a.published_at,
        a.excerpt
      FROM articles a
      JOIN article_tags at ON at.article_id = a.id
      JOIN t ON t.id = at.tag_id
      GROUP BY a.id
      ORDER BY a.published_at DESC NULLS LAST, a.id DESC
      LIMIT 100
    `;
    const r = await q(sql, tags);
    res.json({ status: 'ok', items: r.rows });
  } catch (e) { next(e); }
});

export default router;
