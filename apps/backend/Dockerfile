# Stage 1: Build
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install dependencies separately to leverage Docker cache
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the application
# We use CGO_ENABLED=0 for a static binary that works in alpine
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api

# Stage 2: Final image
FROM alpine:latest

# Install CA certificates for HTTPS requests if needed
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from the builder
COPY --from=builder /app/main .

# Expose the port (Render uses $PORT environment variable)
EXPOSE 8080

# Command to run the application
CMD ["./main"]
