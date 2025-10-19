// server/src/services/extractors/generic.ts
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import DOMPurify from "isomorphic-dompurify";
import { getSelectorsFor } from "../site-selectors.js";

/** Fetch HTML (giữ lại URL cuối sau redirect) */
export async function fetchHtml(url: string) {
  const r = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "accept-language": "vi,en;q=0.9",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const html = await r.text().catch(() => null);
  return { html, status: r.status, finalUrl: r.url };
}

/** Chuẩn hoá date string về ISO hoặc null */
export function toIsoOrNull(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  // yyyy-mm-dd
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    return isNaN(+d) ? null : d.toISOString();
  }
  const d2 = new Date(s);
  return isNaN(+d2) ? null : d2.toISOString();
}

/** Đọc JSON-LD để lấy tác giả/ngày (hỗ trợ @graph, nhiều biến thể) */
export function parseJsonLd(doc: Document) {
  try {
    const scripts = Array.from(
      doc.querySelectorAll('script[type="application/ld+json"]')
    );

    const pickArticle = (obj: any) => {
      const type = obj?.["@type"] || obj?.type;
      return type === "Article" || type === "NewsArticle" || type === "BlogPosting";
    };
    const toAuthorString = (a: any) => {
      if (!a) return "";
      if (typeof a === "string") return a;
      if (Array.isArray(a)) {
        return a
          .map((x: any) => (x?.name || x?.url || ""))
          .filter(Boolean)
          .join(", ");
      }
      if (typeof a === "object") return a.name || a.url || "";
      return "";
    };

    for (const s of scripts) {
      const txt = s.textContent?.trim();
      if (!txt) continue;

      let data: any;
      try {
        data = JSON.parse(txt);
      } catch {
        continue;
      }
      const pile: any[] = [];
      if (Array.isArray(data)) {
        pile.push(...data);
      } else if (data && typeof data === "object") {
        if (Array.isArray(data["@graph"])) pile.push(...data["@graph"]);
        pile.push(data);
      }

      // Ưu tiên node Article
      for (const obj of pile) {
        if (!obj || typeof obj !== "object") continue;
        if (pickArticle(obj)) {
          const author = toAuthorString(obj.author);
          const published =
            obj.datePublished ||
            obj.dateCreated ||
            obj.uploadDate ||
            obj.pubDate ||
            null;
          return {
            author: String(author || "").trim(),
            publishedAt: toIsoOrNull(published),
          };
        }
      }

      // Nếu không có Article, thử lấy author/name chung
      for (const obj of pile) {
        if (!obj || typeof obj !== "object") continue;
        if (obj.author || obj.datePublished || obj.headline || obj.name) {
          const author = toAuthorString(obj.author);
          const published = obj.datePublished || obj.dateCreated || null;
          return {
            author: String(author || "").trim(),
            publishedAt: toIsoOrNull(published),
          };
        }
      }
    }
  } catch {}
  return { author: "", publishedAt: null as string | null };
}

/** Bỏ hậu tố tên site khỏi tiêu đề (— Site | | Site …) */
function stripSiteSuffix(title: string, doc: Document, hostname: string) {
  const site =
    doc
      .querySelector('meta[property="og:site_name"]')
      ?.getAttribute("content")
      ?.trim() || hostname.replace(/^www\./, "");
  if (!site) return title;

  const patterns = [
    new RegExp(`\\s*[—–\\-|•|:]\\s*${site}\\s*$`, "i"),
    new RegExp(`\\s*\\|\\s*${site}\\s*$`, "i"),
  ];
  let out = title;
  for (const rx of patterns) out = out.replace(rx, "");
  return out.trim();
}

