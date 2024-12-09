package models

// StartTorrentRequest is the payload for starting a torrent download
type StartTorrentRequest struct {
	MagnetLink string `json:"magnetLink" binding:"required"`
}

// TorrentTask represents the state of a torrent download task
type TorrentTask struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

// TorrentStatus represents the status of a torrent task
type TorrentStatus struct {
	ID        string  `json:"id"`
	Status    string  `json:"status"`
	Progress  float64 `json:"progress"`
}
