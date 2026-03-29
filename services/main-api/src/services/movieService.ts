import axios from 'axios';
import { cacheGet, cacheSet } from './redisService';
import { AppError } from '../types';
import { logger } from '../config/logger';

const SEARCH_TTL = 15 * 60;   // 15 min
const DETAIL_TTL = 60 * 60;   // 1 h
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

export interface Movie {
    tmdbId: number;
    title: string;
    year?: number;
    rating?: number;
    posterUrl?: string;
    overview?: string;
}

const transformTmdbMovie = (data: any): Movie => {
    return {
        tmdbId: data.id,
        title: data.title || data.name,
        year: data.release_date ? parseInt(data.release_date.split('-')[0]) : undefined,
        rating: data.vote_average,
        posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : undefined,
        overview: data.overview,
    };
};

export const getPopularMovies = async (): Promise<Movie[]> => {
    const cacheKey = 'movies:popular';

    const cached = await cacheGet(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
            params: { api_key: TMDB_API_KEY },
        });

        if (response.status !== 200) {
            throw new Error('TMDB API error');
        }

        const movies = response.data.results.map(transformTmdbMovie);
        await cacheSet(cacheKey, JSON.stringify(movies), SEARCH_TTL);
        return movies;
    } catch (error) {
        logger.error({ error }, 'Failed to fetch popular movies from TMDB');
        const err: AppError = new Error('Failed to fetch movies');
        err.status = 502;
        throw err;
    }
};

export const searchMovies = async (query: string): Promise<Movie[]> => {
    const cacheKey = `movies:search:${encodeURIComponent(query.toLowerCase())}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
            params: { query, api_key: TMDB_API_KEY },
        });

        if (response.status !== 200) {
            throw new Error('TMDB API error');
        }

        const movies = response.data.results.map(transformTmdbMovie);
        await cacheSet(cacheKey, JSON.stringify(movies), SEARCH_TTL);
        return movies;
    } catch (error) {
        logger.error({ error }, 'Failed to search movies from TMDB');
        const err: AppError = new Error('Failed to search movies');
        err.status = 502;
        throw err;
    }
};

export const getMovieById = async (id: number): Promise<Movie> => {
    const cacheKey = `movies:detail:${id}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/movie/${id}`, {
            params: { api_key: TMDB_API_KEY },
        });

        if (response.status !== 200) {
            throw new Error('TMDB API error');
        }

        const movie = transformTmdbMovie(response.data);
        await cacheSet(cacheKey, JSON.stringify(movie), DETAIL_TTL);
        return movie;
    } catch (error) {
        logger.error({ error }, 'Failed to fetch movie details from TMDB');
        const err: AppError = new Error('Failed to fetch movie');
        err.status = 502;
        throw err;
    }
};
