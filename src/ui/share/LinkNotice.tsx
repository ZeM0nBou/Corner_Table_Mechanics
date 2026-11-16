import { fromSI } from '@core/units';
import type { SnapshotDifference } from '@share/materialLink';
import { Button } from '@ui/components/Button';
import { formatNumber } from '@ui/format';
import type { LinkedMaterial } from './usePageMaterial';

/** Ouverture de la page (toute `LinkLoad<P>` convient). */
type LinkStatus = { kind: 'none' } | { kind: 'ok' } | { kind: 'error'; message: string };

const DIFF_LABELS: Record<
  SnapshotDifference['key'],
  { label: string; show: (v: number) => string }
> = {
  E_Pa: { label: 'E', show: (v) => `${formatNumber(fromSI(v, 'stress', 'GPa'))} GPa` },
  nu: { label: 'ν', show: (v) => formatNumber(v) },
  rho_kg_m3: { label: 'ρ', show: (v) => `${formatNumber(v)} kg/m³` },
  Re_Pa: { label: 'Re', show: (v) => `${formatNumber(fromSI(v, 'stress', 'MPa'))} MPa` },
  Rm_Pa: { label: 'Rm', show: (v) => `${formatNumber(fromSI(v, 'stress', 'MPa'))} MPa` },
};

function showValue(d: SnapshotDifference, v: number | undefined): string {
  return v === undefined ? 'non renseignée' : DIFF_LABELS[d.key].show(v);
}

function MaterialStatus({ linked }: { linked: LinkedMaterial }) {
  const { resolved } = linked;
  const name = resolved.material.name;
  switch (resolved.status.kind) {
    case 'reference':
    case 'perso-local':
      return null;
    case 'reference-modifiee':
      return (
        <div className="mt-2">
          <p>
            Le matériau a changé dans la base de référence depuis la création du lien. Le calcul
            reprend les valeurs du lien (« {name} ») :
          </p>
          <ul className="mt-1 list-disc pl-5">
            {resolved.status.differences.map((d) => (
              <li key={d.key}>
                <i className="font-serif">{DIFF_LABELS[d.key].label}</i> : {showValue(d, d.link)}{' '}
                dans le lien, {showValue(d, d.current)} dans la base actuelle.
              </li>
            ))}
          </ul>
        </div>
      );
    case 'reference-inconnue':
      return (
        <p className="mt-2">
          Le matériau du lien n’existe pas dans la base de référence actuelle : il est reconstitué à
          partir des valeurs du lien (« {name} », non vérifié).
        </p>
      );
    case 'perso-lien':
      return (
        <div className="mt-2">
          <p>
            Matériau personnalisé « {name} » reçu par le lien : il est utilisé pour ce calcul
            seulement.
          </p>
          {linked.saved ? (
            <p className="mt-1 font-medium">Ajouté à vos matériaux.</p>
          ) : linked.conflict ? (
            <div className="mt-1">
              <p>Un de vos matériaux porte déjà le même identifiant, avec d’autres valeurs.</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Button onClick={() => linked.save('keep-both')}>
                  Ajouter à mes matériaux (garder les deux)
                </Button>
                <Button variant="danger" onClick={() => linked.save('replace')}>
                  Remplacer le mien
                </Button>
              </div>
            </div>
          ) : (
            <Button className="mt-1" onClick={() => linked.save('keep-both')}>
              Ajouter à mes matériaux
            </Button>
          )}
        </div>
      );
  }
}

/**
 * Bandeau affiché quand la page est ouverte par un lien : lien lu ou inutilisable,
 * et état du matériau reçu.
 */
export function LinkNotice({
  link,
  linked,
}: {
  link: LinkStatus;
  linked: LinkedMaterial | undefined;
}) {
  if (link.kind === 'none') return null;
  if (link.kind === 'error') {
    return (
      <div
        role="alert"
        className="no-print rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
      >
        <p className="font-medium">Lien de partage inutilisable.</p>
        <p className="mt-1">{link.message} Les valeurs par défaut sont affichées.</p>
      </div>
    );
  }
  return (
    <div className="no-print rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
      <p>
        Calcul ouvert depuis un lien partagé. Vos modifications ne changent pas ce lien : utilisez «
        Copier le lien » pour partager la nouvelle version.
      </p>
      {linked && <MaterialStatus linked={linked} />}
    </div>
  );
}
