import { useEffect, useState } from "react";
import { api, getMe } from "../api";

export default function Comments({ articleId }:{articleId:number}) {
  const [me,setMe] = useState<any>(null);
  const [roots,setRoots] = useState<any[]>([]);
  const [text,setText] = useState("");

  useEffect(()=>{
    getMe().then(r=>setMe(r.user));
    api(`/api/articles/${articleId}/comments`).then((r:any)=>setRoots(r.items));
  },[articleId]);

  const post = async ()=>{
    if (!me) return alert("Hãy đăng nhập để bình luận.");
    if (!text.trim()) return;
    const r:any = await api(`/api/articles/${articleId}/comments`, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ content:text })
    });
    setText("");
    setRoots([{...r.item, display_name:me.display_name, avatar_url:me.avatar_url}, ...roots]);
  };

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-3">Bình luận</h3>
      <div className="flex gap-2">
        {me?.avatar_url && <img src={me.avatar_url} className="w-9 h-9 rounded-full" />}
        <div className="flex-1">
          <textarea value={text} onChange={e=>setText(e.target.value)}
            placeholder="Viết bình luận của bạn…" rows={3}
            className="w-full rounded-2xl border p-3 focus:outline-none focus:ring" />
          <div className="flex justify-end mt-2">
            <button onClick={post} className="px-4 py-2 rounded-2xl bg-black text-white hover:opacity-90">Gửi</button>
          </div>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {roots.map(c => <CommentItem key={c.id} articleId={articleId} comment={c} />)}
      </div>
    </div>
  );
}

function CommentItem({ articleId, comment }:{articleId:number, comment:any}) {
  const [replies,setReplies] = useState<any[]|null>(null);
  const [open,setOpen] = useState(false);
  const [replyText,setReplyText] = useState("");

  const load = async ()=> {
    if (!open) {
      const r:any = await api(`/api/articles/${articleId}/comments?parent_id=${comment.id}`);
      setReplies(r.items);
    }
    setOpen(!open);
  };

  const sendReply = async ()=>{
    if (!replyText.trim()) return;
    const r:any = await api(`/api/articles/${articleId}/comments`, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ content: replyText, parent_id: comment.id })
    });
    setReplyText("");
    setReplies([{...r.item}, ...(replies||[])]);
    if (!open) setOpen(true);
  };

  return (
    <div className="flex gap-3">
      {comment.avatar_url && <img src={comment.avatar_url} className="w-9 h-9 rounded-full" />}
      <div className="flex-1">
        <div className="bg-gray-50 border rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{comment.display_name}</span>
            <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
          </div>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{__html: comment.content}} />
        </div>
        <div className="flex gap-4 mt-2 text-sm">
          <button className="hover:underline" onClick={load}>{open ? "Ẩn phản hồi" : "Xem phản hồi"}</button>
          <div className="flex gap-2">
            <input className="flex-1 border rounded-xl p-2" value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Viết phản hồi…" />
            <button onClick={sendReply} className="px-3 py-1 rounded-xl border">Gửi</button>
          </div>
        </div>
        {open && replies && (
          <div className="mt-3 space-y-3 pl-6 border-l">
            {replies.map(r=>(
              <div key={r.id} className="flex gap-3">
                {r.avatar_url && <img src={r.avatar_url} className="w-7 h-7 rounded-full" />}
                <div className="flex-1">
                  <div className="bg-white border rounded-2xl p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{r.display_name}</span>
                      <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-sm" dangerouslySetInnerHTML={{__html:r.content}} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
