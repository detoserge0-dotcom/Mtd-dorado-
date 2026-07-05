// ══════════════════════════════════════════════════════════════════════════
// MTD Gestion Financière — Service Worker
// Gère le fonctionnement hors-ligne (cache) et les mises à jour automatiques.
//
// IMPORTANT : à chaque nouvelle version du site que vous déployez, changez
// la valeur de CACHE_NAME ci-dessous (ex: 'mtd-v8', 'mtd-v9', ...).
// C'est ce changement qui permet au navigateur de détecter qu'une nouvelle
// version existe et de proposer la mise à jour aux utilisateurs.
// ══════════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'mtd-gestion-v7';

// Liste des fichiers essentiels à mettre en cache pour le fonctionnement hors-ligne.
// Adaptez les noms si vos fichiers portent des noms différents.
const FICHIERS_A_METTRE_EN_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// ── INSTALLATION : met en cache les fichiers de l'application ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FICHIERS_A_METTRE_EN_CACHE))
      .catch(() => {
        // Si certains fichiers n'existent pas (ex: manifest.json absent), on n'échoue pas
        // l'installation entière — l'app fonctionnera quand même en ligne.
      })
  );
});

// ── ACTIVATION : supprime les anciens caches obsolètes ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(
        noms
          .filter((nom) => nom !== CACHE_NAME)
          .map((nom) => caches.delete(nom))
      )
    ).then(() => self.clients.claim())
  );
});

// ── RÉCUPÉRATION DES PAGES : réseau en priorité, cache en secours (hors-ligne) ──
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((reponse) => {
        // Met à jour le cache avec la version fraîche du réseau
        const copie = reponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie));
        return reponse;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── MISE À JOUR MANUELLE : reçoit l'ordre d'activer immédiatement la nouvelle version ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
