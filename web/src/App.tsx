import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, Outlet } from "react-router-dom";
import Read from "./pages/Read";
import ArticlesList from "./pages/ArticlesList";
import ArticleView from "./pages/ArticleView";
import TopBar from "./components/TopBar";
import Privacy from "./pages/Privacy";
import Deletion from "./pages/Deletion";
import Profile from "./pages/Profile";
import ToastProvider from "./components/ToastProvider";

function Shell() {
  // anti-flash đã lo ở index.html; đây chỉ sync toggle khi người dùng bấm
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    document.title = "mdrdr";
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("mdrdr.dark", dark ? "1" : "0");
  }, [dark]);

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <ToastProvider />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:border-zinc-800 dark:bg-black/60 dark:supports-[backdrop-filter]:bg-black/40">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="text-xl font-bold tracking-tight">mdrdr</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              AI Summarizer
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link className="text-sm hover:underline" to="/">Read</Link>
            <Link className="text-sm hover:underline" to="/articles">Articles</Link>
            <button
              onClick={() => setDark(d => !d)}
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white/70 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
            >
              {dark ? "🌙 Dark" : "☀️ Light"}
            </button>
	    <TopBar />
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/60">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          © {new Date().getFullYear()} mdrdr — Medium Reader & AI Summarizer
        </div>
	<div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
	<a href="/privacy" className="text-sm opacity-80 hover:opacity-100">Privacy</a>
	<span> · </span> 
	<a href="/privacy/deletion" className="text-sm opacity-80 hover:opacity-100">Data Deletion</a>
	</div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Read />} />
            <Route path="/articles" element={<ArticlesList />} />
            <Route path="/articles/:id" element={<ArticleView />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/privacy/deletion" element={<Deletion />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
