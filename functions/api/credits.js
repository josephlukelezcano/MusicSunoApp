import { missingKey, suno } from "../../lib/suno.js";

export async function onRequestGet({ env }) {
  return missingKey(env) || suno(env, "/api/v1/generate/credit");
}
