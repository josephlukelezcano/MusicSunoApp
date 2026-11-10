# STRIDE: music for your run

A run-inspired AI music generator. You pick your run type, cadence (BPM), mood and sound, then hit **START**. A full-screen "run in progress" screen tracks the generation, and the finished tracks land in your **Activity** feed, where you can play or download them.

It's built on the [Suno API](https://docs.sunoapi.org) and deployed on **Cloudflare Pages**.

## How it works

```
public/            static front end (HTML/CSS/JS, no build step)
functions/api/     Cloudflare Pages Functions (server-side, hold the API key)
  generate.js      POST /api/generate  -> Suno POST /api/v1/generate
  status.js        GET  /api/status    -> Suno GET  /api/v1/generate/record-info
  credits.js       GET  /api/credits   -> Suno GET  /api/v1/generate/credit
  callback.js      POST /api/callback  (required by Suno; acknowledged only, the UI polls)
lib/suno.js        shared helpers + request validation
```

The browser only calls `/api/*` on your own site. **The Suno API key is stored as a Cloudflare secret and never sent to the browser.** Generated tracks are saved in the browser's localStorage. Suno hosts the audio files, so download any track you want to keep.

## Deploy to Cloudflare Pages (dashboard)

1. Push this repo to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repo.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `public`
4. **Settings → Variables and Secrets**: add `SUNO_API_KEY` as type **Secret** and paste your key from sunoapi.org.
5. Redeploy. Your site will be at `https://<project>.pages.dev`.

## Deploy from the command line (alternative)

```bash
npm install
npx wrangler login
npx wrangler pages secret put SUNO_API_KEY --project-name stride-music
npm run deploy
```

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars   # then paste your key into .dev.vars
npm run dev                      # http://localhost:8788
```

`.dev.vars` is git-ignored. Never commit your API key.
