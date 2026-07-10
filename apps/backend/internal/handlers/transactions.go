package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"

	"github.com/fintrack/backend/internal/models"
)

type TransactionHandler struct {
	db *pgxpool.Pool
}

func NewTransactionHandler(db *pgxpool.Pool) *TransactionHandler {
	return &TransactionHandler{db: db}
}

func (h *TransactionHandler) List(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	q := r.URL.Query()

	query := `SELECT id, ledger_id, title, amount, nature, source_account_id,
		target_account_id, sub_category_id, payment_method_id,
		notes, principal_amount, interest_amount, transaction_date, created_at
		FROM transactions WHERE ledger_id = $1`
	args := []interface{}{ledgerID}
	argIdx := 2

	if v := q.Get("nature"); v != "" {
		query += fmt.Sprintf(" AND nature = $%d", argIdx)
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("account_id"); v != "" {
		query += fmt.Sprintf(" AND (source_account_id = $%d OR target_account_id = $%d)", argIdx, argIdx)
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("date_from"); v != "" {
		query += fmt.Sprintf(" AND transaction_date >= $%d", argIdx)
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("date_to"); v != "" {
		query += fmt.Sprintf(" AND transaction_date <= $%d", argIdx)
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("sub_category_id"); v != "" {
		query += fmt.Sprintf(" AND sub_category_id = $%d", argIdx)
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("category_id"); v != "" {
		query += fmt.Sprintf(" AND sub_category_id IN (SELECT id FROM sub_categories WHERE category_id = $%d)", argIdx)
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("search"); v != "" {
		query += fmt.Sprintf(" AND (LOWER(title) LIKE LOWER('%%' || $%d || '%%') OR LOWER(COALESCE(notes, '')) LIKE LOWER('%%' || $%d || '%%'))", argIdx, argIdx)
		args = append(args, v)
		argIdx++
	}

	query += " ORDER BY transaction_date DESC, created_at DESC"

	// Pagination
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(q.Get("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, perPage, offset)

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch transactions")
		return
	}
	defer rows.Close()

	var transactions []models.Transaction
	for rows.Next() {
		t, err := scanTransaction(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to scan transaction")
			return
		}
		transactions = append(transactions, t)
	}

	if transactions == nil {
		transactions = []models.Transaction{}
	}

	writeJSON(w, http.StatusOK, transactions)
}

func (h *TransactionHandler) Export(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	format := chi.URLParam(r, "format")
	q := r.URL.Query()

	query := `SELECT t.id, t.ledger_id, t.title, t.amount, t.nature, t.source_account_id,
		t.target_account_id, t.sub_category_id, t.payment_method_id,
		t.notes, t.principal_amount, t.interest_amount, t.transaction_date, t.created_at,
		ta.name as target_account_name,
		sc.name as sub_category_name, c.name as category_name
		FROM transactions t
		LEFT JOIN accounts ta ON t.target_account_id = ta.id
		LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
		LEFT JOIN categories c ON sc.category_id = c.id
		WHERE t.ledger_id = $1`
	args := []interface{}{ledgerID}
	argIdx := 2

	if v := q.Get("nature"); v != "" {
		query += fmt.Sprintf(" AND t.nature = $%d", argIdx)
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("account_id"); v != "" {
		query += fmt.Sprintf(" AND (t.source_account_id = $%d OR t.target_account_id = $%d)", argIdx, argIdx)
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("date_from"); v != "" {
		query += fmt.Sprintf(" AND t.transaction_date >= $%d", argIdx)
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("date_to"); v != "" {
		query += fmt.Sprintf(" AND t.transaction_date <= $%d", argIdx)
		args = append(args, v)
		argIdx++
	}

	query += " ORDER BY t.transaction_date DESC, t.created_at DESC"

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch transactions for export")
		return
	}
	defer rows.Close()

	type ExportRow struct {
		models.Transaction
		TargetAccountName *string
		SubCategoryName   *string
		CategoryName      *string
	}

	var data []ExportRow
	for rows.Next() {
		var er ExportRow
		var paymentMethodID *int
		var notes, targetName, subCatName, catName *string
		var txDate time.Time
		err := rows.Scan(&er.ID, &er.LedgerID, &er.Title, &er.Amount, &er.Nature, &er.SourceAccountID,
			&er.TargetAccountID, &er.SubCategoryID, &paymentMethodID,
			&notes, &er.PrincipalAmount, &er.InterestAmount, &txDate, &er.CreatedAt,
			&targetName, &subCatName, &catName)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to scan row")
			return
		}
		if paymentMethodID != nil {
			er.PaymentMethodID = paymentMethodID
		}
		if notes != nil {
			er.Notes = *notes
		}
		er.TargetAccountName = targetName
		er.SubCategoryName = subCatName
		er.CategoryName = catName
		er.TransactionDate = txDate.Format("2006-01-02")
		data = append(data, er)
	}

	totalIncome := 0.0
	totalExpense := 0.0
	for _, d := range data {
		if d.Nature == "INCOME" || d.Nature == "LOAN_DISBURSEMENT" {
			totalIncome += d.Amount
		} else if d.Nature == "EXPENSE" || d.Nature == "EMI_PAYMENT" {
			totalExpense += d.Amount
		}
	}

	headers := []string{"Date", "Title", "Amount", "Nature", "Loan Account", "Category", "Sub Category", "Payment Method ID", "Notes"}

	if format == "csv" {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment;filename=transactions.csv")
		writer := csv.NewWriter(w)

		// Top summary for CSV
		writer.Write([]string{"SUMMARY"})
		writer.Write([]string{"Total Income", fmt.Sprintf("%.2f", totalIncome)})
		writer.Write([]string{"Total Expense", fmt.Sprintf("%.2f", totalExpense)})
		writer.Write([]string{"Difference", fmt.Sprintf("%.2f", totalIncome-totalExpense)})
		writer.Write([]string{}) // Empty row separator

		writer.Write(headers)
		for _, d := range data {
			loanAccount := ""
			if d.TargetAccountName != nil {
				loanAccount = *d.TargetAccountName
			}
			cat := ""
			if d.CategoryName != nil {
				cat = *d.CategoryName
			}
			subCat := ""
			if d.SubCategoryName != nil {
				subCat = *d.SubCategoryName
			}
			pmID := ""
			if d.PaymentMethodID != nil {
				pmID = fmt.Sprintf("%d", *d.PaymentMethodID)
			}
			writer.Write([]string{
				d.TransactionDate,
				d.Title,
				fmt.Sprintf("%.2f", d.Amount),
				string(d.Nature),
				loanAccount,
				cat,
				subCat,
				pmID,
				d.Notes,
			})
		}

		writer.Flush()
		return
	} else if format == "excel" {
		f := excelize.NewFile()
		sheet := "Transactions"
		f.SetSheetName("Sheet1", sheet)

		// Top summary for Excel
		f.SetCellValue(sheet, "A1", "SUMMARY")
		f.SetCellValue(sheet, "A2", "Total Income")
		f.SetCellValue(sheet, "B2", totalIncome)
		f.SetCellValue(sheet, "A3", "Total Expense")
		f.SetCellValue(sheet, "B3", totalExpense)
		f.SetCellValue(sheet, "A4", "Difference")
		f.SetCellValue(sheet, "B4", totalIncome-totalExpense)

		// Set headers
		headerRowIdx := 6
		for i, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(i+1, headerRowIdx)
			f.SetCellValue(sheet, cell, h)
		}

		// Set data
		for i, d := range data {
			rowIdx := i + headerRowIdx + 1
			loanAccount := ""
			if d.TargetAccountName != nil {
				loanAccount = *d.TargetAccountName
			}
			cat := ""
			if d.CategoryName != nil {
				cat = *d.CategoryName
			}
			subCat := ""
			if d.SubCategoryName != nil {
				subCat = *d.SubCategoryName
			}
			f.SetCellValue(sheet, fmt.Sprintf("A%d", rowIdx), d.TransactionDate)
			f.SetCellValue(sheet, fmt.Sprintf("B%d", rowIdx), d.Title)
			f.SetCellValue(sheet, fmt.Sprintf("C%d", rowIdx), d.Amount)
			f.SetCellValue(sheet, fmt.Sprintf("D%d", rowIdx), string(d.Nature))
			f.SetCellValue(sheet, fmt.Sprintf("E%d", rowIdx), loanAccount)
			f.SetCellValue(sheet, fmt.Sprintf("F%d", rowIdx), cat)
			f.SetCellValue(sheet, fmt.Sprintf("G%d", rowIdx), subCat)
			pmID := ""
			if d.PaymentMethodID != nil {
				pmID = fmt.Sprintf("%d", *d.PaymentMethodID)
			}
			f.SetCellValue(sheet, fmt.Sprintf("H%d", rowIdx), pmID)
			f.SetCellValue(sheet, fmt.Sprintf("I%d", rowIdx), d.Notes)
		}

		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", "attachment;filename=transactions.xlsx")
		if err := f.Write(w); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to write excel file")
		}
		return
	}

	writeError(w, http.StatusBadRequest, "Invalid format")
}

func (h *TransactionHandler) Get(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid transaction ID")
		return
	}

	row := h.db.QueryRow(r.Context(),
		`SELECT id, ledger_id, title, amount, nature, source_account_id,
			target_account_id, sub_category_id, payment_method_id,
			notes, principal_amount, interest_amount, transaction_date, created_at
		 FROM transactions WHERE id = $1 AND ledger_id = $2`, id, ledgerID)

	t, err := scanTransactionRow(row)
	if err != nil {
		writeError(w, http.StatusNotFound, "Transaction not found")
		return
	}

	writeJSON(w, http.StatusOK, t)
}

func (h *TransactionHandler) Create(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateTransactionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Default or correct source_account_id to the user's primary asset account if invalid or missing
	var accountExists bool
	if req.SourceAccountID > 0 {
		h.db.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM accounts WHERE id = $1 AND ledger_id = $2)", req.SourceAccountID, ledgerID).Scan(&accountExists)
	}
	if !accountExists {
		primaryID, err := h.getPrimaryAssetAccountID(r.Context(), ledgerID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Invalid source_account_id and no primary asset account found")
			return
		}
		req.SourceAccountID = primaryID
	}
	if err := validateTransactionReq(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	tx, err := h.db.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	// Insert the transaction
	var t models.Transaction
	row := tx.QueryRow(r.Context(),
		`INSERT INTO transactions (ledger_id, title, amount, nature, source_account_id, target_account_id,
			sub_category_id, payment_method_id, notes, principal_amount, interest_amount, transaction_date)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		 RETURNING id, ledger_id, title, amount, nature, source_account_id, target_account_id,
			sub_category_id, payment_method_id, notes, principal_amount, interest_amount,
			transaction_date, created_at`,
		ledgerID, req.Title, req.Amount, req.Nature, req.SourceAccountID, req.TargetAccountID,
		req.SubCategoryID, req.PaymentMethodID, nilIfEmpty(req.Notes),
		req.PrincipalAmount, req.InterestAmount, req.TransactionDate,
	)
	t, err = scanTransactionRow(row)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create transaction: " + err.Error())
		return
	}

	// Apply balance changes
	if err := applyBalanceChange(r.Context(), tx, ledgerID, req.Nature, req.SourceAccountID, req.TargetAccountID, req.Amount, req.PrincipalAmount); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update account balances")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	writeJSON(w, http.StatusCreated, t)
}

func (h *TransactionHandler) Update(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid transaction ID")
		return
	}

	var req models.UpdateTransactionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Default source_account_id to the user's primary asset account when not provided
	if req.SourceAccountID == 0 {
		primaryID, err := h.getPrimaryAssetAccountID(r.Context(), ledgerID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "source_account_id not provided and no primary asset account found")
			return
		}
		req.SourceAccountID = primaryID
	}
	if err := validateTransactionReq(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	tx, err := h.db.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	// Get existing transaction to reverse its balance impact
	row := tx.QueryRow(r.Context(),
		`SELECT id, ledger_id, title, amount, nature, source_account_id,
			target_account_id, sub_category_id, payment_method_id,
			notes, principal_amount, interest_amount, transaction_date, created_at
		 FROM transactions WHERE id = $1 AND ledger_id = $2 FOR UPDATE`, id, ledgerID)
	old, err := scanTransactionRow(row)
	if err != nil {
		writeError(w, http.StatusNotFound, "Transaction not found")
		return
	}

	// Reverse old balance impact
	if err := reverseBalanceChange(r.Context(), tx, ledgerID, old.Nature, old.SourceAccountID, old.TargetAccountID, old.Amount, old.PrincipalAmount); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to reverse old balance")
		return
	}

	// Update the transaction
	var t models.Transaction
	updateRow := tx.QueryRow(r.Context(),
		`UPDATE transactions SET title=$1, amount=$2, nature=$3, source_account_id=$4,
			target_account_id=$5, sub_category_id=$6, payment_method_id=$7,
			notes=$8, principal_amount=$9, interest_amount=$10, transaction_date=$11
		 WHERE id=$12 AND ledger_id=$13
		 RETURNING id, ledger_id, title, amount, nature, source_account_id, target_account_id,
			sub_category_id, payment_method_id, notes, principal_amount, interest_amount,
			transaction_date, created_at`,
		req.Title, req.Amount, req.Nature, req.SourceAccountID, req.TargetAccountID,
		req.SubCategoryID, req.PaymentMethodID, nilIfEmpty(req.Notes),
		req.PrincipalAmount, req.InterestAmount, req.TransactionDate, id, ledgerID,
	)
	t, err = scanTransactionRow(updateRow)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update transaction")
		return
	}

	// Apply new balance changes
	if err := applyBalanceChange(r.Context(), tx, ledgerID, req.Nature, req.SourceAccountID, req.TargetAccountID, req.Amount, req.PrincipalAmount); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update account balances")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	writeJSON(w, http.StatusOK, t)
}

func (h *TransactionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid transaction ID")
		return
	}

	tx, err := h.db.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	// Get existing transaction to reverse its balance
	row := tx.QueryRow(r.Context(),
		`SELECT id, ledger_id, title, amount, nature, source_account_id,
			target_account_id, sub_category_id, payment_method,
			notes, principal_amount, interest_amount, transaction_date, created_at
		 FROM transactions WHERE id = $1 AND ledger_id = $2 FOR UPDATE`, id, ledgerID)
	old, err := scanTransactionRow(row)
	if err != nil {
		writeError(w, http.StatusNotFound, "Transaction not found")
		return
	}

	// Reverse balance impact
	if err := reverseBalanceChange(r.Context(), tx, ledgerID, old.Nature, old.SourceAccountID, old.TargetAccountID, old.Amount, old.PrincipalAmount); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to reverse balance")
		return
	}

	// Delete the transaction
	_, err = tx.Exec(r.Context(), "DELETE FROM transactions WHERE id = $1 AND ledger_id = $2", id, ledgerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete transaction")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to commit")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// --- Balance Logic ---

