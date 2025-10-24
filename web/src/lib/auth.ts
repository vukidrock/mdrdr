// web/src/lib/auth.ts
export type MeResp = {
  ok: boolean;
  user: null | {
    id: number;
    display_name: string | null;
    avatar_url: string | null;
    email?: string | null;
  };
};

const API_BASE = import.meta.env.VITE_API_BASE?.toString() || ""; // same-origin

export async function getMe(): Promise<MeResp> {
  const r = await fetch(`${API_BASE}/api/auth/me`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export async function logout(): Promise<void> {
  const r = await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
}
