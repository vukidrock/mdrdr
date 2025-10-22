// server/src/routes/api/bookmarks.ts
import express from "express";
import { q } from "../../utils/db.js";
import { requireAuth } from "../../middleware/auth.js";
const router = express.Router();

router.post("/articles/:id/bookmark", requireAuth as any, async (req:any, res)=>{
  const id = Number(req.params.id);
  await q(
    `INSERT INTO bookmarks(article_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
    [id, req.user.id]
  );
  res.json({ ok:true });
});

router.delete("/articles/:id/bookmark", requireAuth as any, async (req:any, res)=>{
  const id = Number(req.params.id);
  await q(`DELETE FROM bookmarks WHERE article_id=$1 AND user_id=$2`, [id, req.user.id]);
  res.json({ ok:true });
});

router.get("/me/bookmarks", requireAuth as any, async (req:any, res)=>{
  const items = await q(
    `SELECT a.* FROM bookmarks b JOIN articles a ON a.id=b.article_id
     WHERE b.user_id=$1 ORDER BY b.created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ ok:true, items });
});

export default router;
