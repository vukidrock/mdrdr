// web/src/lib/api.ts

// --- Safe UUID (polyfill) ---
function safeUUID(): string {
  const g: any = (typeof globalThis !== "undefined" ? globalThis : window) as any;
  if (g.crypto && typeof g.crypto.randomUUID === "function") {
    try { return g.crypto.randomUUID(); } catch {}
  }
  if (g.crypto && typeof g.crypto.getRandomValues === "function") {
    const buf = new Uint8Array(16);
    g.crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0"));
    return (
      hex.slice(0, 4).join("") + "-" +
      hex.slice(4, 6).join("") + "-" +
      hex.slice(6, 8).join("") + "-" +
      hex.slice(8, 10).join("") + "-" +
      hex.slice(10, 16).join("")
    );
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// tạo/đọc client id ẩn danh
function ensureClientId(): string {
  try {
    let id = localStorage.getItem("mdrdr.client");
    if (!id) {
      id = safeUUID();
      localStorage.setItem("mdrdr.client", id);
    }
    return id;
  } catch {
    return safeUUID();
  }
}

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ??
  `${location.protocol}//${location.hostname}:3001`;

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const cid = ensureClientId();
  const r = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": cid,
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`${r.status} ${r.statusText}${text ? `: ${text}` : ""}`);
  }
  return r.json() as Promise<T>;
}

export async function ingest(url: string) {
  return http<{ status: string; article?: any }>(
    `/api/articles/ingest?url=${encodeURIComponent(url)}`,
    { method: "POST" }
  );
}

export async function listArticles(opts?: {
  page?: number; limit?: number; sort?: string; q?: string;
}) {
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 20;
  const sort = opts?.sort ?? "-created_at";
  const q = opts?.q ?? "";
  const qs = new URLSearchParams({
    page: String(page), limit: String(limit), sort, ...(q ? { q } : {}),
  }).toString();
  return http<{ items: any[]; total: number; page: number; limit: number }>(
    `/api/articles?${qs}`
  );
}

export async function getArticle(id: number) {
  return http<any>(`/api/articles/${id}`);
}

// ❤️ like / unlike rõ ràng
export async function like(id: number) {
  return http<{ ok: true; id: number; liked: boolean; likes: number }>(
    `/api/articles/${id}/like`,
    { method: "POST" }
  );
}
export async function unlike(id: number) {
  return http<{ ok: true; id: number; liked: boolean; likes: number }>(
    `/api/articles/${id}/like`,
    { method: "DELETE" }
  );
}
