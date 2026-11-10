// STRIDE front end. Talks only to our own /api/* functions; the Suno key stays server-side.

const RUN_TYPES = [
  { id: "recovery", name: "Recovery", bpm: 125, desc: "Loose legs, low effort", energy: "relaxed, gentle groove" },
  { id: "easy", name: "Easy Run", bpm: 150, desc: "Conversational pace", energy: "steady, feel-good" },
  { id: "long", name: "Long Run", bpm: 158, desc: "Settle in for miles", energy: "hypnotic, driving, evolving" },
  { id: "tempo", name: "Tempo", bpm: 168, desc: "Comfortably hard", energy: "relentless, determined" },
  { id: "intervals", name: "Intervals", bpm: 178, desc: "Hard repeats", energy: "explosive drops, high intensity" },
  { id: "race", name: "Race Day", bpm: 185, desc: "Leave it all out there", energy: "epic, triumphant, anthemic" },
];
const MOODS = ["Hype", "Focused", "Euphoric", "Gritty", "Chill", "Cinematic"];
const GENRES = ["Electronic", "Hip-Hop", "Pop", "Rock", "Drum & Bass", "House", "Synthwave", "Trap", "Afrobeats", "Latin", "Punk", "Lo-fi"];
const MAX_GENRES = 3;
const POLL_MS = 5000;
const POLL_LIMIT_MS = 10 * 60 * 1000;
const STORE_KEY = "stride.tracks.v1";

const $ = (id) => document.getElementById(id);
const audio = document.getElementById("audio");
let playingId = null;
const state = { runType: RUN_TYPES[1], bpm: 150, mood: "Hype", genres: new Set(["Electronic"]), tracks: loadTracks() };

// ---------- storage ----------
function loadTracks() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function saveTracks() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state.tracks.slice(0, 200))); } catch {}
}
function upsertTrack(t) {
  const i = state.tracks.findIndex((x) => x.id === t.id);
  if (i >= 0) state.tracks[i] = { ...state.tracks[i], ...t };
  else state.tracks.unshift(t);
  saveTracks();
}

// ---------- form ----------
function renderRunTypes() {
  $("runTypes").innerHTML = RUN_TYPES.map((r) => `
    <button class="runtype" role="radio" aria-checked="${r.id === state.runType.id}" data-id="${r.id}">
      <span class="rt-name">${r.name}</span>
      <span class="rt-bpm">${r.bpm}<small>BPM</small></span>
      <span class="rt-desc">${r.desc}</span>
    </button>`).join("");
}
$("runTypes").addEventListener("click", (e) => {
  const b = e.target.closest(".runtype");
  if (!b) return;
  state.runType = RUN_TYPES.find((r) => r.id === b.dataset.id);
  setBpm(state.runType.bpm);
  renderRunTypes();
});

function setBpm(v) {
  state.bpm = Number(v);
  $("bpm").value = state.bpm;
  $("bpmNum").textContent = state.bpm;
}
$("bpm").addEventListener("input", (e) => setBpm(e.target.value));

function renderChips() {
  $("moods").innerHTML = MOODS.map((m) => `<button class="chip" role="radio" aria-checked="${m === state.mood}" data-v="${m}">${m}</button>`).join("");
  $("genres").innerHTML = GENRES.map((g) => `<button class="chip" aria-pressed="${state.genres.has(g)}" data-v="${g}">${g}</button>`).join("");
}
$("moods").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  state.mood = b.dataset.v;
  renderChips();
});
$("genres").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  const g = b.dataset.v;
  if (state.genres.has(g)) state.genres.delete(g);
  else {
    if (state.genres.size >= MAX_GENRES) state.genres.delete(state.genres.values().next().value);
    state.genres.add(g);
  }
  renderChips();
});

function syncProFields() {
  $("proFields").hidden = !$("customMode").checked;
  $("lyricsField").hidden = $("instrumental").checked;
}
$("customMode").addEventListener("change", syncProFields);
$("instrumental").addEventListener("change", syncProFields);

