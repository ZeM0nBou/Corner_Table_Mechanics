import { useSyncExternalStore } from 'react';

/**
 * Navigation minimale par ancre (#/materiaux…), sans bibliothèque de routage.
 * Compatible GitHub Pages (pas de réécriture d'URL côté serveur).
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function getRoute(): string {
  return window.location.hash.replace(/^#\/?/, '').split('?')[0] ?? '';
}

/** Route courante, sans le « #/ » initial (chaîne vide pour l'accueil). */
export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, getRoute, () => '');
}
