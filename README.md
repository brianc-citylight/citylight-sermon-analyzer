# City Light Sermon Analyzer

Sermon content tool for City Light Church, Vicksburg, MS.
Paste a YouTube sermon link and get five outputs every Tuesday.

## What It Does

1. Seeker Questions — Top 5 culturally resonant questions the sermon answers, each with timestamps and a social media caption
2. Sermon Notes Slides — 3 to 5 branded slide content cards ready to copy into Canva or generate as PNG images
3. Sermon Summary — 500 word or less narrative summary ready to post to social media
4. Opus Clip — Sends exact clip windows to Opus Clip for video production, then publishes to Instagram and Facebook
5. Slide Images — Generates branded 1080x1080 PNG slide images per slide, ready to download and post

## File Structure

```
index.html          — the full web app (single page)
package.json        — Node dependencies for Puppeteer slide rendering
vercel.json         — Vercel function configuration
README.md           — this file

api/
  analyze.js        — Claude API call for sermon analysis
  title.js          — YouTube title fetcher
  transcript.js     — YouTube transcript fetcher
  opus.js           — Opus Clip integration (create, poll, accounts, publish)
  slides.js         — Puppeteer slide image renderer
```

## Deploy to Vercel

1. Push all files to GitHub maintaining the folder structure above
2. Go to vercel.com, import the GitHub repo
3. Add environment variable: ANTHROPIC_API_KEY (from console.anthropic.com)
4. Deploy

## Passwords and Keys

- Staff password: paste from your Notes app each session
- Anthropic API key: paste from your Notes app each session
- Opus Clip API key: paste from your Notes app each session
- Keys are never stored — paste fresh each session

## Canva Template

Template ID: EAHKE92RscA
Account: brianc@citylightvicksburg.org
Open template link: https://www.canva.com/design?create=true&template=EAHKE92RscA

## Opus Clip

Connected accounts: City Light Church Instagram and City Light Church Facebook
Plan: supports 4 concurrent projects and 900 credits per month
Send no more than 3 clips at a time

## Weekly Timeline

Tuesday: Sermon available on YouTube. Run analysis.
Wednesday: Post content to Instagram and Facebook.

## To Change the Staff Password

Edit line 1 of the script tag in index.html:
const CORRECT_PASSWORD = 'XXXXXXXXXX';