/** Lấy title: og:title → twitter:title → ld+json(headline) → heading → document.title */
export function extractTitle(hostname: string, doc: Document): string {
  const og = doc
    .querySelector('meta[property="og:title"]')
    ?.getAttribute("content")
    ?.trim();
  if (og) return stripSiteSuffix(og, doc, hostname);

  const tw = doc
    .querySelector('meta[name="twitter:title"]')
    ?.getAttribute("content")
    ?.trim();
  if (tw) return stripSiteSuffix(tw, doc, hostname);

  try {
    const scripts = Array.from(
      doc.querySelectorAll('script[type="application/ld+json"]')
    );
    for (const s of scripts) {
      const txt = s.textContent?.trim();
      if (!txt) continue;
      const data = JSON.parse(txt);
      const arr = Array.isArray(data) ? data : [data];
      for (const obj of arr) {
        const type = obj["@type"] || obj.type;
        if (
          type === "Article" ||
          type === "NewsArticle" ||
          type === "BlogPosting"
        ) {
          const hl = obj.headline || obj.name || obj.title;
          if (typeof hl === "string" && hl.trim())
            return stripSiteSuffix(hl.trim(), doc, hostname);
        }
      }
    }
  } catch {}

  // Substack: ưu tiên title trong main content
  if (hostname.endsWith("substack.com")) {
    const sels = [
      ".available-content .title",
      ".available-content h1",
      ".available-content h2",
      "main article h1",
      "main article h2",
    ];
    for (const sel of sels) {
      const t = doc.querySelector(sel)?.textContent?.trim();
      if (t) return stripSiteSuffix(t, doc, hostname);
    }
  }

  const generic = ["article h1", "article h2", "h1", "h1 span"];
  for (const sel of generic) {
    const t = doc.querySelector(sel)?.textContent?.trim();
    if (t) return stripSiteSuffix(t, doc, hostname);
  }

  return stripSiteSuffix((doc.title || "").trim(), doc, hostname);
}

/** Biến link tương đối → tuyệt đối (a/img/srcset) */
export function absolutizeUrls(root: Document | Element, baseUrl: string) {
  const base = new URL(baseUrl);
  const scope =
    (root as Document).querySelector ? (root as Document) : (root as Element);

  scope.querySelectorAll("a[href]").forEach((a) => {
    const h = a.getAttribute("href");
    if (!h) return;
    try {
      a.setAttribute("href", new URL(h, base).toString());
    } catch {}
  });

  scope.querySelectorAll("img[src]").forEach((img) => {
    const s = img.getAttribute("src");
    if (!s) return;
    try {
      img.setAttribute("src", new URL(s, base).toString());
    } catch {}
  });

  scope.querySelectorAll("source[srcset], img[srcset]").forEach((el) => {
    const srcset = el.getAttribute("srcset") || "";
    const parts = srcset.split(",").map((p) => p.trim()).filter(Boolean);
    const fixed = parts
      .map((p) => {
        const [u, d] = p.split(/\s+/);
        try {
          return new URL(u, base).toString() + (d ? ` ${d}` : "");
        } catch {
          return p;
        }
      })
      .join(", ");
    if (fixed) el.setAttribute("srcset", fixed);
  });
}

/** Loại bỏ thành phần rác/không liên quan */
export function stripNoise(el: Element) {
  const rm = [
    "header",
    "footer",
    "nav",
    "aside",
    "[role='banner']",
    "[role='contentinfo']",
    "[role='complementary']",
    ".comments",
    ".comment",
    ".related",
    ".recommended",
    ".newsletter",
    ".subscribe",
    ".subscription",
    ".share",
    ".social",
    ".promo",
    ".advert",
    ".ad",
    ".ads",
    ".widget",
    ".sidebar",
    ".breadcrumbs",
    ".cookie",
    ".gdpr",
    ".modal",
    "[data-component='comments']",
    "[data-test='comments']",

    // Substack specific
    "#discussion",
    "#comments-for-scroll",
    ".post-ufi",
    ".post-right-rail",
    ".left-rail",
    ".right-rail",
    ".sidebar-NzGH2W",
    ".sidebar-right-ktL8if",
    ".sidebar-left-K3vrOP",
    ".sidebar-RUDMha",
    ".subscription-widget",
    ".subscribe-widget",
    ".paywall",
    ".recommended-posts",
    ".publisher-bar",
    ".top-bar",
    ".bottom-bar",
    ".header-menu",
    ".footer-newsletter",
    ".video-wrapper-lforaE",
    ".bottomControlsContainer-kx5Iet",
    ".visibility-check",
  ];

  rm.forEach((sel) =>
    el.querySelectorAll(sel).forEach((n) => n.remove())
  );

  // Loại bỏ section có heading gợi ý transcript/discussion
  el.querySelectorAll("h4, h3").forEach((h) => {
    const t = h.textContent?.toLowerCase() || "";
    if (t.includes("transcript") || t.includes("discussion")) {
      h.closest("section,div")?.remove();
    }
  });

  // Script/iframe/css inline
  el.querySelectorAll("script,style,noscript,iframe").forEach((n) => n.remove());
}

