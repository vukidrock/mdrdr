// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import ArticlesPage from "./pages/ArticlesPage";
import EditArticlePage from "./pages/EditArticlePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/articles" replace />} />
      <Route path="/articles" element={<ArticlesPage />} />
      <Route path="/articles/:id/edit" element={<EditArticlePage />} />
      <Route path="/articles/new" element={<EditArticlePage />} />
    </Routes>
  );
}
