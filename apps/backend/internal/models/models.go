package models

import "time"

type AccountType string
type TxNature string

const (
	AccountTypeAsset     AccountType = "ASSET"
	AccountTypeLiability AccountType = "LIABILITY"

	NatureIncome           TxNature = "INCOME"
	NatureExpense          TxNature = "EXPENSE"
	NatureTransfer         TxNature = "TRANSFER"
	NatureEMIPayment       TxNature = "EMI_PAYMENT"
	NatureLoanDisbursement TxNature = "LOAN_DISBURSEMENT"
)

type Account struct {
	ID             int         `json:"id"`
	LedgerID       int         `json:"ledger_id"`
	Name           string      `json:"name"`
	Type           AccountType `json:"type"`
	InitialBalance float64     `json:"initial_balance"`
	CurrentBalance float64     `json:"current_balance"`
	TotalDisbursed float64     `json:"total_disbursed"`
	InterestRate   float64     `json:"interest_rate"`
	IsActive       bool        `json:"is_active"`
	CreatedAt      time.Time   `json:"created_at"`
}

type Category struct {
	ID            int           `json:"id"`
	LedgerID      int           `json:"ledger_id"`
	Name          string        `json:"name"`
	Nature        TxNature      `json:"nature"`
	CreatedAt     time.Time     `json:"created_at"`
	SubCategories []SubCategory `json:"sub_categories,omitempty"`
}

type SubCategory struct {
	ID         int       `json:"id"`
	CategoryID int       `json:"category_id"`
	LedgerID   int       `json:"ledger_id"`
	Name       string    `json:"name"`
	CreatedAt  time.Time `json:"created_at"`
}

