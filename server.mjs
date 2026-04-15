/**
 * Lokální server: statické soubory + stejné API jako sync.php (GET/POST /sync.php).
 * Spusť: node server.mjs
 * Otevři: http://127.0.0.1:3456/
 *
 * Ve script.js nastav REMOTE_SYNC.url na "sync.php" (relativní — funguje s tímto serverem).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3456;
const DATA_DIR = path.join(__dirname, "data");
const CHECKS_FILE = path.join(DATA_DIR, "checks.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function readChecks() {
  if (!fs.existsSync(CHECKS_FILE)) return {};
  try {
    const raw = fs.readFileSync(CHECKS_FILE, "utf8");
    const data = JSON.parse(raw || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeChecks(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CHECKS_FILE, JSON.stringify(data), "utf8");
}

function handleSync(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "GET") {
    const data = readChecks();
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(data));
    return;
  }

  if (req.method === "POST") {
    let buf = "";
    req.on("data", (c) => {
      buf += c;
      if (buf.length > 1e5) req.destroy();
    });
    req.on("end", () => {
      let input;
      try {
        input = JSON.parse(buf || "{}");
      } catch {
        sendJson(res, 400, { error: "invalid_json" });
        return;
      }
      const id = typeof input.id === "string" ? input.id : "";
      const checked = Boolean(input.checked);
      if (!id || !/^[a-z0-9-]+$/.test(id)) {
        sendJson(res, 400, { error: "invalid_id" });
        return;
      }
      const data = readChecks();
      if (checked) data[id] = true;
      else delete data[id];
      writeChecks(data);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify(data));
    });
    return;
  }

  sendJson(res, 405, { error: "method_not_allowed" });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1`);

  if (url.pathname === "/sync.php" || url.pathname === "/sync") {
    handleSync(req, res, url);
    return;
  }

  let filePath = path.join(__dirname, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ""));
  if (url.pathname === "/" || url.pathname === "") {
    filePath = path.join(__dirname, "index.html");
  }

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Gift list: http://127.0.0.1:${PORT}/`);
});
