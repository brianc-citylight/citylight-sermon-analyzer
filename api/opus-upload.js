// Opus Upload via Edge Runtime — streams video from B2 to Opus GCS server-side
// Three actions: initiate, stream, status
// Uses Edge runtime for waitUntil() background streaming support

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPUS_API_KEY = process.env.OPUS_API_KEY;
const ORG_ID = '9931cb42-e87e-42d4-b62b-156de98069e1';

// Simple KV store using Supabase to track upload status
async function getUploadStatus(uploadId) {
  const r = await fetch(
    SUPABASE_URL + '/rest/v1/sermon_library?opus_upload_id=eq.' + encodeURIComponent(uploadId) + '&org_id=eq.' + ORG_ID + '&select=id,opus_upload_id',
    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY } }
  );
  const data = await r.json();
  return data && data.length > 0 ? data[0] : null;
}

async function saveUploadId(libraryId, uploadId) {
  await fetch(
    SUPABASE_URL + '/rest/v1/sermon_library?id=eq.' + libraryId + '&org_id=eq.' + ORG_ID,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ opus_upload_id: uploadId })
    }
  );
}

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
    'x-opus-api-key': OPUS_API_KEY,
    'Content-Type': 'application/json'
  };

  // ── INITIATE: get GCS upload URL and uploadId from Opus ──────────────────
  if (req.method === 'POST' && action === 'initiate') {
    try {
      const body = await req.json();
      const { libraryId } = body;
      if (!libraryId) return new Response(JSON.stringify({ error: 'Missing libraryId' }), { status: 400, headers: corsHeaders });

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

      // Save uploadId to DB immediately — do not wait for streaming to complete
      // This ensures the frontend can use it right away for zero-credit clips
      await saveUploadId(libraryId, uploadId);

      // Step 2: Initiate GCS resumable session
      const initRes = await fetch(gcsUrl, {
        method: 'POST',
        headers: { 'x-goog-resumable': 'start', 'Content-Length': '0' }
      });
      const location = initRes.headers.get('location') || initRes.headers.get('Location');
      if (!location) return new Response(JSON.stringify({ error: 'No GCS location returned' }), { status: 500, headers: corsHeaders });

      return new Response(JSON.stringify({ uploadId, location, libraryId }), { status: 200, headers: corsHeaders });

    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // ── STREAM: fetch from B2 and PUT to Opus GCS in background ──────────────
  if (req.method === 'POST' && action === 'stream') {
    try {
      const body = await req.json();
      const { b2Url, location, uploadId, libraryId } = body;
      if (!b2Url || !location || !uploadId || !libraryId) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
      }

      // Use waitUntil to stream in background after responding
      const streamTask = (async () => {
        try {
          // Fetch the video from B2
          const videoRes = await fetch(b2Url);
          if (!videoRes.ok) throw new Error('Failed to fetch from B2: ' + videoRes.status);

          const contentLength = videoRes.headers.get('content-length');
          const contentType = videoRes.headers.get('content-type') || 'video/mp4';

          // Stream directly to Opus GCS resumable location
          await fetch(location, {
            method: 'PUT',
            headers: {
              'Content-Type': contentType,
              ...(contentLength ? { 'Content-Length': contentLength } : {})
            },
            body: videoRes.body,
            duplex: 'half'
          });

          // uploadId already saved in initiate action — no need to save again here
          console.log('Background stream to Opus GCS completed for uploadId:', uploadId);

        } catch(e) {
          console.error('Background stream failed:', e.message);
        }
      })();

      // Use waitUntil so the Edge function keeps running after response
      if (typeof globalThis !== 'undefined' && globalThis.waitUntil) {
        globalThis.waitUntil(streamTask);
      }

      // Respond immediately — streaming happens in background
      return new Response(JSON.stringify({ started: true, uploadId }), { status: 200, headers: corsHeaders });

    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // ── STATUS: check if uploadId has been saved to library ──────────────────
  if (req.method === 'GET' && action === 'status') {
    const uploadId = url.searchParams.get('uploadId');
    if (!uploadId) return new Response(JSON.stringify({ error: 'Missing uploadId' }), { status: 400, headers: corsHeaders });
    try {
      const record = await getUploadStatus(uploadId);
      return new Response(JSON.stringify({ complete: !!record, uploadId }), { status: 200, headers: corsHeaders });
    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });
}
