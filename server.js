import { resolve, join, sep } from "node:path";

// ─── Config ────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const BASE_URL = (
  process.env.BASE_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${PORT}`)
).replace(/\/$/, "");
const PUBLIC_DIR = process.env.PUBLIC_DIR
  ? resolve(process.env.PUBLIC_DIR)
  : null;

// ─── Store ──────────────────────────────────────────────────────────────────
const links = new Map(); // code → { code, url, shortUrl, hits, createdAt }

// ─── Helpers ────────────────────────────────────────────────────────────────
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CHARS[b % 62]).join("");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * Try to serve a static file from PUBLIC_DIR.
 * Path traversal is blocked: the resolved path must stay inside PUBLIC_DIR.
 */
async function tryStatic(pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = resolve(join(PUBLIC_DIR, rel));
  // Reject anything that escapes the public directory
  if (!safePath.startsWith(PUBLIC_DIR + sep)) return null;
  const file = Bun.file(safePath);
  return (await file.exists()) ? new Response(file, { headers: CORS_HEADERS }) : null;
}

// ─── Server ──────────────────────────────────────────────────────────────────
const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    const { pathname } = new URL(req.url);
    const method = req.method.toUpperCase();

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Static files win over short codes when PUBLIC_DIR is configured
    if (PUBLIC_DIR) {
      const staticRes = await tryStatic(pathname);
      if (staticRes) return staticRes;
    }

    // POST /api/links — create a short link
    if (method === "POST" && pathname === "/api/links") {
      let body;
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }

      const { url: longUrl } = body ?? {};
      let parsed;
      try {
        parsed = new URL(longUrl);
      } catch {
        return json({ error: "url must be a valid http(s) URL" }, 400);
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return json({ error: "url must be a valid http(s) URL" }, 400);
      }

      // Collision-safe code generation
      let code;
      do { code = generateCode(); } while (links.has(code));

      const link = {
        code,
        url: longUrl,
        shortUrl: `${BASE_URL}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return json(link, 201);
    }

    // GET /api/links — list all links
    if (method === "GET" && pathname === "/api/links") {
      return json([...links.values()]);
    }

    // GET /:code — redirect to original URL
    if (method === "GET" && pathname.length > 1) {
      const code = pathname.slice(1);
      const link = links.get(code);
      if (link) {
        link.hits++;
        return new Response(null, {
          status: 302,
          headers: { ...CORS_HEADERS, Location: link.url },
        });
      }
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`Snip backend listening on :${server.port}`);
console.log(`BASE_URL → ${BASE_URL}`);
if (PUBLIC_DIR) console.log(`Serving static files from ${PUBLIC_DIR}`);
