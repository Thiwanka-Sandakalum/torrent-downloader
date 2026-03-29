# Torrent Hunt Application Documentation

## Table of Contents
1. [Application Scenario](#application-scenario)
2. [Core Functionalities](#core-functionalities)
3. [Technical Overview](#technical-overview)
4. [APIs and External Services](#apis-and-external-services)
5. [Future Enhancements](#future-enhancements)

---

## Application Scenario

This application is a movie downloader and streaming platform that offers users the ability to:
1. **Search for movies** by title or category.
2. **Provide a torrent magnet link** or upload a torrent file to download movies.
3. **Save downloaded movies** to a cloud drive (e.g., Google Drive).
4. **Stream movies directly** within the application.

The system leverages external APIs for movie suggestions, torrent searching, subtitles, and cloud storage.

---

## Core Functionalities

### 1. Movie Search and Suggestions
- Users can search for movies by entering a keyword.
- Based on the entered query, the application provides movie suggestions using external APIs.

### 2. Torrent File/Magnet Link Support
- Users can paste a torrent magnet link or upload a `.torrent` file.
- The application processes the torrent to begin the download.

### 3. Movie Downloads and Cloud Storage
- Movies can be downloaded and saved locally.
- Alternatively, users can directly save the downloaded files to Google Drive.

### 4. Streaming Movies
- Users can stream movies through an integrated player without downloading the files.

### 5. Subtitle Integration
- Subtitles for movies are fetched using a third-party API.

---

## Technical Overview

### Technology Stack
- **Frontend**: React with TypeScript
- **Backend**: RESTful APIs using Node.js/Express 
- **Database**: NoSQL (MongoDB) 
- **Deployment**: Azure Cloud Services
- **External Services**
   - APIs for movie metadata and torrent search.
   - Google Drive for file storage.
   - Subtitle provider APIs.

---

## APIs and External Services

### 1. Movie Suggestion and Search
- **Purpose**: Retrieve movie metadata such as titles, descriptions, and ratings.
- **Example API**: TMDB (The Movie Database) or OMDb API.

### 2. Torrent Search and Download
- **Purpose**: Find torrent links or download torrent files.
- **Libraries/Tools**: WebTorrent or qBittorrent.

### 3. Subtitles
- **Purpose**: Fetch subtitles in various languages.
- **Example API**: OpenSubtitles API.

### 4. Google Drive API
- **Purpose**: Upload movies to Google Drive for storage and sharing.
- **Tools**: Google Drive SDK with OAuth2.

## Future Enhancements

1. **Multi-language Support**
   - Enable localization for wider audience reach.

2. **Advanced User Accounts**
   - Include user authentication and profiles for personalized experiences.

3. **Download Scheduling**
   - Allow users to schedule downloads for off-peak hours.

4. **Streaming Optimization**
   - Improve streaming performance using adaptive bitrate streaming.

