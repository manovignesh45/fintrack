package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fintrack/backend/internal/models"
)

type CategoryHandler struct {
	db *pgxpool.Pool
}

func NewCategoryHandler(db *pgxpool.Pool) *CategoryHandler {
	return &CategoryHandler{db: db}
}

func (h *CategoryHandler) List(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	nature := r.URL.Query().Get("nature")

	categories := make([]models.Category, 0)

	query := `SELECT id, ledger_id, name, nature, created_at FROM categories WHERE ledger_id = $1`
	args := []interface{}{ledgerID}
	argIdx := 2
	if nature != "" {
		query += fmt.Sprintf(` AND nature = $%d`, argIdx)
		args = append(args, nature)
		argIdx++
	}
	query += ` ORDER BY name`

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch categories")
		return
	}
	defer rows.Close()

	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.LedgerID, &c.Name, &c.Nature, &c.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to scan category")
			return
		}
		categories = append(categories, c)
	}

	// Fetch subcategories for each category
	for i := range categories {
		subRows, err := h.db.Query(r.Context(),
			`SELECT id, category_id, ledger_id, name, created_at FROM sub_categories WHERE category_id = $1 AND ledger_id = $2 ORDER BY name`,
			categories[i].ID, ledgerID)
		if err != nil {
			continue
		}
		for subRows.Next() {
			var sc models.SubCategory
			if err := subRows.Scan(&sc.ID, &sc.CategoryID, &sc.LedgerID, &sc.Name, &sc.CreatedAt); err != nil {
				continue
			}
			categories[i].SubCategories = append(categories[i].SubCategories, sc)
		}
		subRows.Close()
	}

	writeJSON(w, http.StatusOK, categories)
}

func (h *CategoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateCategoryReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Name is required")
		return
	}
	if req.Nature != models.NatureIncome && req.Nature != models.NatureExpense {
		writeError(w, http.StatusBadRequest, "Nature must be INCOME or EXPENSE")
		return
	}

	var c models.Category
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO categories (ledger_id, name, nature) VALUES ($1, $2, $3)
		 RETURNING id, ledger_id, name, nature, created_at`,
		ledgerID, req.Name, req.Nature).Scan(&c.ID, &c.LedgerID, &c.Name, &c.Nature, &c.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create category: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, c)
}

func (h *CategoryHandler) Update(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var req models.UpdateCategoryReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Name is required")
		return
	}

	tag, err := h.db.Exec(r.Context(), "UPDATE categories SET name = $1 WHERE id = $2 AND ledger_id = $3", req.Name, id, ledgerID)
	if err != nil || tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Category not found")
		return
	}

	var c models.Category
	h.db.QueryRow(r.Context(),
		`SELECT id, ledger_id, name, nature, created_at FROM categories WHERE id = $1 AND ledger_id = $2`, id, ledgerID).Scan(
		&c.ID, &c.LedgerID, &c.Name, &c.Nature, &c.CreatedAt)

	writeJSON(w, http.StatusOK, c)
}

func (h *CategoryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}

	tag, err := h.db.Exec(r.Context(), "DELETE FROM categories WHERE id = $1 AND ledger_id = $2", id, ledgerID)
	if err != nil || tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Category not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// --- Sub-category handlers ---

func (h *CategoryHandler) CreateSubCategory(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	categoryID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var req models.CreateSubCategoryReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Name is required")
		return
	}

	var sc models.SubCategory
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO sub_categories (category_id, ledger_id, name) VALUES ($1, $2, $3)
		 RETURNING id, category_id, ledger_id, name, created_at`,
		categoryID, ledgerID, req.Name).Scan(&sc.ID, &sc.CategoryID, &sc.LedgerID, &sc.Name, &sc.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create sub-category")
		return
	}

	writeJSON(w, http.StatusCreated, sc)
}

func (h *CategoryHandler) UpdateSubCategory(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	subID, err := strconv.Atoi(chi.URLParam(r, "subId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid sub-category ID")
		return
	}

	var req models.UpdateSubCategoryReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Name is required")
		return
	}

	tag, err := h.db.Exec(r.Context(), "UPDATE sub_categories SET name = $1 WHERE id = $2 AND ledger_id = $3", req.Name, subID, ledgerID)
	if err != nil || tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Sub-category not found")
		return
	}

	var sc models.SubCategory
	h.db.QueryRow(r.Context(),
		`SELECT id, category_id, ledger_id, name, created_at FROM sub_categories WHERE id = $1 AND ledger_id = $2`, subID, ledgerID).Scan(
		&sc.ID, &sc.CategoryID, &sc.LedgerID, &sc.Name, &sc.CreatedAt)

	writeJSON(w, http.StatusOK, sc)
}

func (h *CategoryHandler) DeleteSubCategory(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	subID, err := strconv.Atoi(chi.URLParam(r, "subId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid sub-category ID")
		return
	}

	tag, err := h.db.Exec(r.Context(), "DELETE FROM sub_categories WHERE id = $1 AND ledger_id = $2", subID, ledgerID)
	if err != nil || tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Sub-category not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
