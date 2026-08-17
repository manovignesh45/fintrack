package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fintrack/backend/internal/models"
)

type AccountHandler struct {
	db *pgxpool.Pool
}

func NewAccountHandler(db *pgxpool.Pool) *AccountHandler {
	return &AccountHandler{db: db}
}

func (h *AccountHandler) List(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	query := `SELECT a.id, a.ledger_id, a.name, a.type, a.initial_balance, a.current_balance,
			a.initial_balance + COALESCE(disb.total, 0) AS total_disbursed,
			a.interest_rate, a.is_active, a.created_at
		 FROM accounts a
		 LEFT JOIN (
			SELECT source_account_id, SUM(amount) AS total
			FROM transactions
			WHERE nature = 'LOAN_DISBURSEMENT'
			GROUP BY source_account_id
		 ) disb ON disb.source_account_id = a.id
		 WHERE a.ledger_id = $1`
	args := []interface{}{ledgerID}

	if t := r.URL.Query().Get("type"); t == "ASSET" || t == "LIABILITY" {
		query += " AND a.type = $2"
		args = append(args, t)
	}
	query += " ORDER BY a.type, a.name"

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		writeInternalError(w, err, "Failed to fetch accounts")
		return
	}
	defer rows.Close()

	var accounts []models.Account
	for rows.Next() {
		var a models.Account
		if err := rows.Scan(&a.ID, &a.LedgerID, &a.Name, &a.Type, &a.InitialBalance, &a.CurrentBalance, &a.TotalDisbursed, &a.InterestRate, &a.IsActive, &a.CreatedAt); err != nil {
			writeInternalError(w, err, "Failed to scan account")
			return
		}
		accounts = append(accounts, a)
	}

	writeJSON(w, http.StatusOK, accounts)
}

func (h *AccountHandler) Get(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid account ID")
		return
	}

	dateTo := r.URL.Query().Get("date_to")

	var a models.Account
	var query string
	var args []interface{}
	args = append(args, id, ledgerID)

	if dateTo != "" {
		// Calculate current balance up to dateTo
		query = `
			WITH account_info AS (
				SELECT id, ledger_id, name, type, initial_balance, interest_rate, is_active, created_at
				FROM accounts WHERE id = $1 AND ledger_id = $2
			),
			inflow AS (
				SELECT COALESCE(SUM(
					CASE 
						WHEN nature = 'EMI_PAYMENT' THEN 0 -- EMI into target is handled by principal_amount reduction
						ELSE amount 
					END), 0) as total
				FROM transactions
				WHERE target_account_id = $1 AND ledger_id = $2 AND transaction_date <= $3
			),
			outflow AS (
				SELECT COALESCE(SUM(amount), 0) as total
				FROM transactions
				WHERE source_account_id = $1 AND ledger_id = $2 AND transaction_date <= $3
			),
			loan_reduction AS (
				-- EMI Payments reduce loan balance via principal_amount
				SELECT COALESCE(SUM(principal_amount), 0) as total
				FROM transactions
				WHERE target_account_id = $1 AND nature = 'EMI_PAYMENT' AND ledger_id = $2 AND transaction_date <= $3
			),
			disbursed AS (
				SELECT COALESCE(SUM(amount), 0) as total
				FROM transactions
				WHERE source_account_id = $1 AND nature = 'LOAN_DISBURSEMENT' AND ledger_id = $2 AND transaction_date <= $3
			)
			SELECT
				ai.id, ai.ledger_id, ai.name, ai.type, ai.initial_balance,
				ai.initial_balance + inflow.total - outflow.total - loan_reduction.total as current_balance,
				ai.initial_balance + disbursed.total as total_disbursed,
				ai.interest_rate, ai.is_active, ai.created_at
			FROM account_info ai, inflow, outflow, loan_reduction, disbursed`
		args = append(args, dateTo)
	} else {
		query = `SELECT a.id, a.ledger_id, a.name, a.type, a.initial_balance, a.current_balance,
				a.initial_balance + COALESCE(disb.total, 0) AS total_disbursed,
				a.interest_rate, a.is_active, a.created_at
			 FROM accounts a
			 LEFT JOIN (
				SELECT source_account_id, SUM(amount) AS total
				FROM transactions
				WHERE nature = 'LOAN_DISBURSEMENT'
				GROUP BY source_account_id
			 ) disb ON disb.source_account_id = a.id
			 WHERE a.id = $1 AND a.ledger_id = $2`
	}

	err = h.db.QueryRow(r.Context(), query, args...).Scan(
		&a.ID, &a.LedgerID, &a.Name, &a.Type, &a.InitialBalance, &a.CurrentBalance, &a.TotalDisbursed, &a.InterestRate, &a.IsActive, &a.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "Account not found")
		return
	}

	writeJSON(w, http.StatusOK, a)
}

