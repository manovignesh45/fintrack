package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/fintrack/backend/internal/models"
)

// ImportCSV expects a multipart form with a "file" field containing the CSV.
func (h *AccountHandler) ImportCSV(w http.ResponseWriter, r *http.Request) {
	userID, err := GetUserID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	err = r.ParseMultipartForm(10 << 20) // 10MB
	if err != nil {
		writeError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "File 'file' is required")
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1 // Allow variable number of fields per record
	reader.LazyQuotes = true
	records, err := reader.ReadAll()
	if err != nil || len(records) < 2 {
		writeError(w, http.StatusBadRequest, "Invalid CSV format or empty file")
		return
	}

	// Find the header row (look for "Date" and "Amount")
	var headerRowIdx int = -1
	var headers []string
	colIdx := make(map[string]int)

	for i, row := range records {
		for _, col := range row {
			if strings.ToLower(strings.TrimSpace(col)) == "date" || strings.ToLower(strings.TrimSpace(col)) == "transaction_date" {
				headerRowIdx = i
				headers = row
				break
			}
		}
		if headerRowIdx != -1 {
			for j, h := range headers {
				colIdx[strings.ToLower(strings.TrimSpace(h))] = j
			}
			break
		}
	}

	if headerRowIdx == -1 {
		writeError(w, http.StatusBadRequest, "Could not find header row in CSV")
		return
	}

	// Only process records after the header row
	dataRecords := records[headerRowIdx+1:]

	ctx := r.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Helper to get or create Ledger
	ledgers := make(map[string]int) // Name -> ID
	getLedgerID := func(name string) (int, error) {
		name = strings.TrimSpace(name)
		if name == "" {
			name = "Personal" // Default fallback
		}
		name = strings.ToUpper(name) // Standardize to HOME / PERSONAL

		if id, ok := ledgers[name]; ok {
			return id, nil
		}
		var id int
		err := tx.QueryRow(ctx, "SELECT id FROM ledgers WHERE user_id = $1 AND name = $2", userID, name).Scan(&id)
		if err == nil {
			ledgers[name] = id
			return id, nil
		}
		// Create
		err = tx.QueryRow(ctx, "INSERT INTO ledgers (user_id, name) VALUES ($1, $2) RETURNING id", userID, name).Scan(&id)
		if err != nil {
			return 0, err
		}
		ledgers[name] = id
		return id, nil
	}

	// Helper to get or create Account
	accounts := make(map[string]int) // LedgerID_Name -> ID
	getAccountID := func(ledgerID int, name string, acctType models.AccountType) (int, error) {
		name = strings.TrimSpace(name)
		if name == "" {
			return 0, nil
		}
		key := fmt.Sprintf("%d_%s", ledgerID, name)
		if id, ok := accounts[key]; ok {
			return id, nil
		}
		var id int
		err := tx.QueryRow(ctx, "SELECT id FROM accounts WHERE ledger_id = $1 AND name = $2", ledgerID, name).Scan(&id)
		if err == nil {
			accounts[key] = id
			return id, nil
		}
		// Create
		err = tx.QueryRow(ctx, "INSERT INTO accounts (ledger_id, name, type, initial_balance, current_balance) VALUES ($1, $2, $3, 0, 0) RETURNING id", ledgerID, name, acctType).Scan(&id)
		if err != nil {
			return 0, err
		}
		accounts[key] = id
		return id, nil
	}

	// Helper to get or create Category/SubCategory
	categories := make(map[string]int) // LedgerID_Name -> ID
	getCategoryID := func(ledgerID int, nature models.TxNature, catName, subName string) (*int, error) {
		catName = strings.TrimSpace(catName)
		if catName == "" {
			return nil, nil
		}
		key := fmt.Sprintf("%d_%s_%s", ledgerID, catName, nature)
		var catID int
		if id, ok := categories[key]; ok {
			catID = id
		} else {
			err := tx.QueryRow(ctx, "SELECT id FROM categories WHERE ledger_id = $1 AND name = $2 AND nature = $3", ledgerID, catName, nature).Scan(&catID)
			if err != nil {
				err = tx.QueryRow(ctx, "INSERT INTO categories (ledger_id, name, nature) VALUES ($1, $2, $3) RETURNING id", ledgerID, catName, nature).Scan(&catID)
				if err != nil {
					return nil, err
				}
			}
			categories[key] = catID
		}

		subName = strings.TrimSpace(subName)
		if subName == "" {
			return nil, nil // return category? no, transaction takes sub_category_id
		}

		var subID int
		err := tx.QueryRow(ctx, "SELECT id FROM sub_categories WHERE category_id = $1 AND name = $2", catID, subName).Scan(&subID)
		if err == nil {
			return &subID, nil
		}
		err = tx.QueryRow(ctx, "INSERT INTO sub_categories (category_id, ledger_id, name) VALUES ($1, $2, $3) RETURNING id", catID, ledgerID, subName).Scan(&subID)
		if err != nil {
			return nil, err
		}
		return &subID, nil
	}

	for i, row := range dataRecords {

		safeGet := func(colNames ...string) string {
			for _, col := range colNames {
				if idx, ok := colIdx[col]; ok && idx < len(row) {
					return row[idx]
				}
			}
			return ""
		}

		entity := safeGet("entity")
		ledgerID, err := getLedgerID(entity)
		if err != nil {
			continue
		}

		title := safeGet("title")
		amountStr := safeGet("amount")
		amount, _ := strconv.ParseFloat(amountStr, 64)
		natureStr := safeGet("nature")
		nature := models.TxNature(strings.ToUpper(natureStr))
		
		sourceAcctName := safeGet("source account", "source_account")
		targetAcctName := safeGet("target account", "target_account")
		loanAcctName := safeGet("loan account", "loan_account")
		paymentMethod := safeGet("payment method", "payment_method")

		sourceAcctType := models.AccountTypeAsset
		targetAcctType := models.AccountTypeAsset

		if loanAcctName != "" {
			if nature == "EMI_PAYMENT" {
				targetAcctName = loanAcctName
				targetAcctType = models.AccountTypeLiability
			} else if nature == "LOAN_DISBURSEMENT" {
				sourceAcctName = loanAcctName
				sourceAcctType = models.AccountTypeLiability
			}
		}

		sourceAcctID, err := getAccountID(ledgerID, sourceAcctName, sourceAcctType)
		if err != nil || sourceAcctID == 0 {
			// fallback
			sourceAcctID, _ = getAccountID(ledgerID, "Default Account", models.AccountTypeAsset)
		}

		var targetAcctID *int
		if targetAcctName != "" {
			tID, err := getAccountID(ledgerID, targetAcctName, targetAcctType)
			if err == nil {
				targetAcctID = &tID
			}
		}

		categoryName := safeGet("category")
		subCategoryName := safeGet("sub category", "sub_category")
		if categoryName == "" && subCategoryName != "" {
			categoryName = "Imported"
		}
		subCategoryID, _ := getCategoryID(ledgerID, nature, categoryName, subCategoryName)

		dateStr := safeGet("date", "transaction_date")
		if dateStr == "" {
			dateStr = time.Now().Format("2006-01-02")
		}

		notes := safeGet("notes")
		
		var principalAmount, interestAmount float64
		if nature == "EMI_PAYMENT" {
			if strings.Contains(strings.ToLower(title), "interest only") || strings.Contains(strings.ToLower(title), "interest") {
				interestAmount = amount
				principalAmount = 0
			} else {
				principalAmount = amount
				interestAmount = 0
			}
		} else if nature == "LOAN_DISBURSEMENT" {
			principalAmount = amount
			interestAmount = 0
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO transactions 
			(ledger_id, title, amount, nature, source_account_id, target_account_id, sub_category_id, payment_method, transaction_date, notes, principal_amount, interest_amount) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			ledgerID, title, amount, nature, sourceAcctID, targetAcctID, subCategoryID, paymentMethod, dateStr, notes, principalAmount, interestAmount)
		
		if err != nil {
			fmt.Printf("Error inserting row %d: %v\n", i, err)
		} else {
			// Apply balance changes
			err = applyBalanceChange(ctx, tx, ledgerID, nature, sourceAcctID, targetAcctID, amount, principalAmount)
			if err != nil {
				fmt.Printf("Error applying balance for row %d: %v\n", i, err)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to commit import")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Import successful"})
}
