# FinTrack: Personal Tool → Multi-Tenant SaaS (Entity Removal, Phases 1–3)

## Context

FinTrack is a Turborepo/pnpm monorepo (`apps/backend` Go + chi + pgx/Postgres, `apps/frontend` React 19 + Vite, `apps/mobile` Expo, `packages/shared` TS types/constants/api-client). It began as a single-admin tool that separates records with an **Entity** tag (`PERSONAL` / `HOME`) inside one login. We are moving to a public multi-tenant SaaS where **separate user accounts are the tenant boundary**, so the Entity tag is redundant and must go — web + backend now, mobile later.

**Critical discoveries from exploration (these change the shape of the work):**

1. **The app is already multi-tenant by `user_id`.** Every table (`accounts`, `categories`, `sub_categories`, `transactions`, `transaction_templates`) already has a `user_id` column (added in `004_user_management`), and **every handler query is already scoped** with `WHERE user_id = $1` via `GetUserID(r)` (JWT claims → context, see [auth.go](apps/backend/internal/handlers/auth.go#L136)). So Phase 2's "scope all queries to user_id" is *already done* — Phase 2 is really just entity removal.
2. **Entity is a sub-tag, not a tenant.** `entity` exists only on `transactions`, `categories`, `transaction_templates`. **`accounts` and loans (LIABILITY accounts) have NO entity tag**, and balances are computed across *all* transactions on an account. → A mechanical "move HOME to a new user" is undefined and would break balances. **Decision: collapse PERSONAL+HOME into the single existing workspace** (no second user).
3. **`user_id` may be NULL on legacy rows.** `004` added `user_id` nullable with no backfill → the 3-month live data can have `user_id IS NULL`. The migration must assign those rows to the workspace user (this *is* the real tenant-assignment step).
4. **Backend API + `@fintrack/shared` are shared with the live mobile app.** Mobile POSTs `entity`, stores it in local SQLite, and reads an entity-grouped `/summary`. **Decision: hard cut now** — purge entity from backend + shared; mobile will not build/run correctly until its own phase (accepted, out of scope here).

**Outcome:** one clean workspace per user, no entity anywhere in web/backend/shared, zero financial data loss, balances unchanged.

---

## Phase 1 — Safe DB Migration (zero data loss)

New auto-run migration pair `008_remove_entity.{up,down}.sql` in [migrations/](apps/backend/internal/db/migrations/). Migrations run on startup, one-per-transaction, tracked in `schema_migrations` ([migrate.go](apps/backend/internal/db/migrate.go)). **Take a `pg_dump` backup before deploying.**

Order inside `008_remove_entity.up.sql` (all in the single migration tx):

1. **Ensure a workspace user + backfill tenancy.** The existing admin user normally already exists (they log in today); the INSERT is a fallback only if `users` is empty. Fold every orphaned row into the one workspace:
   ```sql
   INSERT INTO users (username, password_hash)
   SELECT 'home', '$2a$10$<PRECOMPUTED_BCRYPT_HASH>'   -- fallback only; change pw after
   WHERE NOT EXISTS (SELECT 1 FROM users);

   -- workspace = lowest existing user id
   UPDATE accounts              SET user_id=(SELECT MIN(id) FROM users) WHERE user_id IS NULL;
   UPDATE categories            SET user_id=(SELECT MIN(id) FROM users) WHERE user_id IS NULL;
   UPDATE sub_categories        SET user_id=(SELECT MIN(id) FROM users) WHERE user_id IS NULL;
   UPDATE transactions          SET user_id=(SELECT MIN(id) FROM users) WHERE user_id IS NULL;
   UPDATE transaction_templates SET user_id=(SELECT MIN(id) FROM users) WHERE user_id IS NULL;
   ```
   Generate the bcrypt hash the same way the app does ([auth.go](apps/backend/internal/handlers/auth.go#L67), `bcrypt.DefaultCost`) — e.g. a throwaway Go snippet — rather than hand-writing it.

2. **Archive the entity classification (non-destructive).** Preserves the PERSONAL/HOME labels so the drop is reversible:
   ```sql
   CREATE TABLE entity_archive_transactions AS SELECT id AS transaction_id, entity FROM transactions;
   CREATE TABLE entity_archive_categories   AS SELECT id AS category_id,   entity FROM categories;
   CREATE TABLE entity_archive_templates    AS SELECT id AS template_id,   entity FROM transaction_templates;
   ```

3. **De-duplicate categories** that differed only by entity, so the new `UNIQUE(user_id, name, nature)` holds. Keep lowest id as survivor; re-parent sub-categories; merge any resulting sub-category name collisions by re-pointing `transactions.sub_category_id` to the survivor sub, then delete losers. (Illustrative — validate against a dump first; if PERSONAL/HOME never shared a category name+nature, these are no-ops.)
   ```sql
   -- re-parent sub-categories of duplicate categories to the survivor category
   WITH ranked AS (
     SELECT id, MIN(id) OVER (PARTITION BY user_id, name, nature) AS keep_id FROM categories)
   UPDATE sub_categories sc SET category_id = r.keep_id
   FROM ranked r WHERE sc.category_id = r.id AND r.id <> r.keep_id;

   -- merge sub-category name collisions under the survivor
   WITH dup AS (
     SELECT id, MIN(id) OVER (PARTITION BY user_id, category_id, name) AS keep_id FROM sub_categories)
   UPDATE transactions t SET sub_category_id = d.keep_id
   FROM dup d WHERE t.sub_category_id = d.id AND d.id <> d.keep_id;
   DELETE FROM sub_categories sc USING (
     SELECT id, MIN(id) OVER (PARTITION BY user_id, category_id, name) AS keep_id FROM sub_categories) d
   WHERE sc.id = d.id AND d.id <> d.keep_id;

   -- delete the now-duplicate categories
   DELETE FROM categories c USING (
     SELECT id, MIN(id) OVER (PARTITION BY user_id, name, nature) AS keep_id FROM categories) r
   WHERE c.id = r.id AND r.id <> r.keep_id;
   ```

4. **Swap the category constraint, drop indexes/columns/enum, harden tenancy:**
   ```sql
   ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_name_entity_nature_key;
   ALTER TABLE categories ADD  CONSTRAINT categories_user_id_name_nature_key UNIQUE (user_id, name, nature);

   DROP INDEX IF EXISTS idx_transactions_entity;
   DROP INDEX IF EXISTS idx_categories_entity;

   ALTER TABLE transactions          DROP COLUMN entity;
   ALTER TABLE categories            DROP COLUMN entity;
   ALTER TABLE transaction_templates DROP COLUMN entity;
   DROP TYPE IF EXISTS entity_type;

   -- enforce tenancy now that every row is assigned
   ALTER TABLE accounts              ALTER COLUMN user_id SET NOT NULL;
   ALTER TABLE categories            ALTER COLUMN user_id SET NOT NULL;
   ALTER TABLE sub_categories        ALTER COLUMN user_id SET NOT NULL;
   ALTER TABLE transactions          ALTER COLUMN user_id SET NOT NULL;
   ALTER TABLE transaction_templates ALTER COLUMN user_id SET NOT NULL;
   ```

`008_remove_entity.down.sql`: recreate `entity_type` enum, re-add `entity` columns nullable, restore values from the `entity_archive_*` tables, drop the archive tables, revert the constraint. (Category de-dup is not reversible — documented one-way.)

**Loan safety:** because we collapse (not split), all LIABILITY/loan accounts and every EMI/disbursement transaction keep the same `user_id` and the same `source/target_account_id` — the balance logic in [transactions.go](apps/backend/internal/handlers/transactions.go#L571) (`applyBalanceChange`/`reverseBalanceChange`) is untouched and balances are provably unchanged.

---

## Phase 2 — Backend hard cut (`apps/backend` + `packages/shared`)

Query scoping to `user_id` is already complete — do **not** re-plumb it. Remove every entity reference:

- **[models.go](apps/backend/internal/models/models.go):** delete `EntityType`, `EntityPersonal`, `EntityHome`; remove the `Entity` field from `Transaction`, `TransactionTemplate`, `Category`, `CreateTransactionReq`, `CreateTemplateReq`, `CreateCategoryReq`, and `TransactionFilter`. Redefine summary to single totals:
  ```go
  type SummaryResponse struct {
      Month        string  `json:"month"`
      TotalIncome  float64 `json:"total_income"`
      TotalExpense float64 `json:"total_expense"`
      TotalEMI     float64 `json:"total_emi"`
      NetFlow      float64 `json:"net_flow"`
  }   // delete EntitySummary
  ```
- **[transactions.go](apps/backend/internal/handlers/transactions.go):** drop `entity` from the `List`/`Export` SELECT columns and remove the `q.Get("entity")` filter branch (L45, L148); drop `entity` from the `Create`/`Update` INSERT/UPDATE column+value lists and `RETURNING`; remove the `req.Entity` PERSONAL/HOME check in `validateTransactionReq` (L689); drop `&t.Entity` from `scanTransaction`/`scanTransactionRow`; remove the `Entity` column from the CSV/Excel export (`headers`, row writers).
- **[categories.go](apps/backend/internal/handlers/categories.go):** remove the `?entity` filter and its SELECT column, the `req.Entity` validation (L104), and `entity` from the INSERT/RETURNING/scans.
- **[templates.go](apps/backend/internal/handlers/templates.go):** remove `entity` from all template SELECT/INSERT/scan lists and from the `Execute` → transaction insert mapping (L168, L185).
- **[tally.go](apps/backend/internal/handlers/tally.go#L118):** `Summary` — drop `GROUP BY entity`; return one aggregated `SummaryResponse` for the month.
- **`packages/shared` (hard cut, breaks mobile — accepted):** [types.ts](packages/shared/src/types.ts) remove `EntityType`, `entity` fields on `Transaction`/`TransactionTemplate`/`Category`/`TransactionFormData`, `EntitySummary`, `FilterState.entity`, and reshape `SummaryResponse` to the flat totals above; [constants.ts](packages/shared/src/constants.ts) delete `ENTITIES`, remove `entity` from `DEFAULT_FILTERS`/`emptyTransactionForm`/`countActiveFilters`; [api-client.ts](packages/shared/src/api-client.ts#L86) drop the `entity` param from `categoriesApi.list`/`create`.

Verify with `go build ./... && go vet ./...`.

---

## Phase 3 — Web frontend refactor (`apps/frontend`)

- **[TransactionForm.tsx](apps/frontend/src/components/TransactionForm.tsx) (primary deliverable):** remove `entity` from the `TransactionFormData` interface + `emptyForm()`; delete the entire **Entity selector** block (L157–174) and the `ENTITIES`/`EntityType` imports; change the category fetch to `categoriesApi.list({ nature: form.nature })` and drop `form.entity` from that effect's dependency array (L57, L70).
- **[api/types.ts](apps/frontend/src/api/types.ts):** drop the `EntityType`, `EntitySummary`, and `ENTITIES` re-exports.
- **[TransactionFilter.tsx](apps/frontend/src/components/TransactionFilter.tsx):** remove `entity` from `FilterState`, the Entity pill group (L262+), and the entity-based narrowing of `availableNatures`/categories (L171–185).
- **[TransactionsPage.tsx](apps/frontend/src/pages/TransactionsPage.tsx):** remove the `entity` request param (L38, L81), the entity `FilterPill` (L173), and `· {t.entity}` from the row line (L235).
- **[SummaryPage.tsx](apps/frontend/src/pages/SummaryPage.tsx):** delete `EntityCard` + the per-entity `data.entities.map` breakdown; read the new flat `SummaryResponse` totals directly.
- **[CategoriesPage.tsx](apps/frontend/src/pages/CategoriesPage.tsx):** remove the Entity tabs, `STORAGE_ENTITY_KEY`/`selectedEntity` state, and `entity` from the list call — filter by nature only.
- **[CreateCategoryPage.tsx](apps/frontend/src/pages/CreateCategoryPage.tsx):** remove the Entity selector + `entity` from the create payload.
- **[CreateSubCategoryPage.tsx](apps/frontend/src/pages/CreateSubCategoryPage.tsx#L67):** drop the `category.entity` badge.
- **[TemplatesPage.tsx](apps/frontend/src/pages/TemplatesPage.tsx):** replace entity-grouped rendering with a flat template list.
- **Payload senders:** [AddTransactionPage.tsx](apps/frontend/src/pages/AddTransactionPage.tsx#L18), [EditTransactionPage.tsx](apps/frontend/src/pages/EditTransactionPage.tsx#L46), [CreateTemplatePage.tsx](apps/frontend/src/pages/CreateTemplatePage.tsx#L16) — remove `entity:` from each request body.

Verify with `pnpm --filter frontend build` (runs `tsc -b`) → zero type errors.

---

## Mobile fallout (out of scope, fix in its later phase)

Hard cut will break `apps/mobile` build/runtime. Files to update when mobile's phase starts (do **not** touch now): [mobile TransactionForm.tsx](apps/mobile/src/components/TransactionForm.tsx), [TransactionFilter.tsx](apps/mobile/src/components/TransactionFilter.tsx), [localTypes.ts](apps/mobile/src/db/localTypes.ts), [transactionRepo.ts](apps/mobile/src/db/transactionRepo.ts), [referenceDataRepo.ts](apps/mobile/src/db/referenceDataRepo.ts), [summary.tsx](apps/mobile/app/(tabs)/summary.tsx), `app/add.tsx`, `app/edit/[id].tsx`, `app/templates/new.tsx`, plus a local-SQLite migration to drop entity columns.

---

## Verification (end-to-end)

1. **Migration integrity (against a copy of prod, or docker-compose Postgres):** record `SELECT COUNT(*)` per table and `SELECT id,current_balance FROM accounts ORDER BY id` **before**; run backend so `008` applies; confirm counts identical and balances byte-identical (zero data loss / balances unchanged); `\d transactions` shows no `entity`; `\dT` shows no `entity_type`; every `user_id` is non-NULL; `entity_archive_*` tables populated.
2. **Backend:** `go build ./... && go vet ./...`; smoke the API — `POST /api/register` → `POST /api/login` → `POST /api/transactions` **with no `entity` field** succeeds → `GET /api/transactions` returns it → `GET /api/summary?month=YYYY-MM` returns flat totals → `GET /api/transactions/export/csv` has no Entity column.
3. **Frontend:** `pnpm --filter frontend build` passes; `pnpm --filter frontend dev` + Playwright MCP — open Add Transaction and confirm **no Entity toggle**, create a transaction, confirm it lists; open Summary and confirm single-total rendering; open Categories and confirm no Entity tabs.
4. **Expected:** `pnpm --filter mobile` typecheck/build **fails** — acceptable, mobile is a later phase.

## Rollout order & risks
- Deploy order: **Phase 1 migration + Phase 2 backend together** (schema and code must match), then **Phase 3 web**.
- Risk: category de-dup is the only data-shaping step — dry-run it on a dump and eyeball merged categories before prod.
- Risk: the live mobile app will error against the new backend until its phase — coordinate timing / expect mobile downtime as decided.
