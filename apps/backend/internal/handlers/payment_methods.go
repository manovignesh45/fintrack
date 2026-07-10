package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fintrack/backend/internal/models"
)

type PaymentMethodHandler struct {
	db *pgxpool.Pool
}

func NewPaymentMethodHandler(db *pgxpool.Pool) *PaymentMethodHandler {
	return &PaymentMethodHandler{db: db}
}

func (h *PaymentMethodHandler) List(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	paymentMethods := make([]models.PaymentMethod, 0)

	query := `SELECT id, ledger_id, name, created_at FROM payment_methods WHERE ledger_id = $1 ORDER BY name`
	rows, err := h.db.Query(r.Context(), query, ledgerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch payment methods")
		return
	}
	defer rows.Close()

	for rows.Next() {
		var pm models.PaymentMethod
		if err := rows.Scan(&pm.ID, &pm.LedgerID, &pm.Name, &pm.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to scan payment method")
			return
		}
		paymentMethods = append(paymentMethods, pm)
	}

	writeJSON(w, http.StatusOK, paymentMethods)
}

func (h *PaymentMethodHandler) Create(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreatePaymentMethodReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Name is required")
		return
	}

	var pm models.PaymentMethod
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO payment_methods (ledger_id, name) VALUES ($1, $2)
		 RETURNING id, ledger_id, name, created_at`,
		ledgerID, req.Name).Scan(&pm.ID, &pm.LedgerID, &pm.Name, &pm.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create payment method (name might be taken)")
		return
	}

	writeJSON(w, http.StatusCreated, pm)
}

func (h *PaymentMethodHandler) Update(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid payment method ID")
		return
	}

	var req models.UpdatePaymentMethodReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Name is required")
		return
	}

	tag, err := h.db.Exec(r.Context(), "UPDATE payment_methods SET name = $1 WHERE id = $2 AND ledger_id = $3", req.Name, id, ledgerID)
	if err != nil || tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Payment method not found")
		return
	}

	var pm models.PaymentMethod
	h.db.QueryRow(r.Context(),
		`SELECT id, ledger_id, name, created_at FROM payment_methods WHERE id = $1 AND ledger_id = $2`, id, ledgerID).Scan(
		&pm.ID, &pm.LedgerID, &pm.Name, &pm.CreatedAt)

	writeJSON(w, http.StatusOK, pm)
}

func (h *PaymentMethodHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid payment method ID")
		return
	}

	tag, err := h.db.Exec(r.Context(), "DELETE FROM payment_methods WHERE id = $1 AND ledger_id = $2", id, ledgerID)
	if err != nil || tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Payment method not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
