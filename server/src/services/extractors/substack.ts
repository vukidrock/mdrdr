// server/src/services/extractors/substack.ts
import { JSDOM } from "jsdom";
import { extractBody, extractTitle, extractAuthorAndDate, fetchHtml, parseJsonLd, toIsoOrNull } from "./generic.js";

/** Resolve /browse|/profile → URL bài gốc */
export async function resolveSubstackPostUrl(rawUrl: string): Promise<string | null> {
  try {
    const u = new URL(rawUrl);
    if (!u.hostname.endsWith("substack.com")) return null;
    if (!(u.pathname.startsWith("/browse") || u.pathname.startsWith("/profile"))) return null;

    const { html, status, finalUrl } = await fetchHtml(rawUrl);
    if (!html || status >= 400) return null;

    const d = new JSDOM(html, { url: finalUrl }).window.document;
    const canon = d.querySelector('link[rel="canonical"]')?.getAttribute("href");
    if (canon) return canon;
    const og = d.querySelector('meta[property="og:url"]')?.getAttribute("content");
    if (og) return og;

    const nextData = d.querySelector("#__NEXT_DATA__")?.textContent;
    if (nextData) {
      const json = JSON.parse(nextData);
      const pp = json?.props?.pageProps || {};
      const cand =
        pp?.post?.url || pp?.post?.canonical_url || pp?.post?.canonicalURL ||
        pp?.canonical_url || pp?.canonicalURL || pp?.url;
      if (typeof cand === "string") return cand;
    }

    const a = Array.from(d.querySelectorAll("a[href]")).find((el) => {
      const href = el.getAttribute("href") || "";
      return /^https?:\/\/[^\/]+\.substack\.com\/p\//.test(href);
    });
    if (a?.getAttribute("href")) return a.getAttribute("href")!;
  } catch {}
  return null;
}

export async function extractSubstack(url: string) {
  const resolved = await resolveSubstackPostUrl(url);
  const finalUrl = resolved || url;

  const { html, status } = await fetchHtml(finalUrl);
  if (!html || status >= 400) throw new Error("fetch_substack_failed");

  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;

  const hostname = new URL(finalUrl).hostname;
  const title = extractTitle(hostname, doc);

  // Author & date
  const { author, publishedAt } = extractAuthorAndDate(hostname, doc);

  const { contentHtml, excerpt } = extractBody(hostname, finalUrl, doc, title);
  return { title, author, publishedAt, excerpt, contentHtml, sourceUsed: "substack" as const };
}
