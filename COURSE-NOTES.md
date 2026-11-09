# Backend Series — Walkthrough (Part 1, chapters at 04:06:17 → 06:15:38)

Course: [Chai aur Code — complete Backend Developer course, Part 1](https://www.youtube.com/watch?v=EH3vGeqeIAo&list=PLu71SKxNbfoBGh_8p_NS-ZAh6v7HhYqHW)

This file maps the code in `src/` to the four chapters you listed. Your original
scaffold is untouched in `_backup/original-project-2026-11-08/`.

---

## 0. Run it

```bash
npm run dev       # start the API with auto-reload
```

Then open <http://localhost:8000/api/v1/healthcheck>.

**You still need to paste your Atlas connection string into `.env`.** See below.

### Your database: MongoDB Atlas

Docker Hub's CDN is blocked on your network (the `mongo:8` pull stalls at
"Pulling fs layer" and `production.cloudflare.docker.com` returns 403), so the
Docker option is left in the repo but is not usable here. Atlas is the active path.

Set this one line in `.env`:

```
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net
```

Setup, in order:

1. Create a free account and an **M0 (free)** cluster at <https://cloud.mongodb.com>.
2. **Database Access** → Add New Database User → username + password. Use a
   password with no special characters, or URL-encode them (`@` → `%40`, `#` → `%23`).
3. **Network Access** → Add IP Address → *Allow Access from Anywhere*
   (`0.0.0.0/0`) for development. Without this you get a timeout, not an auth error.
4. **Cluster → Connect → Drivers** → copy the connection string.
5. Paste it into `.env` as `MONGODB_URI`, replacing the placeholder. Leave the
   database name out — `DB_NAME=hasnain` is appended automatically.
6. Run `npm run dev`. You should see `MongoDB connected. HOST: ... | DB: hasnain`.

`DB_NAME` stays separate from the URI, so switching provider never means editing code.

| Option | `MONGODB_URI` | Status here |
| --- | --- | --- |
| **Atlas (active)** | `mongodb+srv://user:pass@cluster.mongodb.net` | chosen — needs your string |
| Local install | `mongodb://127.0.0.1:27017` | works if you install MongoDB (~740 MB) |
| Docker | `mongodb://127.0.0.1:27017` | blocked — Docker Hub CDN unreachable |

---

## 1. Professional backend project setup — 04:06:17

### What changed in your folder

Your `package.json` and `src/` were inside `public/`. In this course `public/` is
**only** for static and temporary upload files (`public/temp/` for Multer).
Everything else now lives at the root, which is what the video assumes.

Your `public/.ENV` held a Docker Desktop download link, not environment
variables. It is preserved in the backup; the real config is now `.env`.

```
HASNAIN/
├── .env                 # your secrets — gitignored
├── .env.example         # safe template you CAN commit
├── .gitignore
├── .prettierrc
├── docker-compose.yml   # MongoDB container
├── package.json
├── public/temp/         # Multer uploads land here later
└── src/
    ├── index.js         # entry point: env → DB → HTTP
    ├── app.js           # Express app: middleware → routes → errors
    ├── constants.js
    ├── db/index.js
    ├── models/          # user.model.js, video.model.js
    ├── controllers/
    ├── routes/
    ├── utils/           # ApiError, ApiResponse, asyncHandler
    └── middlewares/     # Multer + auth go here next chapter
```

### Why `app.js` and `index.js` are separate

`app.js` only builds the Express app. `index.js` owns the environment, the
database connection and the HTTP port. Splitting them means tests can import
`app` without opening a port or touching a database.

### Middleware order matters

In `app.js` the order is `cors → json → urlencoded → static → cookieParser → routes → 404 → error handler`.
Anything that reads the request must be registered **before** the routes that
need it. `cookieParser` after the routes would leave `req.cookies` undefined.

### The dotenv trap (the actual bug in this chapter)

This looks correct but is broken:

```js
import dotenv from "dotenv";
import { app } from "./app.js";
dotenv.config({ path: "./.env" });   // runs TOO LATE
```

ES module imports are hoisted and evaluated **before** any statement in the file.
`app.js` reads `process.env.CORS_ORIGIN` while it is still `undefined`.

The fix used in `src/index.js` is a side-effect import placed first:

```js
import "dotenv/config";   // must be the first import
```

Imports evaluate in written order, so `.env` is loaded before `app.js` runs.

---

## 2. Connect the database, with debugging — 04:47:51

`src/db/index.js` is an async function because connecting is I/O and always has
to be awaited. It returns the connection instance so `index.js` can log the host.

### Debugging features built in

