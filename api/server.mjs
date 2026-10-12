// softwareequality.com back end: replaces the old Netlify Functions.
//
//   POST /api/chat                              AI assistant (agentic-assistant.js)
//   GET  /.netlify/functions/stripe-checkout    bootcamp checkout (bootcamp.html)
//   GET  /api/checkout                          same, without the legacy path
//   GET  /api/health                            status, never shows secrets
//
// Zero dependencies (Node 22). Runs on the Oracle server next to Caddy; keys
// come from the server's .env (OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL,
// STRIPE_SECRET_KEY), optionally overridden with SE_* versions of each.
//
// The assistant answers from the website's own pages: every HTML file in
// ../site is indexed, the most relevant passages are given to the model, and
// if the model is unavailable the visitor still gets those passages as links.

import http from "node:http";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = process.env.SE_SITE_DIR || path.join(HERE, "..", "site");
const PORT = Number(process.env.PORT || 8787);
const PUBLIC_URL = (process.env.SE_PUBLIC_URL || "https://softwareequality.com").replace(/\/$/, "");

const env = (name, fallback = "") => (process.env[`SE_${name}`] || process.env[name] || fallback).trim();
const AI_KEY = env("OPENAI_API_KEY");
const AI_BASE = env("OPENAI_BASE_URL", "https://api.openai.com/v1").replace(/\/$/, "");
const AI_MODEL = env("OPENAI_MODEL", "gpt-4o-mini");
const STRIPE_KEY = env("STRIPE_SECRET_KEY");

// ---------------------------------------------------------------------------
// Site knowledge: index the published pages
// ---------------------------------------------------------------------------

const AGENTS = ["knowledge", "pricing", "scheduler", "research"];
let chunks = [];
let indexedAt = null;

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div|tr|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&pound;/g, "£")
    .replace(/&mdash;|&ndash;/g, ", ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const WORD = /[a-z0-9£]+/g;
const STOP = new Set("the a an and or of to in for on with is are be by at as it this that your you our we from can how what do does i me my".split(" "));
const tokens = (s) => (s.toLowerCase().match(WORD) || []).filter((w) => w.length > 1 && !STOP.has(w));

async function buildIndex() {
  const files = (await readdir(SITE_DIR)).filter((f) => f.endsWith(".html") && f !== "404.html");
  const next = [];
  for (const file of files) {
    const html = await readFile(path.join(SITE_DIR, file), "utf8");
    const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || file).replace(/\s*\|.*$/, "").trim();
    const desc = htmlToText(html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] || "");
    const text = htmlToText(html);
    const url = file === "index.html" ? "/" : `/${file.replace(/\.html$/, "")}`;
    // ~700-character passages on line boundaries.
    let buf = "";
    for (const line of text.split("\n")) {
      if ((buf + line).length > 700 && buf) {
        next.push({ url, title, desc, text: buf.trim(), words: new Set(tokens(buf + " " + title)) });
        buf = "";
      }
      buf += line + "\n";
    }
    if (buf.trim()) next.push({ url, title, desc, text: buf.trim(), words: new Set(tokens(buf + " " + title)) });
  }
  chunks = next;
  indexedAt = new Date().toISOString();
  console.log(`[se-api] indexed ${files.length} pages, ${chunks.length} passages`);
}

