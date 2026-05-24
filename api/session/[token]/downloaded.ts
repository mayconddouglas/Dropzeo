import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = req.query.token as string;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('upload_sessions')
      .select('id, is_expired, self_destruct, files(storage_path)')
      .eq('share_token', token)
      .maybeSingle();

    if (sessionError || !session) return res.status(404).json({ error: 'Sessão inexistente.' });

    if (session.self_destruct && !session.is_expired) {
      await supabaseAdmin
        .from('upload_sessions')
        .update({ is_expired: true })
        .eq('id', session.id);

      const filePaths = (session.files || []).map((f: any) => f.storage_path).filter(Boolean);
      if (filePaths.length > 0) {
        await supabaseAdmin.storage.from('dropzeo-files').remove(filePaths);
      }
      return res.json({ success: true, message: 'Processo de autodestruição finalizado!' });
    }

    return res.json({ success: true, message: 'Autodestruição ignorada.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
}
