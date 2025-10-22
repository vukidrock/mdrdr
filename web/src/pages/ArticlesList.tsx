// web/src/pages/ArticlesList.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listArticles, like, unlike } from "../lib/api";

type Article = {
  id: number;
  url?: string | null;
  medium_url?: string | null;
  title: string | null;
  author: string | null;
  excerpt: string | null;
  published_at: string | null;
  created_at: string;
  likes: number;
  liked?: boolean; // server trả nếu có cookie đăng nhập
};

type ListResp = {
  items: Article[];
  total: number;
  page: number;
  limit: number;
};

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { label: "Newest", value: "-created_at" },
  { label: "Oldest", value: "created_at" },
  { label: "Most liked", value: "-likes" },
  { label: "Least liked", value: "likes" },
];

function timeAgo(d?: string | null) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getDomain(u?: string | null): string {
  if (!u) return "";
  try {
    const host = new URL(u).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function ArticlesList() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const sort = params.get("sort") || "-created_at";
  const q = params.get("q") || "";

  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null); // ⬅ chống double click

  const fetchOpts = useMemo(
    () => ({ page, limit: PAGE_SIZE, sort, q }),
    [page, sort, q]
  );

  useEffect(() => {
    setLoading(true);
    setErr(null);
    listArticles(fetchOpts)
      .then(setData)
      .catch((e: any) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [fetchOpts.page, fetchOpts.limit, fetchOpts.sort, fetchOpts.q]);

  const setSort = (value: string) => {
    const np = new URLSearchParams(params);
    np.set("sort", value);
    np.set("page", "1");
    setParams(np);
  };

  const setQuery = (value: string) => {
    const np = new URLSearchParams(params);
    if (value) np.set("q", value);
    else np.delete("q");
    np.set("page", "1");
    setParams(np);
  };

  const goto = (p: number) => {
    const np = new URLSearchParams(params);
    np.set("page", String(p));
    setParams(np);
  };

  const onToggleLike = async (id: number, curLiked: boolean) => {
    try {
      setPendingId(id);
      const r = curLiked ? await unlike(id) : await like(id);
      // Cập nhật đúng theo server trả về
      setData(prev =>
        prev ? {
          ...prev,
          items: prev.items.map(it =>
            it.id === id ? { ...it, liked: r.liked, likes: r.likes } : it
          )
        } : prev
      );
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("401")) {
        alert("Hãy đăng nhập để like.");
      } else {
        console.error(e);
        alert("Toggle like failed");
      }
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Toolbar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Articles</h1>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative">
            <input
              className="w-full sm:w-72 rounded-xl border border-zinc-300 bg-white/70 px-3 py-2 text-sm outline-none transition hover:border-zinc-400 focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60"
              placeholder="Search by title/author…"
              defaultValue={q}
              onKeyDown={(e) => {
                if (e.key === "Enter") setQuery((e.target as HTMLInputElement).value.trim());
              }}
            />
            <button
              className="absolute right-1 top-1 inline-flex items-center rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>("input[placeholder^='Search']");
                setQuery((input?.value || "").trim());
              }}
              title="Search"
            >
              🔎
            </button>
          </div>

          {/* Sort */}
          <select
            className="rounded-xl border border-zinc-300 bg-white/70 px-3 py-2 text-sm outline-none transition hover:border-zinc-400 focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            title="Sort"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonList />
      ) : err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/40 dark:bg-red-950/40">
          Error: {err}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState q={q} />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.items.map((a) => {
              const domain = getDomain(a.url || a.medium_url) || "—";
              const ico = domain !== "—" ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : "";
              const liked = !!a.liked;
              const disabled = pendingId === a.id;

              return (
                <li
                  key={a.id}
                  className="rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        {/* Domain badge + favicon */}
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                          title={a.url || a.medium_url || ""}
                        >
                          {ico ? (
                            <img
                              src={ico}
                              alt=""
                              width={14}
                              height={14}
                              loading="lazy"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              className="inline-block"
                            />
                          ) : null}
                          {domain}
                        </span>
                      </div>

                      <Link
                        to={`/articles/${a.id}`}
                        className="line-clamp-2 text-lg font-semibold leading-snug hover:underline"
                        title={a.title ?? ""}
                      >
                        {a.title || "(untitled)"}
                      </Link>

                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {a.author ? `by ${a.author}` : "—"}{" "}
                        {a.published_at ? `· ${new Date(a.published_at).toLocaleDateString()}` : ""}
                        {a.created_at ? ` · ${timeAgo(a.created_at)}` : ""}
                      </div>
                    </div>

                    {/* Like button */}
                    <button
                      onClick={() => onToggleLike(a.id, liked)}
                      disabled={disabled}
                      className={[
                        "shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition",
                        disabled ? "opacity-60 cursor-not-allowed" : "",
                        liked
                          ? "bg-black text-white border border-black/80 dark:bg-white dark:text-black"
                          : "border border-zinc-400 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-500 dark:text-zinc-200 dark:hover:bg-zinc-800/30",
                      ].join(" ")}
                      title={liked ? "Unlike" : "Like"}
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill={liked ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth={liked ? 0 : 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      <span className="tabular-nums">{a.likes ?? 0}</span>
                    </button>
                  </div>

                  {a.excerpt && (
                    <p className="mt-3 line-clamp-3 text-sm text-zinc-700 dark:text-zinc-300">
                      {a.excerpt}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              disabled={data.page <= 1}
              onClick={() => goto(page - 1)}
              className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
            >
              ← Prev
            </button>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Page <span className="font-medium">{data.page}</span>{" "}
              of{" "}
              <span className="font-medium">
                {Math.max(1, Math.ceil((data.total ?? 0) / PAGE_SIZE))}
              </span>
            </span>
            <button
              disabled={data.page * PAGE_SIZE >= (data.total ?? 0)}
              onClick={() => goto(page + 1)}
              className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="animate-pulse rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
        >
          <div className="mb-2 h-4 w-20 rounded bg-zinc-200/70 dark:bg-zinc-700/50" />
          <div className="mb-2 h-5 w-3/4 rounded bg-zinc-200/70 dark:bg-zinc-700/50" />
          <div className="mb-4 h-3 w-1/2 rounded bg-zinc-200/70 dark:bg-zinc-700/50" />
          <div className="h-3 w-full rounded bg-zinc-200/70 dark:bg-zinc-700/50" />
          <div className="mt-2 h-3 w-5/6 rounded bg-zinc-200/70 dark:bg-zinc-700/50" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ q }: { q: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-10 text-center dark:border-zinc-800">
      <div className="text-3xl mb-2">🗂️</div>
      <h2 className="text-lg font-semibold mb-1">No articles found</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {q ? (
          <>
            Không có kết quả cho <span className="font-mono">"{q}"</span>. Hãy thử từ khoá khác.
          </>
        ) : (
          <>Chưa có bài nào. Hãy ingest một liên kết Medium trước đã.</>
        )}
      </p>
    </div>
  );
}
