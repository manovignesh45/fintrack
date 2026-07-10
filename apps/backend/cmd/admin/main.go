package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/fintrack/backend/internal/db"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found or failed to load")
	}

	userFlag := flag.String("user", "", "Superadmin username")
	passFlag := flag.String("pass", "", "Superadmin password")
	flag.Parse()

	var username, password string

	reader := bufio.NewReader(os.Stdin)

	if *userFlag != "" {
		username = *userFlag
	} else {
		fmt.Print("Enter Superadmin Username: ")
		u, err := reader.ReadString('\n')
		if err != nil {
			log.Fatalf("Error reading username: %v", err)
		}
		username = strings.TrimSpace(u)
	}

	if *passFlag != "" {
		password = *passFlag
	} else {
		fmt.Print("Enter Superadmin Password: ")
		p, err := reader.ReadString('\n')
		if err != nil {
			log.Fatalf("Error reading password: %v", err)
		}
		password = strings.TrimSpace(p)
	}

	if username == "" || password == "" {
		log.Fatalf("Username and password cannot be empty")
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Check if user exists
	var existingRole string
	err = pool.QueryRow(ctx, "SELECT role FROM users WHERE username = $1", username).Scan(&existingRole)
	if err == nil {
		// User exists, update role and password
		_, err = pool.Exec(ctx, "UPDATE users SET password_hash = $1, role = 'superadmin', updated_at = NOW() WHERE username = $2", string(hashedPassword), username)
		if err != nil {
			log.Fatalf("Failed to update existing user to superadmin: %v", err)
		}
		fmt.Printf("Successfully updated existing user '%s' to superadmin.\n", username)
	} else {
		// User does not exist, create new
		_, err = pool.Exec(ctx, "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'superadmin')", username, string(hashedPassword))
		if err != nil {
			log.Fatalf("Failed to create superadmin: %v", err)
		}
		fmt.Printf("Successfully created superadmin '%s'.\n", username)
	}
}
