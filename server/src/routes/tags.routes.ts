import { Router } from 'express';
import { pool } from '../services/db.js'; // hoặc import { q } nếu bạn đã có helper

const q = (text: string, params?: any[]) => pool.query(text, params);
const router = Router();

/** GET /api/tags */
router.get('/', async (_req, res, next) => {
  try {
    const r = await q('SELECT id, name FROM tags ORDER BY name ASC');
    res.json({ status: 'ok', items: r.rows });
  } catch (e) { next(e); }
});

/** GET /api/tags/:articleId/articles — lấy tags của 1 bài */
router.get('/:articleId/articles', async (req, res, next) => {
  try {
    const id = Number(req.params.articleId);
    const r = await q(
      `SELECT t.id, t.name
       FROM article_tags at
       JOIN tags t ON t.id = at.tag_id
       WHERE at.article_id = $1
       ORDER BY t.name ASC`, [id]);
    res.json({ status: 'ok', items: r.rows });
  } catch (e) { next(e); }
});

/** PUT /api/tags/:articleId  body: { tags: string[] } */
router.put('/:articleId', async (req, res, next) => {
  try {
    const articleId = Number(req.params.articleId);
    const { tags } = (req.body || {}) as { tags: string[] };
    const tagIds: number[] = [];

    for (const raw of (tags || [])) {
      const name = String(raw || '').trim().toLowerCase();
      if (!name) continue;
      const up = await q(
        'INSERT INTO tags(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',
        [name]
      );
      tagIds.push(up.rows[0].id);
    }

    await q('DELETE FROM article_tags WHERE article_id=$1', [articleId]);
    for (const tid of tagIds) {
      await q('INSERT INTO article_tags(article_id, tag_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [articleId, tid]);
    }

    res.json({ status: 'ok' });
  } catch (e) { next(e); }
});

export default router;
