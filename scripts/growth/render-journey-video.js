// scripts/growth/render-journey-video.js (ADR-244, Growth Engine Gate C)
// ─────────────────────────────────────────────────────────────────────────────
// ZERO-SPEND CREATIVE PIPELINE — renders a TikTok-native (1080×1920, 30fps)
// vertical video of a REAL Tawveeri journey on PRODUCTION:
//
//   Pass 1  Puppeteer, mobile viewport, tawveeri.com: types the (pre-verified)
//           query character-by-character, waits for real results, opens them —
//           every frame is the genuine UI with genuine prices. No mockups, no
//           fabricated screens (Video Quality Contract: real capture only).
//   Pass 2  A local composer page (phone frame + Arabic hook captions rendered
//           as DOM, so shaping/RTL are perfect) is stepped DETERMINISTICALLY
//           frame-by-frame and screenshotted at 30fps, then assembled to H.264
//           by ffmpeg-static. No realtime recording = no dropped frames.
//
// The creative story (founder-approved direction, hook family TIME/HASSLE):
// old AC → no time to tour stores → "found an easier way" → real query → real
// answer → CTA. Captions use LAUNCH_MARKETING_PLAYBOOK voice and CAN-SAY
// phrases only; no price/saving/count claims are made in the captions — the
// only prices shown are the live UI itself.
//
// Usage:
//   node scripts/growth/render-journey-video.js --config scripts/growth/experiments/cdv-ac-001.json
// Output: public/growth/<content_id>.mp4 + a capture manifest next to it.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const puppeteer = require("puppeteer");
const ffmpegPath = require("ffmpeg-static");

const argIdx = process.argv.indexOf("--config");
if (argIdx < 0) { console.error("--config <file> required"); process.exit(1); }
const CFG = JSON.parse(fs.readFileSync(process.argv[argIdx + 1], "utf8"));

