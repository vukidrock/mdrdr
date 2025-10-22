import { useEffect, useState } from "react";

type HistoryItem = {
  id: number;
  url: string;
  title: string;
  author?: string;
  created_at?: string;
  published_at?: string | null;
};

const API_BASE =
  import.meta.env.VITE_API_BASE?.toString() || "";

function fmt(d?: string | null) {
  if (!d) return "—";
  const t = new Date(d);
  return Number.isFinite(t.getTime()) ? t.toLocaleString() : "—";
}

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        // 1) Try the paginated API
        const r = await fetch(
          `${API_BASE}/api/articles?page=1&limit=100&sort=-created_at`
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();

        // j => { items, total }
        const raw = Array.isArray(j?.items) ? j.items : [];
        const normalized: HistoryItem[] = raw.map((a: any) => ({
          id: a.id,
          url: a.url,
          title: a.title || a.excerpt || "(untitled)",
          author: a.author,
          created_at: a.created_at,
          published_at: a.published_at,
        }));

        if (!aborted) setItems(normalized);
      } catch {
        // 2) Fallback legacy API
        try {
          const r2 = await fetch(`${API_BASE}/api/article`);
          if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
          const j2 = await r2.json();
          const raw = Array.isArray(j2?.articles) ? j2.articles : [];
          const normalized: HistoryItem[] = raw.map((a: any) => ({
            id: a.id,
            url: a.url,
            title: a.title || a.excerpt || "(untitled)",
            author: a.author,
            created_at: a.created_at,
            published_at: a.published_at,
          }));
          if (!aborted) setItems(normalized);
        } catch (e: any) {
          if (!aborted) setErr(e?.message || "Failed to load history");
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    load();
    return () => {
      aborted = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
        {err}
      </div>
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
        No history yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-3 text-sm font-semibold">History</div>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {items.map((h) => (
          <li key={`${h.id}-${h.url}`} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {h.title || "(untitled)"}
                </div>
                <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {new URL(h.url).hostname}
                  {" • "}Author: {h.author || "Unknown"}
                  {" • "}Published: {fmt(h.published_at)}
                </div>
              </div>
              <a
                className="shrink-0 rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                href={h.url}
                target="_blank"
                rel="noreferrer"
                title={h.url}
              >
                ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
