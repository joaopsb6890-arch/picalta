/* PicalAi proxy — Vercel Serverless Function (Node runtime, CommonJS)
 *
 * Ficheiro: /api/picalai.js  → servido em /api/picalai
 *
 * Este único ficheiro trata /api/picalai/status e /api/picalai/chat
 * (o vercel.json faz o rewrite de ambos para /api/picalai).
 * A escolha da ação é feita pelo MÉTODO HTTP (GET = estado, POST = chat),
 * não pelo caminho, porque req.url pode variar com os rewrites.
 */
'use strict';

const AI_TIMEOUT_MS = 25000; // < maxDuration (30s) do vercel.json
const AUTH_TIMEOUT_MS = 4000;  // orçamento de tempo para verificar o token Firebase
const AI_MAX_MESSAGES = 24;
const AI_MAX_USER_TOKENS = 1200;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;

function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // O AbortController mantém-se ativo durante o fetch E a leitura do corpo/json.
  // O temporizador só é limpo quando a promessa externa (corpo incluído) termina.
  return fetch(url, { ...opts, signal: controller.signal }).then(async (r) => {
    // clona o corpo para que o abort ainda o alcance se demorar a chegar
    const clone = r.clone();
    const text = await clone.text(); // lê o corpo sob o mesmo sinal
    return new Response(text, {
      status: r.status,
      statusText: r.statusText,
      headers: Object.fromEntries(r.headers.entries()),
    });
  }).finally(() => clearTimeout(timer));
}

function json(res, status, obj) {
  res.status(status).json(obj);
}

/* ---------- Configuração (aceita vários nomes de variáveis) ---------- */
function envVal(...names) {
  for (const n of names) {
    let v = process.env[n];
    if (typeof v !== 'string') continue;
    v = v.trim().replace(/^["']|["']$/g, '').trim(); // tolera aspas e espaços copiados do .env
    if (v) return v;
  }
  return '';
}
function aiConfig() {
  const openai = envVal('OPENAI_API_KEY');
  const key = envVal('OVERCONTROL_API_KEY', 'AI_API_KEY') || openai;
  let base = envVal('OVERCONTROL_BASE_URL', 'AI_BASE_URL', 'OPENAI_BASE_URL');
  let model = envVal('OVERCONTROL_MODEL', 'AI_MODEL', 'OPENAI_MODEL');
  // Só com OPENAI_API_KEY, assume os valores por defeito da OpenAI
  if (!envVal('OVERCONTROL_API_KEY', 'AI_API_KEY') && openai) {
    base = base || 'https://api.openai.com/v1';
    model = model || 'gpt-4o-mini';
  }
  base = base.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  const missing = [];
  if (!key) missing.push('OVERCONTROL_API_KEY');
  if (!base) missing.push('OVERCONTROL_BASE_URL');
  if (!model) missing.push('OVERCONTROL_MODEL');
  return { key, base, model, missing, ok: missing.length === 0 };
}
function aiConfigured() { return aiConfig().ok; }

/* ---------- Verificação do token Firebase ---------- */
// Preferência: validar a assinatura RS256 com os certificados públicos da Google
// (não precisa de chave de API). Alternativa: accounts:lookup com a API key.
const crypto = require('crypto');
let certCache = { at: 0, certs: null };
function b64urlToBuf(s) { return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }
async function getCerts() {
  if (certCache.certs && Date.now() - certCache.at < 3600_000) return certCache.certs;
  const r = await fetchWithTimeout('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', {}, AUTH_TIMEOUT_MS);
  if (!r.ok) throw new Error('certs ' + r.status);
  certCache = { at: Date.now(), certs: await r.json() };
  return certCache.certs;
}
async function verifyJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const header = JSON.parse(b64urlToBuf(parts[0]).toString('utf8'));
  const payload = JSON.parse(b64urlToBuf(parts[1]).toString('utf8'));
  const projectId = envVal('FIREBASE_PROJECT_ID') || 'picala-a212f';
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || !header.kid) return null;
  if (payload.aud !== projectId || payload.iss !== 'https://securetoken.google.com/' + projectId) return null;
  if (!payload.sub || payload.exp < now - 30 || payload.iat > now + 300) return null;
  const certs = await getCerts();
  const pem = certs[header.kid];
  if (!pem) return null;
  const v = crypto.createVerify('RSA-SHA256');
  v.update(parts[0] + '.' + parts[1]);
  if (!v.verify(pem, b64urlToBuf(parts[2]))) return null;
  return { uid: payload.sub, email: payload.email || null, name: payload.name || null };
}
async function verifyViaLookup(token) {
  const key = envVal('FIREBASE_API_KEY') || 'AIzaSyDtSLwYJDiL-1AOnwLDh-jxOQzG1xsDsHs';
  const r = await fetchWithTimeout(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + key,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) },
    AUTH_TIMEOUT_MS
  );
  if (!r.ok) return null;
  const j = await r.json();
  const u = j.users && j.users[0];
  return u ? { uid: u.localId, email: u.email || null, name: u.displayName || null } : null;
}
async function verifyFirebaseToken(token) {
  if (!token) return null;
  try { const u = await verifyJwt(token); if (u) return u; } catch (e) { /* tenta a alternativa */ }
  try { return await verifyViaLookup(token); } catch (e) { return null; }
}

