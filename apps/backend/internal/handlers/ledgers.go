package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/fintrack/backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
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

	// Seed default categories for this newly created ledger
	_ = SeedDefaultCategories(r.Context(), h.db, l.ID)

	writeJSON(w, http.StatusCreated, l)
}

// SeedDefaultCategories seeds the basic useful categories and subcategories for a given ledger.
func SeedDefaultCategories(ctx context.Context, db *pgxpool.Pool, ledgerID int) error {
	categories := []struct {
		Nature  models.TxNature
		Label   string
		SubCats []string
	}{
		// Income
		{Nature: models.NatureIncome, Label: "Salary", SubCats: []string{}},
		{Nature: models.NatureIncome, Label: "Business Income", SubCats: []string{}},
		{Nature: models.NatureIncome, Label: "Investments", SubCats: []string{"Dividends", "Interest"}},
		{Nature: models.NatureIncome, Label: "Other Income", SubCats: []string{}},

		// Expense
		{Nature: models.NatureExpense, Label: "Food & Dining", SubCats: []string{"Groceries", "Restaurants & Takeout"}},
		{Nature: models.NatureExpense, Label: "Transport", SubCats: []string{"Fuel", "Public Transport"}},
		{Nature: models.NatureExpense, Label: "Utilities", SubCats: []string{"Electricity", "Water", "Internet & Phone"}},
		{Nature: models.NatureExpense, Label: "Shopping", SubCats: []string{}},
		{Nature: models.NatureExpense, Label: "Health", SubCats: []string{"Medical", "Insurance"}},
		{Nature: models.NatureExpense, Label: "Entertainment", SubCats: []string{}},
		{Nature: models.NatureExpense, Label: "Housing", SubCats: []string{"Rent/Mortgage", "Maintenance"}},

		// Transfer — unchanged, not part of the reported confusion
		{Nature: models.NatureTransfer, Label: "Transfer", SubCats: []string{"Bank Transfer"}},
	}

	for _, c := range categories {
		var catID int
		err := db.QueryRow(ctx, "INSERT INTO categories (ledger_id, name, nature) VALUES ($1, $2, $3) RETURNING id", ledgerID, c.Label, c.Nature).Scan(&catID)
		if err != nil {
			return err
		}
		for _, sc := range c.SubCats {
			_, err = db.Exec(ctx, "INSERT INTO sub_categories (category_id, ledger_id, name) VALUES ($1, $2, $3)", catID, ledgerID, sc)
			if err != nil {
				return err
			}
		}
	}

	paymentMethods := []string{"GPay", "Amazon Pay", "HDFC UPI", "Bank Transfer", "Cash"}
	for _, pm := range paymentMethods {
		_, err := db.Exec(ctx, "INSERT INTO payment_methods (ledger_id, name) VALUES ($1, $2)", ledgerID, pm)
		if err != nil {
			return err
		}
	}

	// Seed a default ASSET account so transactions have a fallback
	_, err := db.Exec(ctx, "INSERT INTO accounts (ledger_id, name, type, initial_balance, current_balance, is_active) VALUES ($1, 'Cash', 'ASSET', 0, 0, true)", ledgerID)
	if err != nil {
		return err
	}

	return nil
}
