# Use the official Golang image to build the application
FROM golang:1.23 AS builder

# Set the current working directory inside the container
WORKDIR /app

# Copy the go mod and sum files
COPY go.mod go.sum ./

# Copy the .env file
COPY .env .env

# Download the dependencies
RUN go mod tidy

# Copy the entire project into the container
COPY . .

# Build the Go app with static linking
RUN CGO_ENABLED=0 go build -o torrent-downloader-api .

# Use a debian image for runtime
FROM debian:bullseye-slim

# Install dependencies for running the app (e.g., ca-certificates and libc)
RUN apt-get update && apt-get install -y ca-certificates libc6

# Create a non-root user with a specific UID in the range 10000–20000
RUN useradd --no-create-home --uid 10001 --shell /usr/sbin/nologin appuser

# Set the working directory
WORKDIR /root/

# Create a volume for the temporary directory
VOLUME /root/temp

# Copy the Go binary from the build stage
COPY --from=builder /app/torrent-downloader-api .

# Copy the .env file from the builder stage to the runtime stage
COPY --from=builder /app/.env .env

# Set ownership for .env and binary files
RUN chown 10001:10001 /root/.env /root/torrent-downloader-api

# Switch to the non-root user
USER 10001

# Expose the port the app runs on
EXPOSE 8080

# Run the application
CMD ["./torrent-downloader-api"]