const rateBuckets = new Map();
function rateAllow(key) {
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || now - b.ts > RATE_WINDOW_MS) { b = { ts: now, n: 0 }; rateBuckets.set(key, b); }
  b.n += 1;
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) if (now - v.ts > RATE_WINDOW_MS) rateBuckets.delete(k);
  }
  return b.n <= RATE_MAX;
}

function picalaiSystemPrompt(userName) {
  return [
    'És a PicalAi, a assistente de IA da rede social Picalta.',
    'Responde sempre em português de Portugal, com frases curtas, simpáticas e diretas.',
    'Podes conversar sobre qualquer assunto, mas o contexto é uma rede social de fotos/conversas/jogos/música/grupos.',
    'Se não souberes algo com certeza, admite-o em vez de inventar.',
    'Nunca fales da tua chave de API nem de detalhes técnicos do servidor.',
    userName ? `O nome do utilizador atual é ${userName}.` : '',
  ].filter(Boolean).join(' ');
}

async function callAi(messages, userName) {
  const cfg = aiConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const payload = {
    model: cfg.model,
    messages: [
      { role: 'system', content: picalaiSystemPrompt(userName) },
      ...messages.slice(-AI_MAX_MESSAGES),
    ],
    max_tokens: AI_MAX_USER_TOKENS,
    temperature: 0.6,
  };
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      let res, text;
      try {
        res = await fetch(cfg.base + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        text = await res.text();
      } catch (netErr) {
        const err = new Error('network: ' + (netErr && netErr.message));
        err.publicMsg = netErr && netErr.name === 'AbortError'
          ? 'O serviço de IA demorou demasiado a responder. Tenta outra vez.'
          : 'Não foi possível contactar o serviço de IA. Confirma o OVERCONTROL_BASE_URL (' + cfg.base.replace(/^https?:\/\//, '').slice(0, 60) + ').';
        throw err;
      }
      if (!res.ok) {
        let detail = text.slice(0, 300);
        try { const j = JSON.parse(text); detail = (j.error && (j.error.message || j.error)) || j.message || detail; } catch (e) {}
        detail = String(detail);
        // Alguns modelos novos não aceitam max_tokens / temperature: adapta e repete
        if (res.status === 400 && attempt < 2) {
          if (/max_tokens/i.test(detail) && payload.max_tokens) { payload.max_completion_tokens = payload.max_tokens; delete payload.max_tokens; continue; }
          if (/temperature/i.test(detail) && 'temperature' in payload) { delete payload.temperature; continue; }
        }
        const err = new Error('upstream ' + res.status + ': ' + detail);
        const short = detail.replace(/\s+/g, ' ').slice(0, 140).replace(new RegExp(cfg.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
        if (res.status === 401 || res.status === 403) err.publicMsg = 'A chave da IA foi recusada (HTTP ' + res.status + '). Confirma OVERCONTROL_API_KEY e se a chave ainda é válida.';
        else if (res.status === 404) err.publicMsg = 'O endpoint ou o modelo não existe (HTTP 404). Confirma OVERCONTROL_BASE_URL e OVERCONTROL_MODEL (' + cfg.model + ').';
        else if (res.status === 429) err.publicMsg = 'O serviço de IA está com limite de pedidos ou sem saldo (HTTP 429). ' + short;
        else err.publicMsg = 'O serviço de IA recusou o pedido (HTTP ' + res.status + '): ' + short;
        throw err;
      }
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) {
        const err = new Error('non-json upstream');
        err.publicMsg = 'O OVERCONTROL_BASE_URL não respondeu no formato esperado. Tem de ser um endpoint compatível com OpenAI (termina em /v1).';
        throw err;
      }
      const msg = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].message;
      let content = msg && msg.content;
      if (Array.isArray(content)) content = content.map((p) => (p && p.text) || '').join('');
      if (!content) {
        const err = new Error('empty response');
        err.publicMsg = 'A IA devolveu uma resposta vazia. Tenta outra vez.';
        throw err;
      }
      return { content: String(content) };
    }
    throw new Error('exhausted');
  } finally {
    clearTimeout(timer);
  }
}

