// Aperçu intégré des liens Google Drive / Docs / Slides / Sheets et Canva, sans connexion ni clé :
// on transforme le lien de partage en lien d'aperçu prévu par le service pour l'intégration.
// L'aperçu ne s'affiche que si le document est partagé (ou si vous êtes connectée à ce service dans ce navigateur).
export const EMBED_HOSTS = ['https://drive.google.com', 'https://docs.google.com', 'https://www.canva.com'];

/** { src, service } pour un lien intégrable, sinon null. */
export function embedOf(url) {
  let u; try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'drive.google.com') {
    const id = (u.pathname.match(/\/file\/d\/([\w-]{10,})/) || [])[1] || (u.pathname === '/open' ? u.searchParams.get('id') : null);
    return id && /^[\w-]+$/.test(id) ? { src: `https://drive.google.com/file/d/${id}/preview`, service: 'Google Drive' } : null;
  }
  if (host === 'docs.google.com') {
    const m = u.pathname.match(/^\/(document|spreadsheets|presentation|forms)\/d\/(e\/)?([\w-]{10,})/);
    if (!m) return null;
    const [, kind, pub, id] = m;
    const names = { document: 'Google Docs', spreadsheets: 'Google Sheets', presentation: 'Google Slides', forms: 'Google Forms' };
    if (kind === 'forms') return { src: `https://docs.google.com/forms/d/${pub || ''}${id}/viewform?embedded=true`, service: names.forms };
    if (pub) return { src: `https://docs.google.com/${kind}/d/e/${id}/${kind === 'presentation' ? 'embed' : 'pubhtml'}`, service: names[kind] };
    return { src: `https://docs.google.com/${kind}/d/${id}/preview`, service: names[kind] };
  }
  if (host === 'canva.com') {
    const m = u.pathname.match(/^\/design\/([\w-]{6,})(?:\/([\w-]{6,}))?/);
    if (!m) return null;
    return { src: `https://www.canva.com/design/${m[1]}${m[2] && m[2] !== 'edit' && m[2] !== 'view' ? '/' + m[2] : ''}/view?embed`, service: 'Canva' };
  }
  return null;
}

import { h, modal, safeUrl } from './ui.js';
/** Cadre d'aperçu + lien d'ouverture (toujours présent : si l'aperçu reste vide, le lien fonctionne). */
export function embedFrame(url, title = '', { note = true } = {}) {
  const e = embedOf(url); const open = safeUrl(url);
  return h('div', { class: 'embed-wrap', 'data-testid': 'embed' },
    e ? h('iframe', { class: 'embed-frame', src: e.src, title: title || e.service, allow: 'fullscreen', allowfullscreen: true, referrerpolicy: 'no-referrer-when-downgrade', loading: 'lazy' }) : null,
    h('div', { class: 'row small' },
      open ? h('a', { class: 'btn btn-small', href: open, target: '_blank', rel: 'noopener noreferrer' }, `Ouvrir dans ${e ? e.service : 'un nouvel onglet'}`) : null,
      note && e ? h('span', { class: 'muted' }, 'Aperçu vide ou « accès refusé » ? Le document n’est pas partagé par lien, ou vous n’êtes pas connectée à ce service dans ce navigateur : utilisez « Ouvrir ».') : null));
}
export function previewLink(f) {
  modal({ title: f.name, wide: true, body: embedFrame(f.url, f.name), actions: [{ label: 'Fermer' }] });
}
