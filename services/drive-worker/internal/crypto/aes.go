package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"fmt"
)

func Decrypt(encryptedBase64 string, keyHex string) (string, error) {
	// Decode hex key to 32-byte key
	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return "", fmt.Errorf("failed to decode hex key: %w", err)
	}

	// Decode base64 encrypted data
	raw, err := base64.StdEncoding.DecodeString(encryptedBase64)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	// Extract components: iv (12 bytes) + authTag (16 bytes) + ciphertext
	if len(raw) < 28 {
		return "", fmt.Errorf("encrypted data too short")
	}

	iv := raw[:12]
	authTag := raw[12:28]
	ciphertext := raw[28:]

	// Create cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// Decrypt: append authTag to ciphertext for Open()
	plaintext, err := gcm.Open(nil, iv, append(ciphertext, authTag...), nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}
