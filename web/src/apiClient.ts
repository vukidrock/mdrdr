// src/apiClient.ts
const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") ||
  (typeof window !== "undefined"
    ? `${window.location.origin.replace(/:3000/, ":3001")}`
    : "http://localhost:3001");

export interface FetchOptions extends RequestInit {
  json?: boolean;
}

async function request<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await res.text();

  // Nếu không phải JSON thì log ra để debug
  if (!res.ok) {
    console.error("❌ API error:", res.status, text);
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  try {
    return options.json === false ? (text as any) : JSON.parse(text);
  } catch {
    console.error("⚠️ Không thể parse JSON từ response:", text.slice(0, 200));
    throw new Error("Invalid JSON response");
  }
}

export const apiClient = {
  // ✅ Ví dụ: tóm tắt bài viết
  ingestArticle: (url: string) =>
    request("/api/ingest", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  // ✅ Ví dụ: kiểm tra trạng thái server
  health: () => request("/api/health"),

  // ✅ Ví dụ: lấy bài viết đã lưu
  getArticle: (id: string) => request(`/api/articles/${id}`),

  // ✅ Ví dụ: tìm bài viết liên quan
  relatedArticles: (id: string) => request(`/api/articles/${id}/related`),
};

export default apiClient;