function buildRequest() {
  const custom = $("customMode").checked;
  const instrumental = $("instrumental").checked;
  const genres = [...state.genres];
  const style = [
    ...genres,
    state.mood.toLowerCase(),
    `${state.bpm} BPM`,
    state.runType.energy,
    "running workout music",
  ].join(", ");
  const idea = $("prompt").value.trim();
  const base = { customMode: custom, instrumental, model: $("model").value, style };

  if (!custom) {
    const prompt = [
      `A ${state.mood.toLowerCase()} ${genres.join("/") || "workout"} track for a ${state.runType.name.toLowerCase()}, locked at ${state.bpm} BPM to match running cadence.`,
      idea,
      instrumental ? "" : "Lyrics about running, pushing forward and not stopping.",
    ].filter(Boolean).join(" ");
    return { ...base, prompt };
  }
  return {
    ...base,
    style: idea ? `${style}, ${idea}` : style,
    title: $("title").value.trim(),
    lyrics: $("lyrics").value.trim(),
    vocalGender: $("vocalGender").value,
    duration: $("duration").value,
    negativeTags: $("negativeTags").value.trim(),
  };
}

function showError(msg) {
  const el = $("formError");
  el.textContent = msg;
  el.hidden = !msg;
  if (msg) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------- API ----------
async function api(path, opts) {
  const r = await fetch(path, opts);
  let data;
  try { data = await r.json(); } catch { data = { code: r.status, msg: r.statusText }; }
  if (!r.ok || (data.code && data.code !== 200)) throw new Error(friendlyError(data));
  return data;
}
function friendlyError(d) {
  const m = d?.msg || "Something went wrong";
  if (d?.code === 401) return "API key rejected (401). Check SUNO_API_KEY.";
  if (d?.code === 429) return "Out of credits or rate-limited (429). Top up at sunoapi.org.";
  if (d?.code === 430) return "Too many requests — wait a moment and try again.";
  return m;
}

async function refreshCredits() {
  try {
    const d = await api("/api/credits");
    const v = typeof d.data === "number" ? d.data : d.data?.credits ?? d.data;
    $("creditsValue").textContent = v ?? "—";
  } catch {
    $("creditsValue").textContent = "—";
  }
}
$("creditsBtn").addEventListener("click", refreshCredits);

// ---------- generation + live screen ----------
let liveTimer = null;
let pollTimer = null;
let currentTask = null;

const STAGE = { PENDING: 2, TEXT_SUCCESS: 3, FIRST_SUCCESS: 3, SUCCESS: 4 };
const STATUS_COPY = {
  PENDING: "Step 2 of 3: Request accepted. Suno is writing the lyrics and song structure.",
  TEXT_SUCCESS: "Step 3 of 3: Lyrics are done. Now recording the audio, which is the longest step.",
  FIRST_SUCCESS: "Song 1 is ready to play! Song 2 is still finishing.",
  SUCCESS: "Done! Both songs are ready. Press play below or find them in Activity.",
};
const STATUS_COPY_INSTRUMENTAL = {
  PENDING: "Step 2 of 3: Request accepted. Suno is arranging the song structure.",
  TEXT_SUCCESS: "Step 3 of 3: Arrangement is done. Now recording the audio, which is the longest step.",
};
const FAILURES = {
  CREATE_TASK_FAILED: "Couldn't start the task.",
  GENERATE_AUDIO_FAILED: "Audio generation failed. Try a different prompt.",
  CALLBACK_EXCEPTION: "Generation hit an error.",
  SENSITIVE_WORD_ERROR: "Your text contains words the model won't use. Try rewording.",
};

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function openLive(req) {
  $("live").hidden = false;
  $("live").classList.remove("done");
  $("liveType").textContent = state.runType.name;
  $("liveBpm").textContent = state.bpm;
  $("liveTracks").textContent = "0 / 2";
  $("results").innerHTML = "";
  $("liveDone").hidden = true;
  $("liveClose").textContent = "Keep generating in background";
  $("liveNote").hidden = false;
  $("liveTimeLabel").textContent = "Time elapsed";
  $("liveEta").hidden = false;
  $("liveEta").textContent = "Songs usually take 2–4 minutes to create.";
  $("step2Title").textContent = req.instrumental ? "Arranging" : "Writing lyrics";
  $("step2Sub").textContent = req.instrumental ? "Building the song structure" : "Lyrics & song structure";
  instrumentalRun = req.instrumental;
  setStage(1, "Step 1 of 3: Sending your request to Suno…");
  const start = Date.now();
  $("liveTime").textContent = "00:00";
  clearInterval(liveTimer);
  liveTimer = setInterval(() => {
    const sec = (Date.now() - start) / 1000;
    $("liveTime").textContent = fmtTime(sec);
    if (sec > 300) $("liveEta").textContent = "This is taking longer than usual, but it's still working. Hang tight.";
  }, 250);
  document.body.style.overflow = "hidden";
}
let instrumentalRun = false;

function closeLive() {
  $("live").hidden = true;
  document.body.style.overflow = "";
}
$("liveClose").addEventListener("click", () => {
  // Closing doesn't cancel: polling continues and tracks land in Activity.
  closeLive();
});
$("liveDone").addEventListener("click", () => { closeLive(); switchTab("activity"); });

function setStage(stage, text, failed = false) {
  $("liveStage").textContent = stage >= 4 ? "Done" : `${Math.min(stage, 3)} of 3`;
  $("liveStatus").textContent = text;
  document.querySelectorAll(".split").forEach((el) => {
    const n = Number(el.dataset.step);
    el.classList.toggle("done", !failed && (n < stage || stage >= 4));
    el.classList.toggle("active", !failed && n === stage && stage < 4);
    el.classList.toggle("fail", failed && n === Math.min(stage, 3));
  });
}

function finishLive(success = false) {
  clearInterval(liveTimer);
  $("live").classList.add("done");
  $("liveTimeLabel").textContent = success ? "Total creation time" : "Stopped after";
  $("liveEta").hidden = true;
  $("liveNote").hidden = true;
  $("liveClose").textContent = "Close";
  $("startBtn").disabled = false;
}

async function start() {
  showError("");
  const req = buildRequest();
  if (req.customMode && !req.instrumental && !req.lyrics) return showError("Pro mode needs lyrics — or switch on Instrumental.");
  $("startBtn").disabled = true;
  openLive(req);
  try {
    const d = await api("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
    const taskId = d?.data?.taskId;
    if (!taskId) throw new Error("No task ID returned.");
    currentTask = { taskId, startedAt: Date.now(), meta: { runType: state.runType.name, bpm: state.bpm, mood: state.mood, genres: [...state.genres] } };
    setStage(2, (instrumentalRun && STATUS_COPY_INSTRUMENTAL.PENDING) || STATUS_COPY.PENDING);
    poll();
  } catch (e) {
    setStage(1, e.message, true);
    finishLive();
  }
}
$("startBtn").addEventListener("click", start);

async function poll() {
  clearTimeout(pollTimer);
  const task = currentTask;
  if (!task) return;
  if (Date.now() - task.startedAt > POLL_LIMIT_MS) {
    setStage(3, "This is taking unusually long. Check Activity later.", true);
    return finishLive();
  }
  let d;
  try {
    d = await api(`/api/status?taskId=${encodeURIComponent(task.taskId)}`);
  } catch (e) {
    $("liveStatus").textContent = `Reconnecting… (${e.message})`;
    pollTimer = setTimeout(poll, POLL_MS);
    return;
  }
  const info = d.data || {};
  const status = info.status || "PENDING";
  const songs = info.response?.sunoData || info.response?.data || [];

  songs.forEach((s) => {
    const audio = s.audioUrl || s.sourceAudioUrl || "";
    const stream = s.streamAudioUrl || s.sourceStreamAudioUrl || "";
    if (!audio && !stream) return;
    upsertTrack({
      id: s.id,
      taskId: task.taskId,
      title: s.title || "Untitled run",
      tags: s.tags || "",
      image: s.imageUrl || s.sourceImageUrl || "",
      audio,
      stream,
      duration: Number(s.duration) || 0,
      createdAt: task.startedAt,
      ...task.meta,
    });
  });
  renderResults(task.taskId);
  renderActivity();

  if (FAILURES[status] || info.errorMessage) {
    setStage(STAGE[status] || 3, FAILURES[status] || info.errorMessage || "Generation failed.", true);
    return finishLive();
  }
  const copy = (instrumentalRun && STATUS_COPY_INSTRUMENTAL[status]) || STATUS_COPY[status] || status;
  setStage(STAGE[status] || 2, copy);
  if (status === "SUCCESS") {
    finishLive(true);
    $("liveDone").hidden = false;
    refreshCredits();
    return;
  }
  pollTimer = setTimeout(poll, POLL_MS);
}

function renderResults(taskId) {
  const ts = state.tracks.filter((t) => t.taskId === taskId);
  // Count only finished songs; "streaming" previews are still being recorded.
  $("liveTracks").textContent = `${ts.filter((t) => t.audio).length} / 2`;
  $("results").innerHTML = ts.map(trackHTML).join("");
}

// ---------- activity ----------
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function trackHTML(t) {
  const src = t.audio || t.stream;
  const ready = Boolean(t.audio);
  const img = t.image ? `<img src="${esc(t.image)}" alt="" loading="lazy" />` : `<div class="art-fallback"></div>`;
  return `
    <li class="track">
      ${img}
      <div class="track-meta">
        <strong>${esc(t.title)}</strong>
        <small>${esc(t.tags || t.genres?.join(", "))}</small>
        <div class="badges">
          <span class="badge volt">${esc(t.bpm)} BPM</span>
          <span class="badge">${esc(t.runType)}</span>
          ${t.duration ? `<span class="badge">${fmtTime(t.duration)}</span>` : ready ? "" : `<span class="badge">Preview</span>`}
        </div>
      </div>
      <div class="track-actions">
        ${playBtnHTML(t, src)}
        ${ready ? `<a class="icon-btn" href="${esc(t.audio)}" download target="_blank" rel="noopener" aria-label="Download">↓</a>` : ""}
      </div>
    </li>`;
}

function isPlaying(id) {
  return playingId === id && !audio.paused;
}
function playBtnHTML(t, src) {
  const on = isPlaying(t.id);
  return `<button class="icon-btn play" data-play="${esc(t.id)}" ${src ? "" : "disabled"} aria-label="${on ? "Pause" : "Play"}">${on ? "❚❚" : "▶"}</button>`;
}
// Keep every play button (Activity list, live results, mini player) in sync with the audio element.
function syncPlayButtons() {
  document.querySelectorAll("[data-play]").forEach((b) => {
    const on = isPlaying(b.dataset.play);
    b.textContent = on ? "❚❚" : "▶";
    b.setAttribute("aria-label", on ? "Pause" : "Play");
  });
  const on = !audio.paused;
  $("playerToggle").textContent = on ? "❚❚" : "▶";
  $("playerToggle").setAttribute("aria-label", on ? "Pause" : "Play");
}

function renderActivity() {
  const ts = state.tracks;
  $("emptyState").hidden = ts.length > 0;
  $("statTracks").textContent = ts.length;
  $("statMinutes").textContent = Math.round(ts.reduce((a, t) => a + (t.duration || 0), 0) / 60);
  $("statBpm").textContent = ts.length ? Math.round(ts.reduce((a, t) => a + (Number(t.bpm) || 0), 0) / ts.length) : "—";

  let html = "";
  let lastDay = "";
  for (const t of ts) {
    const day = new Date(t.createdAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    if (day !== lastDay) { html += `<li class="date-head">${esc(day)}</li>`; lastDay = day; }
    html += trackHTML(t);
  }
  $("trackList").innerHTML = html;
}

// ---------- player ----------

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-play]");
  if (!b) return;
  const t = state.tracks.find((x) => x.id === b.dataset.play);
  if (!t) return;
  if (playingId === t.id && !audio.paused) return audio.pause();
  if (playingId !== t.id) {
    audio.src = t.audio || t.stream;
    playingId = t.id;
    $("playerTitle").textContent = t.title;
    $("playerSub").textContent = `${t.bpm} BPM · ${t.runType}`;
    $("playerArt").src = t.image || "/favicon.svg";
    $("player").hidden = false;
  }
  audio.play().catch(() => {});
});
$("playerToggle").addEventListener("click", () => (audio.paused ? audio.play().catch(() => {}) : audio.pause()));
["play", "pause", "ended"].forEach((ev) => audio.addEventListener(ev, syncPlayButtons));
audio.addEventListener("timeupdate", () => {
  $("playerBar").style.width = audio.duration ? `${(audio.currentTime / audio.duration) * 100}%` : "0";
});
document.querySelector(".player-progress").addEventListener("click", (e) => {
  if (!audio.duration) return;
  const r = e.currentTarget.getBoundingClientRect();
  audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
});

// ---------- tabs ----------
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $("view-run").hidden = name !== "run";
  $("view-activity").hidden = name !== "activity";
  if (name === "activity") renderActivity();
  window.scrollTo({ top: 0 });
}
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

// ---------- init ----------
renderRunTypes();
renderChips();
setBpm(state.runType.bpm);
syncProFields();
renderActivity();
refreshCredits();
