import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { getSupabaseAdmin, supabase } from './src/lib/supabase.js';
import { generateToken } from './src/lib/utils.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable JSON bodies
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// Set up multer for handling multi-file uploads (Memory storage)
// Let's set limits to 50MB (52428800 bytes) total for Beta version
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 52428800, 
  }
});

// Configure Gemini client (using lazy loading or optional check)
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } catch (err) {
    console.error('Failed to initialize Gemini AI client:', err);
  }
}

/**
 * Helper to authenticate user from standard Bearer Token
 */
async function getAuthUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    return data.user;
  } catch (err) {
    console.error('Error authenticating user token:', err);
    return null;
  }
}

// ------------------------------------------------------------
// API ROUTES
// ------------------------------------------------------------

// AI Assist or app health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * POST /api/welcome-email
 * Sends of logs welcome email for newly signed up users
 */
app.post('/api/welcome-email', async (req, res): Promise<any> => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório para envio de boas-vindas.' });
  }

  const userName = name || email.split('@')[0];
  const welcomeHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Boas-vindas ao Dropzeo! 🚀</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px; margin: 0; }
        .card { max-width: 500px; margin: 0 auto; background: #141414; border: 1px solid #262626; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        .logo { color: #818cf8; font-size: 24px; font-weight: 800; text-decoration: none; margin-bottom: 24px; display: inline-block; }
        h1 { font-size: 22px; font-weight: 700; margin: 0 0 16px 0; color: #ffffff; }
        p { font-size: 14px; line-height: 1.6; color: #a3a3a3; margin: 0 0 16px 0; }
        .highlight { color: #818cf8; font-weight: 600; }
        .button { display: inline-block; background: #6366f1; color: #ffffff !important; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin-top: 16px; transition: background 0.2s; }
        .button:hover { background: #4f46e5; }
        .footer { font-size: 12px; color: #525252; margin-top: 32px; border-t: 1px solid #262626; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Dropzeo <span style="font-size: 10px; color: #525252; font-weight: 400;">by brazeo.ai</span></div>
        <h1>Olá, ${userName}! 🚀</h1>
        <p>Estamos muito felizes em ter você no <strong style="color: #ffffff;">Dropzeo</strong>, a plataforma de compartilhamento de arquivos ultrarrápida e privada.</p>
        <p>Como o Dropzeo está atualmente em <strong class="highlight">versão Beta</strong>, agora você pode enviar arquivos de até <strong class="highlight">50MB</strong> por sessão e escolher tempos de expiração personalizados de até 30 minutos!</p>
        <p>Aproveite para enviar o seu primeiro pacote agora mesmo clicando no botão abaixo:</p>
        <a href="${process.env.VITE_APP_URL || 'http://localhost:3000'}" class="button">Começar a Compartilhar</a>
        <div class="footer">
          Dropzeo - Desenvolvido com amor pela equipe brazeo.ai.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      console.log(`[Email] Sending welcome email to ${email} via Resend...`);
      const apiResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from: 'Dropzeo <bemvindo@resend.dev>',
          to: email,
          subject: 'Bem-vindo ao Dropzeo! 🚀',
          html: welcomeHtml
        })
      });

      if (apiResponse.ok) {
        console.log(`[Email] Welcome email sent successfully to ${email}.`);
        return res.json({ success: true, method: 'resend', message: 'E-mail enviado com sucesso via Resend API!' });
      } else {
        const errorText = await apiResponse.text();
        console.error(`[Email] Resend API error:`, errorText);
      }
    }

    // Fallback: Terminal simulated beautiful logging
    console.log('\n' + '='.repeat(60));
    console.log('📬  DROPZEO SIMULATOR: E-MAIL DE BOAS-VINDAS ENVIADO!');
    console.log('='.repeat(60));
    console.log(`Para: ${email}`);
    console.log(`Nome: ${userName}`);
    console.log(`Assunto: Bem-vindo ao Dropzeo! 🚀`);
    console.log('-'.repeat(60));
    console.log(`[Conteúdo HTML Simulado]:\nOlá, ${userName}! Estamos animados por você ter se cadastrado no Dropzeo!`);
    console.log('='.repeat(60) + '\n');

    res.json({ 
      success: true, 
      method: 'simulation', 
      message: 'E-mail de boas-vindas processado!',
      preview: {
        to: email,
        name: userName,
        subject: 'Bem-vindo ao Dropzeo! 🚀'
      }
    });
  } catch (err: any) {
    console.error('Error handling welcome email dispatch:', err);
    res.status(500).json({ error: 'Erro ao despachar o e-mail de boas-vindas.' });
  }
});

