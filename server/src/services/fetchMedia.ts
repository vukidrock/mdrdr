// server/src/services/fetchMedia.ts
import { request } from "undici";
import { detectProvider, extractProviderId, Provider } from "./detectMedia.js";

type OEmbed = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  html?: string;
  width?: number;
  height?: number;
};

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await request(url, { method: "GET" });
  if (r.statusCode >= 200 && r.statusCode < 300) {
    return (await r.body.json()) as T;
  }
  throw new Error(`Fetch failed ${r.statusCode} ${url}`);
}

function buildOEmbedUrl(provider: Provider, originalUrl: string): string | undefined {
  const enc = encodeURIComponent(originalUrl);
  switch (provider) {
    case "youtube":   return `https://www.youtube.com/oembed?url=${enc}&format=json`;
    case "tiktok":    return `https://www.tiktok.com/oembed?url=${enc}`;
    case "spotify":   return `https://open.spotify.com/oembed?url=${enc}`;
    case "soundcloud":return `https://soundcloud.com/oembed?format=json&url=${enc}`;
    case "instagram": return undefined; // cần token FB, fallback client
    case "x":         return undefined; // oEmbed không ổn định
  }
}

export function canonicalizeForOEmbed(provider: Provider, originalUrl: string, provider_id?: string) {
  if (provider === "youtube" && provider_id) {
    return `https://www.youtube.com/watch?v=${provider_id}`;
  }
  return originalUrl;
}

export async function fetchMediaMeta(originalUrl: string) {
  const { provider, content_type } = detectProvider(originalUrl);
  if (!provider || !content_type) throw new Error("Unsupported provider");

  const provider_id = extractProviderId(originalUrl, provider);

  let oembed: OEmbed | undefined;

  const canonUrl = canonicalizeForOEmbed(provider, originalUrl, provider_id);
  const oembedUrl = buildOEmbedUrl(provider, canonUrl);
  if (oembedUrl) {
    try { oembed = await fetchJSON<OEmbed>(oembedUrl); } catch {}
  }

  // Fallback HTML nhúng cho Instagram/X dùng blockquote, YouTube tự dựng iframe
  let embed_html = oembed?.html;
  if (!embed_html) {
    if (provider === "instagram") {
      embed_html = `
        <blockquote class="instagram-media" data-instgrm-permalink="${originalUrl}" data-instgrm-version="14"></blockquote>
        <script async src="https://www.instagram.com/embed.js"></script>`;
    } else if (provider === "x") {
      embed_html = `
        <blockquote class="twitter-tweet"><a href="${originalUrl}"></a></blockquote>
        <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
    } else if (provider === "youtube" && provider_id) {
      // privacy-friendly iframe fallback
      const title = (oembed?.title || "YouTube video").replace(/"/g, "&quot;");
      embed_html = `<iframe src="https://www.youtube-nocookie.com/embed/${provider_id}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        loading="lazy"
        title="${title}"></iframe>`;
    }
  }

  return {
    content_type,
    provider,
    provider_id,
    original_url: originalUrl,
    title: oembed?.title,
    author: oembed?.author_name,
    embed_html,
    thumbnail_url: oembed?.thumbnail_url,
    media_width: oembed?.width,
    media_height: oembed?.height,
    // duration_seconds: có thể bổ sung qua yt-dlp nếu cần
    extra: {},
    canonical_url: canonUrl,
  };
}
