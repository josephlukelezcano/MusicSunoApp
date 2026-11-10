// Cloudflare Worker entry: serves /api/* (Suno proxy) and lets static assets in /public handle the rest.
import { json, missingKey, suno, buildGeneratePayload } from "../lib/suno.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (pathname === "/api/callback" && method === "POST") {
      // Required by Suno; the UI polls /api/status, so just acknowledge.
      return json({ ok: true });
    }

    if (pathname.startsWith("/api/")) {
      const err = missingKey(env);
      if (err) return err;

      if (pathname === "/api/generate" && method === "POST") {
        let input;
        try {
          input = await request.json();
        } catch {
          return json({ code: 400, msg: "Invalid JSON" }, 400);
        }
        let payload;
        try {
          payload = buildGeneratePayload(input, url.origin);
        } catch (e) {
          return json({ code: 400, msg: e.message }, 400);
        }
        return suno(env, "/api/v1/generate", { method: "POST", body: payload });
      }

      if (pathname === "/api/status" && method === "GET") {
        const taskId = url.searchParams.get("taskId");
        if (!taskId || !/^[\w-]{1,128}$/.test(taskId)) return json({ code: 400, msg: "Bad taskId" }, 400);
        return suno(env, `/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`);
      }

      if (pathname === "/api/credits" && method === "GET") {
        return suno(env, "/api/v1/generate/credit");
      }

      return json({ code: 404, msg: "Not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