- **Missing URI check** — throws a clear "copy .env.example to .env" instead of a
  cryptic Mongoose error.
- **Password masking** — `maskUri()` replaces the password with `****` before
  logging, so a failed Atlas connection never prints your credentials.
- **`serverSelectionTimeoutMS: 10000`** — fails in 10s instead of hanging for 30s.
- **Error hints** — `ECONNREFUSED`, `ENOTFOUND`, `ETIMEOUT` and `bad auth` each
  print the actual fix.
- **Lifecycle events** — `error`, `disconnected`, `reconnected` are logged so you
  can watch what happens when the DB drops mid-request.
- **Query logging** — set `MONGOOSE_DEBUG=true` in `.env` to print every query
  Mongoose runs. Turn it off when you're done; it is very noisy.

### The database only starts after the connection succeeds

```js
connectDB()
  .then(() => app.listen(PORT))
  .catch(() => process.exit(1));
```

If the DB is unreachable the process exits instead of serving requests that are
guaranteed to fail. `EADDRINUSE` (port already taken) is handled separately
because it is an event on the server object, not a rejected promise.

### Try the failure on purpose

Put a deliberately wrong hostname in `MONGODB_URI`, then `npm run dev`. You get:

```
Connecting to MongoDB: mongodb+srv://user:****@cluster0.xxxxx.mongodb.net/hasnain
MONGODB connection FAILED: querySrv ENOTFOUND ...
HINT: DNS lookup failed. Check the cluster hostname in MONGODB_URI...
MongoDB connection FAILED. Server was not started.
```

Note the `****` where the password would be, and that no HTTP server opened.
That is the chapter's lesson.

### Breakpoint debugging

Three ways, all preconfigured:

1. **VS Code** — press `F5`, pick "Debug backend (nodemon)". Config lives in
   `.vscode/launch.json`.
2. **Terminal** — `npm run debug`, then attach Chrome DevTools via
   `chrome://inspect`.
3. **Stop on line one** — `npm run debug:brk`, useful when the crash happens
   during startup.

Set a breakpoint inside `connectDB` and inspect `connectionString` to see exactly
what Mongoose receives.

---

## 3. Custom API response and error handling — 05:28:43

Three small files in `src/utils/`, each with one job.

### `ApiResponse.js` — one shape for every success

```js
{ statusCode: 200, data: {...}, message: "Success", success: true }
```

`success` is derived from `statusCode < 400`, so it can never contradict the
status code.

### `ApiError.js` — an Error that carries a status code

A plain `Error` has no `statusCode`, so Express answers `500` for everything.
Extending `Error` lets you write:

```js
throw new ApiError(404, "Video not found");
```

`Error.captureStackTrace(this, this.constructor)` keeps the constructor out of
the trace, so the stack points at your controller, not at the utility.

### `asyncHandler.js` — no more try/catch in every controller

Express 4 does **not** catch rejections inside `async` handlers; an unhandled one
leaves the request hanging. This wrapper forwards any rejection to `next(err)`:

```js
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
```

The course also shows a try/catch version that does the same thing:

```js
const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        next(error);
    }
};
```

Only the Promise version is in the source; all code comments were removed at your
request, so this file is now the only place the explanations live.

### The global error handler (bottom of `app.js`)

It must be registered **last** and must declare **four** arguments
`(err, req, res, next)`. With three, Express treats it as ordinary middleware and
your errors go unhandled.

It also translates raw Mongoose errors into clean API responses:

| Error | Becomes |
| --- | --- |
| Mongoose code `11000` (duplicate key) | `409` with the offending field |
| Mongoose `ValidationError` | `400` with per-field messages |
| Mongoose `CastError` (bad ObjectId) | `400 Invalid id: ...` |
| body-parser `entity.too.large` | `413` (not 500) |
| body-parser `entity.parse.failed` | `400 Malformed JSON` |
| JWT `TokenExpiredError` / `JsonWebTokenError` | `401` |

The last three are easy to miss: those errors are not `ApiError` instances, so a
handler that only checks `instanceof ApiError` reports them all as `500`. That was
a real bug caught while testing this project — an oversized payload returned 500
instead of 413 until the handler was changed to fall back to
`err.statusCode || err.status || 500`.

The stack trace is included only when `NODE_ENV=development`.

### See both paths

```bash
curl http://localhost:8000/api/v1/healthcheck        # ApiResponse, success: true
curl http://localhost:8000/api/v1/healthcheck/error  # ApiError 418, success: false
curl http://localhost:8000/api/v1/nope               # 404 from the catch-all
```

Delete the `/error` route before deploying.

---

