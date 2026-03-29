import axios from 'axios';
import { cacheGet, cacheSet } from './redisService';
import { logger } from '../config/logger';

const OPENSUBTITLES_API = 'https://api.opensubtitles.com/api/v1';
const CACHE_TTL = 60 * 60 * 24; // 24 h — subtitles rarely change

export interface SubtitleTrack {
    id: string;
    language: string;
    languageCode: string;
    downloadUrl: string;
    fileSize: number;
    matchedBy: string;
}

export const getSubtitles = async (imdbId: string): Promise<SubtitleTrack[]> => {
    const cacheKey = `subtitles:${imdbId}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
        logger.debug({ imdbId }, 'Subtitles cache hit');
        return JSON.parse(cached) as SubtitleTrack[];
    }

    const response = await axios.get(`${OPENSUBTITLES_API}/subtitles`, {
        params: { imdb_id: imdbId, languages: 'en' },
        headers: {
            'Api-Key': process.env.OPENSUBTITLES_API_KEY,
            'Content-Type': 'application/json',
        },
    });

    const tracks: SubtitleTrack[] = (response.data?.data ?? []).map((item: Record<string, unknown>) => {
        const attrs = item.attributes as Record<string, unknown>;
        const files = (attrs?.files as Record<string, unknown>[]) ?? [];
        return {
            id: String(item.id),
            language: String(attrs?.language ?? ''),
            languageCode: String(attrs?.language ?? ''),
            downloadUrl: String(files[0]?.file_name ?? ''),
            fileSize: Number(attrs?.upload_date ?? 0),
            matchedBy: String(attrs?.matched_by ?? 'unknown'),
        };
    });

    await cacheSet(cacheKey, JSON.stringify(tracks), CACHE_TTL);
    logger.debug({ imdbId, count: tracks.length }, 'Subtitles fetched and cached');

    return tracks;
};
