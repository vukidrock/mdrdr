-- scripts/004_comments_and_votes.sql
-- Compatible with existing comments.id BIGINT
BEGIN;

-- 1) Ensure columns exist on comments (id is assumed BIGINT already)
-- parent_id: BIGINT nullable, FK -> comments(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='comments' AND column_name='parent_id'
  ) THEN
    ALTER TABLE comments
      ADD COLUMN parent_id BIGINT NULL;
  END IF;
END$$;

-- user_id: BIGINT (we'll try to add FK to users later)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='comments' AND column_name='user_id'
  ) THEN
    ALTER TABLE comments
      ADD COLUMN user_id BIGINT NULL; -- set NULL first to avoid failing if backfilling is needed
  END IF;
END$$;

-- body
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='comments' AND column_name='body'
  ) THEN
    ALTER TABLE comments
      ADD COLUMN body TEXT;
  END IF;
END$$;

-- score_cached
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='comments' AND column_name='score_cached'
  ) THEN
    ALTER TABLE comments
      ADD COLUMN score_cached INTEGER NOT NULL DEFAULT 0;
  END IF;
END$$;

-- is_deleted
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='comments' AND column_name='is_deleted'
  ) THEN
    ALTER TABLE comments
      ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END$$;

-- created_at / updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='comments' AND column_name='created_at'
  ) THEN
    ALTER TABLE comments
      ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='comments' AND column_name='updated_at'
  ) THEN
    ALTER TABLE comments
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END$$;

-- Basic constraints
ALTER TABLE comments
  ALTER COLUMN body SET NOT NULL,
  ALTER COLUMN is_deleted SET NOT NULL,
  ALTER COLUMN score_cached SET NOT NULL;

-- FK parent_id -> comments(id) (BIGINT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='comments_parent_id_fkey'
  ) THEN
    ALTER TABLE comments
      ADD CONSTRAINT comments_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Try add FK user_id -> users(id); if types mismatch, skip (kept nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='comments_user_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE comments
        ADD CONSTRAINT comments_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
      -- If we reach here, also set NOT NULL for user_id
      ALTER TABLE comments ALTER COLUMN user_id SET NOT NULL;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skip adding FK to users(id) due to type mismatch. You can add later if desired.';
    END;
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id);
CREATE INDEX IF NOT EXISTS idx_comments_article_parent ON comments(article_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_article_created ON comments(article_id, created_at DESC);

-- 2) comment_votes table (BIGINT keys)
CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id  BIGINT NOT NULL,
  user_id     BIGINT NOT NULL,
  value       SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

-- FK comment_id -> comments(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='comment_votes_comment_id_fkey'
  ) THEN
    ALTER TABLE comment_votes
      ADD CONSTRAINT comment_votes_comment_id_fkey
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Try FK user_id -> users(id); skip if mismatched
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='comment_votes_user_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE comment_votes
        ADD CONSTRAINT comment_votes_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skip adding FK from comment_votes.user_id to users(id) due to type mismatch.';
    END;
  END IF;
END$$;

-- 3) Trigger: update score_cached when votes change
CREATE OR REPLACE FUNCTION update_comment_score_cached() RETURNS TRIGGER AS $$
BEGIN
  UPDATE comments c
     SET score_cached = COALESCE((
       SELECT SUM(value)::int FROM comment_votes WHERE comment_id = c.id
     ), 0)
   WHERE c.id = COALESCE(NEW.comment_id, OLD.comment_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_comment_score ON comment_votes;
CREATE TRIGGER trg_update_comment_score
AFTER INSERT OR UPDATE OR DELETE ON comment_votes
FOR EACH ROW EXECUTE FUNCTION update_comment_score_cached();

-- 4) Trigger: touch updated_at on edit/delete
CREATE OR REPLACE FUNCTION touch_comment_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_comment ON comments;
CREATE TRIGGER trg_touch_comment
BEFORE UPDATE OF body, is_deleted ON comments
FOR EACH ROW EXECUTE FUNCTION touch_comment_updated_at();

COMMIT;
