import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import dotenv from "dotenv";

/* -------------------- paths / dotenv -------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// AI_ROOT = the folder that contains index.html (one level up from /server)
const AI_ROOT      = path.resolve(__dirname, ".."); // .../ai-index
const PROJECT_ROOT = path.resolve(AI_ROOT, "..");   // project root

// Load .env from server/ first, then fallback to project root .env if missing
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") }); // fallback

/* -------------------- env & constants -------------------- */
const API_URL        = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY        = process.env.OPENROUTER_API_KEY || "";     // from .env
const CLASS_SECRET   = process.env.CLASSROOM_SECRET || "";       // optional gate
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5000";
// const MODEL_ID       = process.env.MODEL_ID || "openai/gpt-3.5-turbo"; 
// const MODEL_ID       = process.env.MODEL_ID || "meta-llama/llama-3.1-8b-instruct:free";


// demo mode: on if DEMO_MODE=1 or when no API key is provided
const DEMO_MODE =
  process.env.DEMO_MODE === "1" || !API_KEY;

// cleanup config (all optional)
const CLEAN_ON_BOOT          = (process.env.CLEAN_ON_BOOT || "0") === "1";
const MAX_DOWNLOAD_AGE_HOURS = Number(process.env.MAX_DOWNLOAD_AGE_HOURS || 24);
const MAX_LOG_AGE_DAYS       = Number(process.env.MAX_LOG_AGE_DAYS || 7);

// in real mode (not demo), require an API key
if (!API_KEY && !DEMO_MODE) {
  console.error(" Missing OPENROUTER_API_KEY in .env (server/.env or project/.env)");
  process.exit(1);
}

/* -------------------- express setup -------------------- */
const app = express();

// Strict CORS: only your configured origin; allow no-Origin tools like curl/Postman
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);                     // allow server-to-server / curl
      if (DEMO_MODE && ALLOWED_ORIGIN === "*") return cb(null, true); // demo convenience
      return origin === ALLOWED_ORIGIN ? cb(null, true) : cb(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json());

// Serve the frontend & generated files (from AI_ROOT)
const DOWNLOADS_DIR = path.join(AI_ROOT, "downloads");
const FONTS_DIR     = path.join(AI_ROOT, "fonts");
const FONT_REGULAR  = path.join(FONTS_DIR, "NotoSans-Regular.ttf");
const FALLBACK_PDF  = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

/* ✅ Serve manifest with correct MIME BEFORE static middleware */
app.get("/manifest.webmanifest", (req, res) => {
  res.sendFile(path.join(AI_ROOT, "manifest.webmanifest"), {
    headers: { "Content-Type": "application/manifest+json" }
  });
});

fs.mkdirSync(DOWNLOADS_DIR, { recursive: true }); // ensure exists for static
app.use(express.static(AI_ROOT));
app.use("/downloads", express.static(DOWNLOADS_DIR));

/* -------------------- text helpers -------------------- */
function normalizePunctuation(s = "") {
  return s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u00A0/g, " ");
}
function stripEmoji(s = "") {
  return s.replace(/\p{Extended_Pictographic}/gu, "");
}
function markdownToPdfFriendly(md = "") {
  let s = md;
  s = s.replace(/\*\*(.*?)\*\*/g, "$1");
  s = s.replace(/__(.*?)__/g, "$1");
  s = s.replace(/(^|[^*])\*(?!\*)([^*\n]+)\*(?!\*)/g, "$1$2");
  s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1$2");
  s = s.replace(/^\s*([-*_]){3,}\s*$/gm, "");
  return s;
}
function markdownToPlain(md = "") {
  let s = md;
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""));
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1 ($2)");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  s = s.replace(/(\*\*|__)(.*?)\1/g, "$2");
  s = s.replace(/(\*|_)(.*?)\1/g, "$2");
  s = s.replace(/^\s*([-*_]){3,}\s*$/gm, "");
  s = s.replace(/^\s*[-*+]\s+/gm, "• ");
  s = s.replace(/^\s*(\d+)[\.)]\s+/gm, "$1. ");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.trim();
  return s;
}
function stripAutoPdfOffers(s = "") {
  return s
    .replace(/^\s*(?:💡|📎)?\s*would you like me to prepare a pdf of this\?\s*$/gim, "")
    .replace(/^\s*(?:💡|📎)?\s*i can prepare a pdf.*$/gim, "")
    .trim();
}

/* -------------------- DEMO reply helper -------------------- */
function demoReply(prompt = "") {
  const p = String(prompt || "").trim();
  const preview = p.length ? `"${p.slice(0, 200)}"` : "your message";
  return [
    "🧪 Demo mode (no API key).",
    `I received ${preview}.`,
    "In production this route calls OpenRouter and streams an LLM’s answer.",
  ].join(" ");
}

/* -------------------- logs (kept under server/logs) -------------------- */
const logsDir = path.join(__dirname, "logs");
fs.mkdirSync(logsDir, { recursive: true });
function appendLog(sessionId, record) {
  try {
    const f = path.join(logsDir, `${sessionId || "anonymous"}.jsonl`);
    const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + os.EOL;
    fs.appendFileSync(f, line, "utf8");
  } catch (e) {
    console.error("log write failed:", e);
  }
}

