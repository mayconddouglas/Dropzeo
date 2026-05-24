import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Busboy from 'busboy';

function generateToken(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export const config = {
  api: { bodyParser: false },
};

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

function parseMultipart(req: VercelRequest): Promise<{ files: UploadedFile[]; fields: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers as Record<string, string> });
    const files: UploadedFile[] = [];
    const fields: Record<string, string> = {};
    const filePromises: Promise<void>[] = [];

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (name, stream, info) => {
      const chunks: Buffer[] = [];
      const p = new Promise<void>((res) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          files.push({ buffer, originalname: info.filename, mimetype: info.mimeType, size: buffer.length });
          res();
        });
      });
      filePromises.push(p);
    });

    bb.on('finish', async () => {
      await Promise.all(filePromises);
      resolve({ files, fields });
    });

    bb.on('error', reject);
    req.pipe(bb);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { files, fields } = await parseMultipart(req);

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // Resolve user_id from Authorization header if present
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const supabaseAdmin = getSupabaseAdmin();
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) userId = user.id;
    }

    const expirationOpt = fields.expiration || '15min';
    const selfDestructOpt = fields.self_destruct === 'true';
    const passwordOpt = fields.password || null;

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const MAX_SESSION_BYTES = 50 * 1024 * 1024;
    if (totalBytes > MAX_SESSION_BYTES) {
      return res.status(400).json({ error: 'BETA_LIMIT_EXCEEDED' });
    }

    let durationMinutes = 15;
    if (expirationOpt === '5min') durationMinutes = 5;
    if (expirationOpt === '30min') durationMinutes = 30;

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

    const supabaseAdmin = getSupabaseAdmin();
    const shareToken = generateToken(10);

    // Save session WITH user_id so it shows in "Meus Links"
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('upload_sessions')
      .insert({
        share_token: shareToken,
        expires_at: expiresAt.toISOString(),
        is_expired: false,
        self_destruct: selfDestructOpt,
        password: passwordOpt,
        user_id: userId,        // <-- vincula ao usuário logado
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('Session error:', sessionError);
      return res.status(500).json({ error: 'Falha ao criar sessão.' });
    }

    for (const file of files) {
      const cleanName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const uniquePrefix = generateToken(6);
      const storagePath = `session-${shareToken}/${uniquePrefix}-${cleanName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('dropzeo-files')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return res.status(500).json({ error: 'Falha ao fazer upload do arquivo.' });
      }

      await supabaseAdmin.from('files').insert({
        session_id: session.id,
        original_name: file.originalname,
        storage_path: storagePath,
        mime_type: file.mimetype,
        size_bytes: file.size
      });
    }

    return res.json({
      success: true,
      share_token: shareToken,
      expires_at: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
