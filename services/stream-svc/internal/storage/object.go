package storage

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
)

var videoExtensions = []string{".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v"}

type BlobItem struct {
	Key  string
	Size int64
}

type listBucketResultContents struct {
	Key  string `xml:"Key"`
	Size int64  `xml:"Size"`
}

type listBucketResult struct {
	Contents []listBucketResultContents `xml:"Contents"`
}

func ListBlobs(ctx context.Context, baseURL, bucket, prefix string) ([]BlobItem, error) {
	url := fmt.Sprintf("%s/%s?prefix=%s&list-type=2", baseURL, bucket, prefix)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("list blobs failed: %d %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result listBucketResult
	if err := xml.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	var blobs []BlobItem
	for _, item := range result.Contents {
		blobs = append(blobs, BlobItem{
			Key:  item.Key,
			Size: item.Size,
		})
	}

	return blobs, nil
}

func DetectPrimary(blobs []BlobItem) (BlobItem, bool) {
	var largest BlobItem
	found := false

	for _, blob := range blobs {
		if isVideoFile(blob.Key) {
			if !found || blob.Size > largest.Size {
				largest = blob
				found = true
			}
		}
	}

	return largest, found
}

func isVideoFile(key string) bool {
	for _, ext := range videoExtensions {
		if strings.HasSuffix(strings.ToLower(key), ext) {
			return true
		}
	}
	return false
}

func RangedGet(ctx context.Context, baseURL, bucket, key, rangeHeader string) (*http.Response, error) {
	url := fmt.Sprintf("%s/%s/%s", baseURL, bucket, key)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	if rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	return resp, nil
}
