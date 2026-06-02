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
        body: JSON.stringify({ audio_url: audioUrl, speech_models: ['universal-2'], language_detection: true })
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data.error || 'AssemblyAI submit failed' });
      return res.status(200).json({ transcriptId: data.id, status: data.status });
    } catch (e) {
      return res.status(500).json({ error: 'Submit error: ' + e.message });
    }
  }

  // POLL: check status and get result with embedded timestamps
  if (req.method === 'GET' && action === 'poll') {
    const transcriptId = req.query.id;
    if (!transcriptId) return res.status(400).json({ error: 'Missing transcript id' });
    try {
      const pollUrl = ASSEMBLY_BASE + '/v2/transcript/' + transcriptId;
      const r = await fetch(pollUrl, { headers: aaiHeaders });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data.error || 'AssemblyAI poll failed' });

      // If not completed yet return status only
      if (data.status !== 'completed') {
        return res.status(200).json({ status: data.status, text: null, error: data.error || null });
      }

      // Fetch paragraph-level data which contains precise millisecond timestamps
      const paragraphsUrl = ASSEMBLY_BASE + '/v2/transcript/' + transcriptId + '/paragraphs';
      const paragraphsRes = await fetch(paragraphsUrl, { headers: aaiHeaders });
      const paragraphsData = await paragraphsRes.json();

      // Helper: convert milliseconds to MM:SS format
      const formatMs = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
      };

      // Build timestamped transcript — each paragraph prefixed with [MM:SS]
      // This gives Claude real temporal anchors to produce accurate clip timestamps
      let timestampedTranscript = '';
      if (paragraphsData.paragraphs && paragraphsData.paragraphs.length > 0) {
        timestampedTranscript = paragraphsData.paragraphs
          .map(p => '[' + formatMs(p.start) + '] ' + p.text)
          .join('\n\n');
      } else {
        // Fallback to raw text if paragraphs unavailable
        timestampedTranscript = data.text || '';
      }

      return res.status(200).json({
        status: data.status,
        text: timestampedTranscript,
        error: null
      });
    } catch (e) {
      return res.status(500).json({ error: 'Poll error: ' + e.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action. Use submit (POST) or poll (GET).' });
}