/* -------------------- cleanup helpers & boot policy -------------------- */
async function emptyDir(dir) {
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    await Promise.all(entries.map(async (ent) => {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) await fs.promises.rm(p, { recursive: true, force: true });
      else await fs.promises.unlink(p).catch(() => {});
    }));
  } catch (e) {
    console.error("emptyDir failed:", dir, e);
  }
}

async function pruneDirByAge(dir, maxAgeMs) {
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    const now = Date.now();
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    await Promise.all(entries.map(async (ent) => {
      if (!ent.isFile()) return;
      const p = path.join(dir, ent.name);
      try {
        const st = await fs.promises.stat(p);
        if (now - st.mtimeMs > maxAgeMs) await fs.promises.unlink(p);
      } catch {}
    }));
  } catch (e) {
    console.error("pruneDirByAge failed:", dir, e);
  }
}

// run cleanup on boot
(async () => {
  if (CLEAN_ON_BOOT) {
    console.log("🧹 CLEAN_ON_BOOT=1 → wiping downloads & logs…");
    await Promise.all([ emptyDir(DOWNLOADS_DIR), emptyDir(logsDir) ]);
  }
  const msH = 60 * 60 * 1000;
  const msD = 24 * msH;
  await Promise.all([
    pruneDirByAge(DOWNLOADS_DIR, MAX_DOWNLOAD_AGE_HOURS * msH),
    pruneDirByAge(logsDir,       MAX_LOG_AGE_DAYS       * msD),
  ]);
})();

/* -------------------- file helpers -------------------- */
function ensureDirs() {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

async function generatePdfFromText(markdown, baseName = "ai-output") {
  try {
    ensureDirs();
    const filename = `${baseName}-${Date.now()}.pdf`;
    const filePath = path.join(DOWNLOADS_DIR, filename);
    const publicUrl = `/downloads/${filename}`;

    const hasUnicodeFont = fs.existsSync(FONT_REGULAR);
    const cleaned = hasUnicodeFont
      ? stripEmoji(markdown || "")
      : normalizePunctuation(stripEmoji(markdown || ""));
    const content = markdownToPdfFriendly(cleaned);

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    if (hasUnicodeFont) {
      try { doc.registerFont("regular", FONT_REGULAR); doc.font("regular"); }
      catch { doc.font("Helvetica"); }
    } else {
      doc.font("Helvetica");
    }

    const linkMd  = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const linkRaw = /(https?:\/\/[^\s)]+)(?![^[]*\))/g;

    function tokensForLine(line) {
      let parts = [], last = 0;
      for (const m of line.matchAll(linkMd)) {
        const [full, label, url] = m; const i = m.index;
        if (i > last) parts.push({ type: "text", text: line.slice(last, i) });
        parts.push({ type: "link", text: label, url });
        last = i + full.length;
      }
      if (last < line.length) parts.push({ type: "text", text: line.slice(last) });

      let final = [];
      const base = parts.length ? parts : [{ type: "text", text: line }];
      for (const p of base) {
        if (p.type !== "text") { final.push(p); continue; }
        let li = 0;
        for (const m of p.text.matchAll(linkRaw)) {
          const i = m.index, url = m[1];
          if (i > li) final.push({ type: "text", text: p.text.slice(li, i) });
          final.push({ type: "link", text: url, url });
          li = i + url.length;
        }
        if (li < p.text.length) final.push({ type: "text", text: p.text.slice(li) });
      }
      return final;
    }

    doc.fillColor("#000000");
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    for (const raw of lines) {
      const line = raw.trimEnd();
      const h = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
      if (h) {
        const level = h[1].length, text = h[2];
        doc.moveDown(0.2);
        doc.fontSize(level <= 2 ? 18 : (level === 3 ? 16 : 14));
        const toks = tokensForLine(text);
        toks.forEach((t, i) => {
          const cont = i < toks.length - 1;
          if (t.type === "link") { doc.fillColor("#0645AD").text(t.text, { link: t.url, underline: true, continued: cont }); doc.fillColor("#000"); }
          else { doc.text(t.text, { continued: cont }); }
        });
        doc.text("");
        continue;
      }

      doc.fontSize(12).fillColor("#000000");
      const toks = tokensForLine(line);
      if (toks.length === 0) { doc.text(" "); continue; }
      toks.forEach((t, i) => {
        const cont = i < toks.length - 1;
        if (t.type === "link") { doc.fillColor("#0645AD").text(t.text, { link: t.url, underline: true, continued: cont }); doc.fillColor("#000"); }
        else { doc.text(t.text, { continued: cont }); }
      });
      doc.text("");
    }

    doc.end();
    await new Promise((res, rej) => { stream.on("finish", res); stream.on("error", rej); });
    return publicUrl;
  } catch (err) {
    console.error("PDF generation failed:", err);
    return null;
  }
}

