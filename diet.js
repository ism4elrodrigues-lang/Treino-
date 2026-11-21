// Cardápio e registro do dia. Funções puras, testadas com `node --test`.
// Alimentos têm valores por 100 g: { id, name, kcal, p, c, f }.

const round1 = (x) => Math.round(x * 10) / 10;
const fmt = (n) => n.toLocaleString('pt-BR');
const round10 = (x) => Math.max(10, Math.round(x / 10) * 10);

export function normalize(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Busca simples: todas as palavras digitadas precisam aparecer no nome.
export function searchFoods(foods, query, limit = 25) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits = foods.filter((f) => {
    const n = normalize(`${f.name} ${f.taco ?? ''}`);
    return terms.every((t) => n.includes(t));
  });
  hits.sort((a, b) => {
    const an = normalize(a.name).startsWith(terms[0]) ? 0 : 1;
    const bn = normalize(b.name).startsWith(terms[0]) ? 0 : 1;
    return an - bn || a.name.length - b.name.length;
  });
  return hits.slice(0, limit);
}

export function foodMacros(food, g) {
  const k = (g || 0) / 100;
  return { kcal: (food.kcal || 0) * k, p: (food.p || 0) * k, c: (food.c || 0) * k, f: (food.f || 0) * k };
}

const ZERO = () => ({ kcal: 0, p: 0, c: 0, f: 0 });
export function addTotals(a, b) {
  return { kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f };
}

export function mealTotals(meal, foodById) {
  return meal.items.reduce((t, it) => {
    const food = foodById(it.foodId);
    return food ? addTotals(t, foodMacros(food, it.g)) : t;
  }, ZERO());
}

export function menuTotals(menu, foodById) {
  return menu.meals.reduce((t, m) => addTotals(t, mealTotals(m, foodById)), ZERO());
}

// Situação de cada número em relação à meta.
// Calorias: ±5%. Proteína: ok a partir de 95% da meta. Carboidrato e gordura: ±10% (mín. 5 g).
export function compare(totals, goal) {
  const out = {};
  for (const k of ['kcal', 'p', 'c', 'f']) {
    const value = totals[k];
    const target = goal[k];
    const diff = value - target;
    let tol = k === 'kcal' ? target * 0.05 : Math.max(5, target * 0.1);
    let status = 'ok';
    if (k === 'p') {
      if (value < target * 0.95) status = 'baixo';
      else if (value > target * 1.3) status = 'alto';
    } else if (diff < -tol) status = 'baixo';
    else if (diff > tol) status = 'alto';
    out[k] = { value, target, diff, status };
  }
  return out;
}

export function goalFromCalories(cal) {
  return cal ? { kcal: cal.target, p: cal.protein, c: cal.carbs, f: cal.fat } : null;
}