func applyBalanceChange(ctx context.Context, tx pgx.Tx, ledgerID int, nature models.TxNature, sourceID int, targetID *int, amount, principalAmount float64) error {
	switch nature {
	case models.NatureIncome:
		_, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2 AND ledger_id = $3", amount, sourceID, ledgerID)
		return err
	case models.NatureExpense:
		_, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2 AND ledger_id = $3", amount, sourceID, ledgerID)
		return err
	case models.NatureTransfer:
		if targetID == nil {
			return fmt.Errorf("target account required for transfer")
		}
		if _, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2 AND ledger_id = $3", amount, sourceID, ledgerID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2 AND ledger_id = $3", amount, *targetID, ledgerID)
		return err
	case models.NatureEMIPayment:
		if targetID == nil {
			return fmt.Errorf("target loan account required for EMI payment")
		}
		// Source (bank) decreases by total amount (principal + interest)
		if _, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2 AND ledger_id = $3", amount, sourceID, ledgerID); err != nil {
			return err
		}
		// Target (loan) balance decreases by principal_amount only (interest is just a cost)
		// Subtract principal from loan balance to reduce the amount owed
		if principalAmount > 0 {
			_, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2 AND ledger_id = $3", principalAmount, *targetID, ledgerID)
			return err
		}
		return nil
	case models.NatureLoanDisbursement:
		// Source (loan) increases by amount (you owe more); bank account not tracked
		_, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2 AND ledger_id = $3", amount, sourceID, ledgerID)
		return err
	}
	return fmt.Errorf("unknown nature: %s", nature)
}

