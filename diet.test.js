import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from './diet.js';

// Alimentos de teste (valores fictícios só para a matemática).
const F = {
  frango: { id: 'frango', name: 'Frango', kcal: 160, p: 32, c: 0, f: 3 },
  arroz: { id: 'arroz', name: 'Arroz', kcal: 130, p: 2.5, c: 28, f: 0.2 },
  azeite: { id: 'azeite', name: 'Azeite', kcal: 880, p: 0, c: 0, f: 100 },
  ovo: { id: 'ovo', name: 'Ovo', kcal: 145, p: 13, c: 0.6, f: 9.5 },
};
const byId = (id) => F[id];
const menu = (meals) => ({ meals: meals.map(([id, items]) => ({ id, name: id, items: items.map(([foodId, g]) => ({ foodId, g })) })) });

test('macros pela quantidade e totais', () => {
  assert.deepEqual(D.foodMacros(F.frango, 150), { kcal: 240, p: 48, c: 0, f: 4.5 });
  const m = menu([['almoco', [['frango', 100], ['arroz', 200]]]]);
  assert.equal(D.menuTotals(m, byId).kcal, 420);
});

test('comparação com a meta', () => {
  const c = D.compare({ kcal: 2000, p: 153, c: 250, f: 70 }, { kcal: 2500, p: 160, c: 250, f: 60 });
  assert.equal(c.kcal.status, 'baixo');
  assert.equal(c.p.status, 'ok'); // 153 >= 95% de 160
  assert.equal(c.c.status, 'ok');
  assert.equal(c.f.status, 'alto');
});

test('sugestões: proteína primeiro, depois calorias pelo carboidrato', () => {
  const m = menu([['almoco', [['frango', 100], ['arroz', 200]]]]);
  const s = D.suggestions(m, byId, { kcal: 1000, p: 80, c: 100, f: 20 });
  assert.equal(s[0].foodId, 'frango');
  assert.equal(s[0].deltaG, 100); // faltariam ~134 g, mas a sugestão no máximo dobra a porção (100 g)
  assert.equal(s[1].foodId, 'arroz');
  assert.ok(s[1].deltaG > 0);
});

test('sugestões: calorias demais reduz o carboidrato; gordura demais reduz o azeite', () => {
  const m = menu([['almoco', [['frango', 200], ['arroz', 400], ['azeite', 30]]]]);
  const s = D.suggestions(m, byId, { kcal: 900, p: 60, c: 60, f: 10 });
  assert.equal(s[0].foodId, 'arroz');
  assert.ok(s[0].deltaG < 0 && -s[0].deltaG <= 200); // corta no máximo metade da porção
  assert.equal(s[1].foodId, 'azeite');
  assert.ok(s[1].deltaG < 0);
});

test('sem fonte de proteína no cardápio vira dica', () => {
  const m = menu([['cafe', [['arroz', 100]]]]);
  assert.deepEqual(D.suggestions(m, byId, { kcal: 130, p: 50, c: 28, f: 1 })[0], { hint: 'proteina' });
});

test('dia: refeições marcadas, trocadas e extras', () => {
  const m = menu([['cafe', [['ovo', 100]]], ['almoco', [['frango', 100], ['arroz', 100]]]]);
  const day = { done: { cafe: true }, swaps: { almoco: { kcal: 800, p: 30 } }, extras: [{ kcal: 200, p: 5 }] };
  const t = D.dayTotals(m, day, byId);
  assert.equal(t.kcal, 145 + 800 + 200);
  assert.equal(t.p, 13 + 30 + 5);
  assert.equal(D.dayVerdict({ kcal: 2000, p: 160 }, { kcal: 2000, p: 160 }).level, 'ok');
  assert.deepEqual(D.dayVerdict({ kcal: 2300, p: 120 }, { kcal: 2000, p: 160 }).lines, ['Faltam 40 g de proteína', 'Passou 300 kcal da meta']);
});

test('busca ignora acentos e maiúsculas', () => {
  const foods = [{ name: 'Feijão carioca cozido' }, { name: 'Pão francês' }, { name: 'Feijão preto cozido' }];
  assert.deepEqual(D.searchFoods(foods, 'feijao preto').map((f) => f.name), ['Feijão preto cozido']);
  assert.equal(D.searchFoods(foods, 'PAO')[0].name, 'Pão francês');
});

test('rótulo por porção vira valores por 100 g', () => {
  assert.deepEqual(D.per100FromLabel({ portion: 30, kcal: 120, p: 24, c: 3, f: 1.5 }), { kcal: 400, p: 80, c: 10, f: 5 });
});

test('sugestões realistas: não manda quadruplicar o whey e avisa quando falta muita comida', () => {
  const G = { ...F, whey: { id: 'whey', name: 'Whey', kcal: 400, p: 80, c: 10, f: 5 } };
  const m = menu([['cafe', [['whey', 30], ['arroz', 100]]], ['almoco', [['frango', 150], ['arroz', 150]]]]);
  const s = D.suggestions(m, (id) => G[id], { kcal: 2800, p: 175, c: 380, f: 60 });
  const whey = s.find((x) => x.foodId === 'whey');
  assert.ok(!whey || whey.deltaG <= 30);
  assert.equal(s.find((x) => x.foodId === 'frango').deltaG, 150);
  assert.ok(s.some((x) => x.hint === 'pouco'));
});
