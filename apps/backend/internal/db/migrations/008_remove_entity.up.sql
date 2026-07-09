-- 008_remove_entity.up.sql
-- Phase 1 of the SaaS migration: collapse the PERSONAL/HOME "entity" sub-tag into a
-- single per-user workspace and remove the entity concept entirely.
--
-- Non-destructive: the PERSONAL/HOME classification is archived into entity_archive_*
-- tables before the columns are dropped, so 008_remove_entity.down.sql can restore it.
-- The whole file runs inside one transaction (see internal/db/migrate.go). Take a
-- pg_dump backup before deploying.

-- 1. Ensure a workspace user exists and assign every orphaned row to it.
--    Rows created before 004_user_management have user_id = NULL; this is the real
--    tenant-assignment step. The INSERT is a fallback that only fires when the users
--    table is empty (normally the existing admin/login user is reused).
--    Fallback credentials: username "home" / password "changeme-home-2026" -- change after migrating.
INSERT INTO users (username, password_hash)
SELECT 'home', '$2a$10$1P4v7eMmMdg.3dSaTSbtjeNqYbZH6VHjY6ns5OP3bs5QymGd3P3im'
WHERE NOT EXISTS (SELECT 1 FROM users);

UPDATE accounts              SET user_id = (SELECT MIN(id) FROM users) WHERE user_id IS NULL;
UPDATE categories            SET user_id = (SELECT MIN(id) FROM users) WHERE user_id IS NULL;
UPDATE sub_categories        SET user_id = (SELECT MIN(id) FROM users) WHERE user_id IS NULL;
UPDATE transactions          SET user_id = (SELECT MIN(id) FROM users) WHERE user_id IS NULL;
UPDATE transaction_templates SET user_id = (SELECT MIN(id) FROM users) WHERE user_id IS NULL;

-- 2. Archive the entity classification before dropping the columns (zero data loss).
--    Store as text, not the entity_type enum, so DROP TYPE entity_type below is not
--    blocked by a dependency from these archive tables.
CREATE TABLE entity_archive_transactions AS SELECT id AS transaction_id, entity::text AS entity FROM transactions;
CREATE TABLE entity_archive_categories   AS SELECT id AS category_id,     entity::text AS entity FROM categories;
CREATE TABLE entity_archive_templates    AS SELECT id AS template_id,     entity::text AS entity FROM transaction_templates;

-- 3. De-duplicate categories that differed only by entity so the new
--    UNIQUE(user_id, name, nature) constraint holds. Keep the lowest id as the
--    survivor. Sub-categories hang off categories, so ordering is critical: we must
--    merge/delete duplicate sub-categories BEFORE re-parenting survivors, otherwise
--    re-parenting a duplicate sub trips the UNIQUE(user_id, category_id, name) index.
--
--    For each sub-category we compute its FUTURE identity: (user_id, survivor category,
--    name). Within each future-identity group the lowest id survives; the rest are
--    merged into it (transactions re-pointed) and deleted. Only then do we re-parent the
--    survivors onto the survivor category and drop the losing categories.

-- 3a. Re-point transactions from losing sub-categories to the surviving sub.
WITH cat_keep AS (
  SELECT id AS cat_id, MIN(id) OVER (PARTITION BY user_id, name, nature) AS keep_cat_id
  FROM categories
),
sub_future AS (
  SELECT s.id AS sub_id,
         MIN(s.id) OVER (PARTITION BY s.user_id, ck.keep_cat_id, s.name) AS keep_sub_id
  FROM sub_categories s
  JOIN cat_keep ck ON ck.cat_id = s.category_id
)
UPDATE transactions t
SET sub_category_id = sf.keep_sub_id
FROM sub_future sf
WHERE t.sub_category_id = sf.sub_id AND sf.sub_id <> sf.keep_sub_id;

-- 3b. Delete the losing (merged) sub-categories.
WITH cat_keep AS (
  SELECT id AS cat_id, MIN(id) OVER (PARTITION BY user_id, name, nature) AS keep_cat_id
  FROM categories
),
sub_future AS (
  SELECT s.id AS sub_id,
         MIN(s.id) OVER (PARTITION BY s.user_id, ck.keep_cat_id, s.name) AS keep_sub_id
  FROM sub_categories s
  JOIN cat_keep ck ON ck.cat_id = s.category_id
)
DELETE FROM sub_categories s
USING sub_future sf
WHERE s.id = sf.sub_id AND sf.sub_id <> sf.keep_sub_id;

-- 3c. Re-parent the surviving sub-categories onto the survivor category (now collision-free).
WITH cat_keep AS (
  SELECT id AS cat_id, MIN(id) OVER (PARTITION BY user_id, name, nature) AS keep_cat_id
  FROM categories
)
UPDATE sub_categories s
SET category_id = ck.keep_cat_id
FROM cat_keep ck
WHERE s.category_id = ck.cat_id AND ck.cat_id <> ck.keep_cat_id;

-- 3d. Delete the now-empty duplicate categories.
WITH cat_keep AS (
  SELECT id AS cat_id, MIN(id) OVER (PARTITION BY user_id, name, nature) AS keep_cat_id
  FROM categories
)
DELETE FROM categories c
USING cat_keep ck
WHERE c.id = ck.cat_id AND ck.cat_id <> ck.keep_cat_id;

-- 4. Swap the category uniqueness constraint, drop entity indexes/columns/enum,
--    and harden tenancy now that every row is assigned to a workspace.
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_name_entity_nature_key;
ALTER TABLE categories ADD  CONSTRAINT categories_user_id_name_nature_key UNIQUE (user_id, name, nature);

DROP INDEX IF EXISTS idx_transactions_entity;
DROP INDEX IF EXISTS idx_categories_entity;

ALTER TABLE transactions          DROP COLUMN entity;
ALTER TABLE categories            DROP COLUMN entity;
ALTER TABLE transaction_templates DROP COLUMN entity;

DROP TYPE IF EXISTS entity_type;

ALTER TABLE accounts              ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE categories            ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sub_categories        ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE transactions          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE transaction_templates ALTER COLUMN user_id SET NOT NULL;
