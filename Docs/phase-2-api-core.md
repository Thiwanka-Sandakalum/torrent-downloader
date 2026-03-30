# Agent Instructions — Phase 2: API Core

## Prerequisite
Phase 1 must be complete (`npm run dev` starts and `/health` responds).

## Goal
Implement all empty models, the movie service, both controllers, rewrite the task
routes, rewrite validation middleware, and wire an Express router that is imported
by `src/config/server.ts`.

## Working directory
`services/main-api/`

## Read these files first
- `src/services/redisService.ts`
- `src/services/taskService.ts`
- `src/services/movieService.ts` (empty — you will implement it)
- `src/services/auth0Management.ts`
- `src/services/googleDrive.ts`
- `src/routes/driveRoutes.ts`
- `src/routes/taskRoutes.ts` (outdated — you will rewrite it)
- `src/middlewares/authMiddleware.ts`
- `src/types/index.ts`
- `src/types/error.ts`
- `src/types/drive.ts`
- `src/types/globals.ts`
- `src/config/logger.ts` (from Phase 1)

---

## Task 1 — `src/models/taskModel.ts`

Use Mongoose. Schema fields:

| Field | Type | Notes |
|-------|------|-------|
| `taskId` | String, required, unique | UUID v4 — set by service layer |
| `userId` | String, required, index | Auth0 `sub` |
| `magnetLink` | String, required | max 1024 chars |
| `status` | String enum | `queued\|downloading\|uploading\|complete\|failed\|cancelled` default `queued` |
| `progress` | Number | 0–100, default 0 |
| `speed` | String | e.g. `"5.2 MB/s"` |
| `eta` | Number | seconds |
| `storagePath` | String | `/downloads/{taskId}/` |
| `driveFileId` | String | set when complete |
| `errorMessage` | String | set on failure |
| `createdAt` | Date, default now | |
| `completedAt` | Date | |

- Add compound index: `{ userId: 1, createdAt: -1 }`
- Export: `export const TaskModel = mongoose.model('Task', taskSchema)`

---

## Task 2 — `src/models/userModel.ts`

| Field | Type | Notes |
|-------|------|-------|
| `auth0Id` | String, required, unique | matches `req.auth.payload.sub` |
| `driveLinked` | Boolean, default false | |
| `driveTokens` | Object | `{ encryptedAccessToken, encryptedRefreshToken, expiryDate }` — all strings |
| `createdAt` | Date, default now | |
| `updatedAt` | Date | |

- Export: `export const UserModel = mongoose.model('User', userSchema)`

---

## Task 3 — `src/models/movieModel.ts`

| Field | Type | Notes |
|-------|------|-------|
| `tmdbId` | Number, required, unique | |
| `title` | String, required | |
| `year` | Number | |
| `rating` | Number | |
| `posterUrl` | String | |
| `overview` | String | |
| `cachedAt` | Date, default now | |

- Export: `export const MovieModel = mongoose.model('Movie', movieSchema)`

---

## Task 4 — `src/services/movieService.ts`

**Install first (if not already):**
```
npm install axios
npm install --save-dev @types/axios
```

**Implementation requirements:**

```typescript
// Cache TTLs
const SEARCH_TTL = 15 * 60;   // 15 min
const DETAIL_TTL = 60 * 60;   // 1 h

// getPopularMovies(): Promise<Movie[]>
//   Cache key: 'movies:popular'
//   Cache miss → TMDB GET /movie/popular?api_key=...
//   Transform response, write to Redis, return

// searchMovies(query: string): Promise<Movie[]>
//   Cache key: `movies:search:${encodeURIComponent(query.toLowerCase())}`
//   Cache miss → TMDB GET /search/movie?query=...
//   Transform, cache, return

// getMovieById(id: number): Promise<Movie>
//   Cache key: `movies:detail:${id}`
//   Cache miss → TMDB GET /movie/{id}
//   Transform, cache, return
```

- TMDB base URL: `https://api.themoviedb.org/3`
- API key: `process.env.TMDB_API_KEY`
- Poster URL: prefix with `https://image.tmdb.org/t/p/w500`
- Use `{ cacheGet, cacheSet }` from `./redisService`
- On TMDB non-200: throw an AppError with status 502

---

## Task 5 — `src/controllers/movieController.ts`

