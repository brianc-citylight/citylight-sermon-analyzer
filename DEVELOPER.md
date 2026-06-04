# SermonReach — Developer Reference
### City Light Church, Vicksburg MS

This document covers the complete technical architecture of SermonReach for any developer picking up this codebase. Read this before touching anything.

---

## Stack Overview

| Layer | Technology |
|---|---|
| Frontend | Single-page HTML/CSS/JS (`index.html`) |
| Backend | Vercel Serverless Functions (Node.js) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Database | Supabase (PostgreSQL with RLS) |
| Video Storage | Backblaze B2 (`CityLightSermons` bucket) |
| Transcription | AssemblyAI |
| AI Analysis | Anthropic Claude (`claude-sonnet-4-6`) |
| Clip Creation | Opus Clip API |
| Social Publishing | Opus Clip API (`post-tasks` + `publish-schedules`) |
| Deployment | Vercel (auto-deploy from GitHub main branch) |

---

## Repository Structure

```
index.html                    — full single-page app (~3500 lines)
package.json                  — type: module, no build step
vercel.json                   — function timeouts per endpoint
README.md                     — stakeholder overview
DEVELOPER.md                  — this file

api/
  analyze.js                  — Claude API: clips, slides, summary
  title.js                    — YouTube oEmbed title fetch
  transcript.js               — Supadata YouTube transcript fetch
  transcript-drive.js         — AssemblyAI transcription (upload path)
  b2-upload.js                — Backblaze B2 upload: get-upload-url, get-public-url
  opus.js                     — Opus Clip: create, poll, publish, schedule, accounts
  opus-upload.js              — Opus GCS upload: initiate resumable session
  library.js                  — Shared sermon library CRUD
  admin.js                    — Team management and invites
  history.js                  — Analysis history CRUD
  config.js                   — Delivers Supabase public keys to frontend

images/
  CityLightLogo.png           — Church logo used in slides
  favicon.ico / .svg / .png   — Favicon set
  site.webmanifest            — PWA manifest
  web-app-manifest-*.png      — PWA icons
```

---

## Environment Variables

All set in Vercel. Never commit these to the repo.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API for sermon analysis |
| `ASSEMBLYAI_API_KEY` | AssemblyAI transcription |
| `OPUS_API_KEY` | Opus Clip clip creation and publishing |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public anon key (safe for frontend) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only) |
| `B2_KEY_ID` | Backblaze B2 key ID |
| `B2_APP_KEY` | Backblaze B2 application key |
| `B2_BUCKET_ID` | Backblaze B2 bucket ID (`CityLightSermons`) |

---

## Database Schema (Supabase)

### `organizations`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Church name |

City Light org ID: `9931cb42-e87e-42d4-b62b-156de98069e1`

### `org_members`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `org_id` | uuid | FK to organizations |
| `user_id` | uuid | FK to auth.users |
| `role` | text | `admin` or `member` |
| `created_at` | timestamptz | |

Admin user ID: `05b384e6-7143-404b-915f-5fdb6fec818c` (Brian Crawford)

### `sermon_analyses`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `org_id` | uuid | FK to organizations |
| `video_id` | text | YouTube video ID or B2 public URL |
| `sermon_title` | text | |
| `sermon_date` | text | |
| `speaker` | text | |
| `clip_mode` | text | `outreach`, `discipleship`, or `custom` |
| `slide_count` | int | 3, 4, or 5 |
| `questions` | jsonb | Array of clip question objects |
| `slides` | jsonb | Array of slide objects |
| `summary` | text | Sermon summary text |
| `custom_q` | text | Custom question if applicable |
| `source_type` | text | `youtube` or `upload` |
| `created_at` | timestamptz | |

A pg_cron job purges records older than 60 days nightly at 2am UTC.

### `sermon_library`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `org_id` | uuid | FK to organizations |
| `title` | text | |
| `sermon_date` | text | |
| `speaker` | text | |
| `b2_url` | text | Backblaze B2 public URL — permanent storage |
| `opus_upload_id` | text | Reserved — not currently used reliably |
| `uploaded_by` | uuid | FK to auth.users |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | 60 days from created_at |

