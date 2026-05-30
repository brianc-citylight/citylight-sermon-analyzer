// AssemblyAI transcript API for Google Drive video files
// Two actions: submit (start job) and poll (check status)

const ASSEMBLY_BASE = 'https://api.assemblyai.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing ASSEMBLYAI_API_KEY' });

  const aaiHeaders = {
    'Authorization': apiKey,
    'Content-Type': 'application/json'
  };

  const action = req.query.action;

  // SUBMIT: start a transcription job
  if (req.method === 'POST' && action === 'submit') {
    const audioUrl = req.body && req.body.audioUrl;
    if (!audioUrl) return res.status(400).json({ error: 'Missing audioUrl' });
    try {
      const submitUrl = ASSEMBLY_BASE + '/v2/transcript';
      const r = await fetch(submitUrl, {
        method: 'POST',
        headers: aaiHeaders,
        body: JSON.stringify({ audio_url: audioUrl, speech_models: 'universal-3-pro', language_detection: true })
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data.error || 'AssemblyAI submit failed' });
      return res.status(200).json({ transcriptId: data.id, status: data.status });
    } catch (e) {
      return res.status(500).json({ error: 'Submit error: ' + e.message });
    }
  }

  // POLL: check status and get result
  if (req.method === 'GET' && action === 'poll') {
    const transcriptId = req.query.id;
    if (!transcriptId) return res.status(400).json({ error: 'Missing transcript id' });
    try {
      const pollUrl = ASSEMBLY_BASE + '/v2/transcript/' + transcriptId;
      const r = await fetch(pollUrl, { headers: aaiHeaders });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data.error || 'AssemblyAI poll failed' });
      return res.status(200).json({
        status: data.status,
        text: data.text || null,
        error: data.error || null
      });
    } catch (e) {
      return res.status(500).json({ error: 'Poll error: ' + e.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action. Use submit (POST) or poll (GET).' });
}
