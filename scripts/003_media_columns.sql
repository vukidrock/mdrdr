ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_id TEXT,
  ADD COLUMN IF NOT EXISTS original_url TEXT,
  ADD COLUMN IF NOT EXISTS embed_html TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INT,
  ADD COLUMN IF NOT EXISTS media_width INT,
  ADD COLUMN IF NOT EXISTS media_height INT,
  ADD COLUMN IF NOT EXISTS extra JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_articles_content_type ON articles(content_type);
CREATE INDEX IF NOT EXISTS idx_articles_provider ON articles(provider);
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_provider_id ON articles(provider, provider_id);
