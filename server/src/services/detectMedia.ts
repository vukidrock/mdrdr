import { URL } from "node:url";

export type Provider =
  | "youtube" | "tiktok" | "instagram" | "x"
  | "spotify" | "soundcloud";

export type ContentType = "video" | "music" | "social" | "article";

export function detectProvider(u: string): { provider?: Provider; content_type?: ContentType } {
  let host = "";
  try { host = new URL(u).hostname.replace(/^www\./, ""); } catch { return {}; }

  if (host.endsWith("youtu.be") || host.includes("youtube.com")) return { provider: "youtube", content_type: "video" };
  if (host.includes("tiktok.com")) return { provider: "tiktok", content_type: "video" };
  if (host.includes("instagram.com")) return { provider: "instagram", content_type: "social" };
  if (host.includes("twitter.com") || host.includes("x.com")) return { provider: "x", content_type: "social" };
  if (host.includes("open.spotify.com")) return { provider: "spotify", content_type: "music" };
  if (host.includes("soundcloud.com")) return { provider: "soundcloud", content_type: "music" };
  return {};
}

export function extractProviderId(url: string, provider?: Provider): string | undefined {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    if (provider === "youtube") {
      if (u.hostname.endsWith("youtu.be")) return path.slice(1);
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = path.split("/").filter(Boolean);
      const idx = parts.findIndex(p => p === "embed" || p === "shorts");
      if (idx >= 0 && parts[idx+1]) return parts[idx+1];
    }
    if (provider === "tiktok") {
      const m = path.match(/\/video\/(\d+)/);
      if (m) return m[1];
    }
    if (provider === "instagram") {
      const m = path.match(/\/(p|reel|tv)\/([^\/]+)/);
      if (m) return m[2];
    }
    if (provider === "x") {
      const m = path.match(/\/status\/(\d+)/);
      if (m) return m[1];
    }
    if (provider === "spotify") {
      const parts = path.split("/").filter(Boolean);
      if (parts[1]) return parts[1];
    }
    if (provider === "soundcloud") {
      return u.origin + path;
    }
  } catch {}
  return undefined;
}
