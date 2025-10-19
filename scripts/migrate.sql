-- =====================================================================
-- MDRDR - migrate.sql (CLEAN, idempotent, no medium_url)
-- Works with: keywords TEXT[] ; embedding VECTOR(1536)
-- =====================================================================

SET client_min_messages = WARNING;

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 1) Base table (no medium_url)
CREATE TABLE IF NOT EXISTS public.articles (
  id            BIGSERIAL PRIMARY KEY,
  url           TEXT,
  title         TEXT,
  author        TEXT,
  published_at  TIMESTAMPTZ,
  content_html  TEXT,
  content_hash  TEXT,
  summary_html  TEXT,
  keywords      TEXT[],          -- giữ TEXT[] để hợp với code hiện tại ($9::text[])
  embedding     VECTOR(1536),
  views         INTEGER NOT NULL DEFAULT 0,
  likes         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  excerpt       TEXT,
  source_used   TEXT DEFAULT 'medium'
);

-- 2) Bring older schemas up-to-date (safe adds / defaults)
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS url           TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS title         TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS author        TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS published_at  TIMESTAMPTZ;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS content_html  TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS content_hash  TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS summary_html  TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS keywords      TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS embedding     VECTOR(1536);
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS views         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS likes         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS excerpt       TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_used   TEXT DEFAULT 'medium';

-- 3) Dọn rác cũ liên quan medium_url (nếu từng tồn tại)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='articles' AND column_name='medium_url'
  ) THEN
    ALTER TABLE public.articles DROP COLUMN IF EXISTS medium_url;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_sync_medium_url') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_medium_url ON public.articles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='sync_medium_url') THEN
    EXECUTE 'DROP FUNCTION IF EXISTS public.sync_medium_url()';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_articles_medium_url' AND n.nspname='public'
  ) THEN
    DROP INDEX IF EXISTS public.idx_articles_medium_url;
  END IF;
END$$;

-- 4) Touch updated_at on UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_articles_updated_at ON public.articles;
CREATE TRIGGER trg_articles_updated_at
BEFORE UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 5) Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_url         ON public.articles (url);
CREATE INDEX        IF NOT EXISTS idx_articles_created_at  ON public.articles (created_at DESC);
CREATE INDEX        IF NOT EXISTS idx_articles_likes       ON public.articles (likes DESC, id DESC);

-- Vector index (đúng opclass)
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_articles_embedding
    ON public.articles
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists=100);
EXCEPTION WHEN OTHERS THEN
  -- (fallback cho phiên bản pgvector không hỗ trợ IF NOT EXISTS với ivfflat)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_articles_embedding' AND n.nspname='public'
  ) THEN
    EXECUTE 'CREATE INDEX idx_articles_embedding ON public.articles USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)';
  END IF;
END$$;

-- 6) Likes table
CREATE TABLE IF NOT EXISTS public.article_likes (
  id          bigserial PRIMARY KEY,
  article_id  bigint NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  client_id   text   NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_article_likes_article ON public.article_likes(article_id);
CREATE INDEX IF NOT EXISTS idx_article_likes_client  ON public.article_likes(client_id);

-- =====================================================================
-- End
-- =====================================================================
