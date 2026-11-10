import { json, missingKey, suno } from "../../lib/suno.js";

export async function onRequestGet({ request, env }) {
  const err = missingKey(env);
  if (err) return err;
  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId || !/^[\w-]{1,128}$/.test(taskId)) return json({ code: 400, msg: "Bad taskId" }, 400);
  return suno(env, `/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`);
}
