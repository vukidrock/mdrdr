// web/src/components/TopBar.tsx
import { useEffect, useState } from "react";
import { getMe } from "../lib/auth";
import AuthButtons from "./AuthButtons";

type Me = { id: number; display_name: string | null; avatar_url: string | null };

export default function TopBar() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    getMe().then((r) => setMe(r.user)).catch(() => setMe(null));
  }, []);

  return (
    <div className="flex items-center gap-3">
      {me ? (
        <div
          className="flex items-center gap-2 rounded-xl border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 cursor-pointer"
          title={me.display_name || "Profile"}
          onClick={() => (window.location.href = "/profile")}
        >
          {me.avatar_url ? (
            <img
              src={me.avatar_url}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              {me.display_name?.[0]?.toUpperCase() || "U"}
            </span>
          )}
          <span className="max-w-[10rem] truncate">
            {me.display_name || "User"}
          </span>
        </div>
      ) : (
        <AuthButtons />
      )}
    </div>
  );
}
