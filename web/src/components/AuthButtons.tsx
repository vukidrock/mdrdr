// web/src/components/AuthButtons.tsx
export default function AuthButtons() {
  return (
    <div className="flex items-center gap-2">
      <a
        href="/api/auth/google"
        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Continue with Google
      </a>
      <a
        href="/api/auth/facebook"
        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Continue with Facebook
      </a>
    </div>
  );
}
