import { Disclaimer } from '@ui/components/Disclaimer';

/** Modules prévus par la feuille de route (CLAUDE.md), dans l'ordre. */
const MODULES_A_VENIR = [
  'Matériaux et unités',
  'Propriétés de sections',
  'Poutres isostatiques',
  'Contraintes et critères',
  'Flambement d’Euler',
] as const;

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <h1 className="text-xl font-semibold sm:text-2xl">Calculs RDM — coin de table</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pré-dimensionnement en résistance des matériaux, directement dans le navigateur.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <section aria-labelledby="modules-titre">
          <h2 id="modules-titre" className="text-lg font-medium">
            Modules à venir
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {MODULES_A_VENIR.map((nom) => (
              <li
                key={nom}
                className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-slate-500"
              >
                {nom}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="hypotheses-titre" className="mt-10">
          <h2 id="hypotheses-titre" className="text-lg font-medium">
            Hypothèses par défaut
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Petites déformations, matériau élastique linéaire homogène isotrope, théorie
            d’Euler-Bernoulli (sauf indication contraire). Unités SI en interne.
          </p>
        </section>
      </main>

      <footer className="sticky bottom-0">
        <Disclaimer />
      </footer>
    </div>
  );
}
