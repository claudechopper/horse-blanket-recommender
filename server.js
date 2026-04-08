// Tiny Express server that wraps the static HTML app with:
//   - HTTP Basic Auth (AUTH_USER / AUTH_PASSWORD env vars)
//   - GET /api/data + PUT /api/data backed by a single JSON file on a Railway Volume
// Single-user assumption: last write wins. No concurrency control beyond atomic file rename.

const express = require("express");
const basicAuth = require("express-basic-auth");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "data.json");
const TMP_FILE = path.join(DATA_DIR, "data.json.tmp");

// Ensure the data directory exists (useful for local dev; Railway Volume creates it at mount time).
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create data dir:", DATA_DIR, e.message);
}

const AUTH_USER = process.env.AUTH_USER;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

if (!AUTH_USER || !AUTH_PASSWORD) {
  console.warn("⚠  AUTH_USER and/or AUTH_PASSWORD not set — the app is UNPROTECTED.");
}

// Auth gate — applies to every request (static files AND the API).
if (AUTH_USER && AUTH_PASSWORD) {
  app.use(
    basicAuth({
      users: { [AUTH_USER]: AUTH_PASSWORD },
      challenge: true,
      realm: "Horse Blanket Recommender",
    })
  );
}

app.use(express.json({ limit: "2mb" }));

// GET /api/data — returns the saved JSON, or {} if the file doesn't exist yet.
app.get("/api/data", (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({});
    }
    const content = fs.readFileSync(DATA_FILE, "utf8");
    res.type("application/json").send(content);
  } catch (e) {
    console.error("GET /api/data error:", e);
    res.status(500).json({ error: "read_failed", message: e.message });
  }
});

// PUT /api/data — atomic write: write to temp file then rename.
// Rename within the same filesystem is atomic on POSIX.
app.put("/api/data", (req, res) => {
  try {
    const body = JSON.stringify(req.body ?? {});
    fs.writeFileSync(TMP_FILE, body, "utf8");
    fs.renameSync(TMP_FILE, DATA_FILE);
    res.json({ ok: true, bytes: body.length });
  } catch (e) {
    console.error("PUT /api/data error:", e);
    res.status(500).json({ error: "write_failed", message: e.message });
  }
});

// Health check (also auth-gated, which is fine — Railway pings the root).
app.get("/healthz", (req, res) => res.type("text/plain").send("ok"));

// Static files (index.html etc.) live next to this file.
app.use(express.static(__dirname, { extensions: ["html"] }));

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
  console.log(`Auth: ${AUTH_USER ? "enabled (" + AUTH_USER + ")" : "DISABLED"}`);
});
