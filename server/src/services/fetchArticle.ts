// server/src/services/fetchArticle.ts
import { extractArticleByUrl } from "./extractors/index.js";
import summarize from "./summarize.js";
import { q } from "./db.js";

/** API nội bộ: trả về { title, author, publishedAt, excerpt, contentHtml, sourceUsed } */
export async function fetchExtracted(_freediumUrl: string, url: string) {
  // _freediumUrl giữ cho tương thích cũ, nhưng extractor đã tự xử lý Medium/Substack
  return await extractArticleByUrl(url);
}

/** Legacy: insert nếu chưa có, dùng summarize() */
export async function getOrCreateArticle(url: string) {
  const found = await q("SELECT * FROM articles WHERE url = $1", [url]);
  if (found.length > 0) return { status: "cached", article: found[0] };

  const { title, author, publishedAt, excerpt, contentHtml, sourceUsed } =
    await extractArticleByUrl(url);

  const summaryHtml = await summarize(contentHtml);

  const rows = await q(
    `INSERT INTO articles
       (url, title, author, published_at, excerpt, content_html, summary_html, source_used, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
     RETURNING *`,
    [url, title, author, publishedAt, excerpt, contentHtml, summaryHtml, sourceUsed]
  );
  return { status: "ok", article: rows[0] };
}

export async function listArticles() {
  const rows = await q(
    "SELECT id, url, title, author, published_at, created_at FROM articles ORDER BY created_at DESC LIMIT 50"
  );
  return rows;
}
