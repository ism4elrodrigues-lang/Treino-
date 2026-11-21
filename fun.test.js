import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from './fun.js';

test('comparação escolhe o maior item que cabe e arredonda', () => {
  assert.equal(F.compare(6450).text, 'um elefante-africano');
  assert.equal(F.compare(6450).next.s, 'um tiranossauro');
  assert.equal(F.compare(120).text, 'um panda-gigante');
  assert.equal(F.compare(1000).text, 'um carro popular');
  assert.equal(F.compare(1100).text, 'um carro popular');
  assert.equal(F.compare(1000000).text, '5 Estátuas da Liberdade');
  assert.equal(F.compare(0), null);
});

test('volume, série mais pesada e total', () => {
  const s = { sets: [{ weight: 100, reps: 5 }, { weight: 110, reps: 3 }, { weight: 0, reps: 12 }] };
  assert.equal(F.sessionVolume(s), 830);
  assert.equal(F.heaviestSet(s).weight, 110);
  assert.equal(F.totalVolume([s, s]), 1660);
});

test('maior sequência de semanas', () => {
  const ses = (...d) => d.map((date) => ({ date, sets: [] }));
  assert.equal(F.longestWeekStreak(ses('2026-10-05', '2026-10-13', '2026-10-20', '2026-11-10', '2026-11-17')), 3);
  assert.equal(F.longestWeekStreak([]), 0);
});

test('conquistas e as novas desbloqueadas', () => {
  const s1 = { date: '2026-11-02', sets: [{ exId: 'a', weight: 100, reps: 6 }] };
  const s2 = { date: '2026-11-09', sets: [{ exId: 'a', weight: 115, reps: 5 }, ...Array(12).fill({ exId: 'b', weight: 100, reps: 5 })] };
  const before = F.achievements([s1]);
  const after = F.achievements([s1, s2], { proteinDays: 7 });
  const ok = (list) => list.filter((a) => a.ok).map((a) => a.id);
  assert.deepEqual(ok(before), ['primeiro']);
  assert.deepEqual(ok(after), ['primeiro', 'panda', 'elefante', 'recorde', 'proteina']);
  assert.deepEqual(F.newlyUnlocked(before, after).map((a) => a.id), ['panda', 'elefante', 'recorde', 'proteina']);
  assert.equal(after.find((a) => a.id === 'leao').prog, 115 / 190);
});
