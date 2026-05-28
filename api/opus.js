// SermonReach — Opus Clip Integration
// Handles clip creation, polling, social account fetching,
// immediate publishing, and scheduled publishing
// Reads OPUS_API_KEY from Vercel environment variables

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const opusKey = process.env.OPUS_API_KEY;
  if (!opusKey) {
    return res.status(500).json({ error: 'Opus Clip API key not configured in environment variables' });
  }

  const opusHeaders = {
    'Authorization': 'Bearer ' + opusKey,
    'Content-Type': 'application/json'
  };

  // ── CREATE PROJECT ────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.query.action === 'create') {
    const { videoUrl, startSec, endSec, question } = req.body;

    let adjustedStart = startSec;
    let adjustedEnd = endSec;
    const clipDuration = endSec - startSec;

    // Enforce 30 second minimum
    if (clipDuration < 30) {
      const deficit = 30 - clipDuration;
      adjustedStart = Math.max(0, startSec - Math.ceil(deficit / 2));
      adjustedEnd = endSec + Math.floor(deficit / 2);
    }

    // Enforce 90 second maximum — hard cap for all platforms
    if (adjustedEnd - adjustedStart > 90) {
      adjustedEnd = adjustedStart + 90;
    }

    const adjustedDuration = adjustedEnd - adjustedStart;
    const minDuration = Math.max(30, adjustedDuration - 5);
    const maxDuration = Math.min(90, adjustedDuration + 5);

    const body = {
      title: question.substring(0, 100),
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

    const endpoints = [
      'https://api.opus.pro/api/clips?projectId=' + projectId,
      'https://api.opus.pro/api/exportable-clips?q=findByProjectId&projectId=' + projectId,
      'https://api.opus.pro/api/clip-projects/' + projectId + '/clips',
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

        const clips = Array.isArray(parsed) ? parsed :
                      parsed.clips ? parsed.clips :
                      parsed.data ? parsed.data :
                      parsed.items ? parsed.items : null;

        if (clips && clips.length > 0) {
          const clip = clips[0];
          const rawId = clip.id || clip.curationId || clip.clipId || '';
          const cleanClipId = rawId.includes('.') ? rawId.split('.').pop() : rawId;
          return res.status(200).json({
            ready: true,
            clipId: cleanClipId,
            rawClipId: rawId,
            previewUrl: clip.uriForPreview || clip.previewUrl || clip.url || '',
            exportUrl: clip.uriForExport || clip.exportUrl || '',
            durationMs: clip.durationMs || clip.duration || 0,
            debug: debugInfo
          });
        }

        if (parsed && (parsed.id || parsed.curationId) && parsed.status === 'done') {
          const rawId = parsed.id || parsed.curationId;
          const cleanClipId = rawId.includes('.') ? rawId.split('.').pop() : rawId;
          return res.status(200).json({
            ready: true,
            clipId: cleanClipId,
            rawClipId: rawId,
            previewUrl: parsed.uriForPreview || parsed.previewUrl || '',
            exportUrl: parsed.uriForExport || parsed.exportUrl || '',
            debug: debugInfo
          });
        }

      } catch (e) {
        debugInfo.push({ url, error: e.message });
      }
    }

    return res.status(200).json({ ready: false, debug: debugInfo });
  }

  // ── GET SOCIAL ACCOUNTS ──────────────────────────────────────────────────
  if (req.method === 'GET' && req.query.action === 'accounts') {
    try {
      const opusRes = await fetch('https://api.opus.pro/api/social-accounts?q=mine', { headers: opusHeaders });
      const raw = await opusRes.text();
      let data;
      try { data = JSON.parse(raw); } catch(e) {
        return res.status(opusRes.status).json({ error: 'Opus Clip returned: ' + raw.substring(0, 100) });
      }
      if (!opusRes.ok) {
        return res.status(opusRes.status).json({ error: data.message || data.error || 'Failed to fetch accounts' });
      }
      const allAccounts = data.accounts || data.data || data || [];
      const accounts = allAccounts.filter(a =>
        (a.platform === 'INSTAGRAM_BUSINESS' || a.platform === 'FACEBOOK_PAGE' || a.platform === 'YOUTUBE') &&
        (a.extUserName === 'City Light Church' || a.platform === 'YOUTUBE')
      );
      return res.status(200).json({ accounts });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PUBLISH NOW ───────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.query.action === 'publish') {
    const { projectId, clipId, postAccountId, subAccountId, title, description } = req.body;

    if (!projectId || !clipId || !postAccountId || !title) {
      return res.status(400).json({ error: 'Missing required publish fields' });
    }

    const postDetail = {
      title: title.substring(0, 150),
      mediaType: 'video',
      custom: { description: description || '', privacy: 'public' }
    };

    const clipIdVariants = [clipId];
    if (!clipId.includes('.') && projectId) clipIdVariants.push(projectId + '.' + clipId);
    if (clipId.includes('.')) clipIdVariants.push(clipId.split('.').pop());

    let lastError = null;
    for (const tryClipId of clipIdVariants) {
      const body = { projectId, clipId: tryClipId, postAccountId, postDetail };
      if (subAccountId && subAccountId !== 'null' && subAccountId !== 'undefined') {
        body.subAccountId = subAccountId;
      }
      try {
        const opusRes = await fetch('https://api.opus.pro/api/post-tasks', {
          method: 'POST',
          headers: opusHeaders,
          body: JSON.stringify(body)
        });
        const raw = await opusRes.text();
        let data;
        try { data = JSON.parse(raw); } catch(e) { data = { raw }; }
        if (opusRes.ok) {
          return res.status(200).json({ success: true, postId: data.data?.postId || '', clipIdUsed: tryClipId });
        }
        lastError = { error: data.message || data.errorName || data.error || 'Publish failed', detail: data, sentBody: body };
      } catch (e) {
        lastError = { error: e.message };
      }
    }
    return res.status(400).json(lastError || { error: 'Publish failed' });
  }

  // ── SCHEDULE ──────────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.query.action === 'schedule') {
    const { projectId, clipId, postAccountId, subAccountId, title, description, scheduledTimestamp } = req.body;

    if (!projectId || !clipId || !postAccountId || !title || !scheduledTimestamp) {
      return res.status(400).json({ error: 'Missing required schedule fields' });
    }

    const postDetail = {
      title: title.substring(0, 150),
      mediaType: 'video',
      custom: { description: description || '', privacy: 'public' }
    };

    const clipIdVariants = [clipId];
    if (!clipId.includes('.') && projectId) clipIdVariants.push(projectId + '.' + clipId);
    if (clipId.includes('.')) clipIdVariants.push(clipId.split('.').pop());

    let lastError = null;
    for (const tryClipId of clipIdVariants) {
      const body = {
        projectId,
        clipId: tryClipId,
        postAccountId,
        postDetail,
        scheduledTime: scheduledTimestamp  // Unix timestamp in milliseconds
      };
      if (subAccountId && subAccountId !== 'null' && subAccountId !== 'undefined') {
        body.subAccountId = subAccountId;
      }
      try {
        const opusRes = await fetch('https://api.opus.pro/api/post-tasks', {
          method: 'POST',
          headers: opusHeaders,
          body: JSON.stringify(body)
        });
        const raw = await opusRes.text();
        let data;
        try { data = JSON.parse(raw); } catch(e) { data = { raw }; }
        if (opusRes.ok) {
          return res.status(200).json({ success: true, postId: data.data?.postId || '', clipIdUsed: tryClipId, scheduledFor: scheduledTimestamp });
        }
        lastError = { error: data.message || data.errorName || data.error || 'Schedule failed', detail: data };
      } catch (e) {
        lastError = { error: e.message };
      }
    }
    return res.status(400).json(lastError || { error: 'Schedule failed' });
  }

  return res.status(404).json({ error: 'Unknown action' });
}
