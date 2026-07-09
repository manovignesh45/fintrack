package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

type OldAcct struct {
	name string
	acctType string
	ib, cb, ir interface{}
	isActive bool
	createdAt interface{}
}

type OldCat struct {
	name, nature string
	createdAt interface{}
}

type OldSubCat struct {
	catID int
	name string
	createdAt interface{}
}

func main() {
	// Connection strings
	sourceDSN := os.Getenv("SOURCE_DATABASE_URL")
	targetDSN := os.Getenv("TARGET_DATABASE_URL")
	
	if sourceDSN == "" || targetDSN == "" {
		log.Fatalf("SOURCE_DATABASE_URL and TARGET_DATABASE_URL environment variables are required")
	}

	ctx := context.Background()

	// Connect to source
	srcPool, err := pgxpool.New(ctx, sourceDSN)
	if err != nil {
		log.Fatalf("Failed to connect to source: %v", err)
	}
	defer srcPool.Close()

	// Connect to target
	tgtPool, err := pgxpool.New(ctx, targetDSN)
	if err != nil {
		log.Fatalf("Failed to connect to target: %v", err)
	}
	defer tgtPool.Close()

	fmt.Println("Connected to both databases.")

	// Wipe target tables cleanly
	fmt.Println("Wiping target database...")
	_, err = tgtPool.Exec(ctx, `TRUNCATE TABLE users, ledgers, accounts, categories, sub_categories, transactions, transaction_templates CASCADE`)
	if err != nil {
		log.Fatalf("Failed to truncate target tables: %v", err)
	}

	// 1. Migrate Users
	fmt.Println("Migrating Users...")
	userRows, err := srcPool.Query(ctx, "SELECT id, username, password_hash, created_at FROM users")
	if err != nil {
		log.Fatalf("Failed to query users: %v", err)
	}
	for userRows.Next() {
		var id int
		var username, pwd string
		var createdAt interface{}
		userRows.Scan(&id, &username, &pwd, &createdAt)
		_, err := tgtPool.Exec(ctx, "INSERT INTO users (id, username, password_hash, created_at) VALUES ($1, $2, $3, $4)", id, username, pwd, createdAt)
		if err != nil {
			log.Fatalf("Insert user failed: %v", err)
		}
	}
	userRows.Close()

	// Helper to track ledger IDs
	// Key: UserID_Entity (e.g., "1_PERSONAL") -> Value: LedgerID
	ledgers := make(map[string]int)

	getOrCreateLedger := func(userID int, entity string) int {
		key := fmt.Sprintf("%d_%s", userID, entity)
		if id, ok := ledgers[key]; ok {
			return id
		}
		var ledgerID int
		err := tgtPool.QueryRow(ctx, "INSERT INTO ledgers (user_id, name) VALUES ($1, $2) RETURNING id", userID, entity).Scan(&ledgerID)
		if err != nil {
			log.Fatalf("Failed to create ledger: %v", err)
		}
		ledgers[key] = ledgerID
		return ledgerID
	}

	// 2. Load Old Accounts
	fmt.Println("Migrating Accounts...")
	oldAccts := make(map[int]OldAcct)
	acctMap := make(map[int]map[int]int) // oldAcctID -> ledgerID -> newAcctID
	acctRows, err := srcPool.Query(ctx, "SELECT id, name, type, initial_balance, current_balance, is_active, created_at, interest_rate FROM accounts")
	if err != nil {
		log.Fatalf("Failed to query accounts: %v", err)
	}
	for acctRows.Next() {
		var id int
		var old OldAcct
		err := acctRows.Scan(&id, &old.name, &old.acctType, &old.ib, &old.cb, &old.isActive, &old.createdAt, &old.ir)
		if err != nil {
			log.Fatalf("Account scan failed: %v", err)
		}
		oldAccts[id] = old
		acctMap[id] = make(map[int]int)
	}
	acctRows.Close()

	getOrCreateNewAcct := func(oldID, ledgerID int) int {
		if newID, ok := acctMap[oldID][ledgerID]; ok {
			return newID
		}
		old := oldAccts[oldID]
		var newID int
		err := tgtPool.QueryRow(ctx, 
			`INSERT INTO accounts (ledger_id, name, type, initial_balance, current_balance, is_active, created_at, interest_rate) 
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
			ledgerID, old.name, old.acctType, old.ib, old.cb, old.isActive, old.createdAt, old.ir).Scan(&newID)
		if err != nil {
			log.Fatalf("Insert account failed: %v", err)
		}
		acctMap[oldID][ledgerID] = newID
		return newID
	}

	// 3. Load Old Categories
	fmt.Println("Migrating Categories...")
	oldCats := make(map[int]OldCat)
	catMap := make(map[int]map[int]int) // oldCatID -> ledgerID -> newCatID
	catRows, err := srcPool.Query(ctx, "SELECT id, name, nature, created_at FROM categories")
	if err != nil {
		log.Fatalf("Failed to query categories: %v", err)
	}
	for catRows.Next() {
		var id int
		var old OldCat
		catRows.Scan(&id, &old.name, &old.nature, &old.createdAt)
		oldCats[id] = old
		catMap[id] = make(map[int]int)
	}
	catRows.Close()

	getOrCreateNewCat := func(oldID, ledgerID int) int {
		if newID, ok := catMap[oldID][ledgerID]; ok {
			return newID
		}
		old := oldCats[oldID]
		var newID int
		err := tgtPool.QueryRow(ctx, 
			"INSERT INTO categories (ledger_id, name, nature, created_at) VALUES ($1, $2, $3, $4) RETURNING id",
			ledgerID, old.name, old.nature, old.createdAt).Scan(&newID)
		if err != nil {
			log.Fatalf("Insert category failed: %v", err)
		}
		catMap[oldID][ledgerID] = newID
		return newID
	}

	// 4. Load Old SubCategories
	fmt.Println("Migrating Sub Categories...")
	oldSubCats := make(map[int]OldSubCat)
	subCatMap := make(map[int]map[int]int) // oldSubCatID -> ledgerID -> newSubCatID
	subCatRows, err := srcPool.Query(ctx, "SELECT id, category_id, name, created_at FROM sub_categories")
	if err != nil {
		log.Fatalf("Failed to query sub categories: %v", err)
	}
	for subCatRows.Next() {
		var id int
		var old OldSubCat
		subCatRows.Scan(&id, &old.catID, &old.name, &old.createdAt)
		oldSubCats[id] = old
		subCatMap[id] = make(map[int]int)
	}
	subCatRows.Close()

	getOrCreateNewSubCat := func(oldID, ledgerID int) int {
		if newID, ok := subCatMap[oldID][ledgerID]; ok {
			return newID
		}
		old := oldSubCats[oldID]
		newCatID := getOrCreateNewCat(old.catID, ledgerID)
		var newID int
		err := tgtPool.QueryRow(ctx, 
			"INSERT INTO sub_categories (category_id, ledger_id, name, created_at) VALUES ($1, $2, $3, $4) RETURNING id",
			newCatID, ledgerID, old.name, old.createdAt).Scan(&newID)
		if err != nil {
			log.Fatalf("Insert sub category failed: %v", err)
		}
		subCatMap[oldID][ledgerID] = newID
		return newID
	}

	// 5. Migrate Transactions
	fmt.Println("Migrating Transactions...")
	txRows, err := srcPool.Query(ctx, "SELECT id, user_id, title, amount, nature, source_account_id, target_account_id, sub_category_id, entity, payment_method, notes, principal_amount, interest_amount, transaction_date, created_at FROM transactions")
	if err != nil {
		log.Fatalf("Failed to query tx: %v", err)
	}
	for txRows.Next() {
		var id int
		var userID *int
		var title, nature, entity string
		var amt, pAmt, iAmt interface{}
		var srcAcctID int
		var tgtAcctID, subCatID *int
		var paymentMethod, notes *string
		var txDate, createdAt interface{}
		
		err := txRows.Scan(&id, &userID, &title, &amt, &nature, &srcAcctID, &tgtAcctID, &subCatID, &entity, &paymentMethod, &notes, &pAmt, &iAmt, &txDate, &createdAt)
		if err != nil {
			log.Fatalf("Tx scan failed: %v", err)
		}

		uID := 1
		if userID != nil {
			uID = *userID
		}

		ledgerID := getOrCreateLedger(uID, entity)
		newSrcAcctID := getOrCreateNewAcct(srcAcctID, ledgerID)
		var newTgtAcctID *int
		if tgtAcctID != nil {
			mapped := getOrCreateNewAcct(*tgtAcctID, ledgerID)
			newTgtAcctID = &mapped
		}
		var newSubCatID *int
		if subCatID != nil {
			mapped := getOrCreateNewSubCat(*subCatID, ledgerID)
			newSubCatID = &mapped
		}

		_, err = tgtPool.Exec(ctx, 
			`INSERT INTO transactions (id, ledger_id, title, amount, nature, source_account_id, target_account_id, sub_category_id, payment_method, notes, principal_amount, interest_amount, transaction_date, created_at) 
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
			 id, ledgerID, title, amt, nature, newSrcAcctID, newTgtAcctID, newSubCatID, paymentMethod, notes, pAmt, iAmt, txDate, createdAt)
		if err != nil {
			log.Fatalf("Insert tx failed: %v", err)
		}
	}
	txRows.Close()

	// 6. Migrate Templates
	fmt.Println("Migrating Templates...")
	tmplRows, err := srcPool.Query(ctx, "SELECT id, title, amount, nature, source_account_id, target_account_id, sub_category_id, entity, payment_method, principal_amount, interest_amount, created_at FROM transaction_templates")
	if err == nil {
		for tmplRows.Next() {
			var id int
			var title, nature, entity string
			var amt, pAmt, iAmt interface{}
			var srcAcctID int
			var tgtAcctID, subCatID *int
			var paymentMethod *string
			var createdAt interface{}
			
			tmplRows.Scan(&id, &title, &amt, &nature, &srcAcctID, &tgtAcctID, &subCatID, &entity, &paymentMethod, &pAmt, &iAmt, &createdAt)

			var firstUserID int
			tgtPool.QueryRow(ctx, "SELECT id FROM users ORDER BY id LIMIT 1").Scan(&firstUserID)
			ledgerID := getOrCreateLedger(firstUserID, entity)
			
			newSrcAcctID := getOrCreateNewAcct(srcAcctID, ledgerID)
			var newTgtAcctID *int
			if tgtAcctID != nil {
				mapped := getOrCreateNewAcct(*tgtAcctID, ledgerID)
				newTgtAcctID = &mapped
			}
			var newSubCatID *int
			if subCatID != nil {
				mapped := getOrCreateNewSubCat(*subCatID, ledgerID)
				newSubCatID = &mapped
			}

			_, err = tgtPool.Exec(ctx, 
				`INSERT INTO transaction_templates (id, ledger_id, title, amount, nature, source_account_id, target_account_id, sub_category_id, payment_method, principal_amount, interest_amount, created_at) 
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
				 id, ledgerID, title, amt, nature, newSrcAcctID, newTgtAcctID, newSubCatID, paymentMethod, pAmt, iAmt, createdAt)
			if err != nil {
				log.Fatalf("Insert template failed: %v", err)
			}
		}
		tmplRows.Close()
	} else {
		fmt.Printf("Warning: Could not query templates: %v\n", err)
	}

	// Reset sequences
	tgtPool.Exec(ctx, "SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))")
	tgtPool.Exec(ctx, "SELECT setval('accounts_id_seq', (SELECT MAX(id) FROM accounts))")
	tgtPool.Exec(ctx, "SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions))")
	tgtPool.Exec(ctx, "SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))")
	tgtPool.Exec(ctx, "SELECT setval('sub_categories_id_seq', (SELECT MAX(id) FROM sub_categories))")

	fmt.Println("Migration completed successfully!")
}
