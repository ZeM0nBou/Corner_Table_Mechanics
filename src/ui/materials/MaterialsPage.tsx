import { useState } from 'react';
import { findMaterial, REFERENCE_MATERIALS } from '@materials/index';
import { MaterialCard } from './MaterialCard';
import { MaterialSelect } from './MaterialSelect';

const DEFAULT_ID = REFERENCE_MATERIALS[0]?.id ?? '';

export function MaterialsPage() {
  const [id, setId] = useState(DEFAULT_ID);
  const material = findMaterial(id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Matériaux</h2>
        <p className="mt-1 text-sm text-slate-600">
          Base de référence ({REFERENCE_MATERIALS.length} entrées). Rm est la valeur minimale
          garantie par la norme ; les caractéristiques dépendent de l’épaisseur et de l’état.
        </p>
      </div>

      <div className="max-w-xl">
        <MaterialSelect materials={REFERENCE_MATERIALS} value={id} onChange={setId} />
      </div>

      {material ? (
        <MaterialCard key={material.id} material={material} />
      ) : (
        <p className="text-red-700">Matériau introuvable.</p>
      )}
    </div>
  );
}
