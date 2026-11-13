import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { Material } from '@materials/schema';
import { NumberInput, UnitInput } from '@ui/components/UnitInput';
import {
  buildMaterial,
  draftFromMaterial,
  emptyDraft,
  visibleErrors,
  type DraftField,
  type MaterialDraft,
} from './materialDraft';

interface MaterialFormProps {
  title: string;
  /** Matériau de départ (modification ou duplication) ; formulaire vide sinon. */
  initial?: Material | undefined;
  /** Identifiant du matériau enregistré. */
  id: string;
  /** Familles existantes, proposées à la saisie. */
  familySuggestions: readonly string[];
  onSave: (m: Material) => void;
  onCancel: () => void;
}

function TextField({
  label,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  multiline = false,
  placeholder,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string | undefined;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
  /** Valeurs proposées (liste de suggestions du navigateur, saisie libre conservée). */
  suggestions?: readonly string[];
}) {
  const id = useId();
  const listId = `${id}-suggestions`;
  const cls = `w-full rounded-md border bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 ${
    error !== undefined
      ? 'border-red-500 focus:ring-red-500/30'
      : 'border-slate-300 focus:border-sky-600 focus:ring-sky-600/30'
  }`;
  const common = {
    id,
    value,
    placeholder,
    onBlur,
    'aria-invalid': error !== undefined,
    'aria-describedby': error !== undefined ? `${id}-erreur` : undefined,
    className: cls,
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-700">*</span>}
      </label>
      {multiline ? (
        <textarea rows={3} {...common} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          type="text"
          {...common}
          list={suggestions ? listId : undefined}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {error !== undefined && (
        <p id={`${id}-erreur`} className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-medium text-slate-800">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/**
 * Formulaire de création ou de modification d'un matériau personnalisé.
 * Chaque champ est contrôlé dès qu'on le quitte (y compris les contrôles croisés
 * comme Re ≤ Rm) ; « Enregistrer » affiche toutes les erreurs restantes.
 */
export function MaterialForm({
  title,
  initial,
  id,
  familySuggestions,
  onSave,
  onCancel,
}: MaterialFormProps) {
  const [draft, setDraft] = useState<MaterialDraft>(() =>
    initial ? draftFromMaterial(initial) : emptyDraft(),
  );
  const [touched, setTouched] = useState<ReadonlySet<DraftField>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const set =
    <K extends keyof MaterialDraft>(key: K) =>
    (value: MaterialDraft[K]) =>
      setDraft((d) => ({ ...d, [key]: value }));

  const result = buildMaterial(draft, id);
  const errors = visibleErrors(result.ok ? {} : result.errors, touched, submitted);

  /** Props communes à un champ : marquage « quitté » et erreur à afficher. */
  const field = (key: DraftField) => ({
    onBlur: () => setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key))),
    error: errors[key],
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (result.ok) onSave(result.material);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-slate-600">
        Les champs marqués <span className="text-red-700">*</span> sont obligatoires. Le matériau
        est enregistré dans ce navigateur uniquement : exportez-le pour le conserver ou le partager.
      </p>

      <Fieldset legend="Identification">
        <TextField
          label="Nom"
          required
          value={draft.name}
          onChange={set('name')}
          {...field('name')}
          placeholder="ex. S355 — fiche fournisseur"
        />
        <TextField
          label="Famille"
          required
          value={draft.family}
          onChange={set('family')}
          {...field('family')}
          suggestions={familySuggestions}
          placeholder="Choisir ou saisir une famille"
        />
        <TextField
          label="Norme"
          value={draft.standard}
          onChange={set('standard')}
          {...field('standard')}
        />
        <TextField
          label="État / traitement"
          value={draft.condition}
          onChange={set('condition')}
          {...field('condition')}
        />
      </Fieldset>

      <Fieldset legend="Élasticité et masse">
        <UnitInput
          label="Module d’Young"
          symbol="E"
          required
          quantity="stress"
          defaultUnit="GPa"
          initialSI={initial?.E_Pa}
          onChange={set('E_Pa')}
          {...field('E_Pa')}
        />
        <NumberInput
          label="Coefficient de Poisson"
          symbol="ν"
          required
          initial={initial?.nu}
          onChange={set('nu')}
          {...field('nu')}
        />
        <UnitInput
          label="Masse volumique"
          symbol="ρ"
          required
          quantity="density"
          defaultUnit="kg/m³"
          initialSI={initial?.rho_kg_m3}
          onChange={set('rho_kg_m3')}
          {...field('rho_kg_m3')}
        />
        <UnitInput
          label="Dilatation thermique"
          symbol="α"
          quantity="thermalExpansion"
          defaultUnit="10⁻⁶/K"
          initialSI={initial?.alpha_1_K}
          onChange={set('alpha_1_K')}
          {...field('alpha_1_K')}
        />
      </Fieldset>

      <Fieldset legend="Résistance">
        <UnitInput
          label="Limite élastique"
          symbol="Re"
          quantity="stress"
          defaultUnit="MPa"
          initialSI={initial?.Re_Pa}
          onChange={set('Re_Pa')}
          {...field('Re_Pa')}
        />
        <UnitInput
          label="Résistance à la rupture"
          symbol="Rm"
          quantity="stress"
          defaultUnit="MPa"
          initialSI={initial?.Rm_Pa}
          onChange={set('Rm_Pa')}
          {...field('Rm_Pa')}
        />
        <NumberInput
          label="Allongement à rupture"
          symbol="A"
          unitLabel="%"
          initial={initial?.A_percent}
          onChange={set('A_percent')}
          {...field('A_percent')}
        />
      </Fieldset>

      <Fieldset legend="Domaine d’épaisseur (facultatif)">
        <UnitInput
          label="Épaisseur min."
          quantity="length"
          defaultUnit="mm"
          initialSI={initial?.thicknessRange_m?.[0]}
          onChange={set('tMin_m')}
          {...field('tMin_m')}
        />
        <UnitInput
          label="Épaisseur max."
          quantity="length"
          defaultUnit="mm"
          initialSI={initial?.thicknessRange_m?.[1]}
          onChange={set('tMax_m')}
          {...field('tMax_m')}
        />
      </Fieldset>

      <Fieldset legend="Traçabilité">
        <div className="sm:col-span-2">
          <TextField
            label="Source"
            required
            value={draft.source}
            onChange={set('source')}
            {...field('source')}
            placeholder="ex. fiche technique fournisseur X, rév. 2025 ; essai interne n° …"
          />
        </div>
        <div className="sm:col-span-2">
          <TextField
            label="Notes"
            multiline
            value={draft.notes}
            onChange={set('notes')}
            {...field('notes')}
          />
        </div>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={draft.verified}
            onChange={(e) => set('verified')(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            Valeurs vérifiées
            <span className="block text-slate-600">
              Je confirme avoir relu ces valeurs par rapport à la source citée.
            </span>
          </span>
        </label>
      </Fieldset>

      {submitted && !result.ok && (
        <p role="alert" className="text-sm text-red-700">
          Le matériau n’est pas enregistré : corrigez les champs signalés.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
