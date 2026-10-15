// Gera public/env-config.js a partir do ficheiro .env (local) ou das variáveis de ambiente (Vercel).
// Só são copiados valores públicos por desenho (configuração web do Firebase e Cloudinary sem assinatura).
// Chaves secretas, como OVERCONTROL_API_KEY, NUNCA entram no front-end: ficam só em api/picalai.js.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, '.env');
const fromFile = {};
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    fromFile[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const get = (k) => (process.env[k] ?? fromFile[k] ?? '').trim();

const env = {
  firebase: {
    apiKey: get('FIREBASE_API_KEY'),
    authDomain: get('FIREBASE_AUTH_DOMAIN'),
    projectId: get('FIREBASE_PROJECT_ID'),
    storageBucket: get('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: get('FIREBASE_MESSAGING_SENDER_ID'),
    appId: get('FIREBASE_APP_ID'),
  },
  cloudinary: {
    cloudName: get('CLOUDINARY_CLOUD_NAME'),
    unsignedPreset: get('CLOUDINARY_UNSIGNED_PRESET'),
  },
};
writeFileSync(
  join(root, 'public', 'env-config.js'),
  '/* Ficheiro gerado por scripts/build-config.mjs. Não editar à mão. */\nwindow.PICALTA_ENV = ' + JSON.stringify(env, null, 2) + ';\n'
);
const fb = Object.values(env.firebase).every(Boolean);
console.log('[Picalta] Firebase:', fb ? 'configurado pelo .env' : 'a usar a configuração incluída no código (firebase.js)');
console.log('[Picalta] Cloudinary:', env.cloudinary.cloudName && env.cloudinary.unsignedPreset ? 'configurado' : 'NÃO configurado (uploads de fotografias desativados)');
