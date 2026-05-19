# City Light Sermon Analyzer

Sermon analysis tool for City Light Church, Vicksburg, MS.
Paste a YouTube sermon link — get seeker questions and sermon notes slides.

## Files

- `public/index.html` — the full web app
- `api/analyze.js` — Claude API call (serverless function)
- `api/title.js` — YouTube title fetcher
- `api/transcript.js` — YouTube transcript fetcher
- `vercel.json` — Vercel deployment config

## Deploy to Vercel

1. Push this folder to a GitHub repository
2. Go to vercel.com → New Project → import the GitHub repo
3. Add environment variable: `ANTHROPIC_API_KEY` = your key from console.anthropic.com
4. Click Deploy

## Password

Default: `citylight2026`
To change: edit line 2 of the `<script>` tag in `public/index.html`

## Canva Template

The "Open Canva Template" button links to template ID `EAHKE92RscA`
in the brianc@citylightvicksburg.org Canva account.
