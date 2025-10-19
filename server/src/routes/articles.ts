// routes/articles.ts
import { Router } from "express";
import { listArticles } from "../services/fetchArticle.js";
const r = Router();

r.get("/", async (req, res) => {
  // ... tính page/limit/q/sort
  // res.json({ items, total })
});

export default r;
