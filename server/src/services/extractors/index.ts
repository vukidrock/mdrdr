// server/src/services/extractors/index.ts
import { extractMedium } from "./medium.js";
import { extractSubstack } from "./substack.js";
import { fetchHtml, extractBody, extractTitle,extractAuthorAndDate, parseJsonLd, toIsoOrNull } from "./generic.js";
import { JSDOM } from "jsdom";

export async function extractArticleByUrl(url: string) {
  const hostname = (() => { try { return new URL(url).hostname; } catch { return ""; } })();

  if (hostname.includes("medium.com")) {
    return await extractMedium(url);
  }
  if (hostname.endsWith("substack.com")) {
    return await extractSubstack(url);
  }

  // Generic
  const { html, status, finalUrl } = await fetchHtml(url);
  if (!html || status >= 400) throw new Error("fetch_origin_failed");
  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;

  const title = extractTitle(hostname, doc);

  const { author, publishedAt } = extractAuthorAndDate(hostname, doc);

  const { contentHtml, excerpt } = extractBody(hostname, finalUrl, doc, title);
  return { title, author, publishedAt, excerpt, contentHtml, sourceUsed: "origin" as const };
}
