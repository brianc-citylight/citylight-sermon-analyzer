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

    // Try both known Opus Clip endpoints
    const endpoints = [
      `https://api.opus.pro/api/clips?projectId=${projectId}`,
      `https://api.opus.pro/api/exportable-clips?q=findByProjectId&projectId=${projectId}`,
      `https://api.opus.pro/api/clip-projects/${projectId}/clips`,
    ];

    const debugInfo = [];

    for (const url of endpoints) {
      try {
        const opusRes = await fetch(url, { headers: opusHeaders });
        const statusCode = opusRes.status;
        const raw = await opusRes.text();
        debugInfo.push({ url, status: statusCode, body: raw.substring(0, 300) });

        if (!opusRes.ok) continue;

        let parsed;
        try { parsed = JSON.parse(raw); } catch(e) { continue; }

        // Handle array response
        const clips = Array.isArray(parsed) ? parsed :
                      parsed.clips ? parsed.clips :
                      parsed.data ? parsed.data :
                      parsed.items ? parsed.items : null;

        if (clips && clips.length > 0) {
          const clip = clips[0];
          return res.status(200).json({
            ready: true,
            clipId: clip.id || clip.curationId || clip.clipId,
            previewUrl: clip.uriForPreview || clip.previewUrl || clip.url || '',
            exportUrl: clip.uriForExport || clip.exportUrl || '',
            durationMs: clip.durationMs || clip.duration || 0,
            debug: debugInfo
          });
        }

        // Single object response
        if (parsed && (parsed.id || parsed.curationId) && parsed.status === 'done') {
          return res.status(200).json({
            ready: true,
            clipId: parsed.id || parsed.curationId,
            previewUrl: parsed.uriForPreview || parsed.previewUrl || '',
            exportUrl: parsed.uriForExport || parsed.exportUrl || '',
            debug: debugInfo
          });
        }

      } catch (e) {
        debugInfo.push({ url, error: e.message });
      }
    }

    // Nothing found — return debug info so we can see what Opus is returning
    return res.status(200).json({ ready: false, debug: debugInfo });
  }

  return res.status(404).json({ error: 'Unknown action' });
}
