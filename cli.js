#!/usr/bin/env node
"use strict";

const { execFileSync } = require("child_process");
const http  = require("http");
const https = require("https");
const os    = require("os");

const BASE = (process.env.SNIP_API || "http://localhost:3000").replace(/\/$/, "");

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Write msg to stderr and exit 1. */
function die(msg) {
  process.stderr.write("snip: " + msg + "\n");
  process.exit(1);
}

function usage() {
  console.log(
    "Usage:\n" +
    "  snip add <url>     Shorten a URL and print the short link\n" +
    "  snip ls            List all short links\n" +
    "  snip open <code>   Open the URL behind a short code in your browser\n" +
    "  snip help          Show this help\n" +
    "\nBackend: " + BASE + "  (override with SNIP_API env var)"
  );
}

/**
 * Low-level GET that returns status + Location WITHOUT following redirects.
 *
 * The Fetch API redirect:"manual" mode returns an opaque response in Node.js
 * (status 0, headers inaccessible per the WinterTC spec), so we use the
 * built-in http/https modules to achieve the same "ask, don't follow" goal.
 */
function getManual(rawUrl) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch (e) { return reject(e); }
    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path:     (parsed.pathname || "/") + parsed.search,
        method:   "GET",
        headers:  { "User-Agent": "snip-cli/1.0" },
      },
      (res) => {
        resolve({
          status:   res.statusCode,
          location: res.headers["location"] || null,
        });
        res.destroy(); // discard body
      }
    );
    req.on("error", reject);
    req.end();
  });
}

// ─── Commands ───────────────────────────────────────────────────────────────

async function cmdAdd(url) {
  if (!url) die("add requires a <url> argument");

  let parsed;
  try   { parsed = new URL(url); }
  catch { die('"' + url + '" is not a valid URL'); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    die('"' + url + '" must be an http(s) URL');
  }

  let res;
  try {
    res = await fetch(BASE + "/api/links", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ url }),
    });
  } catch (err) {
    die("Cannot reach backend at " + BASE + " \u2014 " + err.message);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) die(body.error || "HTTP " + res.status);
  console.log(body.shortUrl);
}

async function cmdLs() {
  let res;
  try   { res = await fetch(BASE + "/api/links"); }
  catch (err) { die("Cannot reach backend at " + BASE + " \u2014 " + err.message); }

  if (!res.ok) die("HTTP " + res.status);

  let links;
  try   { links = await res.json(); }
  catch { die("Invalid response from backend"); }

  if (links.length === 0) {
    console.log("No links yet.");
    return;
  }

  const W = {
    code: Math.max(4, ...links.map((l) => l.code.length)),
    hits: Math.max(4, ...links.map((l) => String(l.hits).length)),
  };
  const row = (c, h, u) =>
    String(c).padEnd(W.code) + "  " + String(h).padEnd(W.hits) + "  " + u;

  console.log(row("CODE", "HITS", "URL"));
  console.log("-".repeat(W.code) + "  " + "-".repeat(W.hits) + "  ---");
  for (const l of links) console.log(row(l.code, l.hits, l.url));
}

async function cmdOpen(code) {
  if (!code) die("open requires a <code> argument");

  let result;
  try   { result = await getManual(BASE + "/" + encodeURIComponent(code)); }
  catch (err) { die("Cannot reach backend at " + BASE + " \u2014 " + err.message); }

  if (result.status === 404) die('Unknown short code "' + code + '"');

  const location = result.location;
  if (!location) {
    die('No redirect returned for "' + code + '" (status ' + result.status + ")");
  }

  // Validate redirect target before handing to the OS (block non-http(s) schemes)
  let target;
  try   { target = new URL(location); }
  catch { die("Invalid redirect location: " + location); }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    die("Redirect target is not an http(s) URL: " + location);
  }

  try {
    const p = os.platform();
    if (p === "win32") {
      // Pass location as a separate argv element; Node.js will quote it for cmd.
      execFileSync("cmd", ["/c", "start", "", location], { stdio: "ignore" });
    } else if (p === "darwin") {
      execFileSync("open", [location], { stdio: "ignore" });
    } else {
      execFileSync("xdg-open", [location], { stdio: "ignore" });
    }
  } catch (err) {
    die("Could not open browser: " + err.message);
  }

  console.log("Opening " + location);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const [, , cmd, arg] = process.argv;

(async () => {
  switch (cmd) {
    case "add":    return cmdAdd(arg);
    case "ls":     return cmdLs();
    case "open":   return cmdOpen(arg);
    case "help":
    case undefined: return usage();
    default:
      process.stderr.write('snip: unknown command "' + cmd + '"\n\n');
      usage();
      process.exit(1);
  }
})().catch((err) => die(err.message || String(err)));
