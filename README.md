# Snip — Tiny URL Shortener Backend

A single-file Bun server with zero npm dependencies that shortens URLs and
stores them in memory.

## Requirements

- [Bun](https://bun.sh) ≥ 1.0

## Quick start

```sh
bun start
# or directly
bun run server.js
```

## Environment variables

| Variable                | Default                      | Description                                                                 |
|-------------------------|------------------------------|-----------------------------------------------------------------------------|
| `PORT`                  | `3000`                       | HTTP port to listen on                                                      |
| `BASE_URL`              | `http://localhost:<PORT>`    | Origin prepended to every `shortUrl`                                        |
| `RAILWAY_PUBLIC_DOMAIN` | —                            | When set (and `BASE_URL` isn't), builds `https://<domain>` automatically   |
| `PUBLIC_DIR`            | —                            | When set, serves static files from this directory (`/` → `index.html`)     |

Static files served from `PUBLIC_DIR` take priority over short-code redirects.

## API

### `POST /api/links`

Create a new short link.

**Request body**
```json
{ "url": "https://example.com/very/long/path" }
```

**Response `201`**
```json
{
  "code":     "aB3xYz",
  "url":      "https://example.com/very/long/path",
  "shortUrl": "http://localhost:3000/aB3xYz",
  "hits":     0,
  "createdAt":"2025-01-01T00:00:00.000Z"
}
```

Returns `400` on invalid JSON or a non-http(s) URL.

---

### `GET /api/links`

Returns a JSON array of all stored links (same shape as above).

---

### `GET /:code`

Redirects (`302`) to the original URL and increments the hit counter.  
Returns `404` JSON if the code is unknown.

---

### `OPTIONS *`

Returns `204` with full CORS headers for browser preflight requests.

## Notes

- Codes are 6 random base-62 characters (`A-Z a-z 0-9`).
- All data is in-memory — it resets when the process restarts.
