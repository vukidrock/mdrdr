// web/src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { getMe, logout } from "../lib/auth";
import AuthButtons from "../components/AuthButtons";

type Me = { id: number; display_name: string | null; avatar_url: string | null; email?: string | null };

export default function Profile() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getMe()
      .then((r) => setMe(r.user))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const onLogout = async () => {
    try {
      await logout();
      // sau khi logout, reload để cập nhật TopBar / state
      location.href = "/";
    } catch (e) {
      alert("Logout failed");
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-6 w-40 rounded bg-zinc-200/70 dark:bg-zinc-800/60 mb-4" />
        <div className="h-20 w-full rounded bg-zinc-200/70 dark:bg-zinc-800/60" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/40 dark:bg-red-950/40">
          Error: {err}
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Sign in</h1>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Bạn cần đăng nhập để xem hồ sơ, quản lý like / bookmark / bình luận.
        </p>
        <AuthButtons />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Your profile</h1>

      <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-center gap-4">
          {me.avatar_url ? (
            <img
              src={me.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-xl font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              {me.display_name?.[0]?.toUpperCase() || "U"}
            </span>
          )}
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate">{me.display_name || "User"}</div>
            {me.email ? <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{me.email}</div> : null}
            <div className="mt-3">
              <button
                onClick={onLogout}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* chỗ này để sau bổ sung: danh sách bookmarks, comments… */}
      <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        Sắp có: bookmarks, bình luận, thiết lập tài khoản…
      </div>
    </div>
  );
}
