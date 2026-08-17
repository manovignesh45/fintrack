package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fintrack/backend/internal/models"
)

// Commitment statuses, resolved per month.
const (
	commitmentStatusPaid     = "PAID"
	commitmentStatusDue      = "DUE"
	commitmentStatusInactive = "INACTIVE"
)

const commitmentCols = `c.id, c.ledger_id, c.name, c.amount, c.nature, c.due_day,
	c.source_account_id, c.target_account_id, c.sub_category_id, c.payment_method_id,
	c.principal_amount, c.interest_amount, c.notes, c.is_active,
	c.start_month, c.end_month, c.sort_order, c.created_at, c.updated_at`

type CommitmentHandler struct {
	db *pgxpool.Pool
}

func NewCommitmentHandler(db *pgxpool.Pool) *CommitmentHandler {
	return &CommitmentHandler{db: db}
}

// List returns every commitment for the ledger resolved against a month, plus
// the month's totals. Paused commitments (and ones outside their start/end
// window) come back as INACTIVE and are excluded from the totals, so the client
// can still list and edit them.
func (h *CommitmentHandler) List(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	month, err := parseCommitmentMonth(r.URL.Query().Get("month"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid month, expected YYYY-MM")
		return
	}

	query := `SELECT ` + commitmentCols + `,
			p.id, p.ledger_id, p.commitment_id, p.period, p.transaction_id, p.amount, p.paid_on, p.created_at
		FROM commitments c
		LEFT JOIN commitment_payments p ON p.commitment_id = c.id AND p.period = $2
		WHERE c.ledger_id = $1
		ORDER BY c.sort_order, c.due_day, c.name`

	rows, err := h.db.Query(r.Context(), query, ledgerID, month)
	if err != nil {
		writeInternalError(w, err, "Failed to fetch commitments")
		return
	}
	defer rows.Close()

	resp := models.CommitmentsMonthResponse{
		Month: month.Format("2006-01"),
		Items: make([]models.CommitmentStatus, 0),
	}

	for rows.Next() {
		item, err := scanCommitmentWithPayment(rows, month)
		if err != nil {
			writeInternalError(w, err, "Failed to scan commitment")
			return
		}

		switch item.Status {
		case commitmentStatusPaid:
			resp.Total += item.Payment.Amount
			resp.PaidTotal += item.Payment.Amount
		case commitmentStatusDue:
			resp.Total += item.Amount
			resp.DueTotal += item.Amount
		}

		resp.Items = append(resp.Items, item)
	}
	if rows.Err() != nil {
		writeInternalError(w, err, "Failed to fetch commitments")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *CommitmentHandler) Create(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateCommitmentReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	sourceID, err := h.resolveSourceAccount(r.Context(), ledgerID, req.SourceAccountID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "No source account available. Create an asset account first.")
		return
	}
	req.SourceAccountID = sourceID

	startMonth, endMonth, err := normalizeCommitmentReq(&req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	row := h.db.QueryRow(r.Context(),
		`INSERT INTO commitments (ledger_id, name, amount, nature, due_day, source_account_id,
			target_account_id, sub_category_id, payment_method_id, principal_amount, interest_amount,
			notes, is_active, start_month, end_month, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		 RETURNING `+strings.ReplaceAll(commitmentCols, "c.", ""),
		ledgerID, strings.TrimSpace(req.Name), req.Amount, req.Nature, req.DueDay, req.SourceAccountID,
		req.TargetAccountID, req.SubCategoryID, req.PaymentMethodID, req.PrincipalAmount, req.InterestAmount,
		nilIfEmpty(req.Notes), isActive, startMonth, endMonth, req.SortOrder)

	c, err := scanCommitmentRow(row)
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "A commitment named \""+req.Name+"\" already exists")
			return
		}
		writeInternalError(w, err, "Failed to create commitment")
		return
	}

	writeJSON(w, http.StatusCreated, c)
}

