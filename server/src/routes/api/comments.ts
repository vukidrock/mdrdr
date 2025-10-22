// server/src/routes/api/comments.ts
import express from "express";
import { q } from "../../utils/db.js";
import { requireAuth } from "../../middleware/auth.js";
import sanitizeHtml from "sanitize-html";

const router = express.Router();

router.get("/articles/:id/comments", async (req, res)=>{
  const id = Number((req.params as any).id);
  const parent = (req.query.parent_id as string) || null;

  const items = await q(
    `SELECT c.id, c.parent_id, c.content, c.created_at,
            u.id AS user_id, u.display_name, u.avatar_url
       FROM comments c JOIN users u ON u.id=c.user_id
      WHERE c.article_id=$1
        AND ( ($2::bigint IS NULL AND c.parent_id IS NULL) OR c.parent_id=$2::bigint )
      ORDER BY c.created_at DESC
      LIMIT 50`,
    [id, parent]
  );
  res.json({ ok:true, items });
});

router.post("/articles/:id/comments", requireAuth as any, async (req:any, res)=>{
  const id = Number(req.params.id);
  const parent_id = req.body?.parent_id || null;
  const contentRaw = (req.body?.content || "").toString();
  const content = sanitizeHtml(contentRaw, {
    allowedTags: ["b","i","em","strong","a","code","br"],
    allowedAttributes: { a:["href","title","target","rel"] }
  }).trim();
  if (!content) return res.status(400).json({ ok:false, error:"EMPTY" });

  const row = (await q<{
    id:number; parent_id:number|null; content:string; created_at:string;
  }>(
    `INSERT INTO comments(article_id,user_id,parent_id,content)
     VALUES($1,$2,$3,$4)
     RETURNING id, parent_id, content, created_at`,
    [id, req.user.id, parent_id, content]
  ))[0];

  res.json({ ok:true, item: row });
});

router.delete("/comments/:commentId", requireAuth as any, async (req:any, res)=>{
  const commentId = Number(req.params.commentId);
  await q(`DELETE FROM comments WHERE id=$1 AND user_id=$2`, [commentId, req.user.id]);
  res.json({ ok:true });
});

export default router;
