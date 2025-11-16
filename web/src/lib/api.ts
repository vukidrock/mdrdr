// web/src/lib/api.ts

// Tự suy luận API_BASE: mặc định cùng origin (https://mdrdr.xyz),
// còn khi dev (http://localhost:3000) sẽ tự đổi sang :3001
export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ??
  `${location.protocol}//${location.hostname}${location.port ? `:${location.port}` : ""}`.replace(
    /:3000$/,
    ":3001"
  );

// Lỗi có status để UI bắt 401 hiển thị toast lịch sự
export class ApiError extends Error {
  status: number;
  body?: any;
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (r.ok) return r.json() as Promise<T>;

  // gom message từ json/text để debug tốt hơn
  let body: any = undefined;
  try {
    const ct = r.headers.get("content-type") || "";
    body = ct.includes("application/json") ? await r.json() : await r.text();
  } catch {
    /* ignore */
  }
  const msg = typeof body === "string" ? body : JSON.stringify(body ?? {});
  throw new ApiError(r.status, `${r.status} ${r.statusText}${msg ? `: ${msg}` : ""}`, body);
}

/** Ingest 1 bài viết */
export async function ingest(url: string) {
  return http<{ status: string; article?: any }>(
    `/api/articles/ingest?url=${encodeURIComponent(url)}`,
    { method: "POST" }
  );
}

/** Danh sách bài viết (có cờ liked nếu đã đăng nhập) */
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

/** Lấy chi tiết 1 bài (kèm liked nếu đã đăng nhập) */
export async function getArticle(id: number) {
  const res = await fetch(`${API_BASE}/api/articles/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error(String(res.status));
  const j = await res.json();
  // map nhưng giữ toàn bộ trường quan trọng:
  return {
    id: j.id,
    url: j.url,
    medium_url: j.medium_url,
    title: j.title,
    author: j.author,
    published_at: j.published_at,
    summary_html: j.summary_html,
    content_html: j.content_html,
    created_at: j.created_at,
    updated_at: j.updated_at,
    likes: j.likes,
    liked: j.liked,

    // giữ MEDIA FIELDS
    content_type: j.content_type,
    provider: j.provider,
    provider_id: j.provider_id,
    original_url: j.original_url,
    embed_html: j.embed_html,
    thumbnail_url: j.thumbnail_url,
    duration_seconds: j.duration_seconds,
    media_width: j.media_width,
    media_height: j.media_height,
    extra: j.extra,
  };
}

/** Likes: đếm + danh sách avatar + liked_by_me (UI avatar stack) */
export async function getLikes(articleId: number) {
  return http<{
    ok: true;
    count: number;
    likers: { id: number; display_name: string; avatar_url?: string | null }[];
    liked_by_me: boolean;
  }>(`/api/articles/${articleId}/likes`);
}

/** ❤️ like / 💔 unlike — yêu cầu đã đăng nhập (cookie JWT) */
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

/** Lấy user hiện tại từ cookie JWT */
export async function getMe() {
  return http<{ ok: true; user: null | { id: number; display_name: string; avatar_url?: string | null } }>(
    `/api/me`
  );
}
