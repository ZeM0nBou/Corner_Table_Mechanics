/**
 * Test de fumée : vérifie que la chaîne Vitest + alias @core fonctionne.
 * À remplacer par les vrais tests des modules dès l'étape 2.
 */
import { describe, expect, it } from 'vitest';
import * as core from '@core/index';

describe('socle', () => {
  it('le module core est importable via l’alias @core', () => {
    expect(core).toBeTypeOf('object');
  });
});
