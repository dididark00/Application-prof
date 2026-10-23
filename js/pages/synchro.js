// Réglages › Synchronisation : passer d'un appareil à l'autre par Nuage (apps.education.fr), sans serveur de l'application.
import * as store from '../store.js';
import * as model from '../model.js';
import * as SY from '../sync.js';
import * as D from '../device.js';
import { h, icon, toast, modal, field, pickFiles, badge } from '../ui.js';

const GUIDE = 'https://monaidenumerique.education.gouv.fr/dev/pdf/nuage/synchroniser_ses_donnees.pdf';
const NEXTCLOUD = 'https://nextcloud.com/fr/install/#install-clients';

export async function synchroTab() {
  const box = h('div', { class: 'stack', 'data-testid': 'synchro' });
  const draw = async () => box.replaceChildren(...await content(draw));
  await draw();
  return box;
}

async function content(redraw) {
  const me = await D.identity();
  const pw = await SY.savedPassword();
  const seen = (await D.get('seen')) || {};
  const last = await D.get('lastSync');
  const fh = await SY.folder();
  const perm = fh ? await SY.folderPermission(fh) : 'none';
  const auto = store.getSettings().syncAuto !== false;

  const pwIn = h('input', { type: 'password', autocomplete: 'new-password', value: pw, minlength: 8, 'data-testid': 'sync-password', placeholder: 'au moins 8 caractères, le même sur tous vos appareils' });
  const remember = h('input', { type: 'checkbox', checked: true, 'data-testid': 'sync-remember' });
  const getPw = async () => {
    const v = pwIn.value;
    if (!v || v.length < 8) { toast('Saisissez le mot de passe de synchronisation (8 caractères au moins).', { kind: 'error' }); pwIn.focus(); return null; }
    await SY.rememberPassword(remember.checked ? v : '');
    return v;
  };
  const busy = (btn, fn) => async () => { btn.disabled = true; try { await fn(); } catch (e) { modal({ title: 'Synchronisation impossible', body: h('p', {}, e.message), actions: [{ label: 'Fermer', primary: true }] }); } finally { btn.disabled = false; } };

  const receive = async (files, password) => {
    const reports = [];
    for (const f of files) {
      const parsed = await SY.readFile(f, password);
      if (await SY.needsChoice(parsed.payload)) {
        const choice = await firstTimeDialog(f);
        if (choice === 'cancel') continue;
        if (choice === 'replace') { const r = await SY.replaceParsed(parsed); reports.push(`${r.head.deviceName} : données reprises (${r.counts.records} éléments, ${r.counts.files} fichier(s))`); continue; }
      }
      const r = await SY.mergeParsed(parsed);
      reports.push(r.own ? `${f.name} : c’est le fichier de cet appareil, ignoré` : `${r.head.deviceName} (${model.frDateTime(r.head.at)}) : ${SY.summary(r.counts)}`);
    }
    if (reports.length) modal({ title: 'Synchronisation faite', body: h('ul', { 'data-testid': 'sync-report' }, reports.map(t => h('li', {}, t))), actions: [{ label: 'Fermer', primary: true }] });
    redraw();
  };

  const sendBtn = h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'sync-send' });
  sendBtn.append(icon('upload', 16), navigator.canShare ? 'Envoyer vers Nuage (partager)' : 'Créer le fichier pour Nuage');
  sendBtn.onclick = busy(sendBtn, async () => { const p = await getPw(); if (!p) return; const r = await SY.sendFile(p); if (r !== 'annulé') toast(r === 'partagé' ? 'Fichier partagé : choisissez l’application Nextcloud pour le déposer dans Nuage.' : 'Fichier créé dans vos téléchargements : déposez-le dans votre dossier Nuage.', { kind: 'success', timeout: 9000 }); redraw(); });
  const recvBtn = h('button', { class: 'btn', type: 'button', 'data-testid': 'sync-receive' }, icon('download', 16), 'Récupérer depuis Nuage…');
  recvBtn.onclick = busy(recvBtn, async () => { const p = await getPw(); if (!p) return; const files = await pickFiles({ accept: `${SY.EXT},application/json`, multiple: true }); if (files.length) await receive(files, p); });

  const folderCard = SY.folderSupported() ? h('section', { class: 'card stack' },
    h('h2', {}, 'Sur cet ordinateur : synchronisation d’un clic'),
    h('ol', {},
      h('li', {}, 'Installez une fois l’application de bureau Nextcloud, connectez-la à votre Nuage : un dossier « Nuage » apparaît sur l’ordinateur. ', h('a', { href: GUIDE, target: '_blank', rel: 'noopener' }, 'Guide officiel (Mon aide numérique)'), ' · ', h('a', { href: NEXTCLOUD, target: '_blank', rel: 'noopener' }, 'Télécharger Nextcloud')),
      h('li', {}, 'Créez dans ce dossier un sous-dossier, par exemple « Classeur », puis choisissez-le ci-dessous.'),
      h('li', {}, 'Faites de même sur vos autres ordinateurs. Téléphone et tablette : boutons « Envoyer » et « Récupérer » plus bas.')),
    fh ? h('p', {}, 'Dossier choisi : ', h('strong', {}, fh.name), ' ', perm === 'granted' ? badge('accès autorisé', 'ok') : badge('accès à redonner', 'warn')) : h('p', { class: 'muted' }, 'Aucun dossier choisi.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', 'data-testid': 'sync-folder', onclick: async () => { try { await SY.chooseFolder(); toast('Dossier choisi'); redraw(); } catch (e) { if (e.name !== 'AbortError') toast(e.message, { kind: 'error' }); } } }, fh ? 'Changer de dossier' : 'Choisir le dossier Nuage'),
      fh ? (() => { const b = h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'sync-now' }, 'Synchroniser maintenant');
        b.onclick = busy(b, async () => { const p = await getPw(); if (!p) return;
          const r = await SY.syncFolder(p);
          modal({ title: 'Synchronisation faite', body: h('div', { 'data-testid': 'sync-report' }, r.reports.length ? h('ul', {}, r.reports.map(x => h('li', {}, `${x.name} (${model.frDateTime(x.at)}) : ${SY.summary(x.counts)}`))) : h('p', {}, 'Aucun fichier nouveau d’un autre appareil.'), h('p', { class: 'muted small' }, `Fichier de cet appareil enregistré : ${r.file}`)), actions: [{ label: 'Fermer', primary: true }] });
          redraw(); });
        return b; })() : null,
      fh ? h('button', { class: 'btn btn-link', type: 'button', onclick: async () => { await SY.forgetFolder(); redraw(); } }, 'Oublier ce dossier') : null),
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: auto, onchange: (e) => store.setSettings({ syncAuto: e.target.checked }, { quiet: true }) }), 'Synchroniser automatiquement (à l’ouverture, puis après vos modifications) quand le mot de passe est mémorisé et l’accès au dossier autorisé'),
    h('p', { class: 'muted small' }, 'Le navigateur peut redemander l’accès au dossier après un redémarrage : un clic sur « Synchroniser maintenant » suffit.'))
    : h('section', { class: 'card' }, h('h2', {}, 'Synchronisation d’un clic'), h('p', { class: 'muted' }, 'Sur ordinateur avec Chrome ou Edge, l’application peut écrire directement dans votre dossier Nuage. Sur ce navigateur, utilisez « Envoyer » et « Récupérer ».'));

  return [
    h('section', { class: 'card stack' },
      h('h2', {}, 'Passer d’un appareil à l’autre avec Nuage'),
      h('p', {}, 'Nuage est l’espace de stockage gratuit des agents de l’Éducation nationale (apps.education.fr, 100 Go, serveurs du ministère). L’application y dépose un fichier par appareil, ', h('strong', {}, 'chiffré avec votre mot de passe'), ' : même dans Nuage, il est illisible sans lui. Chaque appareil lit les fichiers des autres et fusionne les changements élément par élément.'),
      h('div', { class: 'grid-2' },
        field('Nom de cet appareil', h('input', { value: me.name, 'data-testid': 'sync-device', onchange: async (e) => { await D.rename(e.target.value); redraw(); } })),
        field('Mot de passe de synchronisation', pwIn, 'Le même sur tous vos appareils. Perdu = fichiers illisibles : notez-le en lieu sûr. Il n’est envoyé nulle part.')),
      h('label', { class: 'inline' }, remember, 'Mémoriser sur cet appareil (nécessaire pour la synchronisation automatique)')),
    folderCard,
    h('section', { class: 'card stack' },
      h('h2', {}, 'Téléphone, tablette ou autre navigateur'),
      h('p', {}, '« Envoyer » prépare le fichier de cet appareil : sur téléphone, choisissez l’application Nextcloud dans le menu de partage pour le déposer dans Nuage. « Récupérer » ouvre les fichiers des autres appareils (depuis l’application Fichiers, reliée à Nextcloud).'),
      h('div', { class: 'row' }, sendBtn, recvBtn)),
    h('section', { class: 'card' },
      h('h2', {}, 'État'),
      h('ul', {},
        h('li', {}, 'Dernier envoi depuis cet appareil : ', last ? model.frDateTime(last) : h('strong', {}, 'jamais')),
        Object.values(seen).length ? Object.values(seen).map(s => h('li', {}, `Fusionné avec « ${s.name} » le ${model.frDateTime(s.mergedAt)} (fichier du ${model.frDateTime(s.fileAt)})`)) : h('li', { class: 'muted' }, 'Aucun autre appareil fusionné pour l’instant.')),
      h('p', { class: 'muted small' }, 'Si un même élément a été modifié sur deux appareils, la version la plus récente est gardée et l’autre reste consultable dans Réglages › Historique. Les éléments supprimés définitivement ne reviennent pas. Les réglages de sélection (année, classe affichées) restent propres à chaque appareil.')),
  ];
}

function firstTimeDialog(file) {
  return new Promise((resolve) => {
    let choice = 'cancel';
    modal({ title: 'Premier branchement de cet appareil', body: h('div', {},
      h('p', {}, `Cet appareil contient déjà des données et n’a jamais été synchronisé. Que faire avec « ${file.name} » ?`),
      h('ul', {}, h('li', {}, h('strong', {}, 'Remplacer : '), 'cet appareil reprend exactement les données de l’autre (conseillé si vous n’avez fait que des essais ici).'),
        h('li', {}, h('strong', {}, 'Fusionner : '), 'les deux contenus sont réunis. Attention : si vous aviez chargé la démonstration ou saisi la même classe sur les deux appareils, elle apparaîtra en double.'))),
    onClose: () => resolve(choice),
    actions: [{ label: 'Annuler' }, { label: 'Fusionner', testid: 'sync-merge', onClick: () => { choice = 'merge'; } }, { label: 'Remplacer cet appareil', primary: true, testid: 'sync-replace', onClick: () => { choice = 'replace'; } }] });
  });
}
