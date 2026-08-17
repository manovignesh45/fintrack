package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/fintrack/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

func (h *AccountHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
	query := `SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at DESC`
	rows, err := h.db.Query(r.Context(), query)
	if err != nil {
		writeInternalError(w, err, "Failed to fetch users")
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		if err := rows.Scan(&user.ID, &user.Username, &user.Role, &user.CreatedAt, &user.UpdatedAt); err != nil {
			writeInternalError(w, err, "Failed to parse user data")
			return
		}
		users = append(users, user)
	}

	writeJSON(w, http.StatusOK, users)
}

type AdminResetPasswordReq struct {
	UserID       int    `json:"user_id"`
	TempPassword string `json:"temp_password"`
}

func (h *AccountHandler) AdminResetPassword(w http.ResponseWriter, r *http.Request) {
	var req AdminResetPasswordReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.UserID == 0 || req.TempPassword == "" {
		writeError(w, http.StatusBadRequest, "User ID and temporary password are required")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.TempPassword), bcrypt.DefaultCost)
	if err != nil {
		writeInternalError(w, err, "Failed to hash password")
		return
	}

	res, err := h.db.Exec(r.Context(), `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, string(hashedPassword), req.UserID)
	if err != nil {
		writeInternalError(w, err, "Failed to update password")
		return
	}
	
	if res.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Password reset to temporary password successfully"})
}

func (h *AccountHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// Make sure superadmin isn't deleting themselves or other superadmins?
	// It's a good practice, but not strictly requested. I will just execute delete.
	var role string
	err = h.db.QueryRow(r.Context(), "SELECT role FROM users WHERE id = $1", userID).Scan(&role)
	if err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}
	if role == "superadmin" {
		writeError(w, http.StatusForbidden, "Cannot delete a superadmin user")
		return
	}

	res, err := h.db.Exec(r.Context(), "DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		writeInternalError(w, err, "Failed to delete user")
		return
	}

	if res.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