func reverseBalanceChange(ctx context.Context, tx pgx.Tx, ledgerID int, nature models.TxNature, sourceID int, targetID *int, amount, principalAmount float64) error {
	switch nature {
	case models.NatureIncome:
		_, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2 AND ledger_id = $3", amount, sourceID, ledgerID)
		return err
	case models.NatureExpense:
		_, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2 AND ledger_id = $3", amount, sourceID, ledgerID)
		return err
	case models.NatureTransfer:
		if targetID == nil {
			return nil
		}
		if _, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2 AND ledger_id = $3", amount, sourceID, ledgerID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2 AND ledger_id = $3", amount, *targetID, ledgerID)
		return err
	case models.NatureEMIPayment:
		if _, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2 AND ledger_id = $3", amount, sourceID, ledgerID); err != nil {
			return err
		}
		if targetID != nil && principalAmount > 0 {
			_, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2 AND ledger_id = $3", principalAmount, *targetID, ledgerID)
			return err
		}
		return nil
	case models.NatureLoanDisbursement:
		// Reverse: decrease loan, decrease bank
		if _, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2 AND ledger_id = $3", amount, sourceID, ledgerID); err != nil {
			return err
		}
		if targetID != nil {
			_, err := tx.Exec(ctx, "UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2 AND ledger_id = $3", amount, *targetID, ledgerID)
			return err
		}
		return nil
	}
	return nil
}

