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
  assert.equal(L.phaseAdvice('crescer', t.rate, 80, S).level, 'comer-menos');
  assert.equal(L.phaseAdvice('crescer', 0.05, 80, S).level, 'comer-mais');
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

test('fases: meta de calorias e macros', () => {
  const base = { bf: 15, hours: 5 };
  const tdee = L.calories(base, 80).tdee;
  const secar = L.calories({ ...base, phase: 'secar' }, 80);
  assert.equal(secar.target, Math.round((370 + 21.6 * 68) * 1.35 * 0.8));
  assert.equal(secar.protein, Math.round((secar.target * 0.4) / 4));
  assert.equal(L.calories({ ...base, phase: 'manter' }, 80).target, tdee);
  assert.equal(L.calories({ ...base, phase: 'manter', adjust: 150 }, 80).target, tdee + 150);
});

test('fases: ritmo bom e conselhos', () => {
  assert.deepEqual(L.phaseRange('secar', 80, S), { min: -0.8, max: -0.4 });
  assert.equal(L.phaseAdvice('secar', -0.6, 80, S).level, 'ok');
  assert.equal(L.phaseAdvice('secar', -0.1, 80, S).level, 'comer-menos');
  assert.equal(L.phaseAdvice('secar', -1.2, 80, S).level, 'comer-mais');
  assert.equal(L.phaseAdvice('manter', 0.1, 80, S).level, 'ok');
  assert.equal(L.phaseAdvice('manter', null, 80, S), null);
});

test('fases: troca pelo % de gordura', () => {
  assert.deepEqual(L.phaseBfAlert('crescer', 17.5, 'M'), { to: 'secar', limit: 17 });
  assert.deepEqual(L.phaseBfAlert('secar', 10, 'M'), { to: 'crescer', limit: 10 });
  assert.equal(L.phaseBfAlert('crescer', 13, 'M'), null);
});

test('tela inicial: semanas seguidas', () => {
  const ses = (...dates) => dates.map((date) => ({ date, sets: [] }));
  const now = new Date(2026, 10, 21); // sábado
  assert.equal(L.weekStreak(ses('2026-11-19', '2026-11-12', '2026-11-03', '2026-10-27'), now), 4);
  assert.equal(L.weekStreak(ses('2026-11-12', '2026-11-03'), now), 2); // semana atual ainda sem treino
  assert.equal(L.weekStreak(ses('2026-11-19', '2026-10-27'), now), 1);
  assert.equal(L.weekStreak([], now), 0);
});

test('tela inicial: grade da semana e rodada', () => {
  const now = new Date(2026, 10, 21);
  const plan = L.defaultPlan();
  const sessions = [
    { date: '2026-11-13', dayId: 'd_bracos', sets: [] },
    { date: '2026-11-16', dayId: 'd_peito', sets: [] },
    { date: '2026-11-17', dayId: 'd_costas', sets: [] },
    { date: '2026-11-19', dayId: 'd_ombros', sets: [] },
  ];
  const g = L.weekGrid(sessions, plan, now);
  assert.equal(g[0].date, '2026-11-16');
  assert.equal(g[5].today, true);
  assert.equal(g.filter((d) => d.sessions.length).length, 3);
  assert.deepEqual([...L.roundDone(plan, sessions)], ['d_peito', 'd_costas', 'd_ombros']);
  assert.equal(L.roundDone(plan, sessions.slice(0, 1)).size, 0); // depois de Braços começa rodada nova
});

test('tela inicial: destaques do treino', () => {
  const sessions = [
    { date: '2026-11-10', sets: [{ exId: 'a', weight: 80, reps: 6 }, { exId: 'b', weight: 50, reps: 6 }] },
    { date: '2026-11-17', sets: [{ exId: 'a', weight: 85, reps: 5 }, { exId: 'b', weight: 50, reps: 4 }] },
  ];
  assert.deepEqual(L.sessionHighlights(sessions, 1), { ups: 1, records: 1, sets: 2 });
  assert.deepEqual(L.sessionHighlights(sessions, 0), { ups: 0, records: 0, sets: 2 });
});
