package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fintrack/backend/internal/models"
)

type TemplateHandler struct {
	db *pgxpool.Pool
}

func NewTemplateHandler(db *pgxpool.Pool) *TemplateHandler {
	return &TemplateHandler{db: db}
}

func (h *TemplateHandler) List(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT id, ledger_id, title, amount, nature, source_account_id, target_account_id,
			sub_category_id, payment_method_id, principal_amount, interest_amount, created_at
		 FROM transaction_templates WHERE ledger_id = $1 ORDER BY title`, ledgerID)
	if err != nil {
		writeInternalError(w, err, "Failed to fetch templates")
		return
	}
	defer rows.Close()

	var templates []models.TransactionTemplate
	for rows.Next() {
		var t models.TransactionTemplate
		var paymentMethodID *int
		if err := rows.Scan(&t.ID, &t.LedgerID, &t.Title, &t.Amount, &t.Nature, &t.SourceAccountID,
			&t.TargetAccountID, &t.SubCategoryID, &paymentMethodID,
			&t.PrincipalAmount, &t.InterestAmount, &t.CreatedAt); err != nil {
			writeInternalError(w, err, "Failed to scan template")
			return
		}
		if paymentMethodID != nil {
			t.PaymentMethodID = paymentMethodID
		}
		templates = append(templates, t)
	}

	if templates == nil {
		templates = []models.TransactionTemplate{}
	}

	writeJSON(w, http.StatusOK, templates)
}

func (h *TemplateHandler) Create(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateTemplateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "Title is required")
		return
	}

	// Default source_account_id to the ledger's primary asset account when not provided
	if req.SourceAccountID == 0 {
		primaryID, err := getPrimaryAssetAccountID(r.Context(), h.db, ledgerID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "source_account_id not provided and no primary asset account found")
			return
		}
		req.SourceAccountID = primaryID
	}

	var t models.TransactionTemplate
	var createPM *int
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO transaction_templates (ledger_id, title, amount, nature, source_account_id,
			target_account_id, sub_category_id, payment_method_id, principal_amount, interest_amount)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING id, ledger_id, title, amount, nature, source_account_id, target_account_id,
			sub_category_id, payment_method_id, principal_amount, interest_amount, created_at`,
		ledgerID, req.Title, req.Amount, req.Nature, req.SourceAccountID, req.TargetAccountID,
		req.SubCategoryID, req.PaymentMethodID,
		req.PrincipalAmount, req.InterestAmount).Scan(
		&t.ID, &t.LedgerID, &t.Title, &t.Amount, &t.Nature, &t.SourceAccountID,
		&t.TargetAccountID, &t.SubCategoryID, &createPM,
		&t.PrincipalAmount, &t.InterestAmount, &t.CreatedAt)
	if err != nil {
		writeInternalError(w, err, "Failed to create template")
		return
	}
	if createPM != nil {
		t.PaymentMethodID = createPM
	}

	writeJSON(w, http.StatusCreated, t)
}

func (h *TemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	tag, err := h.db.Exec(r.Context(), "DELETE FROM transaction_templates WHERE id = $1 AND ledger_id = $2", id, ledgerID)
	if err != nil || tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Template not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Execute creates a transaction from a template
func (h *TemplateHandler) Execute(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	// Fetch the template
	var t models.TransactionTemplate
	var execPM *int
	err = h.db.QueryRow(r.Context(),
		`SELECT id, ledger_id, title, amount, nature, source_account_id, target_account_id,
			sub_category_id, payment_method_id, principal_amount, interest_amount, created_at
		 FROM transaction_templates WHERE id = $1 AND ledger_id = $2`, id, ledgerID).Scan(
		&t.ID, &t.LedgerID, &t.Title, &t.Amount, &t.Nature, &t.SourceAccountID,
		&t.TargetAccountID, &t.SubCategoryID, &execPM,
		&t.PrincipalAmount, &t.InterestAmount, &t.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "Template not found")
		return
	}
	if execPM != nil {
		t.PaymentMethodID = execPM
	}

	// Build transaction request from template
	req := models.CreateTransactionReq{
		Title:           t.Title,
		Amount:          t.Amount,
		Nature:          t.Nature,
		SourceAccountID: t.SourceAccountID,
		TargetAccountID: t.TargetAccountID,
		SubCategoryID:   t.SubCategoryID,
		PaymentMethodID: t.PaymentMethodID,
		PrincipalAmount: t.PrincipalAmount,
		InterestAmount:  t.InterestAmount,
		TransactionDate: time.Now().Format("2006-01-02"),
	}

	// Create the transaction using a DB transaction
	dbTx, err := h.db.Begin(r.Context())
	if err != nil {
		writeInternalError(w, err, "Failed to begin transaction")
		return
	}
	defer dbTx.Rollback(r.Context())

	createdRow := dbTx.QueryRow(r.Context(),
		`INSERT INTO transactions (ledger_id, title, amount, nature, source_account_id, target_account_id,
			sub_category_id, payment_method_id, notes, principal_amount, interest_amount, transaction_date)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		 RETURNING id, ledger_id, title, amount, nature, source_account_id, target_account_id,
			sub_category_id, payment_method_id, notes, principal_amount, interest_amount,
			transaction_date, warranty_until, warranty_notes, created_at`,
		ledgerID, req.Title, req.Amount, req.Nature, req.SourceAccountID, req.TargetAccountID,
		req.SubCategoryID, req.PaymentMethodID, nil,
		req.PrincipalAmount, req.InterestAmount, req.TransactionDate,
	)
	created, err := scanTransactionRow(createdRow)
	if err != nil {
		writeInternalError(w, err, "Failed to create transaction from template")
		return
	}

	if err := applyBalanceChange(r.Context(), dbTx, ledgerID, req.Nature, req.SourceAccountID, req.TargetAccountID, req.Amount, req.PrincipalAmount); err != nil {
		writeInternalError(w, err, "Failed to update balances")
		return
	}

	if err := dbTx.Commit(r.Context()); err != nil {
		writeInternalError(w, err, "Failed to commit")
		return
	}

	writeJSON(w, http.StatusCreated, created)
}
