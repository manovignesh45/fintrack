package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/fintrack/backend/internal/models"
)

func (h *AccountHandler) GetLedgers(w http.ResponseWriter, r *http.Request) {
	userID, err := GetUserID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	query := `SELECT id, user_id, name, created_at, updated_at FROM ledgers WHERE user_id = $1 ORDER BY created_at ASC`
	rows, err := h.db.Query(r.Context(), query, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch ledgers")
		return
	}
	defer rows.Close()

	var ledgers []models.Ledger
	for rows.Next() {
		var l models.Ledger
		if err := rows.Scan(&l.ID, &l.UserID, &l.Name, &l.CreatedAt, &l.UpdatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to parse ledgers")
			return
		}
		ledgers = append(ledgers, l)
	}

	if ledgers == nil {
		ledgers = []models.Ledger{}
	}

	writeJSON(w, http.StatusOK, ledgers)
}

func (h *AccountHandler) CreateLedger(w http.ResponseWriter, r *http.Request) {
	userID, err := GetUserID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateLedgerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Ledger name is required")
		return
	}

	var l models.Ledger
	l.UserID = userID
	l.Name = req.Name
	now := time.Now()
	l.CreatedAt = now
	l.UpdatedAt = now

	query := `INSERT INTO ledgers (user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id`
	err = h.db.QueryRow(r.Context(), query, l.UserID, l.Name, l.CreatedAt, l.UpdatedAt).Scan(&l.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create ledger (name might be taken)")
		return
	}

	writeJSON(w, http.StatusCreated, l)
}
