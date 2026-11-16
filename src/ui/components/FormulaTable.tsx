import { Fragment, useState, type ReactNode } from 'react';
import { Tex } from './Tex';

/** Formule d'un résultat : expression, application numérique et source (LaTeX). */
export interface RowFormula {
  latex: string;
  application: string;
  source: string;
}

export interface FormulaRow {
  key: string;
  label: string;
  symbol: string;
  value: ReactNode;
  /** Précision sous le libellé (abscisse, fibre…). */
  detail?: string;
  formula?: RowFormula | undefined;
}

/**
 * Tableau de résultats : libellé, symbole, valeur, et bouton ƒ qui déplie la formule,
 * son application numérique et sa source (volet « Détail du calcul » de CLAUDE.md).
 */
export function FormulaTable({ rows }: { rows: readonly FormulaRow[] }) {
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const toggle = (k: string) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <table className="mt-2 w-full">
      <tbody>
        {rows.map((r) => {
          const f = r.formula;
          const open = f !== undefined && shown.has(r.key);
          return (
            <Fragment key={r.key}>
              <tr className={open ? '' : 'border-b border-slate-100'}>
                <th
                  scope="row"
                  className="py-1.5 pr-3 text-left text-sm font-normal text-slate-600"
                >
                  {r.label}
                  {r.detail !== undefined && r.detail !== '' && (
                    <span className="block text-xs text-slate-500">{r.detail}</span>
                  )}
                </th>
                <td className="py-1.5 pr-2 font-serif italic whitespace-nowrap">{r.symbol}</td>
                <td className="py-1.5 text-right">{r.value}</td>
                <td className="no-print w-8 py-1.5 pl-2 text-right">
                  {f && (
                    <button
                      type="button"
                      onClick={() => toggle(r.key)}
                      aria-expanded={open}
                      aria-label={`${open ? 'Masquer' : 'Afficher'} la formule de ${r.symbol}`}
                      title={`${open ? 'Masquer' : 'Afficher'} la formule`}
                      className={`rounded px-1.5 font-serif italic ${open ? 'bg-sky-100 text-sky-800' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                      ƒ
                    </button>
                  )}
                </td>
              </tr>
              {open && (
                <tr className="border-b border-slate-100">
                  <td colSpan={4} className="pb-3">
                    <div className="overflow-x-auto rounded-md bg-slate-50 px-3 py-2 text-sm">
                      <Tex expr={f.latex} className="block" />
                      <Tex expr={f.application} className="mt-1 block text-slate-700" />
                      <p className="mt-1.5 text-xs text-slate-500">Source : {f.source}</p>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
