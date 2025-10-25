import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { getArticle, like, unlike } from "../lib/api";
import EmbedHTML from "../components/EmbedHTML";
import Comments from "../components/comments/Comments";

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
  content_type?: "article" | "video" | "music" | "social";
  provider?: string | null;
  embed_html?: string | null;
  thumbnail_url?: string | null;
};

type LikesResp = {
  ok: true;
  count: number;
  likers: { id: number; display_name: string; avatar_url?: string }[];
  liked_by_me: boolean;
};

function getDomain(u?: string | null): string {
  if (!u) return "";
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

export default function ArticleView() {
  const { id } = useParams();
  const [data, setData] = useState<Article | null>(null);
  const [likesBox, setLikesBox] = useState<LikesResp | null>(null);
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

  useEffect(() => {
    if (!id) return;
    fetch(`${(import.meta as any).env?.VITE_API_BASE || ""}/api/articles/${id}/likes`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((r) => setLikesBox(r))
      .catch(() => setLikesBox(null));
  }, [id]);

  const onToggleLike = async () => {
    if (!data) return;
    try {
      const r = data.liked ? await unlike(data.id) : await like(data.id);
      setData((prev) => (prev ? { ...prev, liked: r.liked, likes: r.likes } : prev));
      const fresh = await fetch(`${(import.meta as any).env?.VITE_API_BASE || ""}/api/articles/${data.id}/likes`, { credentials: "include" }).then(r=>r.json());
      setLikesBox(fresh);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("401")) {
        toast("Vui lòng đăng nhập để thả tim bài viết này ❤️", { icon: "🔒", duration: 2500 });
      } else {
        console.error(e);
        toast.error("Không thể xử lý like. Thử lại sau!");
      }
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto p-4">Đang tải…</div>;
  if (err) return (
    <div className="max-w-3xl mx-auto p-4">
      <Link to="/articles" className="text-sm underline">← Back to list</Link>
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        Error: {err}
      </div>
    </div>
  );
  if (!data) return null;

  const isMedia = ["video","music","social"].includes(String(data.content_type || "article"));
  const liked = !!(likesBox ? likesBox.liked_by_me : data.liked);

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Back + actions */}
      <div className="mb-3 flex items-center justify-between">
        <Link to="/articles" className="text-sm underline">← Back to list</Link>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleLike}
            className={[
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition",
              liked
                ? "bg-black text-white border border-black/80"
                : "border border-zinc-400 text-zinc-800 hover:bg-zinc-50",
            ].join(" ")}
            title={liked ? "Unlike" : "Like"}
          >
            ❤️ <span className="tabular-nums">{likesBox?.count ?? data.likes ?? 0}</span>
          </button>
          {(data.url || data.medium_url) && (
            <a
              href={data.url || data.medium_url || "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
              title="Open source"
            >
              🔗 Open source
            </a>
          )}
        </div>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold leading-tight tracking-tight mb-2">
        {data.title || (isMedia ? "Media" : "(untitled)")}
      </h1>

      {/* Meta row */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        {domain && (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium">
            {ico ? <img src={ico} alt="" width={14} height={14} onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none';}} /> : null}
            {domain}
          </span>
        )}
        {data.provider && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px]">{data.provider.toUpperCase()}</span>}
        {data.author && <span>by <b>{data.author}</b></span>}
        {data.published_at && <span>· {new Date(data.published_at).toLocaleDateString()}</span>}
      </div>

      {/* SUMMARY */}
      {data.summary_html && (
        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white/70 p-4">
          <h2 className="text-xl font-semibold mb-2">Summary</h2>
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: data.summary_html || "" }}
          />
        </section>
      )}

      {/* BODY */}
      {isMedia && data.embed_html ? (
        <section className="mb-8">
          <EmbedHTML html={data.embed_html} />
        </section>
      ) : data.content_html ? (
        <section>
          <h2 className="text-xl font-semibold mb-3">Full article</h2>
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: data.content_html || "" }} />
        </section>
      ) : (
        <div className="rounded-xl border bg-zinc-50 p-4 text-sm text-zinc-600">
          Không có nội dung để hiển thị tại đây.
          {data.url ? <> Bạn có thể <a className="underline" href={data.url} target="_blank" rel="noreferrer">mở nguồn gốc</a> để xem chi tiết.</> : null}
        </div>
      )}

      {/* ✅ Separator mượt trước Comments */}
      <div className="my-10 h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent" />

      {/* ✅ COMMENTS */}
      <section className="mt-6">
        <Comments articleId={String(data.id)} />
      </section>
    </div>
  );
}