/** Bọc nội dung thành trang HTML tối giản (giữ title cho preview) */
export function wrapAsStandalone(innerHtml: string, title?: string) {
  const safeTitle = (title || "").replace(/</g, "&lt;");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body>${innerHtml}</body></html>`;
}

/** Ưu tiên selector theo allowlist cho domain */
export function pickByAllowlist(hostname: string, doc: Document) {
  const sels = getSelectorsFor(hostname);
  for (const sel of sels) {
    const el = doc.querySelector(sel);
    if (el && el.textContent && el.textContent.trim().length > 80) return el;
  }
  return null;
}

/** Selector phổ biến nếu allowlist không match */
export function pickGeneric(doc: Document) {
  const cands = [
    "main article",
    "article",
    ".entry-content",
    ".post-content",
    ".article-content",
    ".article-body",
    ".post-body",
    ".content",
    ".section-content",
    ".post .content",
    ".single-post .content",
  ];
  for (const sel of cands) {
    const el = doc.querySelector(sel);
    if (el && el.textContent && el.textContent.trim().length > 120) return el;
  }
  return null;
}

/** Trích body: allowlist → generic selectors → Readability → last resort */
export function extractBody(
  hostname: string,
  url: string,
  doc: Document,
  title: string
) {
  let node = pickByAllowlist(hostname, doc);
  if (!node) node = pickGeneric(doc);

  // Readability fallback
  if (!node) {
    const rd = new Readability(doc);
    const article = rd.parse();
    if (article?.content) {
      const dom2 = new JSDOM(article.content, { url });
      const body = dom2.window.document.body;
      stripNoise(body);
      absolutizeUrls(body.ownerDocument, url);
      const html = DOMPurify.sanitize(body.innerHTML, {
        USE_PROFILES: { html: true },
      });
      const metaDesc = doc
        .querySelector('meta[name="description"]')
        ?.getAttribute("content")
        ?.trim();
      const firstP = body.querySelector("p")?.textContent?.trim() || "";
      const excerpt = (metaDesc || firstP).replace(/\s+/g, " ").slice(0, 220);
      return { contentHtml: wrapAsStandalone(html, title), excerpt };
    }
  }

  // Nếu đã bắt được node
  if (node) {
    const dom2 = new JSDOM("<!doctype html><html><body></body></html>", { url });
    const holder = dom2.window.document.createElement("div");
    holder.innerHTML = node.innerHTML;
    stripNoise(holder);
    absolutizeUrls(holder.ownerDocument, url);
    const html = DOMPurify.sanitize(holder.innerHTML, {
      USE_PROFILES: { html: true },
    });
    const metaDesc = doc
      .querySelector('meta[name="description"]')
      ?.getAttribute("content")
      ?.trim();
    const firstP = holder.querySelector("p")?.textContent?.trim() || "";
    const excerpt = (metaDesc || firstP).replace(/\s+/g, " ").slice(0, 220);
    return { contentHtml: wrapAsStandalone(html, title), excerpt };
  }

  // Last resort: lấy innerHTML article/body rồi làm sạch
  const htmlAll =
    doc.querySelector("article")?.innerHTML?.trim() || doc.body.innerHTML;
  const dom3 = new JSDOM("<!doctype html><html><body></body></html>", { url });
  dom3.window.document.body.innerHTML = htmlAll;
  stripNoise(dom3.window.document.body);
  absolutizeUrls(dom3.window.document, url);
  const html = DOMPurify.sanitize(dom3.window.document.body.innerHTML, {
    USE_PROFILES: { html: true },
  });
  const metaDesc = doc
    .querySelector('meta[name="description"]')
    ?.getAttribute("content")
    ?.trim();
  const firstP =
    dom3.window.document.body.querySelector("p")?.textContent?.trim() || "";
  const excerpt = (metaDesc || firstP).replace(/\s+/g, " ").slice(0, 220);
  return { contentHtml: wrapAsStandalone(html, title), excerpt };
}

/** Biến URL author → tên người đọc được (ví dụ: .../yegor-gilyov/ → "Yegor Gilyov") */
function humanizeFromUrl(href: string) {
  try {
    const u = new URL(href);
    const segs = u.pathname.split("/").filter(Boolean);
    const last = segs[segs.length - 1] || "";
    return last
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  } catch {
    return href;
  }
}

/**
 * Lấy tác giả & ngày xuất bản (ưu tiên JSON-LD → meta → byline phổ biến).
 * Không lệ thuộc mạnh vào hostname để phù hợp mirror (freedium/scribe).
 */
export function extractAuthorAndDate(
  _hostname: string,
  doc: Document
) {
  // 1) JSON-LD trước
  const fromLd = parseJsonLd(doc);
  let author = fromLd.author || "";
  let publishedAt = fromLd.publishedAt || null;

  // 2) Meta tags nếu thiếu
  if (!author) {
    author =
      doc.querySelector('meta[name="author"]')?.getAttribute("content")?.trim() ||
      doc.querySelector('meta[property="article:author"]')?.getAttribute("content")?.trim() ||
      "";
  }
  if (!publishedAt) {
    publishedAt =
      toIsoOrNull(
        doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ||
        doc.querySelector('meta[property="og:article:published_time"]')?.getAttribute("content") ||
        doc.querySelector('meta[name="pubdate"]')?.getAttribute("content") ||
        doc.querySelector('meta[name="date"]')?.getAttribute("content") ||
        doc.querySelector("time")?.getAttribute("datetime")
      ) || null;
  }

  // 3) Nếu author là URL → lấy text trong link hoặc humanize slug
  if (author && /^https?:\/\//i.test(author)) {
    const linkText = doc.querySelector(`a[href="${author}"]`)?.textContent?.trim();
    author = linkText || humanizeFromUrl(author);
  }

  // 4) Byline phổ biến (Medium, freedium, scribe, generic)
  if (!author) {
    const authorSelectors = [
      // Medium (nhiều theme/đời UI)
      'a[rel="author"]',
      'a[href^="/@"]',
      'a[href*="medium.com/@"]',
      ".pw-author",
      ".p-author",
      ".byline a[rel='author']",
      ".byline .author",
      ".postMetaInline a",
      "header .p-author",
      "header a[rel='author']",
      // Scribe/Freedium
      ".article-meta a[rel='author']",
      ".post-meta a[rel='author']",
      ".post-meta .author",
      // Generic news/blog
      ".article__meta a[rel='author']",
      ".article__header a[rel='author']",
      ".c-article__byline a[rel='author']",
      ".author__name",
    ];

    for (const sel of authorSelectors) {
      const nodes = Array.from(doc.querySelectorAll(sel));
      const names = nodes
        .map((n) => n.textContent?.trim())
        .filter((t): t is string => !!t);
      if (names.length) {
        author = Array.from(new Set(names)).join(", ");
        break;
      }
      // Nếu selector là <a> mà text rỗng, thử humanize từ href
      const hrefNames = nodes
        .map((n) =>
          (n instanceof (doc.defaultView?.HTMLAnchorElement ?? HTMLAnchorElement))
            ? n.getAttribute("href")
            : null
        )
        .filter(Boolean)
        .map((href) => humanizeFromUrl(href!))
        .filter(Boolean);
      if (hrefNames.length) {
        author = Array.from(new Set(hrefNames)).join(", ");
        break;
      }
    }
  }

  // 5) Nếu vẫn thiếu ngày: thử thêm vài biến thể time/meta
  if (!publishedAt) {
    const dateSelectors = [
      "time[datetime]",
      ".article__meta time[datetime]",
      ".article__header time[datetime]",
      ".c-article__byline time[datetime]",
      "article time[datetime]",
    ];
    for (const sel of dateSelectors) {
      const node = doc.querySelector(sel);
      const dt =
        node?.getAttribute("datetime") ||
        node?.getAttribute("content") ||
        node?.textContent?.trim() ||
        "";
      const iso = toIsoOrNull(dt);
      if (iso) {
        publishedAt = iso;
        break;
      }
    }
  }

  return { author, publishedAt };
}
