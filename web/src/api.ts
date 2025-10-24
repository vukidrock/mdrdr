const API_BASE = import.meta.env.VITE_API_BASE?.toString() || "";
export async function api<T>(path:string, init?:RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
  if (!res.ok) throw new Error(`API ${path} ${res.status}`);
  return res.json() as Promise<T>;
}
export async function getMe() {
  return api<{ok:true,user:null|{id:number,display_name:string,avatar_url?:string}}>("/api/me");
}
export { API_BASE };