/**
 * POST /api/upload
 * Multi-file upload, session creation
 */
app.post('/api/upload', upload.array('files'), async (req, res): Promise<any> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const expirationOpt = req.body.expiration || '15min'; // 5min, 15min, or 30min
    const selfDestructOpt = req.body.self_destruct === 'true';
    const passwordOpt = req.body.password || null;
    
    // 1. Calculate total bytes
    let totalBytes = 0;
    for (const file of files) {
      totalBytes += file.size;
    }

    // Sessions are capped at 50MB in Beta version
    const MAX_SESSION_BYTES = 50 * 1024 * 1024; // 52,428,800 bytes
    if (totalBytes > MAX_SESSION_BYTES) {
      return res.status(400).json({ 
        error: 'BETA_LIMIT_EXCEEDED',
        message: `Limite da Versão Beta excedido! O limite atual é de 50MB por sessão. Seu envio total possui ${(totalBytes / (1024 * 1024)).toFixed(1)}MB.` 
      });
    }

    // 2. Auth Check
    const user = await getAuthUser(req);
    const LIMIT_20MB = 20 * 1024 * 1024; // 20,971,520 bytes

    if (!user && totalBytes > LIMIT_20MB) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Uploads maiores de 20MB exigem cadastro ou login.'
      });
    }

    // 3. Math for expiration duration
    let durationMinutes = 15;
    if (expirationOpt === '5min') durationMinutes = 5;
    if (expirationOpt === '30min') durationMinutes = 30;

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

    // Get Admin Supabase Client to perform secure operations bypassing RLS
    const supabaseAdmin = getSupabaseAdmin();

    // 4. Generate random, unique token
    let shareToken = generateToken(10);
    let attempts = 0;
    // Check collision
    while (attempts < 5) {
      const { data } = await supabaseAdmin
        .from('upload_sessions')
        .select('id')
        .eq('share_token', shareToken)
        .maybeSingle();

      if (!data) break;
      shareToken = generateToken(10);
      attempts++;
    }

    // 5. Create the Upload Session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('upload_sessions')
      .insert({
        user_id: user ? user.id : null,
        share_token: shareToken,
        expires_at: expiresAt.toISOString(),
        is_expired: false,
        self_destruct: selfDestructOpt,
        password: passwordOpt
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('Error creating upload session:', sessionError);
      return res.status(500).json({ error: 'Falha ao processar a sessão de upload.' });
    }

    const sessionId = session.id;

    // 6. Upload files to Supabase Storage and Insert file records
    const uploadedFilesMetadata = [];

    for (const file of files) {
      // Create a unique storage path: session-[shareToken]/[randomPart]-[original_name]
      const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const uniquePrefix = generateToken(6);
      const storagePath = `session-${shareToken}/${uniquePrefix}-${cleanOriginalName}`;

      // Upload file physically via Supabase admin (bypassing Client RLS constraints)
      const { error: storageError } = await supabaseAdmin.storage
        .from('dropzeo-files')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: true
        });

      if (storageError) {
        console.error(`Failed to upload ${file.originalname} to storage:`, storageError);
        // Clean up previously uploaded items in session if some files failed
        // For absolute robustness, we can try to delete whatever was uploaded
        return res.status(500).json({ error: `Falha ao salvar o arquivo: ${file.originalname}` });
      }

      // Add file DB metadata record
      const { data: fileRecord, error: fileDbError } = await supabaseAdmin
        .from('files')
        .insert({
          session_id: sessionId,
          original_name: file.originalname,
          storage_path: storagePath,
          mime_type: file.mimetype,
          size_bytes: file.size
        })
        .select()
        .single();

      if (fileDbError) {
        console.error(`Failed to register ${file.originalname} database entry:`, fileDbError);
        return res.status(500).json({ error: 'Erro ao registrar metadados dos arquivos.' });
      }

      uploadedFilesMetadata.push(fileRecord);
    }

    // Return successfully completed session detail
    res.json({
      success: true,
      share_token: shareToken,
      expires_at: expiresAt.toISOString(),
      files_count: files.length,
      total_bytes: totalBytes
    });

  } catch (error: any) {
    console.error('Internal upload exception:', error);
    res.status(500).json({ error: 'Erro inesperado no servidor ao processar upload.' });
  }
});

