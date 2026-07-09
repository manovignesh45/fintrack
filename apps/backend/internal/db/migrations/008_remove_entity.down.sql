-- 008_remove_entity.down.sql
-- Reverse 008_remove_entity.up.sql as far as is possible.
--
-- NOTE: the category de-duplication in the up migration is NOT reversible -- merged
-- duplicate categories/sub-categories cannot be un-merged. This down migration restores
-- the entity_type enum, the entity columns, and their archived values, and reverts the
-- tenancy/constraint changes. Rows created after the up migration have no archived
-- entity and default to 'PERSONAL'.

-- 1. Relax tenancy hardening.
ALTER TABLE accounts              ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE categories            ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE sub_categories        ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE transactions          ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE transaction_templates ALTER COLUMN user_id DROP NOT NULL;

-- 2. Recreate the enum and the entity columns (nullable while we backfill).
CREATE TYPE entity_type AS ENUM ('PERSONAL', 'HOME');

ALTER TABLE transactions          ADD COLUMN entity entity_type;
ALTER TABLE categories            ADD COLUMN entity entity_type;
ALTER TABLE transaction_templates ADD COLUMN entity entity_type;

-- 3. Restore archived values, then default anything created after the up migration.
UPDATE transactions t          SET entity = a.entity::entity_type FROM entity_archive_transactions a WHERE t.id = a.transaction_id;
UPDATE categories c            SET entity = a.entity::entity_type FROM entity_archive_categories   a WHERE c.id = a.category_id;
UPDATE transaction_templates t SET entity = a.entity::entity_type FROM entity_archive_templates    a WHERE t.id = a.template_id;

UPDATE transactions          SET entity = 'PERSONAL' WHERE entity IS NULL;
UPDATE categories            SET entity = 'PERSONAL' WHERE entity IS NULL;
UPDATE transaction_templates SET entity = 'PERSONAL' WHERE entity IS NULL;

ALTER TABLE transactions          ALTER COLUMN entity SET NOT NULL;
ALTER TABLE categories            ALTER COLUMN entity SET NOT NULL;
ALTER TABLE transaction_templates ALTER COLUMN entity SET NOT NULL;

-- 4. Restore indexes and the original category uniqueness constraint.
CREATE INDEX IF NOT EXISTS idx_transactions_entity ON transactions(entity);
CREATE INDEX IF NOT EXISTS idx_categories_entity   ON categories(entity);

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_name_nature_key;
ALTER TABLE categories ADD  CONSTRAINT categories_user_id_name_entity_nature_key UNIQUE (user_id, name, entity, nature);

-- 5. Drop the archive tables.
DROP TABLE IF EXISTS entity_archive_transactions;
DROP TABLE IF EXISTS entity_archive_categories;
DROP TABLE IF EXISTS entity_archive_templates;
