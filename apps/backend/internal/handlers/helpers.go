package handlers

import (
	"encoding/json"
	"log"
	"net/http"
)

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// writeInternalError logs the underlying error server-side (writeError alone
// discards it, leaving 500s undiagnosable from logs) before writing the
// generic message to the client.
func writeInternalError(w http.ResponseWriter, err error, message string) {
	log.Printf("%s: %v", message, err)
	writeError(w, http.StatusInternalServerError, message)
}