/**
 * GET /api/session/:token
 * Fetch upload session file meta-details for a recipient.
 */
app.get('/api/session/:token', async (req, res): Promise<any> => {
  const { token } = req.params;

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Fetch session along with nested files
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('upload_sessions')
      .select(`
        id,
        user_id,
        share_token,
        expires_at,
        is_expired,
        self_destruct,
        password,
        files (
          id,
          original_name,
          mime_type,
          size_bytes,
          storage_path
        )
      `)
      .eq('share_token', token)
      .maybeSingle();

    if (sessionError) {
      console.error('Error fetching session details:', sessionError);
      return res.status(500).json({ error: 'Falha ao buscar informações da sessão.' });
    }

    if (!session) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Link não encontrado ou sessão inexistente.' });
    }

    // Check Password Protection
    const clientPassword = req.query.password;
    if (session.password && session.password !== clientPassword) {
      return res.status(401).json({
        error: 'PASSWORD_REQUIRED',
        has_password: true,
        message: !clientPassword ? 'Esta transferência está protegida por senha.' : 'Senha incorreta. Tente novamente.'
      });
    }

    // Validate if expired based on current server time
    const expiresAt = new Date(session.expires_at);
    const isPast = expiresAt.getTime() < Date.now();

    if (session.is_expired || isPast) {
      // If it has expired but is_expired database column says false, let's mark it as expired asynchronously
      if (!session.is_expired) {
        supabaseAdmin.from('upload_sessions').update({ is_expired: true }).eq('id', session.id).then(() => {
          // Trigger storage cleanup for this session's files asynchronously
          const filePaths = (session.files || []).map((f: any) => f.storage_path).filter(Boolean);
          if (filePaths.length > 0) {
            supabaseAdmin.storage.from('dropzeo-files').remove(filePaths).then(({ data, error }) => {
              if (error) console.error('Error cleaning up expired storage files on inline access:', error);
              else console.log('Successfully cleaned up storage on inline access:', data);
            });
          }
        });
      }

      return res.status(410).json({ error: 'EXPIRED', message: 'Este link expirou e os arquivos foram deletados.' });
    }

    // Enrich files list with secure direct read URLs
    // Because public bucket reading is configured, we can construct the read link
    // Scheme: https://[project-ref].supabase.co/storage/v1/object/public/dropzeo-files/[storage_path]
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const enrichedFiles = (session.files || []).map((file: any) => {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/dropzeo-files/${file.storage_path}`;
      return {
        id: file.id,
        original_name: file.original_name,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        download_url: publicUrl
      };
    });

    res.json({
      share_token: session.share_token,
      expires_at: session.expires_at,
      self_destruct: !!session.self_destruct,
      has_password: !!session.password,
      files: enrichedFiles
    });

  } catch (err: any) {
    console.error('Error in request handler for session details:', err);
    res.status(500).json({ error: 'Erro inesperado no servidor ao obter a sessão.' });
  }
});

/**
 * POST /api/session/:token/downloaded
 * Destroys session and its files if self_destruct is enabled.
 */
app.post('/api/session/:token/downloaded', async (req, res): Promise<any> => {
  const { token } = req.params;

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('upload_sessions')
      .select(`
        id,
        is_expired,
        self_destruct,
        files (
          id,
          storage_path
        )
      `)
      .eq('share_token', token)
      .maybeSingle();

    if (sessionError) {
      console.error('Error fetching session for self-destruction:', sessionError);
      return res.status(500).json({ error: 'Falha ao buscar sessão.' });
    }

    if (!session) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Sessão inexistente.' });
    }

    if (session.self_destruct && !session.is_expired) {
      console.log(`[Self-Destruct] Self-destruction triggered for token ${token}`);

      // Mark expired in database
      await supabaseAdmin
        .from('upload_sessions')
        .update({ is_expired: true })
        .eq('id', session.id);

      // Extract file paths to physically clear storage
      const filePaths = (session.files || []).map((f: any) => f.storage_path).filter(Boolean);
      if (filePaths.length > 0) {
        supabaseAdmin.storage.from('dropzeo-files').remove(filePaths).then(({ data, error }) => {
          if (error) {
            console.error('Error cleaning up storage files during self-destruction:', error);
          } else {
            console.log('Successfully cleaned up storage on self-destruction:', data);
          }
        });
      }

      return res.json({ success: true, message: 'Processo de autodestruição finalizado!' });
    }

    return res.json({ success: true, message: 'Autodestruição ignorada (não habilitada ou já expirado).' });

  } catch (err) {
    console.error('Error processing self-destruct state:', err);
    res.status(500).json({ error: 'Erro de processador interno na autodestruição.' });
  }
});

/**
 * GET /api/my-sessions
 * List active & expired upload sessions for the authenticated user
 */
app.get('/api/my-sessions', async (req, res): Promise<any> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Faça login para ver suas transferências.' });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: sessions, error } = await supabaseAdmin
      .from('upload_sessions')
      .select(`
        id,
        share_token,
        expires_at,
        created_at,
        is_expired,
        self_destruct,
        password,
        download_count,
        files (
          id,
          original_name,
          mime_type,
          size_bytes
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching dashboard sessions:', error);
      return res.status(500).json({ error: 'Erro ao obter seu histórico de transferências.' });
    }

    // Map sessions to check dynamic expiration
    const mappedSessions = (sessions || []).map((session: any) => {
      const expiresAt = new Date(session.expires_at);
      const isPast = expiresAt.getTime() < Date.now();
      const expired = session.is_expired || isPast;

      return {
        id: session.id,
        share_token: session.share_token,
        created_at: session.created_at,
        expires_at: session.expires_at,
        is_expired: expired,
        self_destruct: !!session.self_destruct,
        has_password: !!session.password,
        download_count: session.download_count || 0,
        files: session.files || []
      };
    });

    res.json(mappedSessions);
  } catch (err) {
    console.error('get my-sessions exception:', err);
    res.status(500).json({ error: 'Erro inesperado no servidor.' });
  }
});

