import { Router } from 'express';
import tagsRouter from './tags.routes.js';
import relatedRouter from './related.routes.js';
import articlesByTagRouter from './articles-by-tag.routes.js';

const api = Router();

// Ví dụ: api.use('/articles', existingArticlesRouter);

api.use('/tags', tagsRouter);                 // /api/tags ...
api.use('/articles', articlesByTagRouter);    // /api/articles/by-tag
api.use('/articles', relatedRouter);          // /api/articles/:id/related

export default api;
