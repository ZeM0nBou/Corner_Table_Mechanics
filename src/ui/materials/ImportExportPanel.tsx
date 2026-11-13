import { useRef, useState, type ChangeEvent } from 'react';
import {
  CustomFileError,
  findConflicts,
  MAX_IMPORT_BYTES,
  mergeImported,
  parseCustomMaterials,
  serializeCustomMaterials,
  type ConflictDecision,
  type RejectedEntry,
} from '@materials/custom';
import type { Material } from '@materials/schema';
import { Button } from '@ui/components/Button';
import { downloadText } from '@ui/download';

interface ImportExportPanelProps {
  custom: readonly Material[];
  onReplaceAll: (next: Material[]) => void;
}

interface PendingImport {
  fileName: string;
  materials: Material[];
  rejected: RejectedEntry[];
  conflicts: Material[];
  decisions: Record<string, ConflictDecision>;
}

interface Report {
  kind: 'success' | 'error';
  lines: string[];
}

const DECISION_LABELS: Record<ConflictDecision, string> = {
  replace: 'Remplacer l’existant',
  'keep-both': 'Garder les deux',
  skip: 'Ignorer l’importé',
};

function rejectedLines(rejected: readonly RejectedEntry[]): string[] {
  return rejected.map(
    (r) => `Refusé — entrée n° ${r.index + 1}${r.id ? ` (${r.id})` : ''} : ${r.message}`,
  );
}

/** Export et import JSON des matériaux personnalisés, avec résolution des conflits. */
export function ImportExportPanel({ custom, onReplaceAll }: ImportExportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10);
    downloadText(`materiaux-perso-${today}.json`, serializeCustomMaterials(custom, new Date()));
  };

  const applyImport = (p: PendingImport) => {
    const r = mergeImported(custom, p.materials, p.decisions);
    onReplaceAll(r.materials);
    setPending(null);
    setReport({
      kind: 'success',
      lines: [
        `${p.fileName} : ${r.added} ajouté(s), ${r.replaced} remplacé(s), ${r.skipped} ignoré(s), ${p.rejected.length} refusé(s).`,
        ...rejectedLines(p.rejected),
      ],
    });
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de réimporter le même fichier
    if (!file) return;
    setReport(null);
    setPending(null);

    if (file.size > MAX_IMPORT_BYTES) {
      setReport({
        kind: 'error',
        lines: [`${file.name} : fichier trop volumineux (maximum 1 Mo).`],
      });
      return;
    }
    try {
      const parsed = parseCustomMaterials(await file.text());
      const p: PendingImport = {
        fileName: file.name,
        materials: parsed.materials,
        rejected: parsed.rejected,
        conflicts: findConflicts(custom, parsed.materials),
        decisions: {},
      };
      if (p.conflicts.length === 0) applyImport(p);
      else setPending(p);
    } catch (err) {
      setReport({
        kind: 'error',
        lines: [
          `${file.name} : ${err instanceof CustomFileError ? err.message : 'lecture impossible.'}`,
        ],
      });
    }
  };

  const setDecision = (id: string, d: ConflictDecision) =>
    setPending((p) => (p ? { ...p, decisions: { ...p.decisions, [id]: d } } : p));

  const setAll = (d: ConflictDecision) =>
    setPending((p) =>
      p ? { ...p, decisions: Object.fromEntries(p.conflicts.map((m) => [m.id, d])) } : p,
    );

  const allDecided = pending?.conflicts.every((m) => pending.decisions[m.id] !== undefined);

  return (
    <section
      aria-labelledby="import-export-titre"
      className="no-print rounded-lg border border-slate-200 bg-white p-4"
    >
      <h3 id="import-export-titre" className="font-medium">
        Partager mes matériaux
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Exportez vos matériaux personnalisés en JSON pour les sauvegarder ou les envoyer à un
        collègue, qui pourra les importer.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={handleExport} disabled={custom.length === 0}>
          Exporter ({custom.length})
        </Button>
        <Button onClick={() => inputRef.current?.click()}>Importer…</Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void handleFile(e)}
        />
      </div>

      {pending && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">
            {pending.conflicts.length} matériau(x) de « {pending.fileName} » existe(nt) déjà. Que
            faire ?
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="self-center text-amber-900">Pour tous :</span>
            {(Object.keys(DECISION_LABELS) as ConflictDecision[]).map((d) => (
              <Button key={d} onClick={() => setAll(d)} className="px-2! py-1! text-xs!">
                {DECISION_LABELS[d]}
              </Button>
            ))}
          </div>
          <ul className="mt-3 space-y-2">
            {pending.conflicts.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  <span className="font-medium">{m.name}</span>{' '}
                  <span className="text-slate-600">({m.id})</span>
                </span>
                <select
                  aria-label={`Décision pour ${m.name}`}
                  value={pending.decisions[m.id] ?? ''}
                  onChange={(e) => setDecision(m.id, e.target.value as ConflictDecision)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="" disabled>
                    — choisir —
                  </option>
                  {(Object.keys(DECISION_LABELS) as ConflictDecision[]).map((d) => (
                    <option key={d} value={d}>
                      {DECISION_LABELS[d]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" disabled={!allDecided} onClick={() => applyImport(pending)}>
              Importer
            </Button>
            <Button onClick={() => setPending(null)}>Annuler l’import</Button>
          </div>
        </div>
      )}

      {report && (
        <div
          role="status"
          className={`mt-4 rounded-md border p-3 text-sm ${
            report.kind === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {report.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
    </section>
  );
}