func (h *CommitmentHandler) Update(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid commitment ID")
		return
	}

	var req models.UpdateCommitmentReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	sourceID, err := h.resolveSourceAccount(r.Context(), ledgerID, req.SourceAccountID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "No source account available. Create an asset account first.")
		return
	}
	req.SourceAccountID = sourceID

	startMonth, endMonth, err := normalizeCommitmentReq(&req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	row := h.db.QueryRow(r.Context(),
		`UPDATE commitments SET name = $1, amount = $2, nature = $3, due_day = $4,
			source_account_id = $5, target_account_id = $6, sub_category_id = $7,
			payment_method_id = $8, principal_amount = $9, interest_amount = $10,
			notes = $11, is_active = $12, start_month = $13, end_month = $14,
			sort_order = $15, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $16 AND ledger_id = $17
		 RETURNING `+strings.ReplaceAll(commitmentCols, "c.", ""),
		strings.TrimSpace(req.Name), req.Amount, req.Nature, req.DueDay,
		req.SourceAccountID, req.TargetAccountID, req.SubCategoryID,
		req.PaymentMethodID, req.PrincipalAmount, req.InterestAmount,
		nilIfEmpty(req.Notes), isActive, startMonth, endMonth,
		req.SortOrder, id, ledgerID)

	c, err := scanCommitmentRow(row)
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "A commitment named \""+req.Name+"\" already exists")
			return
		}
		writeError(w, http.StatusNotFound, "Commitment not found")
		return
	}

	writeJSON(w, http.StatusOK, c)
}

// Delete removes the commitment and its payment history. Transactions already
// generated from it are left alone — those payments really happened.
func (h *CommitmentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid commitment ID")
		return
	}

	tag, err := h.db.Exec(r.Context(), "DELETE FROM commitments WHERE id = $1 AND ledger_id = $2", id, ledgerID)
	if err != nil || tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Commitment not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Pay materialises the commitment as a real transaction for the given month and