// Sugestões de ajuste, na ordem do livro: primeiro proteína, depois calorias pelo carboidrato,
// e por fim gordura em excesso. Cada sugestão traz o ajuste pronto para aplicar.
// Para ficar realista, uma sugestão no máximo dobra a porção (até +150 g de proteína, +200 g de carboidrato)
// e no máximo corta metade dela. Se ainda faltar muito, vira uma dica de acrescentar comida.
export function suggestions(menu, foodById, goal) {
  const items = [];
  menu.meals.forEach((m) => m.items.forEach((it, idx) => {
    const food = foodById(it.foodId);
    if (food && it.g > 0) items.push({ meal: m, idx, it, food });
  }));
  let totals = menuTotals(menu, foodById);
  const out = [];
  const used = new Set();
  const push = (x, deltaG, why) => {
    const delta = foodMacros(x.food, deltaG);
    totals = addTotals(totals, delta);
    used.add(`${x.meal.id}:${x.idx}`);
    out.push({
      mealId: x.meal.id, idx: x.idx, foodId: x.food.id, deltaG,
      meal: x.meal.name, food: x.food.name, why,
      kcal: Math.round(delta.kcal), p: round1(delta.p),
    });
  };
  const free = (x) => !used.has(`${x.meal.id}:${x.idx}`);
  const up = (x, need, cap) => Math.min(cap, round10(x.it.g), round10(need));
  const down = (x, need) => Math.min(Math.max(10, Math.floor(x.it.g / 20) * 10), round10(need));

  // 1) proteína baixa: aumentar as fontes de proteína que mais pesam no cardápio
  if (totals.p < goal.p * 0.95) {
    const srcs = items.filter((x) => x.food.p >= 15).sort((a, b) => b.it.g * b.food.p - a.it.g * a.food.p);
    for (const x of srcs.slice(0, 2)) {
      const need = (goal.p - totals.p) / (x.food.p / 100);
      if (need <= 0) break;
      push(x, up(x, need, 150), 'proteina');
    }
    if (!srcs.length) out.push({ hint: 'proteina' });
  }

  // 2) calorias fora: ajustar o carboidrato (alimentos que são principalmente carboidrato)
  const carbs = () => items.filter((x) => free(x) && x.food.kcal > 0 && (x.food.c * 4) / x.food.kcal >= 0.6);
  if (goal.kcal - totals.kcal > goal.kcal * 0.05) {
    const srcs = carbs().sort((a, b) => b.it.g - a.it.g);
    for (const x of srcs.slice(0, 2)) {
      const need = (goal.kcal - totals.kcal) / (x.food.kcal / 100);
      if (goal.kcal - totals.kcal <= goal.kcal * 0.05) break;
      push(x, up(x, need, 200), 'calorias');
    }
    if (!srcs.length) out.push({ hint: 'carbo' });
    const left = goal.kcal - totals.kcal;
    if (left > goal.kcal * 0.1) out.push({ hint: 'pouco', kcal: Math.round(left) });
  } else if (totals.kcal - goal.kcal > goal.kcal * 0.05) {
    const pool = carbs().length ? carbs() : items.filter(free);
    const srcs = pool.sort((a, b) => b.it.g * b.food.kcal - a.it.g * a.food.kcal);
    for (const x of srcs.slice(0, 2)) {
      const over = totals.kcal - goal.kcal;
      if (over <= goal.kcal * 0.05) break;
      push(x, -down(x, over / (x.food.kcal / 100)), 'calorias');
    }
  }

  // 3) gordura bem acima: reduzir o alimento mais gorduroso
  const df = totals.f - goal.f;
  if (df > Math.max(10, goal.f * 0.15)) {
    const x = items.filter((y) => free(y) && y.food.f >= 15).sort((a, b) => b.it.g * b.food.f - a.it.g * a.food.f)[0];
    if (x) push(x, -down(x, df / (x.food.f / 100)), 'gordura');
  }
  return out.slice(0, 5);
}

// ---------- registro do dia ----------

export function emptyDay() {
  return { done: {}, swaps: {}, extras: [] };
}

// Total consumido: refeições marcadas (ou trocadas por uma estimativa) + extras.
export function dayTotals(menu, day, foodById) {
  let t = ZERO();
  for (const m of menu.meals) {
    const swap = day.swaps?.[m.id];
    if (swap) t = addTotals(t, { kcal: swap.kcal || 0, p: swap.p || 0, c: 0, f: 0 });
    else if (day.done?.[m.id]) t = addTotals(t, mealTotals(m, foodById));
  }
  for (const x of day.extras || []) t = addTotals(t, { kcal: x.kcal || 0, p: x.p || 0, c: 0, f: 0 });
  return t;
}

// Resumo em uma frase do dia até agora.
export function dayVerdict(totals, goal) {
  const lines = [];
  const kcalDiff = Math.round(totals.kcal - goal.kcal);
  const pDiff = Math.round(goal.p - totals.p);
  const kcalOk = Math.abs(kcalDiff) <= goal.kcal * 0.05;
  const pOk = pDiff <= goal.p * 0.05;
  if (kcalOk && pOk) return { level: 'ok', lines: ['Dentro da meta'] };
  if (!pOk) lines.push(`Faltam ${fmt(pDiff)} g de proteína`);
  if (kcalDiff > goal.kcal * 0.05) lines.push(`Passou ${fmt(kcalDiff)} kcal da meta`);
  else if (!kcalOk) lines.push(`Faltam ${fmt(-kcalDiff)} kcal`);
  return { level: kcalDiff > goal.kcal * 0.05 ? 'alto' : 'baixo', lines };
}

