interface ModuleEntry {
  name: string;
  description: string;
  /** Route du module ; absente tant que le module n'est pas disponible. */
  route?: string;
}

/** Modules de la feuille de route (CLAUDE.md), dans l'ordre. */
const MODULES: readonly ModuleEntry[] = [
  {
    name: 'Matériaux',
    description: 'Base de référence et unités',
    route: 'materiaux',
  },
  { name: 'Propriétés de sections', description: 'A, I, W, i, J' },
  { name: 'Poutres isostatiques', description: 'Réactions, V, M, flèche' },
  { name: 'Contraintes et critères', description: 'von Mises, Tresca, sécurité' },
  { name: 'Flambement d’Euler', description: 'Longueurs de flambement usuelles' },
];

export function HomePage() {
  return (
    <>
      <section aria-labelledby="modules-titre">
        <h2 id="modules-titre" className="text-lg font-medium">
          Modules
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {MODULES.map((m) =>
            m.route !== undefined ? (
              <li key={m.name}>
                <a
                  href={`#/${m.route}`}
                  className="block rounded-lg border border-slate-300 bg-white px-4 py-3 hover:border-sky-600 hover:shadow-sm"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="block text-sm text-slate-600">{m.description}</span>
                </a>
              </li>
            ) : (
              <li
                key={m.name}
                className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-slate-500"
              >
                <span className="font-medium">{m.name}</span>
                <span className="block text-sm">{m.description} — à venir</span>
              </li>
            ),
          )}
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
    </>
  );
}
