export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  const supadataKey = process.env.SUPADATA_API_KEY;
  if (!supadataKey) return res.status(500).json({ error: 'Supadata API key not configured' });

  try {
    const response = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}`,
      { headers: { 'x-api-key': supadataKey } }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(200).json({ transcript: null, error: err.message || 'Supadata error' });
    }

    const data = await response.json();
    if (!data.content || data.content.length === 0) {
      return res.status(200).json({ transcript: null });
    }

    const transcript = data.content.map(seg => {
      const s = (seg.offset || 0) / 1000;
      const mins = Math.floor(s / 60);
      const secs = Math.floor(s % 60);
      return `${mins}:${secs.toString().padStart(2, '0')} ${seg.text}`;
    }).join('\n');

    return res.status(200).json({ transcript: transcript.trim() || null });

  } catch (e) {
    return res.status(500).json({ transcript: null, error: e.message });
  }
}
