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

test('anilhas por lado', () => {
  assert.deepEqual(L.platesPerSide(85, 20, L.DEFAULT_PLATES), { perSide: [25, 5, 2.5], rest: 0 });
  assert.deepEqual(L.platesPerSide(20, 20, L.DEFAULT_PLATES).perSide, []);
  assert.equal(L.platesPerSide(61, 20, L.DEFAULT_PLATES).rest, 1);
});

test('aquecimento: 50/50/70/90% arredondado e nunca abaixo da barra', () => {
  const ws = L.warmupSets(100, supino, S);
  assert.deepEqual(ws.map((w) => [w.reps, w.weight]), [[12, 50], [10, 50], [4, 70], [1, 90]]);
  assert.equal(L.warmupSets(30, supino, S)[0].weight, 20);
});

test('aquecimento padrão só no primeiro exercício do dia', () => {
  const d = L.defaultPlan().days[0];
  assert.equal(L.isWarmupEx(d, d.exercises[0]), true);
  assert.equal(L.isWarmupEx(d, d.exercises[1]), false);
  assert.equal(L.isWarmupEx(d, { ...d.exercises[1], warmup: true }), true);
});

test('carga de deload a 60%', () => {
  assert.equal(L.deloadWeight(100, supino, S), 60);
  assert.equal(L.deloadWeight(85, supino, S), 50); // 51 → 50 (passo de 2,5)
});

test('tendência do peso e conselho do bulking', () => {
  const now = new Date(2026, 0, 15);
  const body = [
    { date: '2026-01-02', kg: 80 }, { date: '2026-01-05', kg: 80.2 },
    { date: '2026-01-10', kg: 80.4 }, { date: '2026-01-14', kg: 80.4 },
  ];
  const t = L.weightTrend(body, now);
  assert.equal(t.rate, 0.3);
  assert.equal(L.bulkAdvice(t.rate, 0.1, 0.25).level, 'muito');
  assert.equal(L.bulkAdvice(0.05, 0.1, 0.25).level, 'pouco');
  assert.equal(L.weightTrend([{ date: '2026-01-14', kg: 80 }], now).rate, null);
});

test('calorias: Katch-McArdle com % de gordura, Mifflin sem', () => {
  const c = L.calories({ bf: 15, hours: 5 }, 80);
  assert.equal(c.bmr, Math.round(370 + 21.6 * 68));
  assert.equal(c.tdee, Math.round((370 + 21.6 * 68) * 1.35));
  const m = L.calories({ sex: 'M', age: 30, height: 180, hours: 2 }, 80);
  assert.equal(m.bmr, 1780);
  assert.equal(L.calories({}, 80), null);
});
