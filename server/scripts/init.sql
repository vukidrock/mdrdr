-- Bảng lưu bài viết Medium đã fetch + tóm tắt
CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title TEXT,
    author TEXT,
    content_html TEXT,
    summary_html TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index để tìm kiếm nhanh theo URL
CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
