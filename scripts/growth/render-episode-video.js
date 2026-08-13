// scripts/growth/render-episode-video.js — "مسلسل توفيري" episode renderer
// ─────────────────────────────────────────────────────────────────────────────
// Creative Proof Mission (2026-08-13): episode 1 evolves cdv-ac-001 from
// "screen journey + captions" into a short STORY — a Saudi husband/wife chat
// about a dying AC, resolved by the wife demonstrating the REAL Tawveeri
// journey inside the same phone.
//
// Why a chat-story scene instead of AI-generated actors: locally-runnable AI
// video cannot yet produce non-uncanny Saudi actors with acceptable Arabic
// lip-sync, and the mission forbids shipping a bad video to close the task.
// The message-thread format is a native, high-retention short-form genre,
// reads perfectly with sound off, keeps the characters PIXEL-CONSISTENT for
// future episodes (series bible = avatars + names + speech style), has zero
// rights/watermark/cost exposure, and makes the story→product transition
// natural: the story already lives on a phone.
//
//   Scene 1  Full-bleed chat (أم فهد ↔ أبو فهد), messages pop in sequentially
//            with typing indicators — deterministic per-frame progress.
//   Scene 2  A phone frame slides up ("شوف وش لقيت 👇") showing the REAL
//            production journey: tawveeri.com, the verified query typed
//            character-by-character, live results (29 real AC results at
//            capture-verification time). No mockups, no fabricated prices.
//   Scene 3  Back to the chat for the punchline, then the end card
//            (series signature + governance-checked CTA).
//
// Audio: subtle synthesized chat pops/typing ticks/whoosh (deterministic
// ffmpeg sine/noise synthesis — no external assets, no rights exposure).
// TikTok trending music, if wanted, is added in the TikTok editor at publish
// time (also the rights-safest route) — a founder act, not this script's.
//
// Usage:
//   node scripts/growth/render-episode-video.js --config scripts/growth/experiments/tw-ep1-ac.json
// Output: public/growth/<content_id>.mp4 + capture manifest.
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
const PHONE_W = 860, PHONE_H = 1770;
const WORK = path.join(__dirname, "..", "..", ".growth-render", CFG.content_id);
const CAPTURE_DIR = path.join(WORK, "capture");
const FRAMES_DIR = path.join(WORK, "frames");
const OUT = path.join(__dirname, "..", "..", "public", "growth", `${CFG.content_id}.mp4`);

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(CAPTURE_DIR, { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Pass 1 — capture the REAL journey (same contract as render-journey-video) ─
async function capture(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
  await page.goto(`${CFG.base_url}/ar?test=1`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2500);

  const shots = [];
  let n = 0;
  const shot = async (label, holdSec) => {
    const file = path.join(CAPTURE_DIR, `c${String(n++).padStart(3, "0")}.png`);
    await page.screenshot({ path: file });
    shots.push({ file, label, holdSec });
  };

  await shot("home", 1.0);

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
    if (i % 2 === 0 || i === q.length) await shot(`typing_${i}`, 0.13);
  }
  await sleep(400);
  await page.keyboard.press("Enter");
  await sleep(2500);
  if (!page.url().includes("/search")) {
    await page.goto(`${CFG.base_url}/ar/search?q=${encodeURIComponent(q)}&test=1`, { waitUntil: "networkidle2", timeout: 60000 });
  }
  await sleep(1500);
  try { await page.waitForFunction(() => document.body.innerText.length > 800, { timeout: 30000 }); } catch { /* capture whatever renders */ }
  await sleep(6000);
  await shot("results_top", 2.2);
  for (let s = 0; s < CFG.scroll_steps; s++) {
    await page.evaluate(() => window.scrollBy({ top: 620, behavior: "instant" }));
    await sleep(900);
    await shot(`results_scroll_${s}`, 1.7);
  }

  await page.close();
  fs.writeFileSync(path.join(WORK, "capture-manifest.json"), JSON.stringify({ captured_at: new Date().toISOString(), base_url: CFG.base_url, query: q, shots: shots.map((s) => ({ ...s, file: path.basename(s.file) })) }, null, 2));
  return shots;
}

// ── Composer ──────────────────────────────────────────────────────────────────
function composerHtml() {
  const hus = CFG.characters.husband;
  // Chat scene: a messaging-app look every Saudi viewer reads instantly as a
  // WhatsApp conversation — familiar bubble colors, header bar, timestamps,
  // read ticks, «اليوم» divider — while using NO WhatsApp name, logo, or the
  // proprietary doodle wallpaper. Meta's brand guidelines require permission
  // for logo/name use in commercial content and forbid implying endorsement;
  // an inspired-but-unbranded UI is the safe, standard practice (mission §3:
  // UNKNOWN BEATS INCORRECT). Authentic 1:1 details: no per-message avatars,
  // no in-bubble sender names, typing shown as «يكتب…» in the header.
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${W}px; height:${H}px; overflow:hidden; font-family:'Segoe UI','Tahoma',sans-serif;
         background: radial-gradient(1200px 800px at 50% -10%, #0e5c49 0%, #07352a 55%, #041f18 100%); }
  #stage { position:relative; width:100%; height:100%; }

  /* series badge (journey scenes only — the chat must read as a real app) */
  #badge { position:absolute; top:4.2%; left:50%; transform:translateX(-50%);
           background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.22);
           color:#d9f4ec; font-size:34px; font-weight:800; padding:10px 30px; border-radius:999px;
           opacity:0; transition:none; white-space:nowrap; z-index:5; }

  /* messaging screen — full-bleed */
  #chatScreen { position:absolute; inset:0; background:#ece5dd; display:none; }
  #chatHeader { position:absolute; top:0; left:0; right:0; height:150px; background:#075e54;
                display:flex; align-items:center; gap:22px; padding:0 28px; z-index:2; }
  #chatHeader .back { color:#fff; font-size:52px; font-weight:400; transform:scaleX(-1); }
  #chatHeader .hav { width:92px; height:92px; border-radius:50%; background:${hus.avatar_bg};
                     display:flex; align-items:center; justify-content:center; color:#fff; font-size:40px; font-weight:900; }
  #chatHeader .meta { display:flex; flex-direction:column; gap:2px; }
  #chatHeader .name { color:#fff; font-size:44px; font-weight:800; }
  #chatHeader .sub { color:#c8e8e3; font-size:30px; font-weight:600; }
  #daychip { position:absolute; top:190px; left:50%; transform:translateX(-50%);
             background:#dff0f5; color:#54656f; font-size:30px; font-weight:700;
             padding:8px 26px; border-radius:14px; box-shadow:0 1px 2px rgba(0,0,0,.12); }
  #chat { position:absolute; left:0; right:0; top:150px; bottom:0; padding:110px 4% 12%;
          display:flex; flex-direction:column; justify-content:flex-end; gap:22px; }
  .row { display:flex; width:100%; }
  /* RTL flex: incoming (his messages) hug the RIGHT edge, outgoing (hers) the LEFT. */
  .row.in  { justify-content:flex-start; }
  .row.out { justify-content:flex-end; }
  .bubble { position:relative; max-width:80%; padding:22px 30px 16px; border-radius:24px;
            font-size:46px; line-height:1.5; font-weight:600; color:#111b21; direction:rtl;
            text-align:right; box-shadow:0 1px 2px rgba(0,0,0,.13); }
  .row.out .bubble { background:#d9fdd3; border-bottom-left-radius:6px; }
  .row.in  .bubble { background:#ffffff; border-bottom-right-radius:6px; }
  .stamp { display:flex; justify-content:flex-end; align-items:center; gap:8px;
           margin-top:6px; font-size:26px; color:#667781; direction:ltr; }
  .ticks { color:#53bdeb; font-size:28px; letter-spacing:-6px; }
  .dots { display:inline-flex; gap:12px; padding:16px 8px 12px; }
  .dots i { width:16px; height:16px; border-radius:50%; background:#9aa8b0; display:inline-block; }

  /* phone with the real journey */
  #phoneWrap { position:absolute; left:50%; top:0; width:${PHONE_W}px; height:${PHONE_H}px;
               transform:translate(-50%, 130%); }
  #phone { width:100%; height:100%; border-radius:70px; overflow:hidden;
           border:16px solid #10241e; box-shadow:0 40px 120px rgba(0,0,0,.65); background:#fff; }
  #phone img { width:100%; height:100%; object-fit:cover; object-position:top; }
  #sub { position:absolute; left:50%; transform:translateX(-50%); top:2.6%; width:94%; text-align:center;
         color:#fff; font-size:50px; font-weight:800; direction:rtl; opacity:0;
         text-shadow:0 4px 22px rgba(0,0,0,.65); }

  /* end card */
  #endcard { position:absolute; inset:0; background: radial-gradient(1000px 700px at 50% 30%, #0e5c49 0%, #052b21 70%); display:none; }
  #cta { position:absolute; top:32%; left:50%; transform:translateX(-50%); width:92%; text-align:center;
         color:#fff; font-size:88px; font-weight:900; direction:rtl; }
  #brand { position:absolute; bottom:18%; left:50%; transform:translateX(-50%); text-align:center; }
  #brand img { height:150px; }
  #brand .url { color:#d9f4ec; font-size:48px; font-weight:700; margin-top:14px; }
  #brand .ep { color:#9fd8c6; font-size:38px; font-weight:700; margin-top:22px; }
  </style></head><body><div id="stage">
    <div id="chatScreen">
      <div id="chatHeader">
        <span class="back">‹</span>
        <div class="hav">${hus.name.slice(0, 2)}</div>
        <div class="meta"><span class="name">${hus.name} ❤️</span><span class="sub" id="hsub">متصل الآن</span></div>
      </div>
      <div id="daychip">اليوم</div>
      <div id="chat"></div>
    </div>
    <div id="badge">${CFG.series} · ${CFG.episode_label}</div>
    <div id="phoneWrap"><div id="phone"><img id="screen" src=""></div></div>
    <div id="sub"></div>
    <div id="endcard"><div id="cta"></div><div id="brand">
      <img src="__LOGO__"><div class="url">tawveeri.com</div>
      <div class="ep">${CFG.series} · ${CFG.episode_label}</div></div>
  </div></div><script>
  // Fictional in-scene timestamps (evening, matches the after-work dialogue).
  const T0 = 21 * 60 + 47;
  const stampFor = (i) => {
    const m = T0 + Math.floor(i / 2);
    return String(Math.floor(m / 60) - 12) + ':' + String(m % 60).padStart(2, '0') + ' م';
  };
  window.__setState = (s) => {
    const el = (id) => document.getElementById(id);
    // The badge and the journey subtitle share the top band — never both, and
    // never over the chat (it must read as a real messaging app).
    el('badge').style.opacity = s.badge && !s.sub && !s.chatVisible ? 1 : 0;
    el('chatScreen').style.display = s.chatVisible ? 'block' : 'none';
    if (s.chatVisible) {
      const anyTyping = (s.msgs || []).some((m) => m.typing);
      el('hsub').textContent = anyTyping ? 'يكتب…' : 'متصل الآن';
      el('chat').innerHTML = (s.msgs || []).map((m, i) => {
        const side = m.who === 'wife' ? 'out' : 'in';
        const p = Math.max(0, Math.min(1, m.progress));
        const scale = 0.85 + 0.15 * p;
        if (m.typing) {
          return '<div class="row in" style="opacity:' + p + '">' +
            '<div class="bubble" style="transform:scale(' + scale + ');transform-origin:bottom right">' +
            '<span class="dots"><i></i><i></i><i></i></span></div></div>';
        }
        const ticks = side === 'out' ? '<span class="ticks">✓✓</span>' : '';
        return '<div class="row ' + side + '" style="opacity:' + p + '">' +
          '<div class="bubble" style="transform:scale(' + scale + ');transform-origin:' + (side === 'out' ? 'bottom left' : 'bottom right') + '">' +
          m.text + '<div class="stamp">' + ticks + '<span>' + stampFor(i) + '</span></div></div></div>';
      }).join('');
    }
    // phone slide: 0 = fully up (centered), 1 = fully off-screen bottom
    const off = s.phoneOff === undefined ? 1 : s.phoneOff;
    el('phoneWrap').style.transform = 'translate(-50%, ' + (4 + off * 130) + '%)';
    if (s.screen) el('screen').src = s.screen;
    el('sub').textContent = s.sub || '';
    el('sub').style.opacity = s.sub ? 1 : 0;
    el('endcard').style.display = s.endcard ? 'block' : 'none';
    el('cta').textContent = s.cta || '';
    return true;
  };
  </script></body></html>`;
}

// ── Timeline ──────────────────────────────────────────────────────────────────
const easeOut = (p) => 1 - Math.pow(1 - p, 3);

function buildTimeline(shots) {
  const frames = [];
  const audio = []; // {sound, tSec}
  const tSec = () => frames.length / FPS;
  const POP_FRAMES = 7;

  const pushChat = (msgs, extra, seconds) => {
    for (let i = 0; i < Math.round(seconds * FPS); i++) {
      frames.push({ chatVisible: true, badge: tSec() > 1.6, msgs: msgs.map((m) => ({ ...m })), phoneOff: 1, ...extra });
    }
  };

  const playChat = (script, msgs) => {
    for (const line of script) {
      if (line.typing) {
        const typingMsg = { who: line.who, typing: true, progress: 1 };
        // typing indicator pops in quickly then holds
        for (let f = 0; f < POP_FRAMES; f++) {
          pushChat([...msgs, { ...typingMsg, progress: easeOut((f + 1) / POP_FRAMES) }], {}, 1 / FPS);
        }
        pushChat([...msgs, typingMsg], {}, Math.max(0, line.typing - POP_FRAMES / FPS));
      }
      audio.push({ sound: line.who === "wife" ? "pop_out" : "pop_in", tSec: tSec() });
      for (let f = 0; f < POP_FRAMES; f++) {
        pushChat([...msgs, { who: line.who, text: line.text, progress: easeOut((f + 1) / POP_FRAMES) }], {}, 1 / FPS);
      }
      msgs.push({ who: line.who, text: line.text, progress: 1 });
      pushChat(msgs, {}, Math.max(0, line.hold - POP_FRAMES / FPS));
    }
    return msgs;
  };

  // Scene 1 — opening chat
  const msgs = playChat(CFG.chat_open, []);

  // Scene 2 — phone slides up over the chat with the REAL journey
  const shotUri = (s) => "file:///" + s.file.replace(/\\/g, "/");
  const home = shots.find((s) => s.label === "home");
  audio.push({ sound: "whoosh", tSec: tSec() });
  const SLIDE = Math.round(0.6 * FPS);
  for (let f = 0; f < SLIDE; f++) {
    frames.push({ chatVisible: true, badge: true, msgs, phoneOff: 1 - easeOut((f + 1) / SLIDE), screen: shotUri(home) });
  }
  const pushPhone = (state, seconds) => { for (let i = 0; i < Math.round(seconds * FPS); i++) frames.push({ chatVisible: false, badge: true, phoneOff: 0, ...state }); };
  pushPhone({ screen: shotUri(home) }, home.holdSec);
  const typingShots = shots.filter((x) => x.label.startsWith("typing_"));
  typingShots.forEach((s, i) => {
    if (i % 3 === 0) audio.push({ sound: "tick", tSec: tSec() });
    pushPhone({ screen: shotUri(s), sub: CFG.subs.typing }, s.holdSec);
  });
  const results = shots.filter((x) => x.label.startsWith("results_"));
  audio.push({ sound: "pop_out", tSec: tSec() });
  results.forEach((s, i) => {
    pushPhone({ screen: shotUri(s), sub: i === 0 ? CFG.subs.results : CFG.subs.results2 }, s.holdSec);
  });

  // Scene 3 — phone slides away, closing chat
  audio.push({ sound: "whoosh", tSec: tSec() });
  const last = results[results.length - 1];
  for (let f = 0; f < SLIDE; f++) {
    frames.push({ chatVisible: true, badge: true, msgs, phoneOff: easeOut((f + 1) / SLIDE), screen: shotUri(last) });
  }
  playChat(CFG.chat_close, msgs);

  // Scene 4 — end card
  audio.push({ sound: "pop_out", tSec: tSec() });
  for (let i = 0; i < Math.round(CFG.cta_seconds * FPS); i++) {
    frames.push({ endcard: true, cta: CFG.cta });
  }
  return { frames, audio };
}

// ── Audio synthesis (deterministic, zero external assets) ─────────────────────
function buildAudio(audioEvents, durationSec, outWav) {
  // Base samples synthesized once with ffmpeg's sine/anoisesrc, then placed at
  // event timestamps via adelay + amix. Volumes deliberately subtle.
  const samples = {
    pop_out: ["-f", "lavfi", "-i", "sine=frequency=1150:duration=0.09", "-af", "afade=t=out:st=0.02:d=0.07,volume=0.32"],
    pop_in: ["-f", "lavfi", "-i", "sine=frequency=850:duration=0.09", "-af", "afade=t=out:st=0.02:d=0.07,volume=0.32"],
    tick: ["-f", "lavfi", "-i", "sine=frequency=1900:duration=0.04", "-af", "afade=t=out:st=0.005:d=0.035,volume=0.10"],
    whoosh: ["-f", "lavfi", "-i", "anoisesrc=color=pink:duration=0.45", "-af", "lowpass=f=900,afade=t=in:st=0:d=0.1,afade=t=out:st=0.15:d=0.3,volume=0.16"],
  };
  const sampleFiles = {};
  for (const [name, args] of Object.entries(samples)) {
    const f = path.join(WORK, `${name}.wav`);
    const r = spawnSync(ffmpegPath, ["-y", ...args, f], { stdio: "ignore" });
    if (r.status !== 0) throw new Error(`sample synth failed: ${name}`);
    sampleFiles[name] = f;
  }
  const inputs = [];
  const delays = [];
  audioEvents.forEach((e, i) => {
    inputs.push("-i", sampleFiles[e.sound]);
    delays.push(`[${i + 1}:a]adelay=${Math.round(e.tSec * 1000)}|${Math.round(e.tSec * 1000)}[d${i}]`);
  });
  const mixIn = audioEvents.map((_, i) => `[d${i}]`).join("");
  const filter = `${delays.join(";")};[0:a]${mixIn}amix=inputs=${audioEvents.length + 1}:normalize=0[out]`;
  const r = spawnSync(ffmpegPath, [
    "-y", "-f", "lavfi", "-i", `anullsrc=r=44100:cl=stereo:d=${durationSec.toFixed(2)}`,
    ...inputs, "-filter_complex", filter, "-map", "[out]", "-t", durationSec.toFixed(2), outWav,
  ], { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) throw new Error("audio mix failed");
}

// ── Render ────────────────────────────────────────────────────────────────────
async function render(browser, shots) {
  const html = composerHtml().replaceAll("__LOGO__", "file:///" + path.join(__dirname, "..", "..", "public", "logos", "Tawveeri.png").replace(/\\/g, "/"));
  const composerFile = path.join(WORK, "composer.html");
  fs.writeFileSync(composerFile, html);

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto("file:///" + composerFile.replace(/\\/g, "/"), { waitUntil: "load" });

  const { frames, audio } = buildTimeline(shots);
  console.log(`rendering ${frames.length} frames (${(frames.length / FPS).toFixed(1)}s @ ${FPS}fps)…`);
  for (let i = 0; i < frames.length; i++) {
    await page.evaluate((s) => window.__setState(s), frames[i]);
    await page.screenshot({ path: path.join(FRAMES_DIR, `f${String(i).padStart(5, "0")}.png`) });
    if (i % 120 === 0) console.log(`  frame ${i}/${frames.length}`);
  }
  await page.close();

  const durationSec = frames.length / FPS;
  console.log("synthesizing audio…");
  const wav = path.join(WORK, "audio.wav");
  buildAudio(audio, durationSec, wav);

  console.log("encoding…");
  const r = spawnSync(ffmpegPath, [
    "-y", "-framerate", String(FPS), "-i", path.join(FRAMES_DIR, "f%05d.png"),
    "-i", wav,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "medium",
    "-c:a", "aac", "-b:a", "96k", "-shortest",
    "-movflags", "+faststart", OUT,
  ], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error("ffmpeg failed");
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(`\nDONE → ${OUT} (${mb} MB, ${durationSec.toFixed(1)}s)`);
}

(async () => {
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
