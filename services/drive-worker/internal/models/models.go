package models

type UploadMessage struct {
	TaskID      string `json:"taskId"`
	UserID      string `json:"userId"`
	StoragePath string `json:"storagePath"`
}

type DriveTokens struct {
	EncryptedAccessToken  string `bson:"encryptedAccessToken"`
	EncryptedRefreshToken string `bson:"encryptedRefreshToken"`
	ExpiryDate            int64  `bson:"expiryDate"`
}

type UserDoc struct {
	Auth0ID     string      `bson:"auth0Id"`
	DriveLinked bool        `bson:"driveLinked"`
	DriveTokens DriveTokens `bson:"driveTokens"`
}
