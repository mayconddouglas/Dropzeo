import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../../../src/lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = req.query.token as string;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: session, error: selectError } = await supabaseAdmin
      .from('upload_sessions')
      .select('id, download_count')
      .eq('share_token', token)
      .maybeSingle();

    if (selectError || !session) return res.status(404).json({ error: 'Sessão não encontrada' });

    await supabaseAdmin
      .from('upload_sessions')
      .update({ download_count: (session.download_count || 0) + 1 })
      .eq('id', session.id);

    return res.json({ success: true, download_count: (session.download_count || 0) + 1 });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
}