function generateTxtFromText(text, baseName = "ai-output") {
  try {
    ensureDirs();
    const filename = `${baseName}-${Date.now()}.txt`;
    fs.writeFileSync(path.join(DOWNLOADS_DIR, filename), text || "", "utf8");
    return `/downloads/${filename}`;
  } catch (err) {
    console.error("TXT generation failed:", err);
    return null;
  }
}

/* -------------------- optional: simple classroom gate -------------------- */
function classroomGate(req, res, next) {
  if (!CLASS_SECRET) return next(); // gate disabled if not set
  const k = req.get("x-classroom-key");
  if (k !== CLASS_SECRET) return res.status(401).json({ error: "Unauthorized" });
  next();
}

/* ---------------------------- admin: manual cleanup ---------------------------- */
app.post("/admin/cleanup", classroomGate, async (_req, res) => {
  try {
    await Promise.all([ emptyDir(DOWNLOADS_DIR), emptyDir(logsDir) ]);
    res.json({ ok: true, cleared: ["downloads", "logs"] });
  } catch (e) {
    console.error("cleanup endpoint failed:", e);
    res.status(500).json({ ok: false, error: "cleanup failed" });
  }
});

/* ----------------------------- API: chat ------------------------------ */
app.post("/api/chat", classroomGate, async (req, res) => {
  const { prompt, sessionId } = req.body || {};
  if (!prompt?.trim()) return res.status(400).json({ error: "Prompt is required" });

  try {
    appendLog(sessionId, { role: "user", content: prompt });

    // DEMO short-circuit
    if (DEMO_MODE) {
      let content = demoReply(prompt);

      // honor explicit file requests in demo too
      const wantsPdf = /\b(pdf|save as pdf|download pdf)\b/i.test(prompt);
      const wantsTxt = /\b(txt|text file|download txt)\b/i.test(prompt);

      if (wantsPdf) {
        const pdfUrl = await generatePdfFromText(content, "ai-output");
        if (pdfUrl) content += `\n\n✅ Here is your PDF: [Download it](${pdfUrl}).`;
        else content += `\n\n(⚠️ PDF generation failed. Fallback:) [Sample PDF](${FALLBACK_PDF}).`;
      }
      if (wantsTxt) {
        const txtUrl = generateTxtFromText(markdownToPlain(content), "ai-output");
        if (txtUrl) content += `\n\n📝 Here is your TXT: [Download it](${txtUrl}).`;
        else content += `\n\n(⚠️ TXT generation failed.)`;
      }

      appendLog(sessionId, { role: "assistant", content });
      return res.json({ choices: [{ message: { content } }] });
    }

    // REAL call (OpenRouter)
    const r = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        //  model: MODEL_ID,
         model: "deepseek/deepseek-r1:free",
        messages: [
          {
            role: "system",
            content:
              "Answer in clean Markdown. Use headings and bullet points. " +
              "Do NOT include chain-of-thought. " +
              "Do NOT offer or mention PDFs/TXTs unless the user explicitly asks.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    // propagate provider error details
    let data;
    try { data = await r.json(); } catch { data = null; }
    if (!r.ok) {
      const msg = data?.error?.message || JSON.stringify(data || {});
      appendLog(sessionId, { role: "assistant", content: `API error ${r.status}: ${msg}` });
      return res.status(r.status).json({ error: { code: r.status, message: msg } });
    }

    // raw markdown from model
    let content = data?.choices?.[0]?.message?.content ?? "";
    content = stripAutoPdfOffers(content);

    // Generate only if the USER asked for it
    const wantsPdf = /\b(pdf|save as pdf|download pdf)\b/i.test(prompt);
    const wantsTxt = /\b(txt|text file|download txt)\b/i.test(prompt);

    if (wantsPdf) {
      const pdfUrl = await generatePdfFromText(content, "ai-output");
      if (pdfUrl) content += `\n\n✅ Here is your PDF: [Download it](${pdfUrl}).`;
      else content += `\n\n(⚠️ PDF generation failed. Fallback:) [Sample PDF](${FALLBACK_PDF}).`;
    }

    if (wantsTxt) {
      const txtUrl = generateTxtFromText(markdownToPlain(content), "ai-output");
      if (txtUrl) content += `\n\n📝 Here is your TXT: [Download it](${txtUrl}).`;
      else content += `\n\n(⚠️ TXT generation failed.)`;
    }

    appendLog(sessionId, { role: "assistant", content });
    data.choices[0].message.content = content;
    return res.json(data);
  } catch (err) {
    console.error("/api/chat failed:", err);
    appendLog(sessionId, { role: "assistant", content: `Server error: ${String(err)}` });
    return res.status(500).json({ error: "Something went wrong" });
  }
});

/* --------------------------- Frontend entry --------------------------- */
app.get("/", (_req, res) => {
  res.sendFile(path.join(AI_ROOT, "index.html"));
});

/* ------------------------------ start ------------------------------ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(
    `Server running at http://localhost:${PORT} ${DEMO_MODE ? "(demo mode)" : ""}`
  )
);
