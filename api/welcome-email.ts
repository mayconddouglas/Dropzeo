import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  
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
        return res.json({ success: true, method: 'resend', message: 'E-mail enviado com sucesso!' });
      }
    }
    
    // Log as simulation if no Resend set up
    console.log(`[Email Simulator] To: ${email}, Subject: Bem-vindo ao Dropzeo! 🚀`);
    res.json({ success: true, method: 'simulation', message: 'E-mail processado (simulado).' });

  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao despachar e-mail.' });
  }
}