export function defaultMenu() {
  return {
    meals: [
      { id: 'm_cafe', name: 'Café da manhã', items: [] },
      { id: 'm_almoco', name: 'Almoço', items: [] },
      { id: 'm_lanche', name: 'Lanche', items: [] },
      { id: 'm_jantar', name: 'Jantar', items: [] },
    ],
  };
}

// Converte o rótulo (valores por porção) para 100 g.
export function per100FromLabel({ portion, kcal, p, c, f }) {
  const k = 100 / portion;
  return { kcal: round1(kcal * k), p: round1(p * k), c: round1(c * k), f: round1(f * k) };
}

// ---------- cardápio de exemplo ----------

// Modelo com alimentos comuns da TACO. role: p = fonte de proteína (escala pela proteína),
// c = fonte de carboidrato (completa as calorias), f = gordura de adição, x = fixo (fruta, salada, iogurte).
const SAMPLE = [
  { id: 'm_cafe', name: 'Café da manhã', items: [['taco:53', 50, 'c'], ['taco:488', 100, 'p'], ['taco:182', 100, 'x']] },
  { id: 'm_almoco', name: 'Almoço', items: [['taco:3', 150, 'c'], ['taco:561', 100, 'x'], ['taco:410', 120, 'p'], ['taco:100', 80, 'x'], ['taco:260', 5, 'f']] },
  { id: 'm_lanche', name: 'Lanche', items: [['taco:448', 170, 'x'], ['taco:7', 30, 'c'], ['taco:179', 100, 'x']] },
  { id: 'm_jantar', name: 'Jantar', items: [['taco:377', 120, 'p'], ['taco:88', 150, 'c'], ['taco:78', 40, 'x'], ['taco:157', 80, 'x'], ['taco:260', 5, 'f']] },
];

const roundTo = (x, step) => Math.max(step, Math.round(x / step) * step);

// Monta o cardápio de exemplo ajustado à meta: proteína → gordura → carboidrato completa as calorias.
export function buildSampleMenu(goal, foodById) {
  const items = SAMPLE.flatMap((m) => m.items.map(([foodId, g, role]) => ({ meal: m.id, foodId, g, role, food: foodById(foodId) })));
  if (items.some((x) => !x.food)) throw new Error('Alimento do modelo não encontrado.');
  const sum = (list, k) => list.reduce((t, x) => t + foodMacros(x.food, x.g)[k], 0);
  const by = (role) => items.filter((x) => x.role === role);

  // 1) proteína
  const pFromOthers = sum(items.filter((x) => x.role !== 'p'), 'p');
  const pFactor = Math.min(3, Math.max(0.5, (goal.p - pFromOthers) / sum(by('p'), 'p')));
  for (const x of by('p')) x.g = roundTo(x.g * pFactor, 10);

  // 2) gordura: azeite completa o que falta (até 20 g por refeição)
  const fNeed = goal.f - sum(items.filter((x) => x.role !== 'f'), 'f');
  const fats = by('f');
  for (const x of fats) x.g = Math.min(20, roundTo(Math.max(0, fNeed) / fats.length, 5));

  // 3) carboidrato completa as calorias
  const kNeed = goal.kcal - sum(items.filter((x) => x.role !== 'c'), 'kcal');
  const cFactor = Math.min(4, Math.max(0.3, kNeed / sum(by('c'), 'kcal')));
  for (const x of by('c')) x.g = roundTo(x.g * cFactor, 10);

  return {
    meals: SAMPLE.map((m) => ({
      id: m.id,
      name: m.name,
      items: items.filter((x) => x.meal === m.id).map((x) => ({ foodId: x.foodId, g: x.g })),
    })),
  };
}
