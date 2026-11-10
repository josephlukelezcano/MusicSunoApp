import { json, missingKey, suno, buildGeneratePayload } from "../../lib/suno.js";

export async function onRequestPost({ request, env }) {
  const err = missingKey(env);
  if (err) return err;
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ code: 400, msg: "Invalid JSON" }, 400);
  }
  let payload;
  try {
    payload = buildGeneratePayload(input, new URL(request.url).origin);
  } catch (e) {
    return json({ code: 400, msg: e.message }, 400);
  }
  return suno(env, "/api/v1/generate", { method: "POST", body: payload });
}