Three handlers, each `async (req, res, next)`:

- `getPopularMovies` → calls `movieService.getPopularMovies()` → `200 { results }`
- `searchMovies` → reads `req.query.q` → validates non-empty (400 if missing) → calls `movieService.searchMovies(q)` → `200 { results }`
- `getMovieById` → reads `req.params.id` → validates numeric → calls `movieService.getMovieById(+id)` → `200 { movie }`

All wrap in try/catch and call `next(error)`.

---

## Task 6 — `src/controllers/taskController.ts`

Five handlers:

### `createTask`
1. Read `userId = req.auth!.payload.sub`
2. Read `magnetLink` from `req.body`
3. Validate: regex `/^magnet:\?xt=urn:btih:/i`, max 1024 chars → 400 if invalid
4. Call `taskService.createTask({ userId, magnetLink })`
5. Persist to MongoDB via `TaskModel.create({ taskId, userId, magnetLink, status: 'queued' })`
6. Return `201 { taskId }`

### `listTasks`
1. `userId = req.auth!.payload.sub`
2. `TaskModel.find({ userId }).sort({ createdAt: -1 }).limit(50)`
3. Return `200 { tasks }`

### `getTask`
1. Verify task exists AND `task.userId === req.auth!.payload.sub` → 403 if mismatch
2. Return `200 { task }`

### `getTaskProgress` (SSE)
1. Verify task ownership (same as getTask)
2. Check Redis snapshot (`taskService.getTaskSnapshot(taskId)`) — if task is already
   `complete` or `failed`, emit the snapshot once then end response
3. Otherwise call `sseService.streamTaskProgress(taskId, res)`

### `cancelTask`
1. Load task, verify ownership
2. Check status — if `uploading` or `complete` return `409`
3. Call `taskService.cancelTask(taskId)`
4. `TaskModel.updateOne({ taskId }, { status: 'cancelled' })`
5. Return `200 { cancelled: true }`

---

## Task 7 — `src/routes/taskRoutes.ts` (full rewrite)

```typescript
import { auth0Middleware } from '../middlewares';
import { createTask, listTasks, getTask, getTaskProgress, cancelTask }
  from '../controllers/taskController';

router.post('/',          auth0Middleware, createTask);
router.get('/',           auth0Middleware, listTasks);
router.get('/:taskId',    auth0Middleware, getTask);
router.get('/:taskId/progress', auth0Middleware, getTaskProgress);
router.delete('/:taskId', auth0Middleware, cancelTask);
```

---

## Task 8 — `src/middlewares/validationMiddleware.ts` (rewrite)

Remove the current auth header check (that is the auth middleware's job).
Instead export two focused validators:

```typescript
export const validateMagnetLink = (req, res, next) => {
  // check req.body.magnetLink exists, matches regex, max 1024 chars
  // 400 on fail, next() on pass
};

export const validateTaskId = (req, res, next) => {
  // check req.params.taskId is a valid UUID v4
  // 400 on fail
};
```

---

## Task 9 — `src/routes/index.ts` + central router

Create a single Express Router in `src/routes/index.ts` that mounts all sub-routers:

```typescript
import movieRoutes from './movieRoutes';
import taskRoutes  from './taskRoutes';
import driveRoutes from './driveRoutes';

const router = express.Router();
router.use('/movies', movieRoutes);
router.use('/tasks',  taskRoutes);
router.use('/drive',  driveRoutes);

export default router;
```

This is the object imported by `src/config/server.ts`.

---

## Task 10 — `src/controllers/index.ts` (new barrel file)

```typescript
export * from './movieController';
export * from './taskController';
```

---

## Acceptance criteria
- `GET  /api/movies`               → 200 array
- `GET  /api/movies/search?q=inception` → 200 array
- `GET  /api/movies/1`             → 200 movie object
- `POST /api/tasks` (with valid JWT + magnet) → 201 `{ taskId }`
- `GET  /api/tasks` (with JWT)     → 200 array
- `GET  /api/tasks/:id/progress`   → SSE connection opens, `ping` heartbeat within 15 s
- `DELETE /api/tasks/:id`          → 200 or 409
- `POST /api/drive/link-google-drive` → 200 (existing driveRoutes, unchanged)
- No TypeScript compilation errors (`npm run build` passes)
