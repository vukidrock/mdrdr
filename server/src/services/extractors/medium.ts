// server/src/services/extractors/medium.ts
import { JSDOM } from "jsdom";
import { marked } from "marked";
import { fetchHtml, extractBody, extractTitle,extractAuthorAndDate, parseJsonLd, toIsoOrNull } from "./generic.js";
import { fetchMediumFallback } from "../fetchMediumFallback.js";

export async function extractMedium(url: string) {
  // 1) Lấy nội dung qua mirror như bạn đang làm (freedium/scribe/…)
  const { html: mirrorHtml, status, finalUrl } = await fetchHtml(url /* mirror url đã build */);
  if (!mirrorHtml || status >= 400) throw new Error("mirror_failed");

  const dom = new JSDOM(mirrorHtml, { url });
  const doc = dom.window.document;

  const hostnameOriginal = new URL(url).hostname;
  const title = extractTitle(hostnameOriginal, doc);
  const { contentHtml, excerpt } = extractBody(hostnameOriginal, url, doc, title);

  // 2) Thăm dò metadata trực tiếp từ Medium gốc (chỉ để lấy author/date)
  let author = "";
  let publishedAt: string | null = null;

  try {
    const { html: mediumHtml } = await fetchHtml(url /* chính là URL medium gốc */);
    if (mediumHtml) {
      // Không cần body, chỉ parse head cho nhanh
      const domHead = new JSDOM(mediumHtml, { url });
      const headDoc = domHead.window.document;

      // Ưu tiên JSON-LD (đã hỗ trợ @graph)
      const fromLd = parseJsonLd(headDoc);
      author = fromLd.author || author;
      publishedAt = fromLd.publishedAt || publishedAt;

      // Bổ sung meta fallback
      if (!author) {
        author =
          headDoc.querySelector('meta[name="author"]')?.getAttribute("content")?.trim() ||
          headDoc.querySelector('meta[property="article:author"]')?.getAttribute("content")?.trim() ||
          author;
      }
      if (!publishedAt) {
        publishedAt =
          headDoc.querySelector('meta[property="article:published_time"]')?.getAttribute("content")?.trim() ||
          headDoc.querySelector('time[datetime]')?.getAttribute("datetime")?.trim() ||
          publishedAt;
      }
    }
  } catch {
    // ignore — nếu Medium chặn thì bỏ qua, vẫn dùng mirror
  }

  // 3) Thêm một nhánh cứu hộ nữa từ chính mirror DOM (lỡ Medium chặn)
  if (!author || !publishedAt) {
    const retry = extractAuthorAndDate(hostnameOriginal, doc);
    author = author || retry.author;
    publishedAt = publishedAt || retry.publishedAt;
  }

  return {
    title,
    author,
    publishedAt,
    excerpt,
    contentHtml,
    sourceUsed: "medium+mirror",
  };
}