/* Vercel Node handler */
module.exports = async function handler(req, res) {
  try {
    const path = req.url || '';
    const firebaseToken = String(req.headers['x-firebase-token'] || '').trim();

    // GET — estado (público: só revela configurado sim/não)
    if (req.method === 'GET') {
      const cfg = aiConfig();
      // Só devolve NOMES das variáveis em falta, nunca valores.
      return json(res, 200, { configured: cfg.ok, model: cfg.ok ? cfg.model : null, missing: cfg.missing });
    }

    // POST — chat
    if (req.method === 'POST') {
      const fbUser = await verifyFirebaseToken(firebaseToken);
      if (!fbUser) {
        return json(res, 401, { error: 'unauthorized', message: 'Não foi possível validar a tua sessão. Termina sessão, entra de novo e tenta outra vez.' });
      }
      if (!aiConfigured()) {
        return json(res, 503, {
          error: 'not_configured',
          missing: aiConfig().missing,
          message: 'A IA não está configurada no servidor. Falta: ' + aiConfig().missing.join(', ') + '. Define-as em Vercel > Settings > Environment Variables e faz Redeploy.',
        });
      }
      if (!rateAllow('uid:' + fbUser.uid)) {
        return json(res, 429, { error: 'rate_limited', message: 'Demasiados pedidos. Espera um momento.' });
      }
      let body = req.body;
      if (!body || typeof body === 'string') {
        try { body = JSON.parse(body || '{}'); } catch (e) { return json(res, 400, { error: 'bad_json', message: 'Corpo inválido.' }); }
      }
      if (!Array.isArray(body.messages) || !body.messages.length) {
        return json(res, 400, { error: 'bad_request', message: 'Falta o histórico de mensagens.' });
      }
      const clean = body.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-AI_MAX_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
      if (!clean.length) return json(res, 400, { error: 'bad_request', message: 'Mensagens inválidas.' });
      const userName = typeof body.userName === 'string' ? body.userName.slice(0, 40) : (fbUser.name || '');
      try {
        const out = await callAi(clean, userName);
        return json(res, 200, { reply: out.content });
      } catch (e) {
        const msg = (e && e.publicMsg) || 'Falha ao falar com a PicalAi. Tenta novamente.';
        console.error('[Picalta][ai]', e && e.message);
        return json(res, 502, { error: 'ai_error', message: msg });
      }
    }

    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'method_not_allowed', message: 'Método não suportado: ' + req.method + ' ' + path });
  } catch (e) {
    console.error('[Picalta][server]', e && e.message);
    return json(res, 500, { error: 'server', message: 'Erro interno.' });
  }
};
