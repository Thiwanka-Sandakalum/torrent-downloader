# Use the official Go image
FROM golang:1.23

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy go.mod and go.sum first (to leverage Docker's layer caching for dependencies)
COPY go.mod go.sum ./

# Download and verify module dependencies
RUN go mod download && go mod verify

# Copy the rest of the application source code
COPY . .

# Build the application binary
RUN go build -v -o /usr/local/bin/app ./...

# Command to run the application
CMD ["app"]
