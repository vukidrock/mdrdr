// web/src/lib/api.ts

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ?? "";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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
  return http<any>(`/api/articles/${id}`);
}

/** Likes: đếm + danh sách avatar + liked_by_me (UI avatar stack) */
export async function getLikes(articleId: number) {
  return http<{
    ok: true;
    count: number;
    likers: { id: number; display_name: string; avatar_url?: string }[];
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

/** (tuỳ dùng) Lấy user hiện tại từ cookie JWT */
export async function getMe() {
  return http<{ ok: true; user: null | { id: number; display_name: string; avatar_url?: string } }>(
    `/api/me`
  );
}
