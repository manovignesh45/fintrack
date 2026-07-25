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

type TallyHandler struct {
	db *pgxpool.Pool
}

func NewTallyHandler(db *pgxpool.Pool) *TallyHandler {
	return &TallyHandler{db: db}
}

// GetTally returns the calculated balance for an account
func (h *TallyHandler) GetTally(w http.ResponseWriter, r *http.Request) {
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

	var name string
	var balance float64
	err = h.db.QueryRow(r.Context(),
		"SELECT name, current_balance FROM accounts WHERE id = $1 AND ledger_id = $2", id, ledgerID).Scan(&name, &balance)
	if err != nil {
		writeError(w, http.StatusNotFound, "Account not found")
		return
	}

	writeJSON(w, http.StatusOK, models.TallyResponse{
		AccountID:         id,
		AccountName:       name,
		CalculatedBalance: balance,
	})
}

// CheckTally compares actual vs calculated balance
func (h *TallyHandler) CheckTally(w http.ResponseWriter, r *http.Request) {
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

	var req models.TallyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var name string
	var balance float64
	err = h.db.QueryRow(r.Context(),
		"SELECT name, current_balance FROM accounts WHERE id = $1 AND ledger_id = $2", id, ledgerID).Scan(&name, &balance)
	if err != nil {
		writeError(w, http.StatusNotFound, "Account not found")
		return
	}

	diff := req.ActualBalance - balance

	writeJSON(w, http.StatusOK, models.TallyResponse{
		AccountID:         id,
		AccountName:       name,
		CalculatedBalance: balance,
		ActualBalance:     req.ActualBalance,
		Difference:        diff,
	})
}

// Summary returns monthly totals grouped by entity
func (h *TallyHandler) Summary(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	month := r.URL.Query().Get("month") // Format: 2026-03
	if month == "" {
		writeError(w, http.StatusBadRequest, "month query parameter is required (format: YYYY-MM)")
		return
	}

	dateFrom := month + "-01"
	// Parse to compute the real last day of the month, avoiding invalid dates like April-31
	t, err := time.Parse("2006-01", month)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid month format, expected YYYY-MM")
		return
	}
	// First day of next month minus one day = last day of this month
	firstOfNext := time.Date(t.Year(), t.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	dateTo := firstOfNext.AddDate(0, 0, -1).Format("2006-01-02")

	resp := models.SummaryResponse{Month: month}
	err = h.db.QueryRow(r.Context(), `
		SELECT
			COALESCE(SUM(CASE WHEN nature = 'INCOME' THEN amount ELSE 0 END), 0) as total_income,
			COALESCE(SUM(CASE WHEN nature = 'EXPENSE' THEN amount ELSE 0 END), 0) as total_expense,
			COALESCE(SUM(CASE WHEN nature = 'EMI_PAYMENT' THEN amount ELSE 0 END), 0) as total_emi,
			COALESCE(SUM(CASE WHEN nature = 'LOAN_DISBURSEMENT' THEN amount ELSE 0 END), 0) as total_loan
		FROM transactions
		WHERE ledger_id = $1 AND transaction_date >= $2 AND transaction_date <= $3`,
		ledgerID, dateFrom, dateTo).Scan(&resp.TotalIncome, &resp.TotalExpense, &resp.TotalEMI, &resp.TotalLoan)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch summary")
		return
	}
	resp.NetFlow = resp.TotalIncome + resp.TotalLoan - resp.TotalExpense - resp.TotalEMI

	writeJSON(w, http.StatusOK, resp)
}

// SummaryRange returns monthly totals for each month in [from, to], zero-filled for months with no transactions
func (h *TallyHandler) SummaryRange(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" || to == "" {
		writeError(w, http.StatusBadRequest, "from and to query parameters are required (format: YYYY-MM)")
		return
	}

	fromT, err := time.Parse("2006-01", from)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid from format, expected YYYY-MM")
		return
	}
	toT, err := time.Parse("2006-01", to)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid to format, expected YYYY-MM")
		return
	}
	if toT.Before(fromT) {
		writeError(w, http.StatusBadRequest, "to must not be before from")
		return
	}

	months := int(toT.Year()-fromT.Year())*12 + int(toT.Month()-fromT.Month()) + 1
	if months > 60 {
		writeError(w, http.StatusBadRequest, "Range too large, maximum 60 months")
		return
	}

	dateFrom := fromT.Format("2006-01-02")
	firstOfNextAfterTo := time.Date(toT.Year(), toT.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	dateTo := firstOfNextAfterTo.AddDate(0, 0, -1).Format("2006-01-02")

	rows, err := h.db.Query(r.Context(), `
		SELECT
			to_char(date_trunc('month', transaction_date), 'YYYY-MM') as month,
			COALESCE(SUM(CASE WHEN nature = 'INCOME' THEN amount ELSE 0 END), 0) as total_income,
			COALESCE(SUM(CASE WHEN nature = 'EXPENSE' THEN amount ELSE 0 END), 0) as total_expense,
			COALESCE(SUM(CASE WHEN nature = 'EMI_PAYMENT' THEN amount ELSE 0 END), 0) as total_emi,
			COALESCE(SUM(CASE WHEN nature = 'LOAN_DISBURSEMENT' THEN amount ELSE 0 END), 0) as total_loan
		FROM transactions
		WHERE ledger_id = $1 AND transaction_date >= $2 AND transaction_date <= $3
		GROUP BY date_trunc('month', transaction_date)`,
		ledgerID, dateFrom, dateTo)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch summary range")
		return
	}
	defer rows.Close()

	byMonth := make(map[string]models.SummaryResponse)
	for rows.Next() {
		var s models.SummaryResponse
		if err := rows.Scan(&s.Month, &s.TotalIncome, &s.TotalExpense, &s.TotalEMI, &s.TotalLoan); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to fetch summary range")
			return
		}
		s.NetFlow = s.TotalIncome + s.TotalLoan - s.TotalExpense - s.TotalEMI
		byMonth[s.Month] = s
	}

	result := make([]models.SummaryResponse, 0, months)
	for i := 0; i < months; i++ {
		d := time.Date(fromT.Year(), fromT.Month()+time.Month(i), 1, 0, 0, 0, 0, time.UTC)
		key := d.Format("2006-01")
		if s, ok := byMonth[key]; ok {
			result = append(result, s)
		} else {
			result = append(result, models.SummaryResponse{Month: key})
		}
	}

	writeJSON(w, http.StatusOK, result)
}
