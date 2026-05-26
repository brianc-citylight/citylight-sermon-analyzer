export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId) {
    return res.status(400).json({ 
      error: 'Missing videoId',
      usage: 'Add ?videoId=YOUR_VIDEO_ID to the URL'
    });
  }

  const supadataKey = process.env.SUPADATA_API_KEY;
  if (!supadataKey) {
    return res.status(500).json({ error: 'SUPADATA_API_KEY not set in environment variables' });
  }

  try {
    const response = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}`,
      { headers: { 'x-api-key': supadataKey } }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        status: response.status,
        error: data.message || data.error || 'Supadata error',
        raw: data
      });
    }

    return res.status(200).json({
      success: true,
      entryCount: data.content?.length || 0,
      language: data.lang,
      firstFew: data.content?.slice(0, 3) || []
    });

  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
