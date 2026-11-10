# STRIDE: music for your run

A run-inspired AI music generator. You pick your run type, cadence (BPM), mood and sound, then hit **START**. A full-screen "run in progress" screen tracks the generation, and the finished tracks land in your **Activity** feed, where you can play or download them.

It's built on the [Suno API](https://docs.sunoapi.org) and deployed as a **Cloudflare Worker** with static assets.

## How it works

```
public/          static front end (HTML/CSS/JS, no build step)
src/worker.js    Worker: handles /api/*, everything else is served from public/
  POST /api/generate  -> Suno POST /api/v1/generate
  GET  /api/status    -> Suno GET  /api/v1/generate/record-info
  GET  /api/credits   -> Suno GET  /api/v1/generate/credit
  POST /api/callback  (required by Suno; acknowledged only, the UI polls)
lib/suno.js      shared helpers + request validation
wrangler.toml    Worker config
```

The browser only calls `/api/*` on your own site. **The Suno API key is stored as a Cloudflare secret and never sent to the browser.** Generated tracks are saved in the browser's localStorage. Suno hosts the audio files, so download any track you want to keep.

## Deploy to Cloudflare (dashboard, connected to GitHub)

1. In Cloudflare, go to **Workers & Pages → Create → Import a repository** and pick this repo.
2. Deploy command: `npx wrangler deploy` (the default). No build command is needed.
3. The `name` in `wrangler.toml` must match the Worker's name in the dashboard. Edit one of them if they differ.
4. In the Worker, open **Settings → Variables and Secrets** and add `SUNO_API_KEY` as type **Secret**, using your key from sunoapi.org.
5. Redeploy. Your site will be at `https://<worker-name>.<your-subdomain>.workers.dev`.

## Deploy from the command line (alternative)

```bash
npm install
npx wrangler login
npx wrangler secret put SUNO_API_KEY
npm run deploy
```

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars   # then paste your key into .dev.vars
npm run dev                      # http://localhost:8787
```

`.dev.vars` is git-ignored. Never commit your API key.
