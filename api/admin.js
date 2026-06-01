// Admin API — user management and invites for City Light org
// Actions: members, invite, remove-member

const ORG_ID = '9931cb42-e87e-42d4-b62b-156de98069e1';
const ADMIN_USER_ID = '05b384e6-7143-404b-915f-5fdb6fec818c';

async function supabaseRequest(url, method, body, serviceKey) {
  const headers = {
    'apikey': serviceKey,
    'Authorization': 'Bearer ' + serviceKey,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : ''
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const text = await r.text();
  try { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
  catch(e) { return { ok: r.ok, status: r.status, data: text }; }
}

function isAdmin(userId) {
  return userId === ADMIN_USER_ID;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Missing Supabase config' });

  const base = supabaseUrl + '/rest/v1';
  const authBase = supabaseUrl + '/auth/v1/admin';
  const action = req.query.action;
  const requestingUserId = req.query.userId || (req.body && req.body.userId);

  // ── MEMBERS: list all org members ─────────────────────────────────────────
  if (req.method === 'GET' && action === 'members') {
    const url = base + '/org_members?org_id=eq.' + ORG_ID + '&select=id,user_id,role,created_at';
    const result = await supabaseRequest(url, 'GET', null, serviceKey);
    if (!result.ok) return res.status(result.status).json({ error: 'Failed to fetch members' });

    // Fetch user emails from auth
    const members = Array.isArray(result.data) ? result.data : [];
    const enriched = await Promise.all(members.map(async m => {
      try {
        const userRes = await supabaseRequest(authBase + '/users/' + m.user_id, 'GET', null, serviceKey);
        return { ...m, email: userRes.data.email || 'Unknown' };
      } catch(e) { return { ...m, email: 'Unknown' }; }
    }));
    return res.status(200).json({ members: enriched });
  }

  // ── INVITE: send email invite to new user ─────────────────────────────────
  if (req.method === 'POST' && action === 'invite') {
    if (!isAdmin(requestingUserId)) return res.status(403).json({ error: 'Admin only' });
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    // Invite via Supabase Auth
    const inviteRes = await supabaseRequest(authBase + '/invite', 'POST', {
      email,
      data: { org_id: ORG_ID, role: 'member' }
    }, serviceKey);
    if (!inviteRes.ok) return res.status(inviteRes.status).json({ error: 'Failed to send invite', detail: inviteRes.data });

    // Add to org_members
    const newUserId = inviteRes.data.id;
    if (newUserId) {
      await supabaseRequest(base + '/org_members', 'POST', {
        org_id: ORG_ID,
        user_id: newUserId,
        role: 'member'
      }, serviceKey);
    }
    return res.status(200).json({ success: true, message: 'Invite sent to ' + email });
  }

  // ── REMOVE MEMBER ──────────────────────────────────────────────────────────
  if (req.method === 'DELETE' && action === 'remove-member') {
    if (!isAdmin(requestingUserId)) return res.status(403).json({ error: 'Admin only' });
    const { memberId } = req.body;
    if (!memberId) return res.status(400).json({ error: 'Missing memberId' });
    const url = base + '/org_members?id=eq.' + memberId + '&org_id=eq.' + ORG_ID;
    const result = await supabaseRequest(url, 'DELETE', null, serviceKey);
    if (!result.ok) return res.status(result.status).json({ error: 'Failed to remove member' });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action or method' });
}
