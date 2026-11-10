import { json } from "../../lib/suno.js";

// Suno POSTs generation progress here. The app polls /api/status instead, so just acknowledge.
export async function onRequestPost() {
  return json({ ok: true });
}