// records the payment. Mirrors TemplateHandler.Execute so balances move through
// the same path as a manually entered transaction.
func (h *CommitmentHandler) Pay(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid commitment ID")
		return
	}

	var req models.PayCommitmentReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	month, err := parseCommitmentMonth(req.Month)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid month, expected YYYY-MM")
		return
	}

	dbTx, err := h.db.Begin(r.Context())
	if err != nil {
		writeInternalError(w, err, "Failed to begin transaction")
		return
	}
	defer dbTx.Rollback(r.Context())

	cRow := dbTx.QueryRow(r.Context(),
		`SELECT `+commitmentCols+` FROM commitments c WHERE c.id = $1 AND c.ledger_id = $2 FOR UPDATE`,
		id, ledgerID)
	c, err := scanCommitmentRow(cRow)
	if err != nil {
		writeError(w, http.StatusNotFound, "Commitment not found")
		return
	}

	var existing int
	if err := dbTx.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM commitment_payments WHERE commitment_id = $1 AND period = $2`,
		id, month).Scan(&existing); err != nil {
		writeInternalError(w, err, "Failed to check existing payment")
		return
	}
	if existing > 0 {
		writeError(w, http.StatusConflict, "This commitment is already paid for "+month.Format("2006-01"))
		return
	}

	if c.SourceAccountID == nil {
		writeError(w, http.StatusBadRequest, "Commitment has no source account. Edit it and pick one.")
		return
	}

	amount := c.Amount
	principal, interest := c.PrincipalAmount, c.InterestAmount
	if req.Amount != nil {
		amount = *req.Amount
		// For an EMI the scheduled principal is fixed; a differing total is
		// absorbed by the interest portion.
		if c.Nature == models.NatureEMIPayment {
			interest = amount - principal
		}
	}

	txDate := commitmentDueDate(month, c.DueDay).Format("2006-01-02")
	if req.TransactionDate != "" {
		if _, err := time.Parse("2006-01-02", req.TransactionDate); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid transaction_date, expected YYYY-MM-DD")
			return
		}
		txDate = req.TransactionDate
	}

	notes := req.Notes
	if notes == "" {
		notes = c.Notes
	}

	txReq := models.CreateTransactionReq{
		Title:           c.Name,
		Amount:          amount,
		Nature:          c.Nature,
		SourceAccountID: *c.SourceAccountID,
		TargetAccountID: c.TargetAccountID,
		SubCategoryID:   c.SubCategoryID,
		PaymentMethodID: c.PaymentMethodID,
		Notes:           notes,
		PrincipalAmount: principal,
		InterestAmount:  interest,
		TransactionDate: txDate,
	}
	if err := validateTransactionReq(&txReq); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	createdRow := dbTx.QueryRow(r.Context(),
		`INSERT INTO transactions (ledger_id, title, amount, nature, source_account_id, target_account_id,
			sub_category_id, payment_method_id, notes, principal_amount, interest_amount, transaction_date)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		 RETURNING id, ledger_id, title, amount, nature, source_account_id, target_account_id,
			sub_category_id, payment_method_id, notes, principal_amount, interest_amount,
			transaction_date, created_at`,
		ledgerID, txReq.Title, txReq.Amount, txReq.Nature, txReq.SourceAccountID, txReq.TargetAccountID,
		txReq.SubCategoryID, txReq.PaymentMethodID, nilIfEmpty(txReq.Notes),
		txReq.PrincipalAmount, txReq.InterestAmount, txReq.TransactionDate)

	created, err := scanTransactionRow(createdRow)
	if err != nil {
		writeInternalError(w, err, "Failed to create transaction for commitment")
		return
	}

	if err := applyBalanceChange(r.Context(), dbTx, ledgerID, txReq.Nature, txReq.SourceAccountID,
		txReq.TargetAccountID, txReq.Amount, txReq.PrincipalAmount); err != nil {
		writeInternalError(w, err, "Failed to update balances")
		return
	}

	payRow := dbTx.QueryRow(r.Context(),
		`INSERT INTO commitment_payments (ledger_id, commitment_id, period, transaction_id, amount, paid_on)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, ledger_id, commitment_id, period, transaction_id, amount, paid_on, created_at`,
		ledgerID, c.ID, month, created.ID, amount, txDate)

	payment, err := scanCommitmentPaymentRow(payRow)
	if err != nil {
		writeInternalError(w, err, "Failed to record commitment payment")
		return
	}

	if err := dbTx.Commit(r.Context()); err != nil {
		writeInternalError(w, err, "Failed to commit")
		return
	}

	writeJSON(w, http.StatusCreated, models.CommitmentStatus{
		Commitment: c,
		Status:     commitmentStatusPaid,
		DueDate:    commitmentDueDate(month, c.DueDay).Format("2006-01-02"),
		Payment:    &payment,
	})
}

// Unpay reverses a Pay: deletes the generated transaction (which cascades the
// payment row away) and restores the affected balances.
func (h *CommitmentHandler) Unpay(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid commitment ID")
		return
	}

	month, err := parseCommitmentMonth(r.URL.Query().Get("month"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid month, expected YYYY-MM")
		return
	}

	dbTx, err := h.db.Begin(r.Context())
	if err != nil {
		writeInternalError(w, err, "Failed to begin transaction")
		return
	}
	defer dbTx.Rollback(r.Context())

	var paymentID int
	var transactionID *int
	err = dbTx.QueryRow(r.Context(),
		`SELECT id, transaction_id FROM commitment_payments
		 WHERE commitment_id = $1 AND ledger_id = $2 AND period = $3 FOR UPDATE`,
		id, ledgerID, month).Scan(&paymentID, &transactionID)
	if err != nil {
		writeError(w, http.StatusNotFound, "No payment recorded for that month")
		return
	}

	if transactionID != nil {
		var nature models.TxNature
		var sourceID int
		var targetID *int
		var amount, principal float64
		err = dbTx.QueryRow(r.Context(),
			`SELECT nature, source_account_id, target_account_id, amount, principal_amount
			 FROM transactions WHERE id = $1 AND ledger_id = $2 FOR UPDATE`,
			*transactionID, ledgerID).Scan(&nature, &sourceID, &targetID, &amount, &principal)
		if err != nil {
			writeError(w, http.StatusNotFound, "Linked transaction not found")
			return
		}

		if err := reverseBalanceChange(r.Context(), dbTx, ledgerID, nature, sourceID, targetID, amount, principal); err != nil {
			writeInternalError(w, err, "Failed to restore balances")
			return
		}

		// Deleting the transaction cascades the commitment_payments row away.
		if _, err := dbTx.Exec(r.Context(), "DELETE FROM transactions WHERE id = $1 AND ledger_id = $2", *transactionID, ledgerID); err != nil {
			writeInternalError(w, err, "Failed to delete transaction")
			return
		}
	} else if _, err := dbTx.Exec(r.Context(), "DELETE FROM commitment_payments WHERE id = $1", paymentID); err != nil {
		writeInternalError(w, err, "Failed to delete payment")
		return
	}

	if err := dbTx.Commit(r.Context()); err != nil {
		writeInternalError(w, err, "Failed to commit")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// --- Helpers ---

// isUniqueViolation reports whether err is a Postgres unique-constraint breach,
// so a duplicate commitment name reads as a 409 instead of a generic 500.
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// parseCommitmentMonth accepts "YYYY-MM" (empty means the current month) and
// returns the first day of that month.
func parseCommitmentMonth(s string) (time.Time, error) {
	if s == "" {
		now := time.Now()
		return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC), nil
	}
	t, err := time.Parse("2006-01", s)
	if err != nil {
		return time.Time{}, err
	}
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC), nil
}

// commitmentDueDate resolves a due day within a month, clamping to the last day
// so a due_day of 31 still lands correctly in February.
func commitmentDueDate(month time.Time, dueDay int) time.Time {
	first := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.UTC)
	lastDay := first.AddDate(0, 1, -1).Day()
	if dueDay < 1 {
		dueDay = 1
	}
	if dueDay > lastDay {
		dueDay = lastDay
	}
	return first.AddDate(0, 0, dueDay-1)
}

// resolveSourceAccount validates that the requested account belongs to the
// ledger, falling back to the primary asset account like TransactionHandler does.
func (h *CommitmentHandler) resolveSourceAccount(ctx context.Context, ledgerID, requested int) (int, error) {
	if requested > 0 {
		var owned int
		err := h.db.QueryRow(ctx,
			"SELECT COUNT(*) FROM accounts WHERE id = $1 AND ledger_id = $2", requested, ledgerID).Scan(&owned)
		if err == nil && owned > 0 {
			return requested, nil
		}
	}
	return getPrimaryAssetAccountID(ctx, h.db, ledgerID)
}

// normalizeCommitmentReq validates the request and returns the parsed
// start/end months. Transaction-shaped rules are delegated to
// validateTransactionReq so a commitment can never produce a transaction the
// manual entry form would have rejected.
func normalizeCommitmentReq(req *models.CreateCommitmentReq) (*time.Time, *time.Time, error) {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return nil, nil, fmt.Errorf("name is required")
	}
	if req.DueDay == 0 {
		req.DueDay = 1
	}
	if req.DueDay < 1 || req.DueDay > 31 {
		return nil, nil, fmt.Errorf("due_day must be between 1 and 31")
	}
	if req.Nature == "" {
		req.Nature = models.NatureExpense
	}

	txReq := models.CreateTransactionReq{
		Title:           req.Name,
		Amount:          req.Amount,
		Nature:          req.Nature,
		SourceAccountID: req.SourceAccountID,
		TargetAccountID: req.TargetAccountID,
		PrincipalAmount: req.PrincipalAmount,
		InterestAmount:  req.InterestAmount,
		// A commitment has a due day rather than a date; this placeholder only
		// satisfies validateTransactionReq's non-empty check.
		TransactionDate: "1970-01-01",
	}
	if err := validateTransactionReq(&txReq); err != nil {
		return nil, nil, err
	}

	start, err := parseCommitmentMonthPtr(req.StartMonth)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid start_month, expected YYYY-MM")
	}
	end, err := parseCommitmentMonthPtr(req.EndMonth)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid end_month, expected YYYY-MM")
	}
	if start != nil && end != nil && end.Before(*start) {
		return nil, nil, fmt.Errorf("end_month cannot be before start_month")
	}

	return start, end, nil
}

// parseCommitmentMonthPtr accepts "YYYY-MM" or "YYYY-MM-DD" and normalizes to
// the first of the month. nil and "" both mean unbounded.
func parseCommitmentMonthPtr(s *string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	value := *s
	if len(value) > 7 {
		value = value[:7]
	}
	t, err := time.Parse("2006-01", value)
	if err != nil {
		return nil, err
	}
	m := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
	return &m, nil
}

func scanCommitmentRow(row pgx.Row) (models.Commitment, error) {
	var c models.Commitment
	var notes *string
	var startMonth, endMonth *time.Time
	err := row.Scan(&c.ID, &c.LedgerID, &c.Name, &c.Amount, &c.Nature, &c.DueDay,
		&c.SourceAccountID, &c.TargetAccountID, &c.SubCategoryID, &c.PaymentMethodID,
		&c.PrincipalAmount, &c.InterestAmount, &notes, &c.IsActive,
		&startMonth, &endMonth, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return c, err
	}
	applyCommitmentNullables(&c, notes, startMonth, endMonth)
	return c, nil
}

func scanCommitmentWithPayment(rows pgx.Rows, month time.Time) (models.CommitmentStatus, error) {
	var c models.Commitment
	var notes *string
	var startMonth, endMonth *time.Time

	var payID, payLedgerID, payCommitmentID *int
	var payPeriod, payPaidOn *time.Time
	var payTransactionID *int
	var payAmount *float64
	var payCreatedAt *time.Time

	err := rows.Scan(&c.ID, &c.LedgerID, &c.Name, &c.Amount, &c.Nature, &c.DueDay,
		&c.SourceAccountID, &c.TargetAccountID, &c.SubCategoryID, &c.PaymentMethodID,
		&c.PrincipalAmount, &c.InterestAmount, &notes, &c.IsActive,
		&startMonth, &endMonth, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt,
		&payID, &payLedgerID, &payCommitmentID, &payPeriod, &payTransactionID,
		&payAmount, &payPaidOn, &payCreatedAt)
	if err != nil {
		return models.CommitmentStatus{}, err
	}
	applyCommitmentNullables(&c, notes, startMonth, endMonth)

	item := models.CommitmentStatus{
		Commitment: c,
		DueDate:    commitmentDueDate(month, c.DueDay).Format("2006-01-02"),
	}

	switch {
	case payID != nil:
		// A recorded payment always wins: it happened, even if the commitment
		// has since been paused or its window moved.
		item.Status = commitmentStatusPaid
		item.Payment = &models.CommitmentPayment{
			ID:            *payID,
			LedgerID:      *payLedgerID,
			CommitmentID:  *payCommitmentID,
			Period:        payPeriod.Format("2006-01-02"),
			TransactionID: payTransactionID,
			Amount:        *payAmount,
			PaidOn:        payPaidOn.Format("2006-01-02"),
			CreatedAt:     *payCreatedAt,
		}
	case commitmentActiveIn(c, month):
		item.Status = commitmentStatusDue
	default:
		item.Status = commitmentStatusInactive
	}

	return item, nil
}

func commitmentActiveIn(c models.Commitment, month time.Time) bool {
	if !c.IsActive {
		return false
	}
	monthStr := month.Format("2006-01-02")
	if c.StartMonth != nil && *c.StartMonth > monthStr {
		return false
	}
	if c.EndMonth != nil && *c.EndMonth < monthStr {
		return false
	}
	return true
}

func applyCommitmentNullables(c *models.Commitment, notes *string, startMonth, endMonth *time.Time) {
	if notes != nil {
		c.Notes = *notes
	}
	if startMonth != nil {
		s := startMonth.Format("2006-01-02")
		c.StartMonth = &s
	}
	if endMonth != nil {
		e := endMonth.Format("2006-01-02")
		c.EndMonth = &e
	}
}

func scanCommitmentPaymentRow(row pgx.Row) (models.CommitmentPayment, error) {
	var p models.CommitmentPayment
	var period, paidOn time.Time
	err := row.Scan(&p.ID, &p.LedgerID, &p.CommitmentID, &period, &p.TransactionID,
		&p.Amount, &paidOn, &p.CreatedAt)
	if err != nil {
		return p, err
	}
	p.Period = period.Format("2006-01-02")
	p.PaidOn = paidOn.Format("2006-01-02")
	return p, nil
}