type PaymentMethod struct {
	ID        int       `json:"id"`
	LedgerID  int       `json:"ledger_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Transaction struct {
	ID              int        `json:"id"`
	LedgerID        int        `json:"ledger_id"`
	Title           string     `json:"title"`
	Amount          float64    `json:"amount"`
	Nature          TxNature   `json:"nature"`
	SourceAccountID int        `json:"source_account_id"`
	TargetAccountID *int       `json:"target_account_id,omitempty"`
	SubCategoryID   *int       `json:"sub_category_id,omitempty"`
	PaymentMethodID *int       `json:"payment_method_id,omitempty"`
	Notes           string     `json:"notes,omitempty"`
	PrincipalAmount float64    `json:"principal_amount"`
	InterestAmount  float64    `json:"interest_amount"`
	TransactionDate string     `json:"transaction_date"`
	CreatedAt       time.Time  `json:"created_at"`
}

type TransactionTemplate struct {
	ID              int        `json:"id"`
	LedgerID        int        `json:"ledger_id"`
	Title           string     `json:"title"`
	Amount          float64    `json:"amount"`
	Nature          TxNature   `json:"nature"`
	SourceAccountID int        `json:"source_account_id"`
	TargetAccountID *int       `json:"target_account_id,omitempty"`
	SubCategoryID   *int       `json:"sub_category_id,omitempty"`
	PaymentMethodID *int       `json:"payment_method_id,omitempty"`
	PrincipalAmount float64    `json:"principal_amount"`
	InterestAmount  float64    `json:"interest_amount"`
	CreatedAt       time.Time  `json:"created_at"`
}

// Commitment is a fixed obligation that recurs every month (loan EMI, broadband
// bill, subscription, chit fund). It is not a transaction: paying one for a given
// month is an explicit action that materialises a real transaction.
type Commitment struct {
	ID              int       `json:"id"`
	LedgerID        int       `json:"ledger_id"`
	Name            string    `json:"name"`
	Amount          float64   `json:"amount"`
	Nature          TxNature  `json:"nature"`
	DueDay          int       `json:"due_day"`
	SourceAccountID *int      `json:"source_account_id,omitempty"`
	TargetAccountID *int      `json:"target_account_id,omitempty"`
	SubCategoryID   *int      `json:"sub_category_id,omitempty"`
	PaymentMethodID *int      `json:"payment_method_id,omitempty"`
	PrincipalAmount float64   `json:"principal_amount"`
	InterestAmount  float64   `json:"interest_amount"`
	Notes           string    `json:"notes,omitempty"`
	IsActive        bool      `json:"is_active"`
	StartMonth      *string   `json:"start_month,omitempty"`
	EndMonth        *string   `json:"end_month,omitempty"`
	SortOrder       int       `json:"sort_order"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type CommitmentPayment struct {
	ID            int       `json:"id"`
	LedgerID      int       `json:"ledger_id"`
	CommitmentID  int       `json:"commitment_id"`
	Period        string    `json:"period"`
	TransactionID *int      `json:"transaction_id,omitempty"`
	Amount        float64   `json:"amount"`
	PaidOn        string    `json:"paid_on"`
	CreatedAt     time.Time `json:"created_at"`
}

// CommitmentStatus is a commitment resolved against a specific month.
type CommitmentStatus struct {
	Commitment
	Status  string             `json:"status"` // "PAID" | "DUE"
	DueDate string             `json:"due_date"`
	Payment *CommitmentPayment `json:"payment,omitempty"`
}

type CommitmentsMonthResponse struct {
	Month     string             `json:"month"`
	Total     float64            `json:"total"`
	PaidTotal float64            `json:"paid_total"`
	DueTotal  float64            `json:"due_total"`
	Items     []CommitmentStatus `json:"items"`
}

type Ledger struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type User struct {
	ID           int                    `json:"id"`
	Username     string                 `json:"username"`
	PasswordHash string                 `json:"-"`
	Role         string                 `json:"role"`
	Preferences  map[string]interface{} `json:"preferences"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

// --- Request / Response DTOs ---

type LoginReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type UpdatePreferencesReq struct {
	Preferences map[string]interface{} `json:"preferences"`
}

type CreateLedgerReq struct {
	Name string `json:"name"`
}

type AuthRes struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateAccountReq struct {
	Name           string      `json:"name"`
	Type           AccountType `json:"type"`
	InitialBalance float64     `json:"initial_balance"`
	InterestRate   float64     `json:"interest_rate"`
}

type UpdateAccountReq struct {
	Name         *string  `json:"name,omitempty"`
	InterestRate *float64 `json:"interest_rate,omitempty"`
	IsActive     *bool    `json:"is_active,omitempty"`
}

type CreateCategoryReq struct {
	Name   string     `json:"name"`
	Nature TxNature   `json:"nature"`
}

type UpdateCategoryReq struct {
	Name string `json:"name"`
}

type CreateSubCategoryReq struct {
	Name string `json:"name"`
}

type UpdateSubCategoryReq struct {
	Name string `json:"name"`
}

type CreatePaymentMethodReq struct {
	Name string `json:"name"`
}

type UpdatePaymentMethodReq struct {
	Name string `json:"name"`
}

type CreateTransactionReq struct {
	Title           string     `json:"title"`
	Amount          float64    `json:"amount"`
	Nature          TxNature   `json:"nature"`
	SourceAccountID int        `json:"source_account_id"`
	TargetAccountID *int       `json:"target_account_id,omitempty"`
	SubCategoryID   *int       `json:"sub_category_id,omitempty"`
	PaymentMethodID *int       `json:"payment_method_id,omitempty"`
	Notes           string     `json:"notes,omitempty"`
	PrincipalAmount float64    `json:"principal_amount"`
	InterestAmount  float64    `json:"interest_amount"`
	TransactionDate string     `json:"transaction_date"`
}

type UpdateTransactionReq = CreateTransactionReq

type CreateTemplateReq struct {
	Title           string     `json:"title"`
	Amount          float64    `json:"amount"`
	Nature          TxNature   `json:"nature"`
	SourceAccountID int        `json:"source_account_id"`
	TargetAccountID *int       `json:"target_account_id,omitempty"`
	SubCategoryID   *int       `json:"sub_category_id,omitempty"`
	PaymentMethodID *int       `json:"payment_method_id,omitempty"`
	PrincipalAmount float64    `json:"principal_amount"`
	InterestAmount  float64    `json:"interest_amount"`
}

type CreateCommitmentReq struct {
	Name            string   `json:"name"`
	Amount          float64  `json:"amount"`
	Nature          TxNature `json:"nature"`
	DueDay          int      `json:"due_day"`
	SourceAccountID int      `json:"source_account_id"`
	TargetAccountID *int     `json:"target_account_id,omitempty"`
	SubCategoryID   *int     `json:"sub_category_id,omitempty"`
	PaymentMethodID *int     `json:"payment_method_id,omitempty"`
	PrincipalAmount float64  `json:"principal_amount"`
	InterestAmount  float64  `json:"interest_amount"`
	Notes           string   `json:"notes,omitempty"`
	IsActive        *bool    `json:"is_active,omitempty"`
	StartMonth      *string  `json:"start_month,omitempty"`
	EndMonth        *string  `json:"end_month,omitempty"`
	SortOrder       int      `json:"sort_order"`
}

type UpdateCommitmentReq = CreateCommitmentReq

type PayCommitmentReq struct {
	Month           string   `json:"month"`
	Amount          *float64 `json:"amount,omitempty"`
	TransactionDate string   `json:"transaction_date,omitempty"`
	Notes           string   `json:"notes,omitempty"`
}

type TallyRequest struct {
	ActualBalance float64 `json:"actual_balance"`
}

type TallyResponse struct {
	AccountID         int     `json:"account_id"`
	AccountName       string  `json:"account_name"`
	CalculatedBalance float64 `json:"calculated_balance"`
	ActualBalance     float64 `json:"actual_balance"`
	Difference        float64 `json:"difference"`
}

type SummaryResponse struct {
	Month        string  `json:"month"`
	TotalIncome  float64 `json:"total_income"`
	TotalExpense float64 `json:"total_expense"`
	TotalEMI     float64 `json:"total_emi"`
	TotalLoan    float64 `json:"total_loan"`
	NetFlow      float64 `json:"net_flow"`
}

type TransactionFilter struct {
	Nature    *TxNature
	AccountID *int
	DateFrom  *string
	DateTo    *string
	Page      int
	PerPage   int
}
