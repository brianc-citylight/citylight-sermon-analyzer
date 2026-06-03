// Opus Upload via Edge Runtime — streams video from B2 to Opus GCS server-side
// Two actions: initiate, stream
// uploadId is session-only — never persisted to database

export const config = { runtime: 'edge' };

const OPUS_API_KEY = process.env.OPUS_API_KEY;

export default async function handler(req) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const opusHeaders = {
    'Authorization': 'Bearer ' + OPUS_API_KEY,
    'Content-Type': 'application/json'
  };

  // ── INITIATE: get GCS upload URL and uploadId from Opus ──────────────────
  if (req.method === 'POST' && action === 'initiate') {
    try {
      // Step 1: Get upload link from Opus
      const linkRes = await fetch('https://api.opus.pro/api/upload-links', {
        method: 'POST',
        headers: opusHeaders,
        body: JSON.stringify({ video: { usecase: 'LocalUpload' } })
      });
      const linkData = await linkRes.json();
      if (!linkRes.ok) return new Response(JSON.stringify({ error: linkData.message || 'Failed to get upload link' }), { status: linkRes.status, headers: corsHeaders });

      const { url: gcsUrl, uploadId } = linkData;
      if (!uploadId || !gcsUrl) return new Response(JSON.stringify({ error: 'Missing uploadId or gcsUrl from Opus' }), { status: 500, headers: corsHeaders });

      // Step 2: Initiate GCS resumable session
      const initRes = await fetch(gcsUrl, {
        method: 'POST',
        headers: { 'x-goog-resumable': 'start', 'Content-Length': '0' }
      });
      const location = initRes.headers.get('location') || initRes.headers.get('Location');
      if (!location) return new Response(JSON.stringify({ error: 'No GCS location returned' }), { status: 500, headers: corsHeaders });

      // Return uploadId and location — uploadId is session-only, never stored to DB
      return new Response(JSON.stringify({ uploadId, location }), { status: 200, headers: corsHeaders });

    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // ── STREAM: fetch from B2 and PUT to Opus GCS in background ──────────────
  if (req.method === 'POST' && action === 'stream') {
    try {
      const body = await req.json();
      const { b2Url, location, uploadId } = body;
      if (!b2Url || !location || !uploadId) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
      }

      const streamTask = (async () => {
        try {
          const videoRes = await fetch(b2Url);
          if (!videoRes.ok) throw new Error('Failed to fetch from B2: ' + videoRes.status);

          const contentLength = videoRes.headers.get('content-length');
          const contentType = videoRes.headers.get('content-type') || 'video/mp4';

          await fetch(location, {
            method: 'PUT',
            headers: {
              'Content-Type': contentType,
              ...(contentLength ? { 'Content-Length': contentLength } : {})
            },
            body: videoRes.body,
            duplex: 'half'
          });

          console.log('Background stream to Opus GCS completed for uploadId:', uploadId);
        } catch(e) {
          console.error('Background stream failed:', e.message);
        }
      })();

      if (typeof globalThis !== 'undefined' && globalThis.waitUntil) {
        globalThis.waitUntil(streamTask);
      }

      return new Response(JSON.stringify({ started: true, uploadId }), { status: 200, headers: corsHeaders });

    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });
}
