// web/src/pages/ArticleView.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getArticle, like, unlike } from "../lib/api";

type Article = {
  id: number;
  url?: string | null;
  medium_url?: string | null;
  title: string | null;
  author: string | null;
  published_at: string | null;
  summary_html: string | null;
  content_html: string | null;
  created_at: string;
  updated_at?: string | null;
  likes: number;
  liked?: boolean;
};

function timeFull(d?: string | null) {
  return d ? new Date(d).toLocaleString() : "";
}

function getDomain(u?: string | null): string {
  if (!u) return "";
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function ArticleView() {
  const { id } = useParams();
  const [data, setData] = useState<Article | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const domain = useMemo(() => getDomain(data?.url || data?.medium_url), [data]);
  const ico = domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : "";

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    getArticle(Number(id))
      .then((a) => {
        setData(a);
        if (a?.title) document.title = a.title + " – mdrdr";
      })
      .catch((e: any) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

const onToggleLike = async () => {
  if (!data) return;
  try {
    const r = data.liked ? await unlike(data.id) : await like(data.id);
    setData(prev => prev ? { ...prev, liked: r.liked, likes: r.likes } : prev);
  } catch (e) {
    console.error(e);
    alert("Toggle like failed");
  }
};

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="mb-3 h-5 w-24 rounded bg-zinc-200/70 dark:bg-zinc-800/60" />
        <div className="mb-2 h-8 w-3/4 rounded bg-zinc-200/70 dark:bg-zinc-800/60" />
        <div className="mb-6 h-4 w-1/2 rounded bg-zinc-200/70 dark:bg-zinc-800/60" />
        <div className="mb-3 h-24 w-full rounded bg-zinc-200/60 dark:bg-zinc-800/40" />
        <div className="h-56 w-full rounded bg-zinc-200/60 dark:bg-zinc-800/40" />
      </div>
    );
  }
  if (err) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <Link to="/articles" className="text-sm underline">← Back to list</Link>
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/40 dark:bg-red-950/40">
          Error: {err}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const liked = !!data.liked;

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Back + actions */}
      <div className="mb-3 flex items-center justify-between">
        <Link to="/articles" className="text-sm underline">← Back to list</Link>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLike}
            className={[
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition",
              liked
                ? "bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800"
                : "border border-red-500 text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-900/20",
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
            <span className="tabular-nums">{data.likes ?? 0}</span>
          </button>
          {data.url || data.medium_url ? (
            <a
              href={data.url || data.medium_url || "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              title="Open source"
            >
              🔗 Open source
            </a>
          ) : null}
        </div>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold leading-tight tracking-tight mb-2">
        {data.title || "(untitled)"}
      </h1>

      {/* Meta row */}
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
        {(() => {
          const d = domain;
          return d ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              title={data.url || data.medium_url || ""}
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
              {d}
            </span>
          ) : null;
        })()}
        {data.author && <span>by <b>{data.author}</b></span>}
        {data.published_at && <span>· {new Date(data.published_at).toLocaleDateString()}</span>}
        {data.updated_at && <span className="opacity-70">· updated {timeFull(data.updated_at)}</span>}
      </div>

      {/* Summary */}
      {data.summary_html && (
        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="text-xl font-semibold mb-2">Summary</h2>
          <div
            className="prose max-w-none prose-zinc dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: data.summary_html || "" }}
          />
        </section>
      )}

      {/* Full content */}
      {data.content_html ? (
        <section>
          <h2 className="text-xl font-semibold mb-3">Full article</h2>
          <div
            className="prose max-w-none prose-zinc dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: data.content_html || "" }}
          />
        </section>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
          Không có nội dung đầy đủ. Bạn có thể mở nguồn để đọc chi tiết hơn.
        </div>
      )}
    </div>
  );
}
