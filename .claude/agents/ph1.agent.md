---
name: ph1
description: Implement the four missing config files and rewrite `src/index.ts` so the main-api
service starts cleanly with Express, middleware, routes, MongoDB, and Redis all
initialised in the correct order.
tools: [read, grep, glob, bash] # specify the tools this agent can use. If not set, all enabled tools are allowed.
---
# Agent Instructions — Phase 1: Server Bootstrap

## Goal

## Working directory
`services/main-api/`

## Read these files first (for context)
- `src/middlewares/authMiddleware.ts`
- `src/middlewares/errorMiddleware.ts`
- `src/middlewares/index.ts`
- `src/routes/index.ts`
- `src/services/redisService.ts`
- `package.json` (installed deps: express, mongoose, helmet, cors, morgan, pino, dotenv)

---

## Task 1 — `src/config/logger.ts`

Create a `pino` logger (pino is not yet installed — add it).

**Install first:**
```
npm install pino pino-pretty
npm install --save-dev @types/pino
```

**Implementation requirements:**
- Export a default `logger` instance (`pino({ level: process.env.LOG_LEVEL || 'info' })`)
- In development (`NODE_ENV !== 'production'`), use `pino-pretty` transport
- Export should be: `export default logger` AND `export { logger }`
  (redisService, taskService, sseService, subtitleService all import `{ logger }`)

---

## Task 2 — `src/config/database.ts`

**Implementation requirements:**
- Import `mongoose` and `{ logger }` from `./logger`
- Export `connectDatabase(): Promise<void>`
- Connect to `process.env.MONGODB_URI` (throw if missing)
- On successful connection: `logger.info('MongoDB connected')`
- On `mongoose.connection` error event: `logger.error(err, 'MongoDB error')`
- On `mongoose.connection` disconnected event: `logger.warn('MongoDB disconnected')`
- Retry logic: if connection fails, wait 5 s and retry (max 5 attempts), then throw

---

## Task 3 — `src/config/server.ts`

**Implementation requirements:**
- Import `express`, `helmet`, `cors`, `morgan`, `rateLimit` from `express-rate-limit`
- Export `createApp(): express.Application`
- Apply in this order:
  1. `helmet()`
  2. `cors({ origin: process.env.CLIENT_ORIGIN || '*', credentials: true })`
  3. `morgan('combined')` in production, `morgan('dev')` otherwise
  4. `express.json({ limit: '10kb' })`
  5. `express.urlencoded({ extended: true })`
  6. Global rate limiter: `rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })`
  7. Health check route: `GET /health → 200 { status: 'ok', timestamp }`
  8. Mount router from `../routes` at `/api`  
     (import the router object — we will create it in Phase 2)
  9. `notFound` middleware (from `../middlewares`)
  10. `errorHandler` middleware (from `../middlewares`)
- Do NOT call `app.listen()` here — that happens in index.ts

---

## Task 4 — `src/index.ts` (full rewrite)

**Current file is broken** — it imports from a non-existent path.  
Replace the entire file.

**Implementation requirements:**
```typescript
// Correct boot sequence:
// 1. Load .env (dotenv)
// 2. Import logger
// 3. Import connectDatabase
// 4. Import connectRedis  (from ../services/redisService)
// 5. Import createApp    (from ../config/server)
// 6. Connect DB
// 7. Connect Redis
// 8. Create Express app
// 9. app.listen(PORT)
// 10. Handle SIGTERM / SIGINT for graceful shutdown
```

- `PORT` = `process.env.PORT || 3000`
- On uncaught errors during startup: `logger.fatal(err)` then `process.exit(1)`
- Graceful shutdown: close HTTP server, then call `mongoose.disconnect()`,
  then Redis client `quit()`

---

## Acceptance criteria
- `npm run dev` starts without import errors
- `GET http://localhost:3000/health` returns `{ status: 'ok' }`
- MongoDB connection log line appears
- Redis connection log line appears
- No references to `./mainApi/` anywhere
s