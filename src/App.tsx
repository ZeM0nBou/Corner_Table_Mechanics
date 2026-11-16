import { lazy, Suspense } from 'react';
import { Disclaimer } from '@ui/components/Disclaimer';
import { HomePage } from '@ui/HomePage';
import { PrintHeader, PrintProvider } from '@ui/print/PrintProvider';
import { SharedPageLoader } from '@ui/share/SharedPageLoader';
import { useHashRoute, useShareParam } from '@ui/useHashRoute';

// Pages chargées à la demande : le paquet initial reste léger (l'accueil s'affiche vite).
const MaterialsPage = lazy(() =>
  import('@ui/materials/MaterialsPage').then((m) => ({ default: m.MaterialsPage })),
);
const SectionsPage = lazy(() =>
  import('@ui/sections/SectionsPage').then((m) => ({ default: m.SectionsPage })),
);
const BeamsPage = lazy(() => import('@ui/beams/BeamsPage').then((m) => ({ default: m.BeamsPage })));
const BucklingPage = lazy(() =>
  import('@ui/buckling/BucklingPage').then((m) => ({ default: m.BucklingPage })),
);
const StressPage = lazy(() =>
  import('@ui/stress/StressPage').then((m) => ({ default: m.StressPage })),
);

const NAV = [
  { route: '', label: 'Accueil' },
  { route: 'materiaux', label: 'Matériaux' },
  { route: 'sections', label: 'Sections' },
  { route: 'poutres', label: 'Poutres' },
  { route: 'contraintes', label: 'Contraintes' },
  { route: 'flambement', label: 'Flambement' },
] as const;

/** Ramène l'onglet actif dans la partie visible de la barre (défilement horizontal seul). */
function scrollIntoViewRef(el: HTMLAnchorElement | null) {
  const nav = el?.parentElement;
  if (!el || !nav || nav.scrollWidth <= nav.clientWidth) return;
  const left = el.offsetLeft - nav.offsetLeft;
  if (left < nav.scrollLeft || left + el.offsetWidth > nav.scrollLeft + nav.clientWidth) {
    nav.scrollTo({ left: left - (nav.clientWidth - el.offsetWidth) / 2 });
  }
}

/**
 * Page de la route. Les pages de calcul lisent d'abord le lien partagé éventuel
 * (`#/poutres?c=…`) ; la clé remonte la page quand le lien change.
 */
function Page({ route, param }: { route: string; param: string | undefined }) {
  switch (route) {
    case 'materiaux':
      return <MaterialsPage />;
    case 'sections':
      return (
        <SharedPageLoader key={param} page="sections" param={param}>
          {(link) => <SectionsPage link={link} />}
        </SharedPageLoader>
      );
    case 'poutres':
      return (
        <SharedPageLoader key={param} page="poutres" param={param}>
          {(link) => <BeamsPage link={link} />}
        </SharedPageLoader>
      );
    case 'contraintes':
      return (
        <SharedPageLoader key={param} page="contraintes" param={param}>
          {(link) => <StressPage link={link} />}
        </SharedPageLoader>
      );
    case 'flambement':
      return (
        <SharedPageLoader key={param} page="flambement" param={param}>
          {(link) => <BucklingPage link={link} />}
        </SharedPageLoader>
      );
    default:
      return <HomePage />;
  }
}

export default function App() {
  const route = useHashRoute();
  const param = useShareParam();

  return (
    <PrintProvider>
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 print:min-h-0 print:bg-white">
        <header className="no-print border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-6">
            <div>
              <h1 className="text-xl font-semibold sm:text-2xl">
                <a href="#/">Calculs RDM — coin de table</a>
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Pré-dimensionnement en résistance des matériaux, directement dans le navigateur.
              </p>
            </div>
            {/*
              Sur un écran étroit, les onglets défilent horizontalement dans la barre au lieu
              d'élargir la page ; l'onglet actif est ramené dans la zone visible.
            */}
            <nav
              aria-label="Navigation principale"
              className="no-print -mx-4 flex max-w-[calc(100%+2rem)] min-w-0 gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] [mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)] sm:[mask-image:none] sm:mx-0 sm:max-w-full sm:px-0"
            >
              {NAV.map((item) => {
                const active = route === item.route;
                return (
                  <a
                    key={item.route}
                    ref={active ? scrollIntoViewRef : undefined}
                    href={`#/${item.route}`}
                    aria-current={active ? 'page' : undefined}
                    className={`shrink-0 rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${
                      active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 print:max-w-none print:p-0">
          <PrintHeader pageTitle={NAV.find((n) => n.route === route)?.label ?? NAV[0].label} />
          <Suspense fallback={<p className="text-sm text-slate-500">Chargement…</p>}>
            <Page route={route} param={param} />
          </Suspense>
        </main>

        <footer className="sticky bottom-0 print:static">
          <Disclaimer />
        </footer>
      </div>
    </PrintProvider>
  );
}
