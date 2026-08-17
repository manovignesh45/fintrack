package handlers

import (
	"encoding/json"
	"net/http"
	"sort"
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
		writeInternalError(w, err, "Failed to fetch summary")
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
		writeInternalError(w, err, "Failed to fetch summary range")
		return
	}
	defer rows.Close()

	byMonth := make(map[string]models.SummaryResponse)
	for rows.Next() {
		var s models.SummaryResponse
		if err := rows.Scan(&s.Month, &s.TotalIncome, &s.TotalExpense, &s.TotalEMI, &s.TotalLoan); err != nil {
			writeInternalError(w, err, "Failed to fetch summary range")
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

// CategoryBreakdown returns, for the given [from, to] month range and nature,
// per-category totals (with their sub-category totals nested) so the
// frontend can chart "where did the money go" and drill into a category.
// Categories/sub-categories with no transactions in range are omitted.
func (h *TallyHandler) CategoryBreakdown(w http.ResponseWriter, r *http.Request) {
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
	nature := models.TxNature(r.URL.Query().Get("nature"))
	if nature == "" {
		nature = models.NatureExpense
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

	dateFrom := fromT.Format("2006-01-02")
	firstOfNextAfterTo := time.Date(toT.Year(), toT.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	dateTo := firstOfNextAfterTo.AddDate(0, 0, -1).Format("2006-01-02")

	rows, err := h.db.Query(r.Context(), `
		SELECT c.id, c.name, sc.id, sc.name,
			COALESCE(SUM(t.amount), 0) AS total
		FROM sub_categories sc
		JOIN categories c ON c.id = sc.category_id
		LEFT JOIN transactions t ON t.sub_category_id = sc.id
			AND t.ledger_id = $1 AND t.transaction_date >= $2 AND t.transaction_date <= $3
		WHERE c.ledger_id = $1 AND c.nature = $4
		GROUP BY c.id, c.name, sc.id, sc.name`,
		ledgerID, dateFrom, dateTo, nature)
	if err != nil {
		writeInternalError(w, err, "Failed to fetch category breakdown")
		return
	}
	defer rows.Close()

	byCategory := make(map[int]*models.CategoryBreakdown)
	var order []int
	for rows.Next() {
		var catID, subID int
		var catName, subName string
		var total float64
		if err := rows.Scan(&catID, &catName, &subID, &subName, &total); err != nil {
			writeInternalError(w, err, "Failed to scan category breakdown")
			return
		}
		if total == 0 {
			continue
		}
		cat, ok := byCategory[catID]
		if !ok {
			cat = &models.CategoryBreakdown{CategoryID: catID, CategoryName: catName}
			byCategory[catID] = cat
			order = append(order, catID)
		}
		cat.Total += total
		cat.SubCategories = append(cat.SubCategories, models.SubCategoryBreakdown{
			SubCategoryID:   subID,
			SubCategoryName: subName,
			Total:           total,
		})
	}

	result := make([]models.CategoryBreakdown, 0, len(order)+1)
	for _, id := range order {
		result = append(result, *byCategory[id])
	}

	// EMI payments aren't categorized like expenses — they're tied to the
	// target loan account instead (see validateTransactionReq/applyBalanceChange),
	// so they never carry a sub_category_id and are invisible to the query
	// above. "Expense" already means "expense + EMI" everywhere else on the
	// summary page (grand total, monthly trend), so fold EMI in here too,
	// grouped by loan account standing in for a sub-category.
	if nature == models.NatureExpense {
		emiRows, err := h.db.Query(r.Context(), `
			SELECT a.id, a.name, COALESCE(SUM(t.amount), 0) AS total
			FROM transactions t
			JOIN accounts a ON a.id = t.target_account_id
			WHERE t.ledger_id = $1 AND t.nature = 'EMI_PAYMENT'
				AND t.transaction_date >= $2 AND t.transaction_date <= $3
			GROUP BY a.id, a.name`,
			ledgerID, dateFrom, dateTo)
		if err != nil {
			writeInternalError(w, err, "Failed to fetch EMI breakdown")
			return
		}
		defer emiRows.Close()

		emi := models.CategoryBreakdown{CategoryID: -1, CategoryName: "EMI Payments"}
		for emiRows.Next() {
			var accountID int
			var accountName string
			var total float64
			if err := emiRows.Scan(&accountID, &accountName, &total); err != nil {
				writeInternalError(w, err, "Failed to scan EMI breakdown")
				return
			}
			if total == 0 {
				continue
			}
			emi.Total += total
			emi.SubCategories = append(emi.SubCategories, models.SubCategoryBreakdown{
				SubCategoryID:   accountID,
				SubCategoryName: accountName,
				Total:           total,
			})
		}
		if emi.Total > 0 {
			result = append(result, emi)
		}
	}

	sort.Slice(result, func(i, j int) bool { return result[i].Total > result[j].Total })
	for i := range result {
		subs := result[i].SubCategories
		sort.Slice(subs, func(a, b int) bool { return subs[a].Total > subs[b].Total })
	}

	writeJSON(w, http.StatusOK, result)
}
