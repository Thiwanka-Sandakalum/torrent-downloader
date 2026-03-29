import { apiClient } from './api';

export interface Movie {
    id: number;
    title: string;
    year: number;
    rating: number;
    posterUrl: string;
    overview: string;
}

export const getPopularMovies = async (): Promise<Movie[]> => {
    const { data } = await apiClient.get<{ results: Movie[] }>('/movies');
    return data.results;
};

export const searchMovies = async (query: string): Promise<Movie[]> => {
    const { data } = await apiClient.get<{ results: Movie[] }>('/movies/search', {
        params: { q: query },
    });
    return data.results;
};

export const getMovieById = async (id: number): Promise<Movie> => {
    const { data } = await apiClient.get<Movie>(`/movies/${id}`);
    return data;
};
