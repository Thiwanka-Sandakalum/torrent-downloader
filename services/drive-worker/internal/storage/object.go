package storage

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type ListBucketResult struct {
	Contents []struct {
		Key string `xml:"Key"`
	} `xml:"Contents"`
}

func ListBlobs(ctx context.Context, baseURL, bucket, prefix string) ([]string, error) {
	// Build URL with query params
	listURL := fmt.Sprintf("%s/%s?prefix=%s&list-type=2", baseURL, bucket, url.QueryEscape(prefix))

	req, err := http.NewRequestWithContext(ctx, "GET", listURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list blobs: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("list blobs returned status %d", resp.StatusCode)
	}

	var result ListBucketResult
	if err := xml.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode XML: %w", err)
	}

	var keys []string
	for _, content := range result.Contents {
		keys = append(keys, content.Key)
	}

	return keys, nil
}

func StreamBlob(ctx context.Context, baseURL, bucket, key string) (io.ReadCloser, int64, error) {
	blobURL := fmt.Sprintf("%s/%s/%s", baseURL, bucket, key)

	req, err := http.NewRequestWithContext(ctx, "GET", blobURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to stream blob: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, 0, fmt.Errorf("stream blob returned status %d", resp.StatusCode)
	}

	return resp.Body, resp.ContentLength, nil
}

func DeleteBlob(ctx context.Context, baseURL, bucket, key string) error {
	blobURL := fmt.Sprintf("%s/%s/%s", baseURL, bucket, key)

	req, err := http.NewRequestWithContext(ctx, "DELETE", blobURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete blob: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("delete blob returned status %d", resp.StatusCode)
	}

	return nil
}
