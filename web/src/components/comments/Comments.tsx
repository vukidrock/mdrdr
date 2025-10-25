// web/src/components/comments/Comments.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import SortBar, { SortKey } from "./SortBar";
import CommentForm from "./CommentForm";
import CommentItem from "./CommentItem";
import type { Comment, ReplyTotal } from "../../types/comment";

type ApiList = {
  items: Comment[];
  replies: Comment[];
  reply_totals: ReplyTotal[];
  page: number;
  limit: number;
  total_root: number;
  has_more: boolean;
  root_reply_limit: number;
};

export default function Comments({ articleId }:{ articleId:string }) {
  const [sort, setSort] = useState<SortKey>("top");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiList|null>(null);
  const [replyTo, setReplyTo] = useState<Comment|null>(null);
  const loading = useRef(false);

  async function fetchPage(p=1, s=sort) {
    if (loading.current) return;
    loading.current = true;
    try {
      const r = await fetch(`/api/articles/${articleId}/comments?sort=${s}&page=${p}&limit=20`);
      const j:ApiList = await r.json();
      setData(j);
      setPage(p);
    } finally {
      loading.current = false;
    }
  }

  useEffect(()=>{ fetchPage(1, sort); }, [sort, articleId]);

  const replyMap = useMemo(()=>{
    const map = new Map<string, Comment[]>();
    (data?.replies || []).forEach(r => {
      const arr = map.get(r.parent_id!) || [];
      arr.push(r);
      map.set(r.parent_id!, arr);
    });
    return map;
  }, [data]);

  const replyCountMap = useMemo(()=>{
    const m = new Map<string, number>();
    (data?.reply_totals || []).forEach(x => m.set(x.parent_id, x.total));
    return m;
  }, [data]);

  async function createComment(body:string) {
    await fetch(`/api/articles/${articleId}/comments`, {
      method:"POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ body, parent_id: replyTo?.id ?? null })
    });
    setReplyTo(null);
    await fetchPage(page, sort);
  }

  async function vote(commentId:string, v:-1|0|1) {
    await fetch(`/api/comments/${commentId}/vote`, {
      method:"POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ value: v })
    });
    await fetchPage(page, sort);
  }

  async function loadMoreReplies(parentId: string) {
    const current = replyMap.get(parentId) || [];
    const last = current[current.length - 1];
    const cursor = last?.created_at ? `&cursor=${encodeURIComponent(last.created_at)}` : "";
    const r = await fetch(`/api/comments/${parentId}/replies?limit=20${cursor}`);
    const j = await r.json();
    setData(prev => {
      if (!prev) return prev;
      const more: Comment[] = j.items || [];
      const next = { ...prev };
      next.replies = [...prev.replies, ...more];
      return next;
    });
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          Bình luận
          {/* ✅ badge số lượng */}
          {typeof data?.total_root === "number" && (
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] text-zinc-700">
              {data.total_root}
            </span>
          )}
        </h3>
        <SortBar value={sort} onChange={setSort}/>
      </div>

      <div className="mb-4">
        <CommentForm onSubmit={createComment}/>
      </div>

      {!data ? <div>Đang tải...</div> : (
        <div className="space-y-6">
          {data.items.map(root => {
            const children = replyMap.get(root.id) || [];
            const total = replyCountMap.get(root.id) || 0;
            const canLoadMore = total > children.length;
            return (
              <div key={root.id} className="space-y-3">
                <CommentItem c={root} onReply={setReplyTo} onVote={vote}/>
                {children.map(rep => (
                  <div key={rep.id} className="pl-10">
                    <CommentItem c={rep} onReply={setReplyTo} onVote={vote}/>
                  </div>
                ))}
                {canLoadMore && (
                  <div className="pl-10">
                    <button
                      onClick={() => loadMoreReplies(root.id)}
                      className="text-sm px-3 py-1 rounded-lg border hover:bg-gray-50"
                    >
                      Xem thêm trả lời ({total - children.length} còn lại)
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {data.has_more && (
            <div className="pt-2">
              <button
                onClick={()=>fetchPage(page+1, sort)}
                className="px-3 py-1 rounded-lg border hover:bg-gray-50"
              >
                Tải thêm
              </button>
            </div>
          )}
        </div>
      )}

      {replyTo && (
        <div className="mt-6 border-t pt-4">
          <div className="mb-2 text-sm text-gray-600">
            Trả lời <span className="font-medium">{replyTo.display_name || "User"}</span>
          </div>
          <CommentForm placeholder="Viết phản hồi..." onSubmit={createComment} onCancel={()=>setReplyTo(null)} />
        </div>
      )}
    </div>
  );
}
