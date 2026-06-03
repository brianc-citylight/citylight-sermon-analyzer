// Opus Upload — two actions:
// initiate: get GCS upload URL and uploadId from Opus
// Uses standard Node.js runtime — no Edge needed

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const OPUS_API_KEY = process.env.OPUS_API_KEY;
  if (!OPUS_API_KEY) return res.status(500).json({ error: 'Missing OPUS_API_KEY' });

  const opusHeaders = {
    'Authorization': 'Bearer ' + OPUS_API_KEY,
    'Content-Type': 'application/json'
  };

  const action = req.query.action;

  // ── INITIATE: get GCS upload URL and uploadId from Opus ──────────────────
  if (req.method === 'POST' && action === 'initiate') {
    try {
      // Step 1: Get upload link from Opus
      const linkRes = await fetch('https://api.opus.pro/api/upload-links', {
        method: 'POST',
        headers: opusHeaders,
        body: JSON.stringify({ video: { usecase: 'LocalUpload' } })
      });
      const linkData = await linkRes.json();
      if (!linkRes.ok) return res.status(linkRes.status).json({ error: linkData.message || 'Failed to get upload link' });

      const { url: gcsUrl, uploadId } = linkData;
      if (!uploadId || !gcsUrl) return res.status(500).json({ error: 'Missing uploadId or gcsUrl from Opus' });

      // Step 2: Initiate GCS resumable session server-side
      const initRes = await fetch(gcsUrl, {
        method: 'POST',
        headers: { 'x-goog-resumable': 'start', 'Content-Length': '0' }
      });
      const location = initRes.headers.get('location') || initRes.headers.get('Location');
      if (!location) return res.status(500).json({ error: 'No GCS location returned' });

      // Return uploadId and location to browser
      // Browser will PUT the file directly to location via XHR
      return res.status(200).json({ uploadId, location });

    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action. Use initiate (POST).' });
}
