import { useEffect, useState } from "react";
import { API_BASE, getMe } from "../api";

export default function AuthBar() {
  const [me, setMe] = useState<any>(undefined);
  useEffect(()=>{ getMe().then(r=>setMe(r.user)).catch(()=>setMe(null)); },[]);
  if (me === undefined) return null;
  if (!me) return (
    <div className="flex gap-2">
      <a className="px-3 py-1 rounded-2xl border" href={`${API_BASE}/api/auth/google`}>Login Google</a>
      <a className="px-3 py-1 rounded-2xl border" href={`${API_BASE}/api/auth/facebook`}>Facebook</a>
    </div>
  );
  return (
    <div className="flex items-center gap-2">
      {me.avatar_url && <img src={me.avatar_url} className="w-8 h-8 rounded-full" />}
      <span className="font-medium">{me.display_name}</span>
    </div>
  );
}
