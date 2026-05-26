import { YoutubeTranscript } from 'youtube-transcript-plus';

export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId. Add ?videoId=YOUR_ID to the URL' });

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return res.status(200).json({
      success: true,
      entryCount: transcript.length,
      firstFew: transcript.slice(0, 3)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      errorName: error.name,
      stack: error.stack
    });
  }
}
