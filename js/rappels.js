// Rappels et agenda externe, sans serveur :
//  - export .ics (événements, rendez-vous, tâches datées) à ouvrir dans l'agenda du téléphone ou de l'ordinateur :
//    c'est cet agenda qui sonne, même application fermée ;
//  - rappels dans l'application quand elle est ouverte (bandeau, et notification du système si autorisée).
import * as store from './store.js';
import * as model from './model.js';
import * as PL from './planning.js';
import * as D from './device.js';
import { toast } from './ui.js';

export const DEFAULTS = { tasks: true, rdv: true, events: true, prep: true, before: 30 };
export const prefs = () => ({ ...DEFAULTS, ...(store.getSettings().reminders || {}) });

// ───── Fichier .ics (RFC 5545)
const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);
const dt = (date, time) => `${date.replace(/-/g, '')}T${(time || '00:00').replace(':', '')}00`;
const dOnly = (date) => date.replace(/-/g, '');
function fold(line) { const out = []; let l = line; while (l.length > 74) { out.push(l.slice(0, 74)); l = ' ' + l.slice(74); } out.push(l); return out.join('\r\n'); }

/** Éléments datés à exporter. Aucune donnée confidentielle : pour un rendez-vous, seulement « Rendez-vous famille » + prénom. */
export function items({ from = model.todayIso(), withStudents = true } = {}) {
  const p = prefs(); const out = [];
  if (p.events) for (const e of store.all('event')) if ((e.endDate || e.date) >= from) out.push({ uid: e.id, title: e.title, date: e.date, endDate: e.endDate, start: e.start, end: e.end, notes: e.personal ? '' : (e.notes || '') });
  if (p.rdv) for (const r of store.all('rdvslot')) if (r.studentId && r.status === 'réservé' && r.date >= from) { const s = store.get(r.studentId); out.push({ uid: r.id, title: `Rendez-vous famille${withStudents && s ? ' de ' + s.firstName : ''}`, date: r.date, start: r.start, end: r.end, place: r.place }); }
  if (p.tasks) for (const t of store.all('task')) if (!t.done && t.due && t.due >= from) out.push({ uid: t.id, title: `À faire : ${t.title}`, date: t.due });
  return out.sort((a, b) => `${a.date}${a.start || ''}`.localeCompare(`${b.date}${b.start || ''}`));
}
export function buildIcs(list, { alarm = prefs().before } = {}) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Classeur//Agenda de classe//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Classeur', 'X-WR-TIMEZONE:Europe/Paris'];
  for (const it of list) {
    lines.push('BEGIN:VEVENT', `UID:${it.uid}@classeur`, `DTSTAMP:${now}`);
    if (it.start) { lines.push(`DTSTART;TZID=Europe/Paris:${dt(it.date, it.start)}`, `DTEND;TZID=Europe/Paris:${dt(it.endDate || it.date, it.end || it.start)}`); }
    else { lines.push(`DTSTART;VALUE=DATE:${dOnly(it.date)}`, `DTEND;VALUE=DATE:${dOnly(model.addDays(it.endDate || it.date, 1))}`); }
    lines.push(`SUMMARY:${esc(it.title)}`);
    if (it.place) lines.push(`LOCATION:${esc(it.place)}`);
    if (it.notes) lines.push(`DESCRIPTION:${esc(it.notes)}`);
    if (alarm && it.start) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(it.title)}`, `TRIGGER:-PT${Number(alarm)}M`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Ouvre le fichier : sur téléphone, le partage propose l'application Agenda ; sinon téléchargement. */
export async function exportIcs(opts) {
  const text = buildIcs(items(opts));
  const file = new File([text], 'classeur-agenda.ics', { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Agenda Classeur' }); return 'partagé'; } catch (e) { if (e.name === 'AbortError') return 'annulé'; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'téléchargé';
}

// ───── Rappels dans l'application
/** Ce qui mérite un rappel maintenant. */
export function due(now = new Date()) {
  const p = prefs(); const today = model.todayIso(now); const tomorrow = model.addDays(today, 1);
  const mins = now.getHours() * 60 + now.getMinutes(); const out = [];
  if (p.tasks) for (const t of store.all('task')) if (!t.done && t.due && t.due <= today) out.push({ key: `task:${t.id}:${t.due}`, text: `${t.due < today ? 'En retard' : 'Aujourd’hui'} : ${t.title}`, href: '#/taches' });
  const soon = (date, start) => date === today && start && model.minutes(start) - mins <= p.before && model.minutes(start) - mins >= 0;
  if (p.rdv) for (const r of store.all('rdvslot')) if (r.studentId && r.status === 'réservé' && soon(r.date, r.start)) out.push({ key: `rdv:${r.id}`, text: `Rendez-vous à ${r.start} (famille de ${store.get(r.studentId)?.firstName || '?'})`, href: '#/rdv' });
  if (p.events) for (const e of store.all('event')) if (soon(e.date, e.start)) out.push({ key: `event:${e.id}:${e.date}`, text: `À ${e.start} : ${e.title}`, href: `#/agenda?d=${e.date}` });
  if (p.prep && mins >= 15 * 60) { const cls = model.currentClass(); if (cls) { try { const n = PL.dayPlan(cls, tomorrow).entries.filter(e => e.kind !== 'event' && !e.session && !['annulée', 'reportée'].includes(e.status)).length; if (n) out.push({ key: `prep:${tomorrow}`, text: `Demain : ${n} créneau(x) sans fiche de séance`, href: `#/cahier?d=${tomorrow}` }); } catch { /* jour sans classe */ } } }
  return out;
}
export const canNotify = () => 'Notification' in window;
export async function askPermission() { if (!canNotify()) return 'indisponible'; return Notification.requestPermission(); }

let timer = null;
export async function check(now = new Date()) {
  const seen = (await D.get('reminded')) || {};
  const fresh = due(now).filter(x => !seen[x.key]);
  for (const x of fresh) {
    seen[x.key] = now.toISOString();
    toast(x.text, { action: 'Voir', onAction: () => { location.hash = x.href; }, timeout: 12000 });
    if (canNotify() && Notification.permission === 'granted' && document.visibilityState !== 'visible') { try { new Notification('Classeur', { body: x.text, tag: x.key, icon: 'icons/icon-192.png' }); } catch { /* */ } }
  }
  // On ne garde que 30 jours de mémoire.
  const limit = new Date(now.getTime() - 30 * 864e5).toISOString();
  for (const [k, v] of Object.entries(seen)) if (v < limit) delete seen[k];
  await D.set('reminded', seen);
  return fresh;
}
export function start() { if (timer) return; setTimeout(() => check().catch(() => {}), 4000); timer = setInterval(() => check().catch(() => {}), 60000); }
