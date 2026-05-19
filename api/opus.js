export default async function handler(req, res) {
  // CORS headers for browser access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-opus-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const opusKey = req.headers['x-opus-key'];
  if (!opusKey) {
    return res.status(400).json({ error: 'Missing Opus Clip API key' });
  }

  const opusHeaders = {
    'Authorization': 'Bearer ' + opusKey,
    'Content-Type': 'application/json'
  };

  // ── CREATE PROJECT ────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.query.action === 'create') {
    const { videoUrl, startSec, endSec, question } = req.body;

    const clipDuration = endSec - startSec;

    // Enforce 30 second minimum clip length
    // If the identified window is shorter than 30s, expand it symmetrically
    let adjustedStart = startSec;
    let adjustedEnd = endSec;
    if (clipDuration < 30) {
      const deficit = 30 - clipDuration;
      adjustedStart = Math.max(0, startSec - Math.ceil(deficit / 2));
      adjustedEnd = endSec + Math.floor(deficit / 2);
    }
    const adjustedDuration = adjustedEnd - adjustedStart;
    const minDuration = Math.max(30, adjustedDuration - 5);
    const maxDuration = adjustedDuration + 20;

    const body = {
      videoUrl,
      curationPref: {
        range: { startSec: adjustedStart, endSec: adjustedEnd },
        clipDurations: [[minDuration, maxDuration]],
        topicKeywords: [question.substring(0, 80)],
        genre: 'Auto',
        skipCurate: true
      },
      importPref: { sourceLang: 'en' }
    };

    try {
      const opusRes = await fetch('https://api.opus.pro/api/clip-projects', {
        method: 'POST',
        headers: opusHeaders,
        body: JSON.stringify(body)
      });
      const data = await opusRes.json();
      if (!opusRes.ok) {
        return res.status(opusRes.status).json({ error: data.message || data.error || 'Opus Clip error' });
      }
      return res.status(200).json({ projectId: data.id || data.projectId });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POLL FOR CLIPS ────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.query.action === 'poll') {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

    try {
      const opusRes = await fetch(
        `https://api.opus.pro/api/exportable-clips?q=findByProjectId&projectId=${projectId}`,
        { headers: opusHeaders }
      );
      if (!opusRes.ok) {
        return res.status(opusRes.status).json({ ready: false, error: 'Poll failed' });
      }
      const clips = await opusRes.json();
      if (clips && clips.length > 0) {
        const clip = clips[0];
        return res.status(200).json({
          ready: true,
          clipId: clip.id || clip.curationId,
          previewUrl: clip.uriForPreview || '',
          exportUrl: clip.uriForExport || '',
          durationMs: clip.durationMs || 0
        });
      }
      return res.status(200).json({ ready: false });
    } catch (e) {
      return res.status(500).json({ ready: false, error: e.message });
    }
  }

  return res.status(404).json({ error: 'Unknown action' });
}
