const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const path = require("path");
const os = require("os");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ─── CONFIG ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const PROMPT = process.env.PROMPT || "Describe this event in one word";
// ───────────────────────────────────────────────────────────────

// In-memory store: { word: count }
const words = {};

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- API ---

// Submit a word
app.post("/api/submit", (req, res) => {
  let word = (req.body.word || "").trim().toLowerCase();
  // Sanitize: only keep letters, numbers, spaces, hyphens
  word = word.replace(/[^a-z0-9\s\-]/g, "").trim();
  if (!word || word.length > 40) {
    return res.status(400).json({ error: "Invalid word" });
  }
  words[word] = (words[word] || 0) + 1;
  io.emit("words", words);
  res.json({ ok: true });
});

// Get current words
app.get("/api/words", (_req, res) => {
  res.json(words);
});

// Get the prompt
app.get("/api/prompt", (_req, res) => {
  res.json({ prompt: PROMPT });
});

// Reset (admin)
app.post("/api/reset", (_req, res) => {
  Object.keys(words).forEach((k) => delete words[k]);
  io.emit("words", words);
  res.json({ ok: true });
});

// QR code as data URL
app.get("/api/qr", async (req, res) => {
  const host = req.query.url || `http://${req.headers.host}`;
  try {
    const dataUrl = await QRCode.toDataURL(host, {
      width: 512,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
    res.json({ qr: dataUrl, url: host });
  } catch (e) {
    res.status(500).json({ error: "QR generation failed" });
  }
});

// --- Socket.io ---
io.on("connection", (socket) => {
  socket.emit("words", words);
});

// --- Start ---
server.listen(PORT, () => {
  const ifaces = os.networkInterfaces();
  let lanIP = "localhost";
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        lanIP = iface.address;
        break;
      }
    }
  }
  console.log(`\n  Live Word Cloud running!\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${lanIP}:${PORT}`);
  console.log(`  Display: http://localhost:${PORT}/display`);
  console.log(`\n  Prompt: "${PROMPT}"`);
  console.log(`  Change it: PROMPT="Your question here" npm start\n`);
});
