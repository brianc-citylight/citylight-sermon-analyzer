export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SermonAnalyzer/1.0)' }
    });
    const html = await response.text();
    const match = html.match(/<title>(.+?) - YouTube<\/title>/);
    const title = match ? match[1].trim() : 'Untitled Sermon';
    return res.status(200).json({ title });
  } catch (e) {
    return res.status(200).json({ title: 'Untitled Sermon' });
  }
}
