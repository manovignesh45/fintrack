package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"github.com/fintrack/backend/internal/db"
	"github.com/fintrack/backend/internal/handlers"
)

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	// Resolve the JWT signing secret now that env/.env is loaded.
	handlers.InitJWT()

	ctx := context.Background()

	// Connect to database
	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Run migrations
	migrationsDir := getMigrationsDir()
	if err := db.RunMigrations(ctx, pool, migrationsDir); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Create handlers
	accountH := handlers.NewAccountHandler(pool)
	categoryH := handlers.NewCategoryHandler(pool)
	paymentMethodH := handlers.NewPaymentMethodHandler(pool)
	transactionH := handlers.NewTransactionHandler(pool)
	templateH := handlers.NewTemplateHandler(pool)
	tallyH := handlers.NewTallyHandler(pool)

	// Setup router
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	allowedOrigins := []string{"http://localhost:5173", "http://localhost:3000"}
	if envOrigins := os.Getenv("ALLOWED_ORIGINS"); envOrigins != "" {
		parts := strings.Split(envOrigins, ",")
		allowedOrigins = make([]string, 0, len(parts))
		for _, p := range parts {
			allowedOrigins = append(allowedOrigins, strings.TrimSpace(p))
		}
	}
	log.Printf("CORS Allowed Origins: %v", allowedOrigins)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization", "X-Ledger-Id", "Cache-Control", "Pragma", "Expires"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Auth
		r.Post("/login", accountH.Login)
		r.Post("/register", accountH.Register)
		r.Post("/reset-password", accountH.ResetPassword)

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(accountH.AuthMiddleware)

			// User Profile
			r.Get("/me", accountH.Me)
			r.Put("/users/me/preferences", accountH.UpdatePreferences)

			// Ledgers & Import (requires auth, but not ledger context)
			r.Get("/ledgers", accountH.GetLedgers)
			r.Post("/ledgers", accountH.CreateLedger)
			r.Post("/import/csv", accountH.ImportCSV)

			// Superadmin routes
			r.Group(func(r chi.Router) {
				r.Use(accountH.SuperAdminMiddleware)
				r.Get("/admin/users", accountH.GetUsers)
				r.Post("/admin/users/reset-password", accountH.AdminResetPassword)
				r.Delete("/admin/users/{id}", accountH.DeleteUser)
			})

			// Ledger-scoped routes
			r.Group(func(r chi.Router) {
				r.Use(accountH.LedgerMiddleware)

				// Accounts
				r.Route("/accounts", func(r chi.Router) {
					r.Get("/", accountH.List)
					r.Post("/", accountH.Create)
				r.Get("/{id}", accountH.Get)
				r.Put("/{id}", accountH.Update)
				r.Delete("/{id}", accountH.Delete)
			})

			// Categories & Sub-categories
			r.Route("/categories", func(r chi.Router) {
				r.Get("/", categoryH.List)
				r.Post("/", categoryH.Create)
				r.Put("/{id}", categoryH.Update)
				r.Delete("/{id}", categoryH.Delete)
				r.Post("/{id}/subcategories", categoryH.CreateSubCategory)
				r.Put("/{id}/subcategories/{subId}", categoryH.UpdateSubCategory)
				r.Delete("/{id}/subcategories/{subId}", categoryH.DeleteSubCategory)
			})

			// Payment Methods
			r.Route("/payment-methods", func(r chi.Router) {
				r.Get("/", paymentMethodH.List)
				r.Post("/", paymentMethodH.Create)
				r.Put("/{id}", paymentMethodH.Update)
				r.Delete("/{id}", paymentMethodH.Delete)
			})

			// Transactions
			r.Route("/transactions", func(r chi.Router) {
				r.Get("/", transactionH.List)
				r.Get("/export/{format}", transactionH.Export)
				r.Post("/", transactionH.Create)
				r.Get("/{id}", transactionH.Get)
				r.Put("/{id}", transactionH.Update)
				r.Delete("/{id}", transactionH.Delete)
			})

			// Templates
			r.Route("/templates", func(r chi.Router) {
				r.Get("/", templateH.List)
				r.Post("/", templateH.Create)
				r.Delete("/{id}", templateH.Delete)
				r.Post("/{id}/execute", templateH.Execute)
			})

			// Tally & Summary
			r.Get("/tally/{id}", tallyH.GetTally)
			r.Post("/tally/{id}", tallyH.CheckTally)
			r.Get("/summary", tallyH.Summary)
			r.Get("/summary/range", tallyH.SummaryRange)
			})
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Channel to listen for shutdown signals
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Run server in a goroutine
	go func() {
		log.Printf("FinTrack API server starting on :%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for signal
	<-stop
	log.Println("Shutting down server gracefully...")

	// Create a timeout context for shutdown
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped.")
}

func getMigrationsDir() string {
	// Get directory relative to this source file
	_, filename, _, ok := runtime.Caller(0)
	if ok {
		return filepath.Join(filepath.Dir(filename), "..", "..", "internal", "db", "migrations")
	}
	return "internal/db/migrations"
}
