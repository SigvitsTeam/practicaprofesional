import { readFile } from 'node:fs/promises';

const indexPath = new URL('../dist/frontend/browser/index.html', import.meta.url);
const vercelPath = new URL('../vercel.json', import.meta.url);
const html = await readFile(indexPath, 'utf8');
const vercel = JSON.parse(await readFile(vercelPath, 'utf8'));
const violations = [];

const eventHandlers = [...html.matchAll(/\s(on[a-z]+)\s*=/giu)].map((match) => match[1]);
if (eventHandlers.length) {
  violations.push(`event handlers inline: ${[...new Set(eventHandlers)].join(', ')}`);
}

const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)].filter(
  ([, attributes, content]) => !/\ssrc\s*=/iu.test(attributes) && content.trim().length > 0,
);
if (inlineScripts.length) violations.push(`${inlineScripts.length} script(s) inline`);

if (/\b(?:href|src)\s*=\s*["']\s*javascript:/iu.test(html)) {
  violations.push('URL javascript:');
}

if (
  !/<meta\s+name=["']referrer["']\s+content=["']strict-origin-when-cross-origin["']/iu.test(html)
) {
  violations.push('política referrer del HTML incompatible con el proveedor cartográfico');
}

const referrerHeader = vercel.headers
  ?.flatMap((rule) => rule.headers ?? [])
  .find((header) => header.key?.toLowerCase() === 'referrer-policy')?.value;
if (referrerHeader !== 'strict-origin-when-cross-origin') {
  violations.push('cabecera Referrer-Policy de Vercel incompatible con el proveedor cartográfico');
}

if (violations.length) {
  throw new Error(`El index de producción viola la CSP: ${violations.join('; ')}.`);
}

console.log('CSP y política de referencia verificadas para el mapa de producción.');