func (h *AccountHandler) Create(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateAccountReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Name is required")
		return
	}
	if req.Type != models.AccountTypeAsset && req.Type != models.AccountTypeLiability {
		writeError(w, http.StatusBadRequest, "Type must be ASSET or LIABILITY")
		return
	}

	var a models.Account
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO accounts (ledger_id, name, type, initial_balance, current_balance, interest_rate)
		 VALUES ($1, $2, $3, $4, $4, $5)
		 RETURNING id, ledger_id, name, type, initial_balance, current_balance, interest_rate, is_active, created_at`,
		ledgerID, req.Name, req.Type, req.InitialBalance, req.InterestRate).Scan(
		&a.ID, &a.LedgerID, &a.Name, &a.Type, &a.InitialBalance, &a.CurrentBalance, &a.InterestRate, &a.IsActive, &a.CreatedAt)
	if err != nil {
		writeInternalError(w, err, "Failed to create account")
		return
	}
	a.TotalDisbursed = a.InitialBalance

	writeJSON(w, http.StatusCreated, a)
}

func (h *AccountHandler) Update(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid account ID")
		return
	}

	var req models.UpdateAccountReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Build dynamic update
	if req.Name != nil {
		_, err = h.db.Exec(r.Context(), "UPDATE accounts SET name = $1 WHERE id = $2 AND ledger_id = $3", *req.Name, id, ledgerID)
	}
	if err == nil && req.InterestRate != nil {
		_, err = h.db.Exec(r.Context(), "UPDATE accounts SET interest_rate = $1 WHERE id = $2 AND ledger_id = $3", *req.InterestRate, id, ledgerID)
	}
	if err == nil && req.IsActive != nil {
		_, err = h.db.Exec(r.Context(), "UPDATE accounts SET is_active = $1 WHERE id = $2 AND ledger_id = $3", *req.IsActive, id, ledgerID)
	}
	if err != nil {
		writeInternalError(w, err, "Failed to update account")
		return
	}

	// Return updated account
	var updatedAccount models.Account
	err = h.db.QueryRow(r.Context(),
		`SELECT a.id, a.ledger_id, a.name, a.type, a.initial_balance, a.current_balance,
			a.initial_balance + COALESCE(disb.total, 0) AS total_disbursed,
			a.interest_rate, a.is_active, a.created_at
		 FROM accounts a
		 LEFT JOIN (
			SELECT source_account_id, SUM(amount) AS total
			FROM transactions
			WHERE nature = 'LOAN_DISBURSEMENT'
			GROUP BY source_account_id
		 ) disb ON disb.source_account_id = a.id
		 WHERE a.id = $1 AND a.ledger_id = $2`, id, ledgerID).Scan(
		&updatedAccount.ID, &updatedAccount.LedgerID, &updatedAccount.Name, &updatedAccount.Type, &updatedAccount.InitialBalance, &updatedAccount.CurrentBalance, &updatedAccount.TotalDisbursed, &updatedAccount.InterestRate, &updatedAccount.IsActive, &updatedAccount.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "Account not found")
		return
	}

	writeJSON(w, http.StatusOK, updatedAccount)
}

func (h *AccountHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid account ID")
		return
	}

	// Check if account has transactions or templates referencing it
	var count int
	err = h.db.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM (
			SELECT id FROM transactions WHERE source_account_id = $1 OR target_account_id = $1
			UNION ALL
			SELECT id FROM transaction_templates WHERE source_account_id = $1 OR target_account_id = $1
		) refs`,
		id).Scan(&count)
	if err != nil {
		writeInternalError(w, err, "Failed to check account transactions")
		return
	}

	if count > 0 {
		writeError(w, http.StatusBadRequest, "Cannot delete account with transactions or templates. Try deactivating it instead.")
		return
	}

	tag, err := h.db.Exec(r.Context(), "DELETE FROM accounts WHERE id = $1 AND ledger_id = $2", id, ledgerID)
	if err != nil {
		writeInternalError(w, err, "Failed to delete account")
		return
	}

	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Account not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
