package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fintrack/backend/internal/models"
)

type TagHandler struct {
	db *pgxpool.Pool
}

func NewTagHandler(db *pgxpool.Pool) *TagHandler {
	return &TagHandler{db: db}
}

func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT id, ledger_id, name, color, created_at
		 FROM tags WHERE ledger_id = $1 ORDER BY name ASC`, ledgerID)
	if err != nil {
		writeInternalError(w, err, "Failed to fetch tags")
		return
	}
	defer rows.Close()

	tags := make([]models.Tag, 0)
	for rows.Next() {
		var t models.Tag
		if err := rows.Scan(&t.ID, &t.LedgerID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
			writeInternalError(w, err, "Failed to scan tag")
			return
		}
		tags = append(tags, t)
	}

	writeJSON(w, http.StatusOK, tags)
}

func (h *TagHandler) Create(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateTagReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Tag name is required")
		return
	}

	var t models.Tag
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO tags (ledger_id, name, color)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (ledger_id, name) DO UPDATE SET name = EXCLUDED.name
		 RETURNING id, ledger_id, name, color, created_at`,
		ledgerID, req.Name, req.Color).Scan(&t.ID, &t.LedgerID, &t.Name, &t.Color, &t.CreatedAt)
	if err != nil {
		writeInternalError(w, err, "Failed to save tag")
		return
	}

	writeJSON(w, http.StatusCreated, t)
}

func (h *TagHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid tag ID")
		return
	}

	_, err = h.db.Exec(r.Context(), "DELETE FROM tags WHERE id = $1 AND ledger_id = $2", id, ledgerID)
	if err != nil {
		writeInternalError(w, err, "Failed to delete tag")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *TagHandler) GetSuggestions(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))

	query := `SELECT id, ledger_id, name, color, created_at FROM tags WHERE ledger_id = $1`
	args := []interface{}{ledgerID}
	if q != "" {
		query += ` AND name ILIKE '%' || $2 || '%'`
		args = append(args, q)
	}
	query += ` ORDER BY name ASC LIMIT 20`

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		writeInternalError(w, err, "Failed to fetch tag suggestions")
		return
	}
	defer rows.Close()

	tags := make([]models.Tag, 0)
	for rows.Next() {
		var t models.Tag
		if err := rows.Scan(&t.ID, &t.LedgerID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
			writeInternalError(w, err, "Failed to scan tag")
			return
		}
		tags = append(tags, t)
	}

	writeJSON(w, http.StatusOK, tags)
}