## 4. User and Video models, hooks and JWT — 06:15:38

### `user.model.js`

`timestamps: true` adds `createdAt` / `updatedAt` for free. `index: true` on
`username` and `fullName` speeds up search. `watchHistory` is an array of
`ObjectId`s with `ref: "Video"`, which is what makes `.populate()` work later.

### The pre-save hook — two details that break real projects

```js
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});
```

1. **`function`, not `() =>`.** Arrow functions have no `this`, and `this` is the
   document being saved.
2. **`isModified("password")` is essential.** Without it, saving a new
   `refreshToken` would re-hash the already-hashed password and permanently lock
   the user out. This is the single most common bug in this chapter.

`10` is the bcrypt salt rounds — the cost factor. Higher is slower and safer.

### The three methods

| Method | Purpose |
| --- | --- |
| `isPasswordCorrect(password)` | `bcrypt.compare` against the stored hash |
| `generateAccessToken()` | short-lived; carries `_id`, `email`, `username`, `fullName` |
| `generateRefreshToken()` | long-lived; carries **only** `_id` |

The refresh token carries fewer claims on purpose — less exposure if it leaks.
Its only job is to mint a new access token. Both secrets and expiries come from
`.env`, never from hardcoded strings.

The refresh token is also stored on the user document, so logout can invalidate
it server-side rather than waiting for it to expire.

### `video.model.js`

`owner` is an `ObjectId` with `ref: "User"` — the other half of `watchHistory`.
`duration` comes from the Cloudinary upload response in a later chapter. The
compound index `{ owner: 1, createdAt: -1 }` serves the exact query a channel page
runs: "all videos by this owner, newest first".

### Test the hooks and JWT

`src/controllers/user.controller.js` has a minimal JSON-only register/login so
you can prove the models work before Multer and Cloudinary arrive:

```bash
# register — password is hashed by the hook
curl -X POST http://localhost:8000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Hasnain Bro","username":"hasnain","email":"hasnain@test.com","password":"test1234"}'

# login — bcrypt.compare + both tokens, set as httpOnly cookies
curl -X POST http://localhost:8000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"hasnain","password":"test1234"}'

# wrong password — should be 401
curl -X POST http://localhost:8000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"hasnain","password":"wrong"}'
```

The register response never contains `password` or `refreshToken` — note the
`.select("-password -refreshToken")`.

**This controller is a smoke test.** The course replaces `registerUser` with a
Multer + Cloudinary version in the next chapter; the `avatar` is a placeholder
URL until then.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | start with auto-reload |
| `npm start` | start without reload |
| `npm run debug` | start with the inspector on port 9229 |
| `npm run debug:brk` | break on the first line |
| `npm run db:up` / `db:down` | start / stop the MongoDB container |
| `npm run db:logs` | tail MongoDB logs |
| `npm run format` | Prettier over `src/` |

## What was actually verified

45 automated checks were run against this code and all passed, then re-run after
the comments were stripped with the same result. The test scripts were deleted,
since they were scaffolding rather than course code.

**Verified without a database (30 checks)** — `ApiResponse` / `ApiError` shape and
inheritance, `asyncHandler` forwarding rejections, User and Video schema
validation, trimming and lowercasing, defaults, refs and the compound index,
bcrypt hashing and comparison, the pre-save hook being registered, and JWT
signing/verification including that the refresh token carries only `_id` and is
rejected by the access secret.

**Verified over real HTTP (14 checks)** — healthcheck 200, the deliberate 418
error, JSON 404 for unknown routes, 400 for missing fields, CORS origin and
credentials headers, and the 16 kb body limit returning 413.

**Verified failure path** — a bad Atlas hostname produces the masked URI, the
`ENOTFOUND` hint, no HTTP server, and exit code 1.

**Not yet verified (needs your Atlas string)** — an actual database connection,
register/login writing to MongoDB, the pre-save hook firing on a real `.save()`,
duplicate-key 409s, and refresh-token rotation. The code for all of these is in
place; run the curl commands in section 4 once `.env` is filled in.

## Notes

- All comments have been removed from `src/`. The commented original is preserved
  in `_backup/src-with-comments-2026-11-08/` if you want to compare while watching
  the videos. This file carries the explanations instead.

- `.env` is gitignored; `.env.example` is the committed template. The JWT secrets
  in your `.env` were randomly generated for local development — generate fresh
  ones for production.
- `npm audit` reports 2 moderate advisories in `minimatch` via `nodemon`. It is a
  dev-only dependency and the "fix" is a breaking downgrade, so it is left alone.
- `_backup/` is gitignored and holds your original files.