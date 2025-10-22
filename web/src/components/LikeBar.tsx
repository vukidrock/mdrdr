import { useEffect, useState } from "react";
import { api } from "../api";

type LikeResp = {
  ok: true;
  count: number;
  likers: { id: number; display_name: string; avatar_url?: string }[];
  liked_by_me: boolean;
};

export default function LikeBar({ articleId }:{ articleId:number }) {
  const [data, setData] = useState<LikeResp | null>(null);
  const load = () => api<LikeResp>(`/api/articles/${articleId}/likes`).then(setData).catch(()=>setData(null));
  useEffect(load, [articleId]);

  const toggle = async ()=>{
    if (!data) return;
    try {
      const method = data.liked_by_me ? "DELETE" : "POST";
      const r = await api<LikeResp>(`/api/articles/${articleId}/like`, { method });
      setData(r);
    } catch (e:any) {
      if (String(e?.message||"").includes("401")) alert("Hãy đăng nhập để like.");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        className={`px-3 py-1 rounded-2xl border hover:shadow ${data?.liked_by_me ? "bg-black text-white" : ""}`}>
        👍 {data?.liked_by_me ? "Đã like" : "Like"} {data?.count ?? 0}
      </button>
      <div className="flex -space-x-2">
        {data?.likers?.map(u=>(
          <img key={u.id} src={u.avatar_url} title={u.display_name}
               className="w-6 h-6 rounded-full ring-2 ring-white object-cover" />
        ))}
      </div>
    </div>
  );
}
