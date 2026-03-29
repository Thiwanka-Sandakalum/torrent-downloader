import { create } from 'zustand';

export interface TaskProgress {
    status: 'queued' | 'downloading' | 'uploading' | 'complete' | 'failed';
    progress: number;
    speed?: string;
    eta?: string;
    driveFileId?: string;
}

export interface Task {
    id: string;
    magnetUrl: string;
    movieId?: string;
    status: TaskProgress['status'];
    createdAt: string;
    progress?: TaskProgress;
}

interface TaskStore {
    tasks: Record<string, Task>;
    setTask: (task: Task) => void;
    updateProgress: (taskId: string, progress: TaskProgress) => void;
    removeTask: (taskId: string) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
    tasks: {},
    setTask: (task) =>
        set((state) => ({
            tasks: { ...state.tasks, [task.id]: task },
        })),
    updateProgress: (taskId, progress) =>
        set((state) => {
            const existingTask = state.tasks[taskId];
            if (!existingTask) return state;
            return {
                tasks: {
                    ...state.tasks,
                    [taskId]: {
                        ...existingTask,
                        status: progress.status,
                        progress,
                    },
                },
            };
        }),
    removeTask: (taskId) =>
        set((state) => {
            const { [taskId]: _, ...rest } = state.tasks;
            return { tasks: rest };
        }),
}));

export interface Movie {
    id: number;
    title: string;
    overview: string;
    posterPath: string;
    voteAverage: number;
    releaseDate: string;
}

interface MovieStore {
    query: string;
    results: Movie[];
    loading: boolean;
    setQuery: (q: string) => void;
    setResults: (movies: Movie[]) => void;
    setLoading: (v: boolean) => void;
}

export const useMovieStore = create<MovieStore>((set) => ({
    query: '',
    results: [],
    loading: false,
    setQuery: (q) => set({ query: q }),
    setResults: (movies) => set({ results: movies }),
    setLoading: (v) => set({ loading: v }),
}));
