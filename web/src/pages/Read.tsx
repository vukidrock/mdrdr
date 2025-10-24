import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type Article = {
  id: number;
  url: string;
  title: string | null;
  author: string | null;
  published_at: string | null;
  excerpt: string | null;
  content_html: string | null;
  summary_html: string | null;
  created_at: string;
  updated_at: string | null;
  // Media fields (mới)
  content_type?: "article" | "video" | "music" | "social";
  provider?: string | null;
  embed_html?: string | null;
  thumbnail_url?: string | null;
};
type ApiResp =
  | { status: "ok"; article: Article }
  | { status: "cached"; article: Article }
  | { error: string; detail?: string };

const API_BASE = import.meta.env.VITE_API_BASE?.toString() || "";
const fmt = (d?: string | null) => (!d ? "—" : new Date(d).toLocaleString());

type HistoryItem = {
  id: number;
  url: string;
  title: string;
  when: string;
  content_type?: string | null;
  provider?: string | null;
};

export default function Read() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  // load history từ danh sách mới /api/articles
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/articles?limit=20&sort=-id`, { credentials: "include" });
        const j = await r.json();
        if (j?.items) {
          setHistory(
            j.items.map((a: any) => ({
              id: a.id,
              url: `/articles/${a.id}`, // link sang trang chi tiết nội bộ
              title: a.title || a.excerpt || "(untitled)",
              when: a.created_at,
              content_type: a.content_type,
              provider: a.provider,
            }))
          );
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // prefill từ ?url=
  useEffect(() => {
    const q = new URL(location.href).searchParams.get("url");
    if (q) setUrl(q);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr(null);
    setArticle(null);
    const target = url.trim();
    if (!target) {
      setErr("Please paste a URL.");
      return;
    }
    setLoading(true);
    try {
      // 💡 DÙNG endpoint mới có nhánh media
      const r = await fetch(`${API_BASE}/api/articles/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: target }),
      });
      const j = (await r.json()) as ApiResp;
      if ("error" in j) {
        setErr(j.detail ? `${j.error}: ${j.detail}` : j.error);
        return;
      }

      const a = j.article;
      // Nếu là MEDIA → điều hướng sang trang chi tiết để hiển thị embed
      const isMedia = ["video", "music", "social"].includes(String(a.content_type || "article"));
      if (isMedia) {
        nav(`/articles/${a.id}`);
        return;
      }

      // Nếu là bài viết → giữ UI cũ (hiển thị summary inline)
      setArticle(a);

      // refresh history (dựa theo list mới)
      const r2 = await fetch(`${API_BASE}/api/articles?limit=20&sort=-id`, { credentials: "include" });
      const j2 = await r2.json();
      if (j2?.items) {
        setHistory(
          j2.items.map((b: any) => ({
            id: b.id,
            url: `/articles/${b.id}`,
            title: b.title || b.excerpt || "(untitled)",
            when: b.created_at,
            content_type: b.content_type,
            provider: b.provider,
          }))
        );
      }
    } catch (e: any) {
      setErr(e?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const shareText = useMemo(
    () => (article ? `Summary of "${article.title || "Article"}" via mdrdr` : ""),
    [article]
  );
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(null), 2500);
  };

  const copySummary = async () => {
    if (!summaryRef.current) return;
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([summaryRef.current.innerHTML], { type: "text/html" }),
      }),
    ]);
    notify("Summary copied");
  };
  const copyUrl = async () => {
    if (article?.url) {
      await navigator.clipboard.writeText(article.url);
      notify("URL copied");
    }
  };
  const share = async () => {
    if (!article) return;
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: article.title || "Article",
          text: shareText,
          url: article.url,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(article.url);
      notify("Link copied");
    }
  };

  const loadFromHistory = async (h: HistoryItem) => {
    // Lịch sử giờ link đến /articles/:id cho mọi loại (media/article)
    nav(h.url);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Left: form + article */}
      <section className="space-y-5">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <label className="mb-2 block text-sm text-zinc-700 dark:text-zinc-300">
            Paste a URL
          </label>
          <div className="flex gap-3">
            <input
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="https://www.youtube.com/watch?v=...  hoặc  https://medium.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Processing..." : "Summarize"}
            </button>
          </div>
          {err && (
            <div className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {err}
            </div>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            Bài viết sẽ được tóm tắt bằng AI. Link media (YouTube/Spotify/TikTok…) sẽ hiển thị
            nhúng và <b>không tốn AI</b>.
          </p>
        </form>

        {/* Nếu là bài viết: show summary inline */}
        {article ? (
          <article className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold leading-tight">
                {article.title || "Untitled"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <span>By {article.author || "Unknown"}</span>
                <span>•</span>
                <span>{fmt(article.published_at)}</span>
              </div>
            </div>

            <div
              ref={summaryRef}
              className="space-y-3 leading-relaxed [&_h1]:text-xl [&_h2]:text-lg [&_a]:text-indigo-600 [&_a:hover]:underline dark:[&_a]:text-indigo-400"
              dangerouslySetInnerHTML={{
                __html: article.summary_html || "<p>No AI summary.</p>",
              }}
            />

            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center rounded-lg border border-zinc-300 bg-white/70 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
                onClick={copySummary}
              >
                📋 Copy Summary
              </button>
              {article.url && (
                <a
                  className="inline-flex items-center rounded-lg border border-zinc-300 bg-white/70 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View original ↗
                </a>
              )}
              <button
                className="inline-flex items-center rounded-lg border border-zinc-300 bg-white/70 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
                onClick={copyUrl}
              >
                Copy URL
              </button>
            </div>
          </article>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            Paste a link above and click <b>Summarize</b> to get started.
          </div>
        )}
      </section>

      {/* Right: history */}
      <aside className="h-fit rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50 lg:sticky lg:top-6">
        <div className="mb-2 text-sm font-semibold">History</div>
        {history.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
            No history yet.
          </div>
        )}
        <ul className="space-y-1">
          {history.map((h) => (
            <li
              key={`${h.id}-${h.url}`}
              className="group flex items-start justify-between gap-3 rounded-xl px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
            >
              <a className="flex min-w-0 flex-col text-start" href={h.url} title={h.url}>
                <span className="truncate text-sm">{h.title}</span>
                <span className="truncate text-xs text-zinc-500 dark:text-zinc-500">
                  #{h.id} • {h.provider ? h.provider.toUpperCase() : "ARTICLE"} • {fmt(h.when)}
                </span>
              </a>
              <a
                className="rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                href={h.url}
                target="_blank"
                rel="noreferrer"
              >
                ↗
              </a>
            </li>
          ))}
        </ul>
      </aside>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-zinc-300 bg-white/90 px-4 py-2 text-sm text-zinc-800 shadow-lg dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100">
          {toast}
        </div>
      )}
    </div>
  );
}
