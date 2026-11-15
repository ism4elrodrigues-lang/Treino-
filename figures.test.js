import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIGS } from './figures.js';
import { defaultPlan } from './logic.js';

const SIDE = ['head', 'sh', 'el', 'ha', 'hip', 'kn', 'an', 'toe'];
const FRONT = ['head', 'nk', 'pv', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'hipL', 'hipR', 'knL', 'knR', 'anL', 'anR', 'toeL', 'toeR'];

test('todo exercício do plano padrão tem desenho', () => {
  for (const d of defaultPlan().days) for (const e of d.exercises) assert.ok(FIGS[e.id], `sem desenho: ${e.id}`);
});

test('poses completas e textos preenchidos', () => {
  for (const [k, f] of Object.entries(FIGS)) {
    const need = f.view === 'front' ? FRONT : SIDE;
    for (const p of need) assert.ok(f.A[p], `${k}: pose A sem ${p}`);
    for (const p of Object.keys(f.B)) assert.ok(f.A[p], `${k}: pose B tem ${p} que não existe em A`);
    for (const w of f.weights || []) assert.ok(f.A[w.at], `${k}: peso preso em ${w.at} inexistente`);
    assert.equal(f.cues.length, 3, k);
    assert.equal(f.phases.length, 2, k);
  }
});
