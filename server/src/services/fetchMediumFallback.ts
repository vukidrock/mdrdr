import { request } from "undici";
import { JSDOM } from "jsdom";
import { marked } from "marked";

// Fallback lấy trực tiếp Medium (có thể dính paywall, nhưng vẫn lấy snippet)
export async function fetchMediumFallback(mediumUrl: string) {
  const r = await request(mediumUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (r.statusCode !== 200) {
    throw new Error(`Medium fallback failed with status ${r.statusCode}`);
  }

  const txt = await r.body.text();
  const html = txt.trim().startsWith("<") ? txt : await marked.parse(txt);

  // Có thể parse để lấy đoạn preview ngắn nếu bài bị paywall
  const dom = new JSDOM(html);
  const preview = dom.window.document.querySelector("p")?.textContent?.trim();

  return {
    html,
    sourceUsed: "medium_fallback",
    preview: preview || "",
  };
}