// --- Helpers ---

func validateTransactionReq(req *models.CreateTransactionReq) error {
	if strings.TrimSpace(req.Title) == "" {
		return fmt.Errorf("title is required")
	}
	if req.Amount <= 0 {
		return fmt.Errorf("amount must be positive")
	}
	if req.SourceAccountID <= 0 {
		return fmt.Errorf("source_account_id is required")
	}
	if req.TransactionDate == "" {
		return fmt.Errorf("transaction_date is required")
	}

	switch req.Nature {
	case models.NatureIncome, models.NatureExpense:
		// OK, no target needed
	case models.NatureTransfer, models.NatureEMIPayment:
		if req.TargetAccountID == nil || *req.TargetAccountID <= 0 {
			return fmt.Errorf("target_account_id is required for %s", req.Nature)
		}
	case models.NatureLoanDisbursement:
		// target_account_id not required — bank account is not tracked in simplified model
	default:
		return fmt.Errorf("nature must be INCOME, EXPENSE, TRANSFER, EMI_PAYMENT, or LOAN_DISBURSEMENT")
	}

	if req.Nature == models.NatureEMIPayment {
		if req.PrincipalAmount < 0 || req.InterestAmount < 0 {
			return fmt.Errorf("principal and interest amounts cannot be negative")
		}
		if req.PrincipalAmount+req.InterestAmount != req.Amount {
			return fmt.Errorf("principal + interest must equal total amount")
		}
	}

	return nil
}

