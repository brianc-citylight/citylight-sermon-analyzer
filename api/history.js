// SermonReach History API
// Uses Supabase REST API directly via fetch — no npm package required
// SUPABASE_URL and SUPABASE_SERVICE_KEY read from Vercel environment variables

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
  'apikey': process.env.SUPABASE_SERVICE_KEY,
  'Prefer': 'return=representation'
});

const db = (path) => process.env.SUPABASE_URL + '/rest/v1/' + path;

async function dbGet(path) {
  const res = await fetch(db(path), { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('DB GET error: ' + err);
  }
  return res.json();
}

async function dbPost(path, body) {
  const res = await fetch(db(path), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('DB POST error: ' + err);
  }
  return res.json();
}

async function dbPatch(path, body) {
  const res = await fetch(db(path), {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('DB PATCH error: ' + err);
  }
  return res.json();
}

async function dbDelete(path) {
  const res = await fetch(db(path), {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('DB DELETE error: ' + err);
  }
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;
  const userId = req.headers['x-user-id'];

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {

    // ── CHECK ──────────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'check') {
      const { videoId, clipMode, slideCount } = req.query;
      if (!videoId || !clipMode || !slideCount) {
        return res.status(400).json({ error: 'Missing fields' });
      }
      const data = await dbGet(
        `sermon_analyses?user_id=eq.${userId}&video_id=eq.${encodeURIComponent(videoId)}&clip_mode=eq.${encodeURIComponent(clipMode)}&slide_count=eq.${parseInt(slideCount)}&order=created_at.desc&limit=1&select=id,sermon_title,sermon_date,clip_mode,slide_count,speaker,created_at`
      );
      return res.status(200).json({ match: data && data.length > 0 ? data[0] : null });
    }

    // ── LOAD ALL ───────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'load') {
      const data = await dbGet(
        `sermon_analyses?user_id=eq.${userId}&order=created_at.desc&limit=10`
      );
      return res.status(200).json({ analyses: data || [] });
    }

    // ── GET ONE ────────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'get') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const data = await dbGet(
        `sermon_analyses?id=eq.${id}&user_id=eq.${userId}&limit=1`
      );
      return res.status(200).json({ analysis: data && data.length > 0 ? data[0] : null });
    }

    // ── SAVE ───────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'save') {
      const {
        videoId, sermonTitle, sermonDate, clipMode,
        slideCount, speaker, questions, slides, summary, customQ,
        sourceType
      } = req.body;

      if (!videoId || !sermonTitle || !clipMode) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if matching record exists
      const existing = await dbGet(
        `sermon_analyses?user_id=eq.${userId}&video_id=eq.${encodeURIComponent(videoId)}&clip_mode=eq.${encodeURIComponent(clipMode)}&slide_count=eq.${parseInt(slideCount)}&limit=1&select=id`
      );

      let savedId;

      if (existing && existing.length > 0) {
        // Update existing
        const updated = await dbPatch(
          `sermon_analyses?id=eq.${existing[0].id}&user_id=eq.${userId}`,
          {
            sermon_title: sermonTitle,
            sermon_date: sermonDate,
            speaker: speaker || null,
            questions: questions || [],
            slides: slides || [],
            summary: summary || '',
            custom_q: customQ || null,
            source_type: sourceType || 'youtube',
            created_at: new Date().toISOString()
          }
        );
        savedId = existing[0].id;
      } else {
        // Insert new
        const inserted = await dbPost('sermon_analyses', {
          user_id: userId,
          video_id: videoId,
          sermon_title: sermonTitle,
          sermon_date: sermonDate,
          clip_mode: clipMode,
          slide_count: parseInt(slideCount),
          speaker: speaker || null,
          questions: questions || [],
          slides: slides || [],
          summary: summary || '',
          custom_q: customQ || null,
          source_type: sourceType || 'youtube' 
        });
        savedId = inserted && inserted[0] ? inserted[0].id : null;
      }

      // Trim to 10 most recent
      const allRecords = await dbGet(
        `sermon_analyses?user_id=eq.${userId}&order=created_at.desc&select=id`
      );
      if (allRecords && allRecords.length > 10) {
        const toDelete = allRecords.slice(10).map(r => r.id);
        for (const id of toDelete) {
          await dbDelete(`sermon_analyses?id=eq.${id}&user_id=eq.${userId}`);
        }
      }

      return res.status(200).json({ success: true, id: savedId });
    }

    // ── PUBLISH ────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'publish') {
      const { analysisId, clipIndex, platform, postId } = req.body;

      if (!analysisId || clipIndex === undefined || !platform) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Fetch current questions
      const records = await dbGet(
        `sermon_analyses?id=eq.${analysisId}&user_id=eq.${userId}&limit=1&select=questions`
      );
      if (!records || records.length === 0) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      const questions = records[0].questions || [];
      if (!questions[clipIndex]) {
        return res.status(400).json({ error: 'Clip index out of range' });
      }

      if (!questions[clipIndex].published) {
        questions[clipIndex].published = {};
      }

      const { type, scheduledFor } = req.body;

      if (type === 'scheduled' && scheduledFor) {
        // Scheduled post — record when it was scheduled and when it will post
        questions[clipIndex].published[platform] = {
          type: 'scheduled',
          scheduledAt: new Date().toISOString(),
          scheduledFor: new Date(scheduledFor).toISOString(),
          postId: postId || null
        };
      } else {
        // Immediate publish
        questions[clipIndex].published[platform] = {
          type: 'immediate',
          publishedAt: new Date().toISOString(),
          postId: postId || null
        };
      }

      await dbPatch(
        `sermon_analyses?id=eq.${analysisId}&user_id=eq.${userId}`,
        { questions }
      );

      return res.status(200).json({ success: true, questions });
    }

    return res.status(404).json({ error: 'Unknown action' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
