# SermonReach — City Light Church

Sermon content tool for City Light Church, Vicksburg, MS.
Paste a YouTube sermon link every Tuesday and get three outputs ready to post by Wednesday.

## What It Does

1. **Sermon Summary** — 500 word or less narrative summary ready to post as a text caption on Instagram, Facebook, or YouTube
2. **Sermon Notes Slides** — 3 to 5 branded 1080x1080 slide images in four theme options, ready to post as a carousel
3. **Sermon Clips** — Top 5 clips in three focus modes: Outreach (for people outside the faith), Discipleship (for growing believers), or Custom (a specific question). Each clip includes a timestamp, social media caption, and direct publishing to Instagram, Facebook, and YouTube Shorts via Opus Clip

## File Structure

```
index.html              — the full web app (single page, includes html2canvas slide rendering)
package.json            — Node dependencies
vercel.json             — Vercel function configuration
README.md               — this file

api/
  analyze.js            — Claude API call for sermon analysis (reads ANTHROPIC_API_KEY)
  title.js              — YouTube title fetcher
  transcript.js         — YouTube transcript fetcher via Supadata
  opus.js               — Opus Clip integration (create, poll, accounts, publish)
  config.js             — Delivers Supabase credentials to frontend
  history.js            — Analysis history and publish tracking (reads SUPABASE_SERVICE_KEY)
  test-transcript.js    — Diagnostic endpoint for transcript testing

images/
  CityLightLogo.png     — City Light logo used in slide exports
  Slide Templates/      — Four cover and detail slide theme reference images
```

## Deploy to Vercel

1. Push all files to GitHub maintaining the folder structure above
2. Go to vercel.com and import the GitHub repo
3. Add all environment variables listed below
4. Deploy

## Environment Variables (Vercel)

All keys are stored securely in Vercel environment variables. Never put them in code.

| Variable | Source |
|---|---|
| ANTHROPIC_API_KEY | console.anthropic.com |
| SUPADATA_API_KEY | supadata.ai dashboard |
| OPUS_API_KEY | Opus Clip dashboard |
| SUPABASE_URL | Supabase project settings → API |
| SUPABASE_ANON_KEY | Supabase project settings → API |
| SUPABASE_SERVICE_KEY | Supabase project settings → API (service_role) |

## Supabase Database

Table: `sermon_analyses`
Stores the last 10 analyses per user including questions, slides, summary, and publish tracking.
Row Level Security must be enabled with a policy allowing users to manage only their own rows.

SQL policy:
```sql
create policy "Users can manage own analyses"
on sermon_analyses
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## Authentication

SermonReach uses Supabase Auth. Staff sign in with email and password or Google.
To add a new user: Supabase dashboard → Authentication → Users → Add user → Create new user.
To change a password: user clicks hamburger menu → My Account → Update Password.

## Opus Clip

Connected accounts: City Light Church Instagram, City Light Church Facebook, City Light Church YouTube
Plan: supports 4 concurrent projects and 900 credits per month
Send no more than 3 clips at a time. Wait for each to finish before sending more.

## Slide Themes

Four themes available in the Sermon Notes Slides tab:
1. City Light — white background, gold and black
2. Navy — deep navy background, white text
3. Warm Brown — warm brown background, white text
4. Slate — medium gray background, white text

All slides export at 1080x1080 for Instagram carousel format.

## Analysis History

SermonReach stores the last 10 analyses per user account in Supabase.
Before running a new analysis, the app checks if an identical one already exists and prompts the user to load it instead of re-running.
Publish tracking is stored per clip so published badges persist across sessions.

## Weekly Timeline

Tuesday: Sermon available on YouTube. Run analysis.
Wednesday: Post content to Instagram, Facebook, and YouTube Shorts.
