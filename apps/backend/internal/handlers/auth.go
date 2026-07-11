package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/fintrack/backend/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	jwtKey  []byte
	jwtOnce sync.Once
)

// signingKey lazily resolves the JWT signing secret. It is loaded on first use
// (after main() has loaded the .env file / process environment) so the
// JWT_SECRET from .env is actually honored. Reading it at package-init time ran
// before godotenv.Load() and silently fell back to the insecure dev default.
func signingKey() []byte {
	jwtOnce.Do(func() {
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			log.Println("WARNING: JWT_SECRET is not set; using an insecure development default. Set JWT_SECRET before deploying.")
			secret = "fintrack-default-secret"
		}
		jwtKey = []byte(secret)
	})
	return jwtKey
}

// InitJWT eagerly initializes the signing key so misconfiguration is logged at
// startup rather than on the first authenticated request. Call after env load.
func InitJWT() { signingKey() }

type Claims struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func (h *AccountHandler) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenString := r.Header.Get("Authorization")
		if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
			tokenString = tokenString[7:]
		} else {
			writeError(w, http.StatusUnauthorized, "Authorization header required")
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			// Enforce the expected HMAC signing method to prevent algorithm-confusion attacks.
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return signingKey(), nil
		}, jwt.WithValidMethods([]string{"HS256"}))

		if err != nil || !token.Valid {
			writeError(w, http.StatusUnauthorized, "Invalid token")
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (h *AccountHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "Username and password are required")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	user := models.User{
		Username:     req.Username,
		PasswordHash: string(hashedPassword),
	}

	query := `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, role, preferences, created_at, updated_at`
	var prefsBytes []byte
	err = h.db.QueryRow(r.Context(), query, user.Username, user.PasswordHash).
		Scan(&user.ID, &user.Role, &prefsBytes, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusConflict, "Failed to create user (username might be taken)")
		return
	}
	if len(prefsBytes) > 0 {
		_ = json.Unmarshal(prefsBytes, &user.Preferences)
	}

	// Auto-create default ledger
	var ledgerID int
	err = h.db.QueryRow(r.Context(), 
		"INSERT INTO ledgers (user_id, name, created_at, updated_at) VALUES ($1, 'Personal', NOW(), NOW()) RETURNING id", 
		user.ID).Scan(&ledgerID)
	if err == nil {
		_ = SeedDefaultCategories(r.Context(), h.db, ledgerID)
	}

	writeJSON(w, http.StatusCreated, user)
}

func (h *AccountHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	var user models.User
	var prefsBytes []byte
	query := `SELECT id, username, password_hash, role, preferences, created_at, updated_at FROM users WHERE username = $1`
	err := h.db.QueryRow(r.Context(), query, req.Username).
		Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role, &prefsBytes, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid username or password")
		return
	}
	if len(prefsBytes) > 0 {
		_ = json.Unmarshal(prefsBytes, &user.Preferences)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid username or password")
		return
	}

	expirationTime := time.Now().Add(72 * time.Hour)
	claims := &Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(signingKey())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	writeJSON(w, http.StatusOK, models.AuthRes{
		Token: tokenString,
		User:  user,
	})
}

// Me returns the currently authenticated user. Clients call it on startup to
// validate a persisted token before entering the app; a 401 here means the
// stored token is invalid/expired and should be cleared.
func (h *AccountHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, err := GetUserID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var user models.User
	var prefsBytes []byte
	query := `SELECT id, username, role, preferences, created_at, updated_at FROM users WHERE id = $1`
	err = h.db.QueryRow(r.Context(), query, userID).
		Scan(&user.ID, &user.Username, &user.Role, &prefsBytes, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "User not found")
		return
	}
	if len(prefsBytes) > 0 {
		_ = json.Unmarshal(prefsBytes, &user.Preferences)
	}

	writeJSON(w, http.StatusOK, user)
}

type contextKey string

const userContextKey contextKey = "user"

func GetUserID(r *http.Request) (int, error) {
	claims, ok := r.Context().Value(userContextKey).(*Claims)
	if !ok {
		return 0, errors.New("user not found in context")
	}
	return claims.UserID, nil
}

func (h *AccountHandler) SuperAdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(userContextKey).(*Claims)
		if !ok || claims.Role != "superadmin" {
			writeError(w, http.StatusForbidden, "Forbidden: Superadmin access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

type ResetPasswordReq struct {
	Username    string `json:"username"`
	TempPassword string `json:"temp_password"`
	NewPassword  string `json:"new_password"`
}

func (h *AccountHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.Username == "" || req.TempPassword == "" || req.NewPassword == "" {
		writeError(w, http.StatusBadRequest, "Username, temp password, and new password are required")
		return
	}

	var userID int
	var passwordHash string
	query := `SELECT id, password_hash FROM users WHERE username = $1`
	err := h.db.QueryRow(r.Context(), query, req.Username).Scan(&userID, &passwordHash)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.TempPassword)); err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid temporary password")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash new password")
		return
	}

	_, err = h.db.Exec(r.Context(), `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, string(hashedPassword), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Password updated successfully"})
}

func (h *AccountHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID, err := GetUserID(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.UpdatePreferencesReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	prefsJSON, err := json.Marshal(req.Preferences)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to encode preferences")
		return
	}

	query := `UPDATE users SET preferences = preferences || $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING preferences`
	
	var prefsBytes []byte
	err = h.db.QueryRow(r.Context(), query, prefsJSON, userID).Scan(&prefsBytes)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update preferences")
		return
	}

	var finalPrefs map[string]interface{}
	if len(prefsBytes) > 0 {
		_ = json.Unmarshal(prefsBytes, &finalPrefs)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"preferences": finalPrefs,
	})
}

const ledgerContextKey contextKey = "ledger"

func (h *AccountHandler) LedgerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ledgerIDStr := r.Header.Get("X-Ledger-Id")
		if ledgerIDStr == "" {
			writeError(w, http.StatusBadRequest, "X-Ledger-Id header required")
			return
		}

		// Ensure the user actually owns this ledger
		userID, err := GetUserID(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}

		var count int
		err = h.db.QueryRow(r.Context(), "SELECT COUNT(*) FROM ledgers WHERE id = $1 AND user_id = $2", ledgerIDStr, userID).Scan(&count)
		if err != nil || count == 0 {
			writeError(w, http.StatusForbidden, "Forbidden: you do not own this ledger")
			return
		}

		ledgerIDInt, _ := strconv.Atoi(ledgerIDStr)
		ctx := context.WithValue(r.Context(), ledgerContextKey, ledgerIDInt)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetLedgerID(r *http.Request) (int, error) {
	ledgerID, ok := r.Context().Value(ledgerContextKey).(int)
	if !ok {
		return 0, errors.New("ledger not found in context")
	}
	return ledgerID, nil
}
