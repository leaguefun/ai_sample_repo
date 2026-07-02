# Snip — Tiny URL Shortener

One backend, two clients.  A short URL is created by the **Bun backend**, shared
via the **Angular SPA** in the browser, and managed from the terminal with the
**Node.js CLI** — all three layers coordinated through this superproject.

```
Browser  ──►  Angular SPA  ──►  POST /api/links
                                GET  /api/links
Terminal ──►  snip CLI     ──►  GET  /:code  (302 redirect)
```

---

## API contract

The backend (`backend/server.js`) exposes three routes:

| Method  | Path          | Request body              | Success response                                      | Error response     |
|---------|---------------|---------------------------|-------------------------------------------------------|--------------------|
| POST    | `/api/links`  | `{ "url": "https://…" }`  | **201** `{ code, url, shortUrl, hits, createdAt }`    | **400** `{ error }`|
| GET     | `/api/links`  | —                         | **200** array of link objects (same shape)            | —                  |
| GET     | `/:code`      | —                         | **302** `Location: <original URL>` + increments hits  | **404** `{ error }`|
| OPTIONS | `*`           | —                         | **204** with CORS headers (browser preflight)         | —                  |

All responses include open CORS headers so the SPA can call the backend from any
origin.  `shortUrl` is built from `BASE_URL` (env var) or
`https://$RAILWAY_PUBLIC_DOMAIN` when set, otherwise `http://localhost:PORT`.

---

## Repository layout

Each layer lives on its own **orphan branch** of this repo and is mounted here as a
Git submodule.  The superproject (`main`) holds only this README and `.gitmodules`.

```
snip-demo/                  ← superproject  (main branch)
├── .gitmodules
├── README.md               ← you are here
│
├── backend/                ← submodule → branch: backend
│   ├── server.js           •  single-file Bun server, zero npm deps
│   ├── package.json        •  name: snip-backend  |  start: bun run server.js
│   └── README.md
│
├── frontend/               ← submodule → branch: frontend
│   ├── src/
│   │   └── app/
│   │       ├── app.component.{ts,html,css}
│   │       ├── app.config.ts
│   │       └── links.service.ts
│   ├── angular.json
│   └── package.json        •  name: snip-frontend
│
└── cli/                    ← submodule → branch: cli
    ├── cli.js              •  zero-dep Node.js CLI
    ├── snip / snip.cmd / snip.ps1   (cross-platform wrappers)
    └── package.json        •  bin: { snip: ./cli.js }
```

---

## Cloning

Always use `--recurse-submodules`; a plain clone leaves the three subdirectories
empty:

```sh
git clone --recurse-submodules https://github.com/leaguefun/ai_sample_repo.git
```

Already cloned without it?

```sh
git submodule update --init --recursive
```

---

## Running all three pieces

### 1 · Backend  (requires [Bun](https://bun.sh) ≥ 1.0)

```sh
cd backend
bun start
# Listening on http://localhost:3000
```

Environment variables:

| Variable                | Default                    | Effect                                      |
|-------------------------|----------------------------|---------------------------------------------|
| `PORT`                  | `3000`                     | HTTP port                                   |
| `BASE_URL`              | `http://localhost:<PORT>`  | Origin used in `shortUrl` values            |
| `RAILWAY_PUBLIC_DOMAIN` | —                          | Auto-builds `https://<domain>` as base URL  |
| `PUBLIC_DIR`            | —                          | Serve static files (e.g. the Angular build) |

### 2 · Frontend  (requires Node.js ≥ 18)

```sh
cd frontend
npm install
npx ng serve
# Dev server → http://localhost:4200
```

The app calls the backend at `http://localhost:3000`.  For production, build the SPA
and serve the output via the backend's `PUBLIC_DIR`:

```sh
npx ng build                            # output → dist/snip-frontend/browser/
PUBLIC_DIR=dist/snip-frontend/browser bun start   # run from backend/
```

### 3 · CLI  (requires Node.js ≥ 18)

```sh
cd cli
npm install -g .     # puts 'snip' on PATH
snip add https://example.com/very/long/path
snip ls
snip open <code>
```

Or run directly without a global install:

```sh
# Unix / macOS
./snip <command>

# Windows CMD
snip.cmd <command>

# Windows PowerShell
.\snip.ps1 <command>
```

Point at a different backend with `SNIP_API`:

```sh
SNIP_API=https://your-snip.example.com snip ls
```

---

## Submodule update workflow

When you push new commits to a layer branch, the superproject still points to the
old commit SHA until you update its pointer.

```
# ── 1. Work inside the submodule ──────────────────────────────────────────────
cd backend                        # (or frontend/ or cli/)
# ... edit files ...
git add .
git commit -m "fix: something"
git push                          # pushes to origin/backend

# ── 2. Bump the pointer in the superproject ───────────────────────────────────
cd ..                             # back to snip-demo/
git submodule update --remote backend   # fetch new commits on the tracked branch
git add backend
git commit -m "chore: bump backend to latest"
git push
```

Collaborators sync by running:

```sh
git pull --recurse-submodules
# or
git submodule update --remote
```
