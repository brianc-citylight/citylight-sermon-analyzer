// Backblaze B2 upload handler
// Two actions: get-upload-url (get a URL to upload to) and confirm (verify upload succeeded)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const keyId = process.env.B2_KEY_ID;
  const appKey = process.env.B2_APP_KEY;
  const bucketId = process.env.B2_BUCKET_ID;

  if (!keyId || !appKey || !bucketId) {
    return res.status(500).json({ error: 'Missing B2 environment variables' });
  }

  const action = req.query.action;

  // ── STEP 1: Authorize with B2 ─────────────────────────────────────────────
  async function authorizeB2() {
    const credentials = Buffer.from(keyId + ':' + appKey).toString('base64');
    const r = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { 'Authorization': 'Basic ' + credentials }
    });
    if (!r.ok) throw new Error('B2 auth failed: ' + r.status);
    return await r.json();
  }

  // ── GET UPLOAD URL: get a signed URL for direct browser upload ────────────
  if (req.method === 'GET' && action === 'get-upload-url') {
    try {
      const auth = await authorizeB2();
      const apiUrl = auth.apiInfo.storageApi.apiUrl;
      const authToken = auth.authorizationToken;

      const r = await fetch(apiUrl + '/b2api/v3/b2_get_upload_url', {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bucketId })
      });
      if (!r.ok) throw new Error('Failed to get upload URL: ' + r.status);
      const data = await r.json();

      // Return everything the browser needs to do the upload directly
      return res.status(200).json({
        uploadUrl: data.uploadUrl,
        authorizationToken: data.authorizationToken,
        bucketId
      });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── GET PUBLIC URL: build the public download URL for a file ──────────────
  if (req.method === 'GET' && action === 'get-public-url') {
    const fileName = req.query.fileName;
    if (!fileName) return res.status(400).json({ error: 'Missing fileName' });
    try {
      const auth = await authorizeB2();
      const downloadUrl = auth.apiInfo.storageApi.downloadUrl;
      const bucketName = 'CityLightSermons';
      const publicUrl = downloadUrl + '/file/' + bucketName + '/' + encodeURIComponent(fileName);
      return res.status(200).json({ publicUrl });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action. Use get-upload-url or get-public-url.' });
}
