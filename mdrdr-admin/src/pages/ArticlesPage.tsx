// src/pages/ArticlesPage.tsx
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Link } from "react-router-dom";

/* ---------- Types ---------- */
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

/* ---------- Env helpers (browser-safe) ---------- */
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

  // xử lý trường hợp server trả rỗng (phòng hờ)
  if (res.status === 204 || res.status === 205) {
    return undefined as unknown as T;
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    if (!text) return undefined as unknown as T;
    try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
  }
  try { return (await res.json()) as T; } catch { return undefined as unknown as T; }
}

/* ---------- Utils ---------- */
function formatDate(d?: string | null) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleString();
}
function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

/* ---------- API ---------- */
async function getArticles(params: { page: number; limit: number; sort: string }) {
  const url = buildUrl("/api/articles", {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
  });
  const data = await fetchJSON<{ items: Article[]; total: number } | any>(url);
  if (Array.isArray(data)) return { items: data as Article[], total: data.length };
  if (data && Array.isArray(data.items)) return { items: data.items as Article[], total: Number(data.total ?? data.items.length) };
  if (data && Array.isArray(data.articles)) return { items: data.articles as Article[], total: data.articles.length };
  return { items: [], total: 0 };
}

/* ---------- Toast ---------- */
function useToast(timeoutMs = 2500) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), timeoutMs);
    return () => clearTimeout(t);
  }, [msg, timeoutMs]);
  return { msg, show: (m: string) => setMsg(m), clear: () => setMsg(null) };
}
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-black text-white text-sm px-4 py-2 rounded-xl shadow-lg flex items-center gap-3">
        <span>{message}</span>
        <button className="opacity-70 hover:opacity-100" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function ArticlesPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [sort, setSort] = useState("-created_at"); // -desc, +asc

  const { data, isLoading, isFetching, isError, error }: UseQueryResult<{
    items: Article[];
    total: number;
  }, Error> = useQuery({
    queryKey: ["articles", page, limit, sort],
    queryFn: () => getArticles({ page, limit, sort }),
    staleTime: 20_000,
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns = useMemo(
    () => [
      { key: "id", label: "ID", width: "w-20", render: (x: Article) => x.id },
      {
        key: "title",
        label: "Tiêu đề",
        width: "",
        render: (x: Article) => (
          <div className="max-w-[520px] truncate" title={x.title}>
            {x.title || "(untitled)"}
          </div>
        ),
      },
      { key: "author", label: "Tác giả", width: "w-40", render: (x: Article) => x.author || "—" },
      { key: "published_at", label: "Xuất bản", width: "w-48", render: (x: Article) => formatDate(x.published_at) },
      { key: "created_at", label: "Tạo", width: "w-48", render: (x: Article) => formatDate(x.created_at) },
      { key: "updated_at", label: "Sửa", width: "w-48", render: (x: Article) => formatDate(x.updated_at) },
      {
        key: "actions",
        label: "Hành động",
        width: "w-56",
        render: (x: Article) => (
          <RowActions
            a={x}
            onDeleted={async () => {
              toast.show(`Đã xoá #${x.id}`);
              await qc.invalidateQueries({ queryKey: ["articles"] });
            }}
            onEdit={() => {/* no-op here */}}
            onError={(m) => toast.show(m)}
          />
        ),
      },
    ],
    [qc, toast]
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="text-lg font-semibold">Articles</h1>
          <span className="ml-2 text-xs text-neutral-500 border rounded-full px-2 py-0.5">
            API: {API_BASE} • mode: /api/articles
          </span>
          <div className="ml-auto flex items-center gap-2">
            <SortSelect value={sort} onChange={setSort} />
            <Link
              to="/articles/new"
              className="border px-3 py-2 rounded-xl bg-black text-white hover:bg-black/90"
            >
              + Bài mới
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-neutral-500">
            {isFetching ? "Đang tải…" : total ? `${total} kết quả` : ""}
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={cx("text-left font-medium px-3 py-2 border-b", c.width)}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-neutral-500" colSpan={columns.length}>
                    Đang tải dữ liệu…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-neutral-500" colSpan={columns.length}>
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                items.map((a: Article) => (
                  <tr key={a.id} className="hover:bg-neutral-50">
                    {columns.map((c) => (
                      <td key={c.key} className={cx("px-3 py-2 border-b align-top", c.width)}>
                        {(c as any).render(a)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} setPage={setPage} canPrev={page > 1} canNext={items.length >= limit} />

        {isError && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 whitespace-pre-wrap">
            {error?.message || "Có lỗi xảy ra"}
          </div>
        )}
      </main>

      {toast.msg && <Toast message={toast.msg} onClose={toast.clear} />}
    </div>
  );
}

/* ---------- Small components ---------- */
function Pagination({
  page,
  setPage,
  canPrev,
  canNext,
}: {
  page: number;
  setPage: (n: number) => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        disabled={!canPrev}
        onClick={() => setPage(page - 1)}
        className={cx("border px-3 py-1.5 rounded-xl text-sm", !canPrev && "opacity-50 cursor-not-allowed")}
      >
        Trước
      </button>
      <span className="text-sm text-neutral-600">Trang {page}</span>
      <button
        disabled={!canNext}
        onClick={() => setPage(page + 1)}
        className={cx("border px-3 py-1.5 rounded-xl text-sm", !canNext && "opacity-50 cursor-not-allowed")}
      >
        Sau
      </button>
    </div>
  );
}

function SortSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-neutral-600">Sắp xếp</span>
      <select className="border rounded-xl px-2 py-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="-created_at">Mới tạo ↓</option>
        <option value="+created_at">Mới tạo ↑</option>
        <option value="-updated_at">Cập nhật ↓</option>
        <option value="+updated_at">Cập nhật ↑</option>
        <option value="-published_at">Xuất bản ↓</option>
        <option value="+published_at">Xuất bản ↑</option>
      </select>
    </label>
  );
}

function RowActions({
  a,
  onDeleted,
  onEdit,
  onError,
}: {
  a: Article;
  onDeleted: () => void;
  onEdit: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const doDelete = async () => {
    if (!confirm(`Xóa bài #${a.id}?`)) return;
    setBusy(true);
    try {
      // Server đã trả 200 { ok: true, id }, nên dùng fetchJSON bình thường
      await fetchJSON(buildUrl(`/api/article/${a.id}`), { method: "DELETE" });
      onDeleted();
    } catch (e: any) {
      onError(e?.message || "Không xóa được");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <a
        className="text-blue-600 hover:underline"
        href={a.medium_url || a.url || `#/articles/${a.id}`}
        target="_blank"
        rel="noreferrer"
      >
        Xem
      </a>
      <Link className="text-amber-600 hover:underline" to={`/articles/${a.id}/edit`} onClick={onEdit}>
        Sửa
      </Link>
      <button
        onClick={doDelete}
        disabled={busy}
        className={cx("text-red-600 hover:underline", busy && "opacity-50 cursor-not-allowed")}
      >
        Xóa
      </button>
    </div>
  );
}