function retrieve(query, pageHint = "", k = 6) {
  const q = tokens(query);
  if (q.length === 0) return [];
  const hint = (pageHint.match(/\/([a-z0-9-]+)/i)?.[1] || "").toLowerCase();
  return chunks
    .map((c) => {
      let score = 0;
      for (const w of q) if (c.words.has(w)) score += w.length > 5 ? 2 : 1;
      if (hint && c.url.includes(hint)) score += 1;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}

function guessAgent(text) {
  const t = text.toLowerCase();
  if (/\b(book|call|meeting|availability|schedule|appointment|discovery)\b/.test(t)) return "scheduler";
  if (/(£|\b(price|pricing|cost|fee|rate|budget|discount|plan|roi|how much)\b)/.test(t)) return "pricing";
  if (/\b(study|research|data|statistic|citation|standard|iso|regulation|act|report|evidence)\b/.test(t)) return "research";
  return "knowledge";
}

// ---------------------------------------------------------------------------
// AI assistant
// ---------------------------------------------------------------------------

let lastAiError = null;
let lastAiSuccessAt = null;

const SYSTEM = `You are the website assistant for Equality Software Ltd (Software Equality), a London AI consultancy: agentic AI engineering, the ADLC and SPARC methods, AI governance (ISO 42001, EU AI Act), AI project rescue, SDLC modernisation and AI bootcamps.
You work as one of four agents and pick the best one for each reply:
- knowledge: services, methods, company
- pricing: fees, plans, ROI (only quote prices that appear in the provided site extracts)
- scheduler: booking discovery calls (send people to <a href="/book">book a discovery call</a> or <a href="/contact">contact the team</a>)
- research: data, standards, regulations, citations from the site
Rules: answer only from the site extracts and general knowledge about AI practice; never invent prices, clients, dates or guarantees; if unsure, say so and offer the contact page. Be concise (under 140 words). Use British English and plain punctuation (no em dashes).
Reply with JSON only: {"agent": "knowledge|pricing|scheduler|research", "reply": "<p>...</p>"} where reply is simple HTML using only p, ul, ol, li, strong, em, a (relative links to site pages).`;

function scrub(s) {
  return String(s).replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***").replace(/Bearer\s+\S+/gi, "Bearer ***").slice(0, 300);
}

async function askModel(messages, context, page) {
  if (!AI_KEY) throw Object.assign(new Error("AI key not configured"), { kind: "not_configured" });
  const ctx = context.map((c, i) => `[${i + 1}] ${c.title} (${c.url})\n${c.text}`).join("\n\n");
  const headers = { "content-type": "application/json", authorization: `Bearer ${AI_KEY}` };
  if (AI_BASE.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = PUBLIC_URL;
    headers["X-Title"] = "Software Equality website";
  }
  const res = await fetch(`${AI_BASE}/chat/completions`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "system", content: `Visitor is on: ${page || "unknown page"}\n\nSite extracts:\n${ctx || "(none matched)"}` },
        ...messages,
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw Object.assign(new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`), { status: res.status });
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { reply: `<p>${raw.replace(/</g, "&lt;")}</p>` };
  }
  if (!parsed.reply) throw new Error("empty model reply");
  return {
    agent: AGENTS.includes(parsed.agent) ? parsed.agent : null,
    reply: String(parsed.reply).replace(/—/g, ", ").slice(0, 6000),
  };
}

function fallbackReply(question, context) {
  const agent = guessAgent(question);
  if (agent === "scheduler") {
    return {
      agent,
      reply:
        '<p>You can <a href="/book">book a free discovery call</a> at a time that suits you, or <a href="/contact">send us a message</a> and the team will get back to you.</p>',
    };
  }
  const seen = new Set();
  const items = [];
  for (const c of context) {
    if (seen.has(c.url) || items.length >= 3) continue;
    seen.add(c.url);
    const source = c.desc || c.text.replace(/\s+/g, " ");
    const snippet = source.slice(0, 220).replace(/</g, "&lt;");
    items.push(`<li><a href="${c.url}">${c.title.replace(/</g, "&lt;")}</a>: ${snippet}${source.length > 220 ? "…" : ""}</li>`);
  }
  const reply = items.length
    ? `<p>Here is what our site says about that:</p><ul>${items.join("")}</ul><p>For a tailored answer, <a href="/book">book a discovery call</a>.</p>`
    : '<p>I could not find that on our site. Please <a href="/contact">contact the team</a> or <a href="/book">book a discovery call</a> and we will help.</p>';
  return { agent, reply };
}

async function handleChat(body) {
  const messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return { status: 400, json: { error: "Please type a question." } };

  const page = typeof body?.page === "string" ? body.page.slice(0, 200) : "";
  const recent = messages.filter((m) => m.role === "user").slice(-2).map((m) => m.content).join(" ");
  const context = retrieve(recent, page);

  try {
    const out = await askModel(messages, context, page);
    lastAiSuccessAt = new Date().toISOString();
    return { status: 200, json: { reply: out.reply, agent: out.agent || guessAgent(lastUser.content), aiPowered: true } };
  } catch (error) {
    if (error.kind !== "not_configured") {
      const cause = error.cause ? ` | ${error.cause.code || ""} ${error.cause.message || ""}` : "";
      lastAiError = { at: new Date().toISOString(), status: error.status ?? null, message: scrub(error.message + cause) };
      console.error("[se-api] AI error:", lastAiError.message);
    }
    const out = fallbackReply(lastUser.content, context);
    return { status: 200, json: { ...out, aiPowered: false } };
  }
}

// ---------------------------------------------------------------------------
// Bootcamp checkout (Stripe Checkout, no SDK)
// ---------------------------------------------------------------------------

const COURSES = {
  foundations: { name: "AI Foundations Bootcamp (per person)", amount: 79900 },
  professional: { name: "AI Professional Bootcamp (per person)", amount: 149900 },
};

async function handleCheckout(course) {
  const item = COURSES[course];
  if (!item) return { status: 400, json: { error: "Unknown course." } };
  if (!STRIPE_KEY) return { status: 503, json: { error: "Checkout unavailable." } };
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "gbp",
    "line_items[0][price_data][unit_amount]": String(item.amount),
    "line_items[0][price_data][product_data][name]": item.name,
    billing_address_collection: "required",
    allow_promotion_codes: "true",
    "metadata[course]": course,
    success_url: `${PUBLIC_URL}/bootcamp?enrolled=${course}`,
    cancel_url: `${PUBLIC_URL}/bootcamp`,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${STRIPE_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    console.error("[se-api] Stripe error:", res.status, scrub(data?.error?.message || ""));
    return { status: 502, json: { error: "Checkout unavailable." } };
  }
  return { status: 200, json: { url: data.url } };
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

const hits = new Map(); // ip -> [timestamps]
function rateLimited(ip, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > limit;
}

function send(res, status, json) {
  const body = JSON.stringify(json);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req, max = 32_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > max) {
        reject(Object.assign(new Error("too large"), { status: 413 }));
        req.destroy();
      } else parts.push(c);
    });
    req.on("end", () => {
      try {
        resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString("utf8")) : {});
      } catch {
        reject(Object.assign(new Error("bad json"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://local");
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
  try {
    if (url.pathname === "/api/health") {
      return send(res, 200, {
        ok: true,
        pages: new Set(chunks.map((c) => c.url)).size,
        passages: chunks.length,
        indexedAt,
        ai: { configured: Boolean(AI_KEY), model: AI_MODEL, provider: new URL(AI_BASE).host, lastError: lastAiError, lastSuccessAt: lastAiSuccessAt },
        checkout: { configured: Boolean(STRIPE_KEY), courses: Object.keys(COURSES) },
      });
    }
    if (url.pathname === "/api/chat" && req.method === "POST") {
      if (rateLimited(ip)) return send(res, 429, { error: "You are sending messages very quickly. Please wait a moment." });
      const out = await handleChat(await readJson(req));
      return send(res, out.status, out.json);
    }
    if (url.pathname === "/api/checkout" || url.pathname === "/.netlify/functions/stripe-checkout") {
      if (rateLimited(`co:${ip}`, 10)) return send(res, 429, { error: "Too many attempts. Please wait a moment." });
      const out = await handleCheckout(url.searchParams.get("course") || "");
      return send(res, out.status, out.json);
    }
    return send(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("[se-api]", error.message);
    return send(res, error.status || 500, { error: "Something went wrong. Please try again." });
  }
});

await buildIndex().catch((e) => console.error("[se-api] index failed:", e.message));
setInterval(() => buildIndex().catch((e) => console.error("[se-api] reindex failed:", e.message)), 10 * 60_000).unref();
server.listen(PORT, () => console.log(`[se-api] listening on :${PORT}`));
