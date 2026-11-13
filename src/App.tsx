import { BeamsPage } from '@ui/beams/BeamsPage';
import { Disclaimer } from '@ui/components/Disclaimer';
import { HomePage } from '@ui/HomePage';
import { MaterialsPage } from '@ui/materials/MaterialsPage';
import { SectionsPage } from '@ui/sections/SectionsPage';
import { useHashRoute } from '@ui/useHashRoute';

const NAV = [
  { route: '', label: 'Accueil' },
  { route: 'materiaux', label: 'Matériaux' },
  { route: 'sections', label: 'Sections' },
  { route: 'poutres', label: 'Poutres' },
] as const;

function Page({ route }: { route: string }) {
  switch (route) {
    case 'materiaux':
      return <MaterialsPage />;
    case 'sections':
      return <SectionsPage />;
    case 'poutres':
      return <BeamsPage />;
    default:
      return <HomePage />;
  }
}

export default function App() {
  const route = useHashRoute();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">
              <a href="#/">Calculs RDM — coin de table</a>
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Pré-dimensionnement en résistance des matériaux, directement dans le navigateur.
            </p>
          </div>
          <nav aria-label="Navigation principale" className="no-print flex gap-1">
            {NAV.map((item) => {
              const active = route === item.route;
              return (
                <a
                  key={item.route}
                  href={`#/${item.route}`}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm ${
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Page route={route} />
      </main>

      <footer className="sticky bottom-0">
        <Disclaimer />
      </footer>
    </div>
  );
}
