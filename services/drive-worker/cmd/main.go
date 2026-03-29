package main

import (
	"context"
	"drive-worker/internal/config"
	"drive-worker/internal/worker"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	cfg := config.Load()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	if err := worker.RunWorker(ctx, cfg); err != nil {
		log.Fatalf("drive-worker exited: %v", err)
	}
}
