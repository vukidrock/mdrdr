-- Tạo extension vector (nếu chưa có)
CREATE EXTENSION IF NOT EXISTS vector;

-- Bảng articles
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  medium_url TEXT UNIQUE NOT NULL,
  title TEXT,
  author TEXT,
  published_at TIMESTAMP,
  excerpt TEXT,
  content_html TEXT,
  content_hash TEXT,
  summary_html TEXT,
  keywords TEXT[],
  embedding vector(1536),
  source_used TEXT DEFAULT 'unknown',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Hàm trigger để auto update cột updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger (nếu chưa có)
DROP TRIGGER IF EXISTS set_timestamp ON articles;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON articles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
