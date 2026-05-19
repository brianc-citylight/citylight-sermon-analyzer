export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SermonAnalyzer/1.0)' }
    });
    const html = await pageRes.text();

    const captionMatch = html.match(/"captionTracks":\[({.+?})\]/);
    if (!captionMatch) return res.status(200).json({ transcript: null });

    const urlMatch = captionMatch[1].match(/"baseUrl":"([^"]+)"/);
    if (!urlMatch) return res.status(200).json({ transcript: null });

    const captionUrl = urlMatch[1].replace(/\\u0026/g, '&');
    const captionRes = await fetch(captionUrl);
    const xml = await captionRes.text();

    const entries = [...xml.matchAll(/<text start="([^"]+)"[^>]*>([^<]*)<\/text>/g)];
    let transcript = '';
    entries.forEach(([, start, text]) => {
      const s = parseFloat(start);
      const mins = Math.floor(s / 60);
      const secs = Math.floor(s % 60);
      const decoded = text
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      transcript += `${mins}:${secs.toString().padStart(2, '0')} ${decoded}\n`;
    });

    return res.status(200).json({ transcript: transcript.trim() || null });
  } catch (e) {
    return res.status(200).json({ transcript: null });
  }
}
