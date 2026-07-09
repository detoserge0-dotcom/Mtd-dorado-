// ══════════════════════════════════════════════════════════════════════════
// MTD Gestion Financière — Service Worker
// Gère le fonctionnement hors-ligne (cache) et les mises à jour automatiques.
//
// IMPORTANT : à chaque nouvelle version du site que vous déployez, changez
// la valeur de CACHE_NAME ci-dessous (ex: 'mtd-v8', 'mtd-v9', ...).
// C'est ce changement qui permet au navigateur de détecter qu'une nouvelle
// version existe et de proposer la mise à jour aux utilisateurs.
// ══════════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'mtd-gestion-v24';

// Liste des fichiers essentiels à mettre en cache pour le fonctionnement hors-ligne.
// Adaptez les noms si vos fichiers portent des noms différents.
const FICHIERS_A_METTRE_EN_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// Scripts externes (CDN) dont l'application a besoin, y compris hors-ligne :
// Firebase (base de données + authentification), Chart.js (graphiques), et
// surtout qrcodejs / html5-qrcode (génération et scan des QR codes des reçus).
// Sans ce pré-cache, ces scripts n'étaient mis en cache qu'APRÈS un premier
// chargement en ligne réussi — d'où des QR codes absents de façon intermittente
// selon la qualité de la connexion au moment de l'utilisation.
const FICHIERS_CDN_A_METTRE_EN_CACHE = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// ── INSTALLATION : met en cache les fichiers de l'application ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Chaque fichier local est mis en cache individuellement : si une icône
      // n'existe pas encore ou porte un nom différent, ça n'empêche pas index.html
      // et manifest.json d'être mis en cache correctement.
      const local = FICHIERS_A_METTRE_EN_CACHE.map((url) =>
        cache.add(url).catch(() => {})
      );
      // Chaque script CDN est mis en cache INDIVIDUELLEMENT (pas addAll) : si un
      // seul échoue (CORS, CDN temporairement indisponible...), les autres sont
      // quand même sauvegardés au lieu de tout annuler en bloc.
      const cdn = FICHIERS_CDN_A_METTRE_EN_CACHE.map((url) =>
        cache.add(url).catch(() => {})
      );
      return Promise.all([...local, ...cdn]);
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
        // Met à jour le cache avec la version fraîche du réseau. event.waitUntil()
        // garde le service worker actif jusqu'à ce que cette écriture soit terminée :
        // sans ça, sur une connexion lente, le navigateur pouvait couper le service
        // worker juste après avoir renvoyé la réponse à la page, avant que le fichier
        // (ex. la librairie de QR code) ait fini d'être sauvegardé en cache — ce qui
        // provoquait une disponibilité hors-ligne incohérente d'une fois sur l'autre.
        const copie = reponse.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie)).catch(() => {})
        );
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
