// web/src/components/LikeBar.tsx
import { useEffect, useState } from "react";
import { getLikes, like, unlike, ApiError } from "../lib/api";
import { toast } from "react-hot-toast";

type Liker = { id: number | string; display_name: string; avatar_url?: string | null };
type LikeResp = {
  ok: true;
  count: number;
  likers: Liker[];
  liked_by_me: boolean;
};

export default function LikeBar({ articleId }: { articleId: number }) {
  const [data, setData] = useState<LikeResp | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const r = await getLikes(articleId);
      setData(r);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  const onToggle = async () => {
    if (!data || loading) return;
    try {
      const r = data.liked_by_me ? await unlike(articleId) : await like(articleId);
      // Map response like/unlike về shape của getLikes()
      setData({
        ok: true,
        count: r.likes,
        likers: (r as any).likers ?? data.likers, // BE đã trả likers; fallback nếu thiếu
        liked_by_me: r.liked,
      });
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) {
        toast("Vui lòng đăng nhập để thả tim bài viết này ❤️", {
          icon: "🔒",
          duration: 2800,
        });
        return;
      }
      console.error(e);
      toast.error("Không thể xử lý like. Vui lòng thử lại sau!");
    }
  };

  const btnLabel = data?.liked_by_me ? "Đã like" : "Like";
  const count = data?.count ?? 0;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToggle}
        disabled={loading}
        className={[
          "px-3 py-1 rounded-2xl border hover:shadow transition",
          data?.liked_by_me ? "bg-black text-white border-black" : "border-zinc-300",
          loading ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        👍 {btnLabel} {count}
      </button>

      {/* Avatar stack */}
      <div className="flex -space-x-2">
        {data?.likers?.map((u) => {
          const title = u.display_name || "—";
          const src =
            u.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&size=40&background=random`;
          return (
            <img
              key={String(u.id)}
              src={src}
              title={title}
              className="w-6 h-6 rounded-full ring-2 ring-white object-cover"
              loading="lazy"
              onError={(ev) => {
                (ev.currentTarget as HTMLImageElement).src =
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&size=40`;
              }}
              alt={title}
            />
          );
        })}
      </div>
    </div>
  );
}
