package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fintrack/backend/internal/models"
)

const (
	maxQuickNotesPerRequest = 500
	maxQuickNoteAmount      = 9999999999.99 // NUMERIC(12, 2)
)

type QuickNoteHandler struct {
	db *pgxpool.Pool
}

func NewQuickNoteHandler(db *pgxpool.Pool) *QuickNoteHandler {
	return &QuickNoteHandler{db: db}
}

// quickNoteSelect returns each note together with how the most recent
// income/expense transaction of the same title was classified, so clients can
// pre-fill (or one-tap confirm) the conversion.
const quickNoteSelect = `
	SELECT q.id, q.ledger_id, q.title, q.amount, q.note_date, q.client_id, q.created_at,
		s.nature, s.source_account_id, s.sub_category_id, s.category_id,
		s.category_name, s.sub_category_name, s.payment_method_id, s.payment_method_name
	FROM quick_notes q
	LEFT JOIN LATERAL (
		SELECT t.nature, t.source_account_id, t.sub_category_id, sc.category_id,
			c.name AS category_name, sc.name AS sub_category_name,
			t.payment_method_id, pm.name AS payment_method_name
		FROM transactions t
		LEFT JOIN sub_categories sc ON sc.id = t.sub_category_id
		LEFT JOIN categories c ON c.id = sc.category_id
		LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
		WHERE t.ledger_id = q.ledger_id
			AND t.nature IN ('EXPENSE', 'INCOME')
			AND LOWER(TRIM(t.title)) = LOWER(TRIM(q.title))
		ORDER BY t.transaction_date DESC, t.created_at DESC
		LIMIT 1
	) s ON TRUE`

func scanQuickNote(row pgx.Row) (models.QuickNote, error) {
	var n models.QuickNote
	var noteDate time.Time
	var nature *models.TxNature
	var sourceAccountID *int
	var s models.QuickNoteSuggestion
	err := row.Scan(&n.ID, &n.LedgerID, &n.Title, &n.Amount, &noteDate, &n.ClientID, &n.CreatedAt,
		&nature, &sourceAccountID, &s.SubCategoryID, &s.CategoryID,
		&s.CategoryName, &s.SubCategoryName, &s.PaymentMethodID, &s.PaymentMethodName)
	if err != nil {
		return n, err
	}
	n.NoteDate = noteDate.Format("2006-01-02")
	if nature != nil && sourceAccountID != nil {
		s.Nature = *nature
		s.SourceAccountID = *sourceAccountID
		n.Suggestion = &s
	}
	return n, nil
}

// normalizeQuickNote trims and validates one note in place. An empty date
// means "today"; amount 0 means "not known yet".
func normalizeQuickNote(in *models.QuickNoteInput) error {
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" {
		return fmt.Errorf("title is required")
	}
	if len(in.Title) > 255 {
		return fmt.Errorf("title must be 255 characters or fewer")
	}
	if in.Amount < 0 || in.Amount > maxQuickNoteAmount {
		return fmt.Errorf("amount is out of range")
	}
	if in.NoteDate == "" {
		in.NoteDate = time.Now().Format("2006-01-02")
	} else if _, err := time.Parse("2006-01-02", in.NoteDate); err != nil {
		return fmt.Errorf("note_date must be YYYY-MM-DD")
	}
	if in.ClientID != nil {
		id := strings.TrimSpace(*in.ClientID)
		if len(id) > 64 {
			return fmt.Errorf("client_id must be 64 characters or fewer")
		}
		if id == "" {
			in.ClientID = nil
		} else {
			in.ClientID = &id
		}
	}
	return nil
}

func (h *QuickNoteHandler) list(r *http.Request, ledgerID int) ([]models.QuickNote, error) {
	rows, err := h.db.Query(r.Context(),
		quickNoteSelect+` WHERE q.ledger_id = $1 ORDER BY q.note_date DESC, q.id DESC`, ledgerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notes := make([]models.QuickNote, 0)
	for rows.Next() {
		n, err := scanQuickNote(rows)
		if err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

func (h *QuickNoteHandler) List(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	notes, err := h.list(r, ledgerID)
	if err != nil {
		writeInternalError(w, err, "Failed to fetch quick notes")
		return
	}
	writeJSON(w, http.StatusOK, notes)
}

// Create saves one or many notes (a pasted list) in a single request and
// returns the ledger's full, refreshed list.
func (h *QuickNoteHandler) Create(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateQuickNotesReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if len(req.Notes) == 0 {
		writeError(w, http.StatusBadRequest, "At least one note is required")
		return
	}
	if len(req.Notes) > maxQuickNotesPerRequest {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("At most %d notes per request", maxQuickNotesPerRequest))
		return
	}
	for i := range req.Notes {
		if err := normalizeQuickNote(&req.Notes[i]); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Note %d: %s", i+1, err.Error()))
			return
		}
	}

	tx, err := h.db.Begin(r.Context())
	if err != nil {
		writeInternalError(w, err, "Failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	for _, n := range req.Notes {
		// A note re-sent with the same client_id (offline retry) is skipped.
		if _, err := tx.Exec(r.Context(),
			`INSERT INTO quick_notes (ledger_id, title, amount, note_date, client_id)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (ledger_id, client_id) DO NOTHING`,
			ledgerID, n.Title, n.Amount, n.NoteDate, n.ClientID); err != nil {
			writeInternalError(w, err, "Failed to save quick note")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeInternalError(w, err, "Failed to save quick notes")
		return
	}

	notes, err := h.list(r, ledgerID)
	if err != nil {
		writeInternalError(w, err, "Failed to fetch quick notes")
		return
	}
	writeJSON(w, http.StatusCreated, notes)
}

func (h *QuickNoteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := GetLedgerID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid quick note ID")
		return
	}

	tag, err := h.db.Exec(r.Context(), "DELETE FROM quick_notes WHERE id = $1 AND ledger_id = $2", id, ledgerID)
	if err != nil {
		writeInternalError(w, err, "Failed to delete quick note")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Quick note not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
