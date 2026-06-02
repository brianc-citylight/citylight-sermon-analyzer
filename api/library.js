// Sermon Library API — shared organizational sermon resource
// Actions: list, save, remove, check, update-title

const ORG_ID = '9931cb42-e87e-42d4-b62b-156de98069e1';

async function supabaseRequest(url, method, body, serviceKey) {
  const headers = {
    'apikey': serviceKey,
    'Authorization': 'Bearer ' + serviceKey,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : ''
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const text = await r.text();
  try { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
  catch(e) { return { ok: r.ok, status: r.status, data: text }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Missing Supabase config' });

  const base = supabaseUrl + '/rest/v1';
  const action = req.query.action;

  // ── LIST: get all sermons in library for this org ─────────────────────────
  if (req.method === 'GET' && action === 'list') {
    const url = base + '/sermon_library?org_id=eq.' + ORG_ID +
      '&expires_at=gt.' + new Date().toISOString() +
      '&order=created_at.desc' +
      '&select=id,title,sermon_date,speaker,b2_url,opus_upload_id,uploaded_by,created_at,expires_at';
    const result = await supabaseRequest(url, 'GET', null, serviceKey);
    if (!result.ok) return res.status(result.status).json({ error: 'Failed to fetch library' });

    // Get user emails for display
    const items = Array.isArray(result.data) ? result.data : [];
    return res.status(200).json({ sermons: items });
  }

  // ── CHECK: does a B2 URL already exist in the library? ────────────────────
  if (req.method === 'GET' && action === 'check') {
    const b2Url = req.query.b2_url;
    if (!b2Url) return res.status(400).json({ error: 'Missing b2_url' });
    const url = base + '/sermon_library?org_id=eq.' + ORG_ID +
      '&b2_url=eq.' + encodeURIComponent(b2Url) +
      '&select=id,title,opus_upload_id';
    const result = await supabaseRequest(url, 'GET', null, serviceKey);
    const found = Array.isArray(result.data) && result.data.length > 0;
    return res.status(200).json({ exists: found, sermon: found ? result.data[0] : null });
  }

  // ── SAVE: add a new sermon to the library ─────────────────────────────────
  if (req.method === 'POST' && action === 'save') {
    const { title, sermonDate, speaker, b2Url, opusUploadId, uploadedBy } = req.body;
    if (!title || !b2Url) return res.status(400).json({ error: 'Missing required fields' });
    const url = base + '/sermon_library';
    const result = await supabaseRequest(url, 'POST', {
      org_id: ORG_ID,
      title,
      sermon_date: sermonDate || null,
      speaker: speaker || null,
      b2_url: b2Url,
      opus_upload_id: opusUploadId || null,
      uploaded_by: uploadedBy || null
    }, serviceKey);
    if (!result.ok) return res.status(result.status).json({ error: 'Failed to save to library', detail: result.data });
    const saved = Array.isArray(result.data) ? result.data[0] : result.data;
    return res.status(200).json({ success: true, sermon: saved });
  }

  // ── UPDATE OPUS ID: store projectId after first clip created ──────────────
  if (req.method === 'PATCH' && action === 'update-opus-id') {
    const { id, opusUploadId } = req.body;
    if (!id || !opusUploadId) return res.status(400).json({ error: 'Missing id or opusUploadId' });
    const url = base + '/sermon_library?id=eq.' + id + '&org_id=eq.' + ORG_ID;
    const result = await supabaseRequest(url, 'PATCH', { opus_upload_id: opusUploadId }, serviceKey);
    if (!result.ok) return res.status(result.status).json({ error: 'Failed to update opus upload id' });
    return res.status(200).json({ success: true });
  }

  // ── UPDATE TITLE: edit sermon title ────────────────────────────────────────
  if (req.method === 'PATCH' && action === 'update-title') {
    const { id, title } = req.body;
    if (!id || !title) return res.status(400).json({ error: 'Missing id or title' });
    const url = base + '/sermon_library?id=eq.' + id + '&org_id=eq.' + ORG_ID;
    const result = await supabaseRequest(url, 'PATCH', { title }, serviceKey);
    if (!result.ok) return res.status(result.status).json({ error: 'Failed to update title' });
    return res.status(200).json({ success: true });
  }

  // ── REMOVE: delete a sermon from the library ───────────────────────────────
  if (req.method === 'DELETE' && action === 'remove') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const url = base + '/sermon_library?id=eq.' + id + '&org_id=eq.' + ORG_ID;
    const result = await supabaseRequest(url, 'DELETE', null, serviceKey);
    if (!result.ok) return res.status(result.status).json({ error: 'Failed to remove sermon' });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action or method' });
}
