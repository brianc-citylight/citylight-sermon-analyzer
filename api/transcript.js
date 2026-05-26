import { YoutubeTranscript } from 'youtube-transcript-plus';

export default async function handler(req, res) {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId' });
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    const formattedTranscript = transcript.map(entry => {
      const s = entry.offset / 1000;
      const mins = Math.floor(s / 60);
      const secs = Math.floor(s % 60);
      return `${mins}:${secs.toString().padStart(2, '0')} ${entry.text}`;
    }).join('\n');

    return res.status(200).json({
      transcript: formattedTranscript || null
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch transcript',
      details: error.message
    });
  }
}
