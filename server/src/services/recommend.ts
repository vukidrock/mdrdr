import { q } from "./db.js";
export async function relatedByEmbedding(articleId: number, topK = 5) {
  const [cur] = await q<{ embedding: number[] }>("SELECT embedding FROM articles WHERE id=$1", [articleId]);
  if (!cur?.embedding) return [];
  return q<{ id:number; title:string; medium_url:string }>(
    `SELECT id, title, medium_url
     FROM articles
     WHERE id <> $1 AND embedding IS NOT NULL
     ORDER BY embedding <=> $2
     LIMIT $3`,
    [articleId, cur.embedding, topK]
  );
}
export async function relatedByKeywords(articleId: number, topK = 5) {
  const [cur] = await q<{ keywords: string[] }>("SELECT keywords FROM articles WHERE id=$1", [articleId]);
  if (!cur?.keywords?.length) return [];
  return q<{ id:number; title:string; medium_url:string }>(
    `SELECT id, title, medium_url
     FROM articles
     WHERE id <> $1
       AND keywords && $2::text[]
     ORDER BY created_at DESC
     LIMIT $3`,
    [articleId, cur.keywords, topK]
  );
}
