import { useState } from 'react';
import { groupByFamily, REFERENCE_MATERIALS, type Material } from '@materials/index';
import { newCustomId } from '@materials/custom';
import { Button } from '@ui/components/Button';
import { ImportExportPanel } from './ImportExportPanel';
import { MaterialCard } from './MaterialCard';
import { MaterialForm } from './MaterialForm';
import { MaterialSelect, type MaterialGroups } from './MaterialSelect';
import { useCustomMaterials } from './useCustomMaterials';

/** Ce qu'affiche la page : la fiche du matériau choisi, ou un formulaire. */
type Mode =
  | { kind: 'view' }
  | { kind: 'create'; id: string; initial?: Material; title: string }
  | { kind: 'edit'; material: Material };

const DEFAULT_ID = REFERENCE_MATERIALS[0]?.id ?? '';

export function MaterialsPage() {
  const custom = useCustomMaterials();
  const [selectedId, setSelectedId] = useState(DEFAULT_ID);
  const [mode, setMode] = useState<Mode>({ kind: 'view' });

  const all = [...custom.materials, ...REFERENCE_MATERIALS];
  const selected = all.find((m) => m.id === selectedId) ?? REFERENCE_MATERIALS[0];
  const isCustom = (m: Material) => custom.materials.some((c) => c.id === m.id);
  const takenIds = new Set(all.map((m) => m.id));

  const groups: MaterialGroups = [
    ['Personnalisés', custom.materials],
    ...groupByFamily(REFERENCE_MATERIALS),
  ];

  const startCreate = (from?: Material) =>
    setMode({
      kind: 'create',
      title: from ? `Nouveau matériau à partir de ${from.name}` : 'Nouveau matériau',
      id: newCustomId(from ? `${from.name} copie` : 'materiau', takenIds),
      ...(from && {
        initial: { ...from, name: `${from.name} (copie)`, verified: false },
      }),
    });

  const save = (m: Material) => {
    custom.upsert(m);
    setSelectedId(m.id);
    setMode({ kind: 'view' });
  };

  const remove = (m: Material) => {
    if (window.confirm(`Supprimer le matériau personnalisé « ${m.name} » ?`)) {
      custom.remove(m.id);
      setSelectedId(DEFAULT_ID);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Matériaux</h2>
        <p className="mt-1 text-sm text-slate-600">
          Base de référence ({REFERENCE_MATERIALS.length} entrées) et vos matériaux personnalisés.
          Valeurs indicatives pour le pré-dimensionnement : Re est la moyenne des tranches
          d’épaisseur courantes, Rm la valeur minimale garantie par la norme.
        </p>
      </div>

      {custom.warning && (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          {custom.warning}
        </p>
      )}

      {mode.kind === 'view' ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-72">
              <MaterialSelect groups={groups} value={selected?.id ?? ''} onChange={setSelectedId} />
            </div>
            <Button variant="primary" onClick={() => startCreate()} className="no-print">
              Nouveau matériau
            </Button>
          </div>

          {selected && (
            <MaterialCard
              key={selected.id}
              material={selected}
              isCustom={isCustom(selected)}
              actions={
                isCustom(selected) ? (
                  <>
                    <Button onClick={() => setMode({ kind: 'edit', material: selected })}>
                      Modifier
                    </Button>
                    <Button onClick={() => startCreate(selected)}>Dupliquer</Button>
                    <Button variant="danger" onClick={() => remove(selected)}>
                      Supprimer
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => startCreate(selected)}>Dupliquer et personnaliser</Button>
                )
              }
            />
          )}

          <ImportExportPanel custom={custom.materials} onReplaceAll={custom.replaceAll} />
        </>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          {mode.kind === 'create' ? (
            <MaterialForm
              key={mode.id}
              title={mode.title}
              id={mode.id}
              initial={mode.initial}
              onSave={save}
              onCancel={() => setMode({ kind: 'view' })}
            />
          ) : (
            <MaterialForm
              key={mode.material.id}
              title={`Modifier « ${mode.material.name} »`}
              id={mode.material.id}
              initial={mode.material}
              onSave={save}
              onCancel={() => setMode({ kind: 'view' })}
            />
          )}
        </div>
      )}
    </div>
  );
}
