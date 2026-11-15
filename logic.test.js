import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from './logic.js';

const S = L.DEFAULT_SETTINGS;
const supino = { id: 'x', equip: 'barra', repMin: 4, repMax: 6, sets: 3, inc: null };

test('6 reps sobe a carga (+5 kg na barra)', () => {
  const r = L.evaluateSet({ weight: 80, reps: 6, repMin: 4, repMax: 6, inc: 5, base: null });
  assert.deepEqual(r, { action: 'subir', next: 85, base: 80 });
});

test('dentro da faixa mantém a carga', () => {
  assert.equal(L.evaluateSet({ weight: 80, reps: 5, repMin: 4, repMax: 6, inc: 5, base: null }).action, 'manter');
});

test('menos de 4 reps depois de subir volta para a carga anterior', () => {
  const w = L.replay(null, [{ weight: 80, reps: 6 }, { weight: 85, reps: 3 }], supino, S);
  assert.deepEqual(w.results.map((r) => r.action), ['subir', 'voltar']);
  assert.equal(w.next, 80);
});

test('menos de 4 reps sem ter subido mantém a carga', () => {
  const w = L.replay({ weight: 80, base: null, stall: 0 }, [{ weight: 80, reps: 3 }], supino, S);
  assert.equal(w.results[0].action, 'abaixo');
  assert.equal(w.next, 80);
});

test('a carga sobe e vale para o próximo treino', () => {
  const start = { weight: 80, base: null, stall: 2 };
  const w = L.replay(start, [{ weight: 80, reps: 6 }, { weight: 85, reps: 4 }, { weight: 85, reps: 4 }], supino, S);
  assert.deepEqual(L.commitExercise(start, w), { weight: 85, base: 80, stall: 0 });
});

test('o contador de estagnação sobe quando não há progresso', () => {
  const start = { weight: 85, base: 80, stall: 1 };
  const w = L.replay(start, [{ weight: 85, reps: 5 }], supino, S);
  assert.equal(L.commitExercise(start, w).stall, 2);
});

test('halteres usam incremento de 2 kg; incremento próprio tem prioridade', () => {
  assert.equal(L.incFor({ equip: 'halter', inc: null }, S), 2);
  assert.equal(L.incFor({ equip: 'barra', inc: 2.5 }, S), 2.5);
});

test('estado do deload', () => {
  const start = '2026-01-01';
  assert.equal(L.deloadStatus(start, new Date(2026, 0, 20), 8).level, 'ok');
  assert.equal(L.deloadStatus(start, new Date(2026, 1, 20), 8).level, 'proximo');
  assert.equal(L.deloadStatus(start, new Date(2026, 1, 27), 8).level, 'agora');
  assert.equal(L.deloadStatus(start, new Date(2026, 2, 15), 8).level, 'atrasado');
});

test('rotação dos dias', () => {
  const plan = L.defaultPlan();
  assert.equal(L.nextDayId(plan, []), 'd_peito');
  assert.equal(L.nextDayId(plan, [{ dayId: 'd_bracos', sets: [] }]), 'd_peito');
  assert.equal(L.nextDayId(plan, [{ dayId: 'd_costas', sets: [] }]), 'd_ombros');
});

test('histórico pega a série mais pesada', () => {
  const sessions = [{ date: '2026-01-01', sets: [{ exId: 'x', weight: 80, reps: 6 }, { exId: 'x', weight: 85, reps: 4 }] }];
  const h = L.exerciseHistory(sessions, 'x');
  assert.equal(h[0].topWeight, 85);
  assert.equal(h[0].e1rm, 96.3);
});

test('migrate rejeita arquivo inválido e completa campos', () => {
  assert.throws(() => L.migrate({ foo: 1 }));
  const s = L.migrate({ plan: { days: [] }, settings: { restSec: 120 } });
  assert.equal(s.settings.restSec, 120);
  assert.equal(s.settings.inc.halter, 2);
});
