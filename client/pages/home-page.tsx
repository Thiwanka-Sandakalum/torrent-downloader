import { useState, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useTasks } from '@/hooks/use-tasks';
import { useMovieStore } from '@/store';
import { searchMovies } from '@/services/movies';
import { useGoogleDriveLink } from '@/hooks/use-google-drive';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ModeToggle } from '@/components/common/theme-toggle';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ExternalLink, Play } from 'lucide-react';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

interface Movie {
  id: number;
  title: string;
  overview: string;
  posterPath: string;
  voteAverage: number;
  releaseDate: string;
}

function Navbar() {
  const { user, logout } = useAuth0();
  const { linkGoogleDrive } = useGoogleDriveLink();

  return (
    <nav className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-xl font-bold">Torrent Hunt</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {user?.picture && (
              <img
                src={user.picture}
                alt={user.name}
                className="h-8 w-8 rounded-full"
              />
            )}
            <span className="text-sm font-medium">{user?.name}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => linkGoogleDrive()}
          >
            Connect Drive
          </Button>
          <ModeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}

function MovieCard({
  movie,
  onSelect,
}: {
  movie: Movie;
  onSelect: (movie: Movie) => void;
}) {
  return (
    <Card
      className="cursor-pointer overflow-hidden transition-transform hover:scale-105"
      onClick={() => onSelect(movie)}
    >
      <div className="aspect-[2/3] overflow-hidden bg-gray-200 dark:bg-gray-800">
        <img
          src={`${TMDB_IMAGE_BASE}${movie.posterPath}`}
          alt={movie.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="p-2">
        <h3 className="line-clamp-2 text-sm font-medium">{movie.title}</h3>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-xs text-yellow-500">★</span>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {movie.voteAverage.toFixed(1)}
          </span>
        </div>
      </div>
    </Card>
  );
}

function SearchSection({
  onSelectMovie,
}: {
  onSelectMovie: (movie: Movie) => void;
}) {
  const { query, results, loading, setQuery, setResults, setLoading } =
    useMovieStore();
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(
    null
  );

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceTimer) clearTimeout(debounceTimer);

      if (!value.trim()) {
        setResults([]);
        return;
      }

      const timer = setTimeout(async () => {
        try {
          setLoading(true);
          const movies = await searchMovies(value);
          const mappedMovies = movies.map(movie => ({
            id: movie.id,
            title: movie.title,
            overview: movie.overview,
            posterPath: movie.posterUrl.replace(TMDB_IMAGE_BASE, ''),
            voteAverage: movie.rating,
            releaseDate: `${movie.year}`,
          }));
          setResults(mappedMovies as Movie[]);
        } catch (error) {
          console.error('Failed to search movies:', error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 400);

      setDebounceTimer(timer);
    },
    [debounceTimer, setQuery, setResults, setLoading]
  );

  return (
    <div className="space-y-4 p-4">
      <div className="relative">
        <Input
          placeholder="Search movies..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-2.5 h-5 w-5 animate-spin text-gray-400" />
        )}
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {results.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              onSelect={onSelectMovie}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DownloadModal({
  movie,
  open,
  onClose,
  onSubmit,
}: {
  movie?: Movie;
  open: boolean;
  onClose: () => void;
  onSubmit: (magnetUrl: string) => Promise<void>;
}) {
  const [magnetUrl, setMagnetUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!magnetUrl.startsWith('magnet:')) {
      setError('Invalid magnet URL');
      return;
    }

    try {
      setIsLoading(true);
      await onSubmit(magnetUrl);
      setMagnetUrl('');
      setError('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Download</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {movie && (
            <div className="flex gap-3">
              <img
                src={`${TMDB_IMAGE_BASE}${movie.posterPath}`}
                alt={movie.title}
                className="h-20 w-14 object-cover"
              />
              <div>
                <h3 className="font-medium">{movie.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {movie.releaseDate}
                </p>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium">Magnet URL</label>
            <Input
              placeholder="magnet:?xt=urn:btih:..."
              value={magnetUrl}
              onChange={(e) => {
                setMagnetUrl(e.target.value);
                setError('');
              }}
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !magnetUrl}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Start Download'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActiveDownloads() {
  const { tasks: allTasks, cancelTask, startSSE } = useTasks();
  const activeTasks = Object.values(allTasks).filter(
    (t) =>
      t.status === 'queued' || t.status === 'downloading' || t.status === 'uploading'
  );

  useEffect(() => {
    activeTasks.forEach((task) => {
      startSSE(task.id);
    });
  }, [activeTasks, startSSE]);

  if (activeTasks.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Active Downloads</h3>
      {activeTasks.map((task) => (
        <Card key={task.id} className="p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {task.magnetUrl.slice(0, 20)}...
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cancelTask(task.id)}
              >
                Cancel
              </Button>
            </div>
            <div className="space-y-1">
              <div className="flex h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div
                  className="bg-blue-500"
                  style={{ width: `${task.progress?.progress || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>{task.progress?.progress || 0}%</span>
                {task.progress?.speed && <span>{task.progress.speed}</span>}
                {task.progress?.eta && <span>ETA: {task.progress.eta}</span>}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function VideoPlayer({ taskId }: { taskId: string }) {
  return (
    <div className="mt-2">
      <video
        controls
        src={`/api/stream/${taskId}`}
        style={{ width: '100%' }}
        className="rounded"
      />
    </div>
  );
}

function CompletedTasks() {
  const { tasks: allTasks } = useTasks();
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const completedTasks = Object.values(allTasks).filter(
    (t) => t.status === 'complete'
  );

  if (completedTasks.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Completed Tasks</h3>
      {completedTasks.map((task) => (
        <Card key={task.id} className="p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {task.magnetUrl.slice(0, 40)}...
              </span>
              <div className="flex gap-2">
                {task.progress?.driveFileId && (
                  <a
                    href={`https://drive.google.com/file/d/${task.progress.driveFileId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Drive
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setExpandedTask(expandedTask === task.id ? null : task.id)
                  }
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {expandedTask === task.id && <VideoPlayer taskId={task.id} />}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [selectedMovie, setSelectedMovie] = useState<Movie | undefined>();
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const { createTask } = useTasks();

  const handleSelectMovie = (movie: Movie) => {
    setSelectedMovie(movie);
    setDownloadModalOpen(true);
  };

  const handleDownload = async (magnetUrl: string) => {
    await createTask(magnetUrl, selectedMovie?.id.toString());
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-6">
        <SearchSection onSelectMovie={handleSelectMovie} />

        <div className="space-y-6">
          <ActiveDownloads />
          <CompletedTasks />
        </div>
      </div>

      <DownloadModal
        movie={selectedMovie}
        open={downloadModalOpen}
        onClose={() => {
          setDownloadModalOpen(false);
          setSelectedMovie(undefined);
        }}
        onSubmit={handleDownload}
      />
    </div>
  );
}