/**
 * POST /api/session/:token/download
 * Increments the download count of the session.
 */
app.post('/api/session/:token/download', async (req, res): Promise<any> => {
  const { token } = req.params;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    // Increment download_count
    const { data: session, error: selectError } = await supabaseAdmin
      .from('upload_sessions')
      .select('id, download_count')
      .eq('share_token', token)
      .maybeSingle();

    if (selectError) {
      console.error('Error selecting session for download count:', selectError);
      return res.status(500).json({ error: 'Erro ao buscar sessão' });
    }

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('upload_sessions')
      .update({ download_count: (session.download_count || 0) + 1 })
      .eq('id', session.id);

    if (updateError) {
      console.error('Error updating download count:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar contagem de downloads' });
    }

    return res.json({ success: true, download_count: (session.download_count || 0) + 1 });
  } catch (err) {
    console.error('Download count increment exception:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * DELETE /api/session/:token
 * Manually revokes/deletes an active upload session. Only the owner can do this.
 */
app.delete('/api/session/:token', async (req, res): Promise<any> => {
  const { token } = req.params;
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Login necessário para revogar transferências.' });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch session first to confirm ownership
    const { data: session, error: findError } = await supabaseAdmin
      .from('upload_sessions')
      .select(`
        id,
        user_id,
        is_expired,
        files (
          id,
          storage_path
        )
      `)
      .eq('share_token', token)
      .maybeSingle();

    if (findError) {
      console.error('Error finding session for revocation:', findError);
      return res.status(500).json({ error: 'Erro ao localizar a transferência.' });
    }

    if (!session) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Sessão não encontrada.' });
    }

    // Verify ownership
    if (session.user_id !== user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Você não tem permissão para revogar este link.' });
    }

    // Perform manual revocation/deletion
    // 1. Mark expired in database
    const { error: updateError } = await supabaseAdmin
      .from('upload_sessions')
      .update({ is_expired: true })
      .eq('id', session.id);

    if (updateError) {
      console.error('Error updating session expiry:', updateError);
      return res.status(500).json({ error: 'Erro ao revogar link.' });
    }

    // 2. Clear out storage files physically
    const filePaths = (session.files || []).map((f: any) => f.storage_path).filter(Boolean);
    if (filePaths.length > 0) {
      supabaseAdmin.storage.from('dropzeo-files').remove(filePaths).then(({ data, error }) => {
        if (error) {
          console.error('Error removing files during manual revocation:', error);
        } else {
          console.log('Successfully removed files on manual revocation:', data);
        }
      });
    }

    return res.json({ success: true, message: 'Link revogado e arquivos removidos com sucesso!' });
  } catch (err) {
    console.error('Revoke session exception:', err);
    res.status(500).json({ error: 'Erro inesperado ao revogar a sessão.' });
  }
});

// Vite middleware or production serving
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server starting on port ${PORT} running dropzeo backend-api services.`);
});
