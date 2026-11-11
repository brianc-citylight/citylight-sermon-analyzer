# SermonReach
### City Light Church, Vicksburg, MS

SermonReach is a sermon content tool that turns any Sunday message into a full week of content. From a single analysis it produces five short-form video clips with captions, a set of branded sermon notes slides, and a narrative summary, all ready to publish directly to Instagram, Facebook, and YouTube. It also writes three short devotions and a small group discussion guide that you can edit and download as PDFs.

---

## What It Does

**Sermon Clips**
SermonReach identifies the five most compelling moments in a sermon and generates precise video clips from those timestamps. Each clip comes with an editable social media caption written in the voice of a connected community member. Clips can be published immediately or scheduled for a future date and time.

Three clip focus modes:
- **Outreach**: finds moments that speak to people outside the faith
- **Discipleship**: finds moments for growing believers
- **Custom**: you enter a specific question; SermonReach finds relevant moments or tells you clearly if the sermon does not address it

**Sermon Notes Slides**
A branded slide deck in four theme options: one title slide, one scripture slide, three key idea slides, and one call to action slide. Each slide is 1080x1080 and ready for an Instagram carousel. Download all six as one zip file, export the full deck as HTML, or download individual slides as PNG.

**Sermon Summary**
A narrative summary of 500 words or less, written for social media. Ready to post as a caption on Instagram, Facebook, or YouTube.

**Devotions**
Three devotions, labeled Day 1 to Day 3, taken straight from the sermon. Each has a title, a scripture reference, a reading of 250 to 400 words (about 2 to 3 minutes), one reflection question, and one action. If the preacher read a verse aloud that fits the devotion, that verse is shown with the reference. A verse is only shown when its wording matches the transcript; otherwise only the reference appears. Every part is editable in the app, and any single day can be regenerated.

**Discussion Guide**
An editable small group guide with the big idea, the sermon points with scripture references, discussion questions, one or two weekly applications, and a closing prayer.

**PDF Downloads**
Devotions and the Discussion Guide download as PDFs with the City Light logo, a gold rule, and page numbers. The PDFs are set so that copying and editing are turned off. This is a speed bump, not real security, because free tools can remove it. Keep the editable version in the app and share the PDF.

Devotions and the guide are generated on demand from their own tabs, and edits save automatically to the sermon's History record.

---

## Video Sources

**YouTube**
Paste a YouTube link. SermonReach tries to fetch the transcript automatically. If the auto-fetch fails, paste the transcript manually using the link below the input field. Pasting the transcript gives the best results.

**Upload Video File**
Upload an MP4 or MOV file (500 MB or smaller). SermonReach stores it securely in your team's cloud storage, transcribes it automatically with precise timestamps, and saves it to the shared Sermon Library for your whole team.

---

## Sermon Library

Uploaded sermons are saved to a shared library accessible to everyone on your team. Any team member can load a previously uploaded sermon instantly without re-uploading. Each sermon stays available for 60 days. The library shows the sermon title, date, speaker, and days remaining.

---

## Publishing and Scheduling

Clips are sent to Opus Clip for processing. Once ready, each clip can be:
- **Published immediately** to Instagram, Facebook, or YouTube
- **Scheduled** for a specific future date and time

Create no more than two clips at a time. Wait for each to finish processing before creating the next. If you are working with a freshly uploaded video in the same session, creating all five clips in that session saves credits.

---

## Team

SermonReach supports multiple team members under one organization. The admin (Pastor Brian Crawford) can invite new members by email and remove members from the Team Management panel. Each team member signs in with their own account and has access to the shared sermon library and analysis history.

---

## Analysis History

SermonReach saves your last 10 analyses automatically. Open Analysis History from the menu to restore any previous analysis instantly. Slides, clips, summary, devotions, and the discussion guide, including your edits, come back exactly as you left them.

The sermon transcript is saved with each new analysis, so devotions, the guide, and caption rewrites still use the preacher's own words after you reload a sermon. Sermons analyzed before this feature was added have no saved transcript. For those, devotions and the guide are built from the summary until a transcript is pasted into the tab, and the pasted transcript is saved for next time.

---

## Admin Setup Notes

Run these once in the Supabase SQL editor. Devotions and guide edits will not save, and transcripts will not be stored, until they are run:

```sql
alter table sermon_analyses add column if not exists extras jsonb;
alter table sermon_analyses add column if not exists transcript text;
```

PDF downloads load the jsPDF library from jsDelivr, so the browser needs internet access for that button to work.

---

## Access

**Web:** [sermonreach.citylightvicksburg.org](https://sermonreach.citylightvicksburg.org)

Sign in with your email and password or continue with Google. Contact Pastor Brian at brianc@citylightvicksburg.org to request access.

---

## Built For

City Light Church, Vicksburg MS, currently in active use by the City Light communications team.
