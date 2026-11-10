// Shared helpers for the Cloudflare Pages Functions that proxy the Suno API.
// The API key lives in env.SUNO_API_KEY (a Cloudflare secret) and never reaches the browser.

const MODELS = new Set(["V6", "V6_MINI", "V6_WILD"]);

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function missingKey(env) {
  return env.SUNO_API_KEY
    ? null
    : json({ code: 500, msg: "SUNO_API_KEY is not set. Add it as a secret in Cloudflare (or .dev.vars locally)." }, 500);
}

export async function suno(env, pathname, { method = "GET", body } = {}) {
  const base = (env.SUNO_API_BASE || "https://api.sunoapi.org").replace(/\/$/, "");
  let r;
  try {
    r = await fetch(base + pathname, {
      method,
      headers: {
        Authorization: `Bearer ${env.SUNO_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return json({ code: 502, msg: "Could not reach the Suno API: " + e.message }, 502);
  }
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { code: r.status, msg: text.slice(0, 300) || r.statusText };
  }
  return json(data, r.status >= 400 ? r.status : 200);
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Build a /api/v1/generate payload from the app's form, enforcing the documented limits.
export function buildGeneratePayload(input, origin) {
  const customMode = Boolean(input.customMode);
  const instrumental = Boolean(input.instrumental);
  const model = MODELS.has(input.model) ? input.model : "V6";
  // callBackUrl is required by the API. The UI polls for status, so the callback is just acknowledged.
  const callBackUrl = `${origin}/api/callback`;

  if (!customMode) {
    const prompt = str(input.prompt, 3000);
    const style = str(input.style, 1000);
    if (!prompt && !style) throw new Error("Describe your run or pick a style.");
    const body = { customMode, instrumental, model, callBackUrl };
    if (prompt) body.prompt = prompt;
    if (style) body.style = style;
    return body;
  }

  const style = str(input.style, 1000);
  const title = str(input.title, 80);
  const lyrics = str(input.lyrics, 5000);
  const negativeTags = str(input.negativeTags, 1000);
  if (!style) throw new Error("Custom mode needs a style.");
  if (!instrumental && !lyrics) throw new Error("Add lyrics, or switch on Instrumental.");

  const body = { customMode, instrumental, model, callBackUrl, style };
  if (title) body.title = title;
  if (lyrics && !instrumental) body.lyrics = lyrics;
  if (negativeTags) body.negativeTags = negativeTags;
  if (input.vocalGender === "m" || input.vocalGender === "f") body.vocalGender = input.vocalGender;
  const d = Number(input.duration);
  if (Number.isFinite(d) && d >= 10 && d <= 360) body.duration = Math.round(d);
  return body;
}