func scanTransaction(rows pgx.Rows) (models.Transaction, error) {
	var t models.Transaction
	var paymentMethodID *int
	var notes *string
	var txDate time.Time
	err := rows.Scan(&t.ID, &t.LedgerID, &t.Title, &t.Amount, &t.Nature, &t.SourceAccountID,
		&t.TargetAccountID, &t.SubCategoryID, &paymentMethodID,
		&notes, &t.PrincipalAmount, &t.InterestAmount, &txDate, &t.CreatedAt)
	if paymentMethodID != nil {
		t.PaymentMethodID = paymentMethodID
	}
	if notes != nil {
		t.Notes = *notes
	}
	t.TransactionDate = txDate.Format("2006-01-02")
	return t, err
}

func scanTransactionRow(row pgx.Row) (models.Transaction, error) {
	var t models.Transaction
	var paymentMethodID *int
	var notes *string
	var txDate time.Time
	err := row.Scan(&t.ID, &t.LedgerID, &t.Title, &t.Amount, &t.Nature, &t.SourceAccountID,
		&t.TargetAccountID, &t.SubCategoryID, &paymentMethodID,
		&notes, &t.PrincipalAmount, &t.InterestAmount, &txDate, &t.CreatedAt)
	if paymentMethodID != nil {
		t.PaymentMethodID = paymentMethodID
	}
	if notes != nil {
		t.Notes = *notes
	}
	t.TransactionDate = txDate.Format("2006-01-02")
	return t, err
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// getPrimaryAssetAccountID returns the first active ASSET account ID for the given user.
func (h *TransactionHandler) getPrimaryAssetAccountID(ctx context.Context, ledgerID int) (int, error) {
	var id int
	err := h.db.QueryRow(ctx,
		`SELECT id FROM accounts WHERE ledger_id = $1 AND type = 'ASSET' AND is_active = true ORDER BY id LIMIT 1`,
		ledgerID).Scan(&id)
	return id, err
}