B2 lifecycle rule: files hide at 60 days, delete at 61 days. The `expires_at` field matches this.

---

## Two Video Source Paths

### YouTube Path
1. User pastes YouTube URL
2. `api/title.js` fetches sermon title via oEmbed
3. `api/transcript.js` fetches transcript via Supadata API
4. `api/analyze.js` sends transcript to Claude
5. Claude returns `Q|` clip lines, slide blocks, and summary separated by `---SLIDES---` and `---SUMMARY---` delimiters
6. `index.html` parses the result and renders three tabs

### Upload Path
1. User enters sermon title, selects MP4 file
2. Browser uploads directly to Backblaze B2 via XHR (CORS enabled on bucket)
3. B2 public URL passed to `api/transcript-drive.js`
4. AssemblyAI submits transcription job, polls until complete
5. `transcript-drive.js` fetches paragraph-level timestamps from AssemblyAI `/paragraphs` endpoint
6. Transcript formatted as `[MM:SS] paragraph text` blocks
7. `api/analyze.js` sends timestamped transcript to Claude
8. Same parsing and rendering as YouTube path
9. Sermon saved to library (`api/library.js`)
10. Background: `api/opus-upload.js` initiates Opus GCS upload — `uploadId` set in session memory

---

## Claude Output Format

The prompt instructs Claude to return a single response with three sections separated by delimiters:

```
Q|[question]|[MM:SS]-[MM:SS]|[caption]
Q|[question]|[MM:SS]-[MM:SS]|[caption]
... (5 Q lines)
---SLIDES---
TITLE_SLIDE
Sermon Title: [title]
Sermon Date: [date]
Speaker: [speaker]

INTRO_SLIDE
Scripture: [reference]
Key Point: [text]

SLIDE_1
Subpoint: [text]
Key Takeaway: [text]
Key Reflection: [text]
Scripture: [reference]

... (up to SLIDE_5)
---SUMMARY---
[500 word narrative summary]
```

### Slide Field Whitelist
`parseSlidesFromRaw()` only accepts these field names — anything else is rejected to prevent summary bleed-through:
- `Sermon Title`, `Sermon Date`, `Speaker`
- `Scripture`, `Key Point`
- `Subpoint`, `Key Takeaway`, `Key Reflection`

### Custom Mode NOANSWER
When custom mode cannot find relevant content the response is:
```
NOANSWER|[explanation of what the sermon is actually about]
```
The app catches this, shows the explanation to the user, and stops execution cleanly.

---

## Opus Clip Integration

### Clip Creation Flow
1. `sendToOpus()` in `index.html` calls `POST /api/opus?action=create`
2. `api/opus.js` calls `POST https://api.opus.pro/api/clip-projects`
3. Request body includes `videoUrl` (B2 URL or YouTube URL), `curationPref` with `range` timestamps and `clipDurations: [[30, 90]]`
4. Returns `projectId`
5. `pollForCompletion()` polls `GET /api/opus?action=poll` every 15 seconds
6. Poll checks three Opus endpoints until a clip is found

### Zero-Credit Session Clips
When a user uploads a new sermon:
1. `api/opus-upload.js` calls Opus `upload-links` to get a GCS URL and `uploadId`
2. Opus `upload-init` starts a GCS resumable session, returns a `location` URL
3. Browser PUTs the video file directly to the GCS location via XHR
4. On completion (including after CORS-blocked response), `currentOpusUploadId` is set in session memory
5. Subsequent clips in the same session use the `uploadId` as `videoUrl` — Opus recognizes the file and does not charge credits
6. The `uploadId` is **session-only** — it is ephemeral on Opus's servers (clears after hours/days). It is never persisted to the database. When the session ends, future clips fall back to the B2 URL and charge credits normally.

