# Agent Instructions — Phase 6: Client UI

## Prerequisite
Phases 1–3 must be complete so the API endpoints exist to call.

## Goal
Build the full React client UI. Replace all stubs with working components.

## Working directory
`client/`

## Tech stack (already installed, do NOT reinstall)
- React 18 + Vite + TypeScript
- `@auth0/auth0-react`
- Tailwind CSS + Radix UI (shadcn/ui components in `components/ui/`)
- React Router v7
- Axios (client/services/api.ts)

## New dependency to install
```bash
pnpm add zustand
```

---

## Task 1 — `client/store/index.ts`

Replace the placeholder with two Zustand stores.

### `useTaskStore`
```ts
interface TaskProgress {
  status: 'queued' | 'downloading' | 'uploading' | 'complete' | 'failed'
  progress: number       // 0–100
  speed?: string         // "4.2 MB/s"
  eta?: string           // "2m 30s"
  driveFileId?: string
}

interface Task {
  id: string
  magnetUrl: string
  movieId?: string
  status: TaskProgress['status']
  createdAt: string
  progress?: TaskProgress
}

interface TaskStore {
  tasks: Record<string, Task>
  setTask: (task: Task) => void
  updateProgress: (taskId: string, progress: TaskProgress) => void
  removeTask: (taskId: string) => void
}
```

### `useMovieStore`
```ts
interface Movie {
  id: number
  title: string
  overview: string
  posterPath: string
  voteAverage: number
  releaseDate: string
}

interface MovieStore {
  query: string
  results: Movie[]
  loading: boolean
  setQuery: (q: string) => void
  setResults: (movies: Movie[]) => void
  setLoading: (v: boolean) => void
}
```

---

## Task 2 — `client/services/api.ts`

Add an Axios request interceptor so every request carries the Auth0 bearer token.

```ts
// Problem: getAccessTokenSilently() is a hook (can't call outside component).
// Solution: module-level token setter pattern.

let tokenGetter: (() => Promise<string>) | null = null

export function setTokenGetter(fn: () => Promise<string>) {
  tokenGetter = fn
}

// Add to the existing axios instance:
api.interceptors.request.use(async (config) => {
  if (tokenGetter) {
    const token = await tokenGetter()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

---

## Task 3 — `client/providers/AuthTokenProvider.tsx` (new file)

```tsx
// Wire up the token getter inside a component that has access to useAuth0()
import { useAuth0 } from '@auth0/auth0-react'
import { useEffect } from 'react'
import { setTokenGetter } from '../services/api'

export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  const { getAccessTokenSilently } = useAuth0()
  useEffect(() => {
    setTokenGetter(getAccessTokenSilently)
  }, [getAccessTokenSilently])
  return <>{children}</>
}
```

Mount this in `app/layout.tsx` (or wherever `Auth0Provider` is already mounted)
as a direct child of `Auth0Provider`.

---

## Task 4 — `client/hooks/use-tasks.ts` (new file)

```ts
// useTasks(): { tasks, createTask, cancelTask, startSSE }
// - On mount: GET /api/tasks → populate store
// - createTask(magnetUrl, movieId?): POST /api/tasks → add to store → call startSSE(id)
// - cancelTask(id): DELETE /api/tasks/:id → update store status to 'failed'
// - startSSE(taskId): read client/services/tasks.ts subscribeToTask() which already
//   implements SSE — on each event call store.updateProgress(taskId, event.data)
```

Read `client/services/tasks.ts` before implementing — most of the API calls are
already there. This hook just bridges the service layer to the Zustand store.

---

## Task 5 — `client/pages/home-page.tsx`

Replace the 12-line stub with the full page. Structure:

```
<HomePage>
  ├── <Navbar>          (user avatar + Drive connect button + theme toggle)
  ├── <SearchSection>   (movie search — calls /api/movies/search)
  │   └── <MovieGrid>   (poster cards, clicking opens DownloadModal)
  ├── <DownloadsSection> (active + completed tasks)
  │   ├── <ActiveDownloads>   (progress bars)
  │   └── <CompletedTasks>    (drive link + stream button)
  └── <DownloadModal>   (magnet URL input, optional movie association)
```

### `<Navbar>`
```tsx
// - Show user.name + user.picture (from useAuth0())
// - "Connect Drive" button: calls useGoogleDrive().connectDrive() if not connected
//   (read client/hooks/use-google-drive.ts for the existing hook API)
// - <ThemeToggle /> (already exists at client/components/common/theme-toggle.tsx)
// - "Sign out" button: calls logout({ returnTo: window.location.origin })
```

### `<SearchSection>`
```tsx
// - Controlled <Input> with 400 ms debounce
// - On change: GET /api/movies/search?q={query} → update MovieStore
// - Shows spinner while loading
// - MovieGrid: grid-cols-2 sm:grid-cols-4 lg:grid-cols-6
//   Each card: <img src={TMDB_IMAGE_BASE + posterPath} /> + title + rating badge
//   Clicking a card: sets selectedMovie state, opens DownloadModal
```

### `<DownloadModal>`
```tsx
// Props: movie?: Movie, open, onClose
// - If movie provided: show movie title + poster as context
// - <Input> for magnet URL (required, validate starts with "magnet:")
// - Submit: calls useTasks().createTask(magnetUrl, movie?.id)
// - Shows error if createTask throws
```

### `<ActiveDownloads>`
```tsx
// Read from useTaskStore — filter tasks where status in ['queued','downloading','uploading']
// For each task:
//   - Task ID (truncated) or movie title if movieId populated
//   - Progress bar: <div style={{ width: `${progress}%` }} />
//   - speed + eta text
//   - Cancel button → useTasks().cancelTask(id)
// Subscribe to SSE on mount for every active task
```

### `<CompletedTasks>`
```tsx
// Filter tasks where status === 'complete'
// For each:
//   - Title
//   - "Open in Drive" link: https://drive.google.com/file/d/{driveFileId}
//   - "Stream" button: opens <VideoPlayer taskId={id} />
```

### `<VideoPlayer>`
```tsx
// A simple component with a native <video> element:
//   <video controls src={`/api/stream/${taskId}`} style={{ width: '100%' }} />
// Mount it in a modal or expandable panel below the task row.
```

---

## Task 6 — Routing check

Read `client/routes.ts` and `client/lib/router/index.tsx`. Confirm that:
- `/` renders `<HomePage />`
- Auth guard wraps `/` so unauthenticated users are redirected to `/auth`
- `<AuthTokenProvider>` is mounted before any route that calls the API

Make any wiring fixes needed. Do not change the routing library or add new routes.

---

## Task 7 — Style baseline

Do NOT redesign the component library. Use only:
- Classes already available from Tailwind config
- Existing `components/ui/` components (button, card, input, tabs)
- The `cn()` utility from `lib/utils/cn.ts`

Dark mode is already wired via `ThemeProvider` — use `dark:` variants normally.

---

## Acceptance criteria
- `pnpm dev` starts without TypeScript errors
- Unauthenticated visit to `/` redirects to `/auth`
- After login, `/` renders the search bar and empty downloads list
- Searching "inception" shows movie cards with posters
- Clicking a card + entering a magnet URL calls `POST /api/tasks` (verify in DevTools)
- Active tasks show a live progress bar that updates via SSE
- Completed tasks show a working Drive link
- `<video>` player makes range requests (verify 206 in DevTools Network tab)
- Theme toggle switches dark/light correctly
