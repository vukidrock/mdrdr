// src/pages/EditArticlePage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

// ---------------- Types ----------------
export type Article = {
  id: number;
  medium_url?: string;
  url?: string;
  title: string;
  author: string;
  published_at: string | null;
  excerpt: string;
  content_html: string;
  summary_html: string;
  keywords?: string[];
  created_at: string;
  updated_at: string;
};

// ---------------- Env helpers (browser-safe) ----------------
function normalizeBaseUrl(v?: string): string | undefined {
  if (!v || typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s.replace(/\/+$/, "");
}
const API_BASE =
  normalizeBaseUrl((import.meta as any)?.env?.VITE_API_BASE) || "http://localhost:3001";

function buildUrl(path: string, params?: Record<string, string | number | undefined | null>) {
  const base = API_BASE + "/";
  const cleanPath = path.replace(/^\/+/, "");
  const u = new URL(cleanPath, base);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      const s = String(v);
      if (!s) continue;
      u.searchParams.set(k, s);
    }
  }
  return u.toString();
}

async function fetchJSON<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `\n${text}` : ""}`);
  }
  return res.json() as Promise<T>;
}

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function formatDateInputValue(d?: string | null) {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  // return YYYY-MM-DDTHH:mm (for datetime-local)
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

// ---------------- Component ----------------
export default function EditArticlePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [urlInput, setUrlInput] = useState("");

  const [form, setForm] = useState<Partial<Article>>({
    title: "",
    author: "",
    excerpt: "",
    content_html: "",
    summary_html: "",
    published_at: null,
    keywords: [],
    medium_url: "",
  });

  // -------- Load article when editing --------
  useEffect(() => {
    if (isNew) return;

    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        // Try modern: GET /api/articles/:id  (if you later add it)
        try {
          const data = await fetchJSON<Article>(buildUrl(`/api/articles/${id}`));
          setForm({
            ...data,
            keywords: Array.isArray(data.keywords) ? data.keywords : [],
          });
          setLoading(false);
          return;
        } catch {
          // Fallback: GET legacy list then find by id
        }

        const list = await fetchJSON<{ items: Article[]; total: number } | { status: string; articles: Article[] }>(
          buildUrl("/api/article")
        );
        let items: Article[] = [];
        if (Array.isArray((list as any).items)) items = (list as any).items;
        else if (Array.isArray((list as any).articles)) items = (list as any).articles;

        const found = items.find((x) => String(x.id) === String(id));
        if (!found) {
          setErrorMsg("Không tìm thấy bài viết.");
        } else {
          setForm({ ...found, keywords: Array.isArray(found.keywords) ? found.keywords : [] });
        }
      } catch (e: any) {
        setErrorMsg(e?.message || "Lỗi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, isNew]);

  // -------- Actions --------
  const doIngest = async () => {
    const url = urlInput.trim();
    if (!url) {
      setErrorMsg("Vui lòng nhập URL Medium hợp lệ.");
      return;
    }
    setErrorMsg(null);
    setIngesting(true);
    try {
      // POST /api/articles/ingest?url=...
      await fetchJSON<any>(buildUrl("/api/articles/ingest", { url }), { method: "POST" });
      // optional: show a toast
      navigate("/articles");
    } catch (e: any) {
      setErrorMsg(e?.message || "Không ingest được bài viết");
    } finally {
      setIngesting(false);
    }
  };

  const doSave = async () => {
    if (isNew) {
      // In "new" mode we only support ingest by URL for now.
      await doIngest();
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      // Try modern PATCH /api/article/:id
      const body: any = {
        title: form.title ?? "",
        author: form.author ?? "",
        excerpt: form.excerpt ?? "",
        content_html: form.content_html ?? "",
        summary_html: form.summary_html ?? "",
        published_at: form.published_at ?? null,
        keywords: Array.isArray(form.keywords) ? form.keywords : [],
        medium_url: form.medium_url ?? form.url ?? "",
      };
      await fetchJSON(buildUrl(`/api/article/${id}`), {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      navigate("/articles");
    } catch (e: any) {
      setErrorMsg(e?.message || "Không lưu được (server chưa hỗ trợ PATCH)");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (isNew) {
      navigate("/articles");
      return;
    }
    if (!confirm(`Xóa bài #${id}?`)) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      await fetchJSON(buildUrl(`/api/article/${id}`), { method: "DELETE" });
      navigate("/articles");
    } catch (e: any) {
      setErrorMsg(e?.message || "Không xóa được (server chưa hỗ trợ DELETE)");
    } finally {
      setDeleting(false);
    }
  };

  // -------- Render --------
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            {isNew ? "Ingest bài mới từ URL Medium" : `Sửa bài #${id}`}
          </h1>
          <span className="ml-2 text-xs text-neutral-500 border rounded-full px-2 py-0.5">
            API: {API_BASE}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/articles" className="border px-3 py-2 rounded-xl hover:bg-neutral-100">
              ← Danh sách
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {errorMsg && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 whitespace-pre-wrap">
            {errorMsg}
          </div>
        )}

        {isNew ? (
          <div className="rounded-2xl border bg-white shadow-sm p-4">
            <label className="block text-sm font-medium mb-1">Medium URL</label>
            <input
              className="border rounded-xl px-3 py-2 w-full mb-3"
              placeholder="https://medium.com/@user/some-article"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={doIngest}
                disabled={ingesting}
                className={cx(
                  "border px-4 py-2 rounded-xl bg-black text-white hover:bg-black/90",
                  ingesting && "opacity-50 cursor-not-allowed"
                )}
              >
                {ingesting ? "Đang ingest…" : "Ingest"}
              </button>
              <Link to="/articles" className="border px-4 py-2 rounded-xl hover:bg-neutral-100">
                Hủy
              </Link>
            </div>
          </div>
        ) : loading ? (
          <div className="text-neutral-600">Đang tải…</div>
        ) : (
          <div className="rounded-2xl border bg-white shadow-sm p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tiêu đề</label>
              <input
                className="border rounded-xl px-3 py-2 w-full"
                value={form.title ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tác giả</label>
                <input
                  className="border rounded-xl px-3 py-2 w-full"
                  value={form.author ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, author: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ngày xuất bản</label>
                <input
                  type="datetime-local"
                  className="border rounded-xl px-3 py-2 w-full"
                  value={formatDateInputValue(form.published_at)}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      published_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Excerpt</label>
              <textarea
                className="border rounded-xl px-3 py-2 w-full h-24"
                value={form.excerpt ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, excerpt: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Keywords (phân tách bằng dấu phẩy)</label>
              <input
                className="border rounded-xl px-3 py-2 w-full"
                value={(form.keywords ?? []).join(", ")}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    keywords: e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Content HTML</label>
              <textarea
                className="border rounded-xl px-3 py-2 w-full h-40 font-mono"
                value={form.content_html ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, content_html: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Summary HTML</label>
              <textarea
                className="border rounded-xl px-3 py-2 w-full h-40 font-mono"
                value={form.summary_html ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, summary_html: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Medium URL</label>
              <input
                className="border rounded-xl px-3 py-2 w-full"
                value={form.medium_url ?? form.url ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, medium_url: e.target.value }))}
                placeholder="https://medium.com/@user/..."
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={doSave}
                disabled={saving}
                className={cx(
                  "border px-4 py-2 rounded-xl bg-black text-white hover:bg-black/90",
                  saving && "opacity-50 cursor-not-allowed"
                )}
              >
                {saving ? "Đang lưu…" : "Lưu"}
              </button>
              <button
                onClick={doDelete}
                disabled={deleting}
                className={cx(
                  "border px-4 py-2 rounded-xl text-red-600 hover:bg-red-50",
                  deleting && "opacity-50 cursor-not-allowed"
                )}
              >
                {deleting ? "Đang xóa…" : "Xóa"}
              </button>
              <Link to="/articles" className="border px-4 py-2 rounded-xl hover:bg-neutral-100">
                Hủy
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