### Publishing
- **Immediate:** `POST https://api.opus.pro/api/post-tasks`
- **Scheduled:** `POST https://api.opus.pro/api/publish-schedules` with `publishAt` as ISO 8601 UTC string

---

## Backblaze B2

Bucket: `CityLightSermons` (public)

CORS rules allow `sermonreach.citylightvicksburg.org` for:
- `b2_upload_file` — browser uploads
- `b2_download_file_by_name` — browser fetches (needed for Opus GCS upload flow)
- `b2_download_file_by_id`

Lifecycle rule: files hide at 60 days, delete at 61 days.

---

## Key Frontend Variables (Session State)

| Variable | Purpose |
|---|---|
| `currentSourceMode` | `'youtube'` or `'upload'` |
| `currentVideoId` | YouTube video ID or B2 URL |
| `currentUploadId` | B2 public URL for uploaded sermons |
| `currentOpusUploadId` | Opus GCS `uploadId` — session only, never persisted |
| `currentQuestions` | Array of clip question objects |
| `currentSlides` | Array of parsed slide objects |
| `currentSummary` | Sermon summary text |
| `currentUser` | Supabase auth user object |
| `youtubeUrl` | Current YouTube URL |
| `sermonTitle` | Current sermon title |

---

## Design System

Dark urban theme. CSS variables defined in `index.html` `<style>` block:

| Variable | Value | Use |
|---|---|---|
| `--black` | `#0a0a0a` | Page background |
| `--surface` | `#111111` | Card backgrounds |
| `--surface2` | `#1a1a1a` | Input backgrounds |
| `--surface3` | `#222222` | Hover states |
| `--gold` | `#C9A84C` | Primary accent |
| `--white` | `#ffffff` | Primary text |
| `--text` | `#e8e8e8` | Body text |
| `--text-dim` | `#a0a0a0` | Secondary text |
| `--gray` | `#666666` | Tertiary text |
| `--border` | `#2a2a2a` | Borders |
| `--border-light` | `#333333` | Light borders |

Font: Inter (Google Fonts), weights 300–900.

---

## Known Design Decisions

**Why B2 for storage instead of Supabase Storage?**
B2 is cheaper at scale, has no egress fees for public files, and supports direct browser uploads with CORS. Supabase Storage would add cost and complexity for large video files.

**Why AssemblyAI for upload transcription instead of Whisper or Supadata?**
AssemblyAI returns paragraph-level timestamps in milliseconds which get converted to `[MM:SS]` markers. These markers are embedded in the transcript so Claude can anchor clip timestamps to real positions in the video rather than guessing.

**Why two separate transcript APIs?**
YouTube transcripts come from Supadata (faster, no processing time). Uploaded files go through AssemblyAI (required for timestamp accuracy on raw video).

**Why session-only Opus uploadId?**
Opus's GCS cache is ephemeral — raw video files are pruned after hours to days. Persisting the `uploadId` to the database creates stale references that cause `ENOENT` errors. The correct pattern is use the `uploadId` within the session it was created, then fall back to B2 URL for future sessions.

**Why no build step?**
The app is a single HTML file with vanilla JS. No framework, no bundler, no compilation. This keeps deployment simple and Vercel serverless functions handle all API logic. The tradeoff is a large `index.html` but it avoids build tooling complexity entirely.

---

## Commercialization Roadmap (Not Yet Built)

1. Church branding settings — logo, colors, hashtags, church name per org
2. Opus Clip platform account — per-church sub-accounts and credit pools
3. Stripe billing and subscriptions
4. Self-service signup and onboarding flow
5. Admin dashboard for platform management
6. Per-church B2 bucket isolation
7. AssemblyAI per-org usage tracking
8. Landing page and marketing site

The `org_id` field in all database tables was built deliberately to support multi-church architecture when the time comes.

---

## Deployment

Push to `main` branch on GitHub. Vercel auto-deploys within 30-60 seconds. No manual steps required.

Production URL: `https://sermonreach.citylightvicksburg.org`
GitHub: `https://github.com/brianc-citylight/citylight-sermon-analyzer`
