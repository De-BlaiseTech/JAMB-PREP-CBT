/* JAMB Prep CBT - PWA installation helper */
/* JAMB Prep CBT startup splash */
(() => {
  const splashKey = 'jambStartupSplashShown';
  let alreadyShown = false;
  try { alreadyShown = sessionStorage.getItem(splashKey) === '1'; } catch (_) {}

  if (alreadyShown) return;

  const showSplash = () => {
    if (document.getElementById('jambStartupSplash')) return;

    const splash = document.createElement('div');
    splash.id = 'jambStartupSplash';
    splash.setAttribute('role', 'status');
    splash.setAttribute('aria-label', 'Loading JAMB Prep CBT');
    splash.innerHTML = `
      <div class="jamb-splash-inner">
        <img class="jamb-splash-logo" src="icons/icon-512.png" alt="JAMB Prep CBT">
        <div class="jamb-splash-title">JAMB PREP CBT</div>
        <div class="jamb-splash-subtitle">Practice • Prepare • Excel</div>
        <div class="jamb-splash-spinner" aria-hidden="true"></div>
        <div class="jamb-splash-loading">Loading your CBT experience...</div>
      </div>
    `;
    document.body.prepend(splash);

    try { sessionStorage.setItem(splashKey, '1'); } catch (_) {}

    const hide = () => {
      splash.classList.add('is-hidden');
      window.setTimeout(() => splash.remove(), 400);
    };

    // Keep the splash visible long enough to be seen, but never hold the app unnecessarily.
    const minimumTime = 900;
    const startedAt = performance.now();
    const finish = () => {
      const remaining = Math.max(0, minimumTime - (performance.now() - startedAt));
      window.setTimeout(hide, remaining);
    };

    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish, { once: true });
    window.setTimeout(hide, 3000);
  };

  if (document.body) showSplash();
  else document.addEventListener('DOMContentLoaded', showSplash, { once: true });
})();

(() => {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) return;

  let deferredPrompt = null;
  let installButton = null;

  const storageKey = 'jambPwaInstallDismissed';

  function createInstallBanner() {
    if (document.getElementById('pwaInstallBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-install-icon">🎓</div>
      <div class="pwa-install-copy">
        <strong>Install JAMB Prep CBT</strong>
        <span>Install the app on your phone for quick access.</span>
      </div>
      <button type="button" class="btn primary pwa-install-btn">Install</button>
      <button type="button" class="pwa-close-btn" aria-label="Close">×</button>
    `;
    document.body.appendChild(banner);

    installButton = banner.querySelector('.pwa-install-btn');
    banner.querySelector('.pwa-close-btn').onclick = () => {
      banner.remove();
      try { sessionStorage.setItem(storageKey, '1'); } catch (_) {}
    };
    installButton.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.remove();
      if (result?.outcome === 'accepted') {
        try { localStorage.setItem('jambPwaInstalled', '1'); } catch (_) {}
      }
    };
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;

    let dismissed = false;
    try { dismissed = sessionStorage.getItem(storageKey) === '1'; } catch (_) {}

    if (!dismissed) createInstallBanner();
    window.dispatchEvent(new CustomEvent('jamb:pwa-install-ready'));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('pwaInstallBanner')?.remove();
    try { localStorage.setItem('jambPwaInstalled', '1'); } catch (_) {}
  });

  // Keep already-installed copies current. The service worker is versioned,\n  // checks the network first, and activates new versions immediately. When\n  // a new controller takes over an existing page, offer a safe refresh rather\n  // than forcing a reload in the middle of a CBT.\n  let hadController = !!navigator.serviceWorker.controller;\n  let updateBannerShown = false;\n\n  function showUpdateBanner() {\n    if (updateBannerShown || document.getElementById('pwaUpdateBanner')) return;\n    updateBannerShown = true;\n    const banner = document.createElement('div');\n    banner.id = 'pwaUpdateBanner';\n    banner.className = 'pwa-install-banner pwa-update-banner';\n    banner.innerHTML = `\n      <div class="pwa-install-icon">🔄</div>\n      <div class="pwa-install-copy">\n        <strong>New version available</strong>\n        <span>Your JAMB CBT app has been updated.</span>\n      </div>\n      <button type="button" class="btn primary pwa-install-btn">Update Now</button>\n      <button type="button" class="pwa-close-btn" aria-label="Close">×</button>\n    `;\n    document.body.appendChild(banner);\n    banner.querySelector('.pwa-close-btn').onclick = () => banner.remove();\n    banner.querySelector('.pwa-install-btn').onclick = () => {\n      window.location.reload();\n    };\n  }\n\n  if ('serviceWorker' in navigator) {\n    navigator.serviceWorker.addEventListener('controllerchange', () => {\n      if (hadController) showUpdateBanner();\n      hadController = true;\n    });\n\n    window.addEventListener('load', async () => {\n      try {\n        const registration = await navigator.serviceWorker.register('./sw.js');\n        await registration.update();\n        // Recheck when the app becomes visible again.\n        document.addEventListener('visibilitychange', () => {\n          if (document.visibilityState === 'visible') registration.update().catch(() => {});\n        });\n        window.setInterval(() => registration.update().catch(() => {}), 5 * 60 * 1000);\n      } catch (_) {}\n    }, { once: true });\n  }\n\n  // iPhone/iPad: there is no beforeinstallprompt event.
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isiOS && !window.navigator.standalone) {
    setTimeout(() => {
      let dismissed = false;
      try { dismissed = sessionStorage.getItem(storageKey) === '1'; } catch (_) {}
      if (dismissed || document.getElementById('pwaInstallBanner')) return;

      const banner = document.createElement('div');
      banner.id = 'pwaInstallBanner';
      banner.className = 'pwa-install-banner';
      banner.innerHTML = `
        <div class="pwa-install-icon">🎓</div>
        <div class="pwa-install-copy">
          <strong>Add JAMB Prep CBT to Home Screen</strong>
          <span>Tap Share, then “Add to Home Screen”.</span>
        </div>
        <button type="button" class="pwa-close-btn" aria-label="Close">×</button>
      `;
      document.body.appendChild(banner);
      banner.querySelector('.pwa-close-btn').onclick = () => {
        banner.remove();
        try { sessionStorage.setItem(storageKey, '1'); } catch (_) {}
      };
    }, 1500);
  }
})();