const FPS = 30;
const W = 1080, H = 1920;
const PHONE_W = 750, PHONE_H = 1624; // captured shots are 390x844 @2x = 780x1688; displayed slightly cropped by frame
const WORK = path.join(__dirname, "..", "..", ".growth-render", CFG.content_id);
const CAPTURE_DIR = path.join(WORK, "capture");
const FRAMES_DIR = path.join(WORK, "frames");
const OUT = path.join(__dirname, "..", "..", "public", "growth", `${CFG.content_id}.mp4`);

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(CAPTURE_DIR, { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Pass 1 — capture the REAL journey ─────────────────────────────────────────
async function capture(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
  // Test-mode: the capture session must never pollute REAL metrics.
  await page.goto(`${CFG.base_url}/ar?test=1`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2500);

  const shots = [];
  let n = 0;
  const shot = async (label, holdSec) => {
    const file = path.join(CAPTURE_DIR, `c${String(n++).padStart(3, "0")}.png`);
    await page.screenshot({ path: file });
    shots.push({ file, label, holdSec });
  };

  await shot("home", 1.2);

  // Focus the first VISIBLE search box (the page renders more than one input; hidden
  // desktop variants are not clickable on mobile) and type the verified query
  // character by character — into the real UI, no mockups.
  const focused = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('input[type="search"], input[type="text"], input:not([type])'));
    const visible = candidates.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 80 && r.height > 20 && r.top >= 0 && r.top < window.innerHeight && getComputedStyle(el).visibility !== "hidden";
    });
    if (!visible) return false;
    visible.setAttribute("data-growth-capture", "1");
    visible.focus();
    return true;
  });
  if (!focused) throw new Error("no visible search input found on the landing page");
  await sleep(600);
  const q = CFG.query;
  for (let i = 1; i <= q.length; i++) {
    await page.evaluate((text) => {
      const el = document.querySelector('[data-growth-capture="1"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, q.slice(0, i));
    // capture every 2nd character → natural typing rhythm at playback
    if (i % 2 === 0 || i === q.length) await shot(`typing_${i}`, 0.14);
  }
  await sleep(400);
  await page.keyboard.press("Enter");
  // If Enter didn't navigate (some inputs submit via button), go to the results URL directly.
  await sleep(2500);
  if (!page.url().includes("/search")) {
    await page.goto(`${CFG.base_url}/ar/search?q=${encodeURIComponent(q)}&test=1`, { waitUntil: "networkidle2", timeout: 60000 });
  }

  // Wait for the real results page to settle, then capture the reveal + scroll.
  await sleep(1500);
  try { await page.waitForFunction(() => document.body.innerText.length > 800, { timeout: 30000 }); } catch { /* capture whatever is there */ }
  await sleep(6000); // let Waffar/advisor + results fully render
  await shot("results_top", 2.2);
  for (let s = 0; s < CFG.scroll_steps; s++) {
    await page.evaluate(() => window.scrollBy({ top: 620, behavior: "instant" }));
    await sleep(900);
    await shot(`results_scroll_${s}`, 1.6);
  }

  await page.close();
  fs.writeFileSync(path.join(WORK, "capture-manifest.json"), JSON.stringify({ captured_at: new Date().toISOString(), base_url: CFG.base_url, query: q, shots: shots.map((s) => ({ ...s, file: path.basename(s.file) })) }, null, 2));
  return shots;
}

// ── Pass 2 — compose + render ─────────────────────────────────────────────────
function composerHtml() {
  // Captions rendered as DOM → perfect Arabic shaping. Brand green matches the
  // production theme; the logo is the real repo asset.
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${W}px; height:${H}px; overflow:hidden; font-family:'Segoe UI','Tahoma',sans-serif;
         background: radial-gradient(1200px 800px at 50% -10%, #0e5c49 0%, #07352a 55%, #041f18 100%); }
  #stage { position:relative; width:100%; height:100%; }
  #phone { position:absolute; left:50%; top:54%; transform:translate(-50%,-50%);
           width:${PHONE_W}px; height:${PHONE_H}px; border-radius:64px; overflow:hidden;
           border:14px solid #10241e; box-shadow:0 40px 120px rgba(0,0,0,.6); background:#fff; display:none; }
  #phone img { width:100%; height:100%; object-fit:cover; object-position:top; }
  .cap { position:absolute; left:50%; transform:translateX(-50%); width:92%; text-align:center;
         color:#fff; font-weight:800; direction:rtl; opacity:0; }
  #hook  { top:34%; font-size:88px; line-height:1.35; text-shadow:0 6px 30px rgba(0,0,0,.55); }
  #sub   { top:6.5%; font-size:54px; line-height:1.4; text-shadow:0 4px 22px rgba(0,0,0,.65); }
  #cta   { top:30%; font-size:76px; line-height:1.45; }
  #brand { position:absolute; bottom:4%; left:50%; transform:translateX(-50%); text-align:center; opacity:0; }
  #brand img { height:130px; }
  #brand .url { color:#d9f4ec; font-size:44px; font-weight:700; margin-top:12px; letter-spacing:.5px; }
  #logoTop { position:absolute; top:3%; left:50%; transform:translateX(-50%); height:84px; opacity:.95; display:none; }
  .show { opacity:1 !important; }
  #endcard { position:absolute; inset:0; background: radial-gradient(1000px 700px at 50% 30%, #0e5c49 0%, #052b21 70%); display:none; }
  </style></head><body><div id="stage">
    <div id="hook" class="cap"></div>
    <img id="logoTop" src="__LOGO__">
    <div id="phone"><img id="screen" src=""></div>
    <div id="sub" class="cap"></div>
    <div id="endcard"><div id="cta" class="cap"></div><div id="brand">
      <img src="__LOGO__"><div class="url">tawveeri.com</div></div></div>
  </div><script>
  window.__setState = (s) => {
    const el = (id) => document.getElementById(id);
    el('hook').textContent = s.hook || ''; el('hook').classList.toggle('show', !!s.hook);
    el('sub').textContent = s.sub || ''; el('sub').classList.toggle('show', !!s.sub);
    el('phone').style.display = s.screen ? 'block' : 'none';
    if (s.screen) el('screen').src = s.screen;
    el('logoTop').style.display = s.screen ? 'block' : 'none';
    el('endcard').style.display = s.endcard ? 'block' : 'none';
    el('cta').textContent = s.cta || ''; el('cta').classList.toggle('show', !!s.cta);
    document.getElementById('brand').classList.toggle('show', !!s.endcard);
    return true;
  };
  </script></body></html>`;
}

/** Build the frame-by-frame timeline: [{state}, ...] at FPS. */
function buildTimeline(shots) {
  const frames = [];
  const push = (state, seconds) => { for (let i = 0; i < Math.round(seconds * FPS); i++) frames.push(state); };
  const shotUri = (s) => "file:///" + s.file.replace(/\\/g, "/");

  const t = CFG.timeline;
  // 1. Text hooks on brand background (no phone yet — pure scroll-stopper)
  for (const h of t.hooks) push({ hook: h.text }, h.seconds);
  // 2. The real journey inside the phone frame, with subtitles
  const home = shots.find((s) => s.label === "home");
  if (home) push({ screen: shotUri(home), sub: t.sub_home }, home.holdSec);
  for (const s of shots.filter((x) => x.label.startsWith("typing_"))) {
    push({ screen: shotUri(s), sub: t.sub_typing }, s.holdSec);
  }
  const results = shots.filter((x) => x.label.startsWith("results_"));
  results.forEach((s, i) => {
    push({ screen: shotUri(s), sub: i === 0 ? t.sub_results : t.sub_results2 }, s.holdSec);
  });
  // 3. End card
  push({ endcard: true, cta: t.cta }, t.cta_seconds);
  return frames;
}

async function render(browser, shots) {
  const html = composerHtml().replaceAll("__LOGO__", "file:///" + path.join(__dirname, "..", "..", "public", "logos", "Tawveeri.png").replace(/\\/g, "/"));
  const composerFile = path.join(WORK, "composer.html");
  fs.writeFileSync(composerFile, html);

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto("file:///" + composerFile.replace(/\\/g, "/"), { waitUntil: "load" });

  const timeline = buildTimeline(shots);
  console.log(`rendering ${timeline.length} frames (${(timeline.length / FPS).toFixed(1)}s @ ${FPS}fps)…`);
  let last = null;
  for (let i = 0; i < timeline.length; i++) {
    const state = timeline[i];
    if (state !== last) { await page.evaluate((s) => window.__setState(s), state); last = state; }
    await page.screenshot({ path: path.join(FRAMES_DIR, `f${String(i).padStart(5, "0")}.png`) });
    if (i % 120 === 0) console.log(`  frame ${i}/${timeline.length}`);
  }
  await page.close();

  console.log("encoding…");
  const r = spawnSync(ffmpegPath, [
    "-y", "-framerate", String(FPS), "-i", path.join(FRAMES_DIR, "f%05d.png"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "medium",
    "-movflags", "+faststart", OUT,
  ], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error("ffmpeg failed");
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(`\nDONE → ${OUT} (${mb} MB, ${(timeline.length / FPS).toFixed(1)}s)`);
}

(async () => {
  // Uses the machine's own Chrome (puppeteer's bundled build isn't downloaded in
  // this environment); a fresh headless instance, isolated user-data-dir.
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox", "--font-render-hinting=none", "--lang=ar", "--hide-scrollbars"],
  });
  try {
    const shots = await capture(browser);
    console.log(`captured ${shots.length} real journey shots`);
    await render(browser, shots);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
