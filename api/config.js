// Delivers public Supabase credentials to the frontend
// These are safe to expose — Supabase anon keys are designed for browser use
// Security is enforced by Supabase Row Level Security and Auth policies

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured in environment variables' });
  }

  return res.status(200).json({ supabaseUrl, supabaseAnonKey });
}
