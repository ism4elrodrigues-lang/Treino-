// Regras de treino baseadas em "Malhar, Secar, Definir" (Michael Matthews).
// Funções puras, sem DOM, para poderem ser testadas com `node --test`.

import { defaultMenu } from './diet.js';

export const EQUIP = {
  barra: 'Barra',
  halter: 'Halteres',
  maquina: 'Máquina / cabo',
  corporal: 'Peso corporal + carga',
};

export const DEFAULT_SETTINGS = {
  restSec: 180,
  deloadWeeks: 8,
  deloadPct: 60,
  barKg: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  gainMin: 0.1,
  gainMax: 0.25,
  inc: { barra: 5, halter: 2, maquina: 5, corporal: 2.5 },
};

// Treinos sem nenhuma subida de carga até o app sugerir deload ou troca de exercício.
export const STALL_LIMIT = 3;

let seq = 0;
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function ex(id, name, equip, extra = {}) {
  return { id, name, equip, sets: 3, repMin: 4, repMax: 6, inc: null, ...extra };
}

// Divisão de 5 dias do livro: 3 exercícios pesados × 3 séries por dia + panturrilha/abdômen.
export function defaultPlan() {
  return {
    days: [
      {
        id: 'd_peito',
        name: 'Peito',
        exercises: [
          ex('supino_incl_barra', 'Supino inclinado com barra', 'barra'),
          ex('supino_reto_barra', 'Supino reto com barra', 'barra'),
          ex('supino_incl_halter', 'Supino inclinado com halteres', 'halter'),
          ex('panturrilha_pe', 'Panturrilha em pé', 'maquina'),
        ],
      },
      {
        id: 'd_costas',
        name: 'Costas',
        exercises: [
          ex('terra', 'Levantamento terra', 'barra'),
          ex('remada_barra', 'Remada curvada com barra', 'barra'),
          ex('barra_fixa', 'Barra fixa com carga', 'corporal'),
          ex('abd_cabo', 'Abdominal no cabo', 'maquina', { repMin: 10, repMax: 15 }),
        ],
      },
      {
        id: 'd_ombros',
        name: 'Ombros',
        exercises: [
          ex('desenv_militar', 'Desenvolvimento militar com barra', 'barra'),
          ex('elev_lateral', 'Elevação lateral com halteres', 'halter'),
          ex('crucifixo_inv', 'Crucifixo invertido com halteres', 'halter'),
          ex('panturrilha_sentado', 'Panturrilha sentado', 'maquina'),
        ],
      },
      {
        id: 'd_pernas',
        name: 'Pernas',
        exercises: [
          ex('agachamento', 'Agachamento livre', 'barra'),
          ex('leg_press', 'Leg press', 'maquina'),
          ex('terra_romeno', 'Levantamento terra romeno', 'barra'),
          ex('elev_pernas', 'Elevação de pernas na barra', 'corporal', { repMin: 10, repMax: 15 }),
        ],
      },
      {
        id: 'd_bracos',
        name: 'Braços',
        exercises: [
          ex('rosca_barra', 'Rosca direta com barra', 'barra'),
          ex('supino_fechado', 'Supino fechado', 'barra'),
          ex('rosca_alt', 'Rosca alternada com halteres', 'halter'),
          ex('triceps_testa', 'Tríceps testa', 'barra'),
        ],
      },
    ],
  };
}

export function isoDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseIsoDate(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function initialState(now = new Date()) {
  return {
    version: 1,
    settings: structuredClone(DEFAULT_SETTINGS),
    plan: defaultPlan(),
    prog: {}, // exId -> { weight, base, stall }
    sessions: [],
    active: null,
    cycleStart: isoDate(now),
    deload: null, // { start } durante a semana de deload
    body: [], // { date, kg }
    profile: { sex: 'M', age: null, height: null, bf: null, hours: 5, phase: 'crescer', adjust: 0, adjustAt: null },
    diet: { menu: defaultMenu(), foods: [], log: {} }, // cardápio, alimentos cadastrados e registro por dia
  };
}

// Valida e completa um estado salvo ou importado.
export function migrate(obj) {
  if (!obj || typeof obj !== 'object' || !obj.plan || !Array.isArray(obj.plan.days)) {
    throw new Error('Arquivo inválido: não parece um backup deste app.');
  }
  const base = initialState();
  return {
    ...base,
    ...obj,
    settings: {
      ...base.settings,
      ...(obj.settings || {}),
      inc: { ...base.settings.inc, ...(obj.settings?.inc || {}) },
    },
    prog: obj.prog && typeof obj.prog === 'object' ? obj.prog : {},
    sessions: Array.isArray(obj.sessions) ? obj.sessions : [],
    active: obj.active ?? null,
    cycleStart: obj.cycleStart || base.cycleStart,
    deload: obj.deload?.start ? obj.deload : null,
    body: Array.isArray(obj.body) ? obj.body : [],
    profile: { ...base.profile, ...(obj.profile || {}) },
    diet: {
      menu: Array.isArray(obj.diet?.menu?.meals) ? obj.diet.menu : base.diet.menu,
      foods: Array.isArray(obj.diet?.foods) ? obj.diet.foods : [],
      log: obj.diet?.log && typeof obj.diet.log === 'object' ? obj.diet.log : {},
    },
    version: 1,
  };
}

export function incFor(exercise, settings) {
  if (Number(exercise.inc) > 0) return Number(exercise.inc);
  return settings.inc[exercise.equip] ?? 5;
}

const round2 = (x) => Math.round(x * 100) / 100;

// Progressão dupla do livro:
// - bateu o topo da faixa (6 reps) → sobe a carga na próxima série;
// - ficou abaixo do mínimo (4 reps) logo depois de subir → volta para a carga anterior;
// - ficou abaixo do mínimo sem ter acabado de subir → mantém e tenta de novo;
// - dentro da faixa → mantém e busca o topo.
// `base` é a carga anterior à última subida (ou null).
export function evaluateSet({ weight, reps, repMin, repMax, inc, base }) {
  if (reps >= repMax) return { action: 'subir', next: round2(weight + inc), base: weight };
  if (reps < repMin) {
    if (base != null && base < weight) return { action: 'voltar', next: base, base: null };
    return { action: 'abaixo', next: weight, base: base ?? null };
  }
  return { action: 'manter', next: weight, base: base ?? null };
}

// Reaplica as séries do treino a partir do estado salvo do exercício.
export function replay(start, sets, exercise, settings) {
  let next = start?.weight ?? null;
  let base = start?.base ?? null;
  const inc = incFor(exercise, settings);
  const results = sets.map((s) => {
    const r = evaluateSet({ weight: s.weight, reps: s.reps, repMin: exercise.repMin, repMax: exercise.repMax, inc, base });
    next = r.next;
    base = r.base;
    return r;
  });
  return { next, base, results };
}

// Estado do exercício gravado ao finalizar o treino.
export function commitExercise(start, work) {
  const progressed = work.results.some((r) => r.action === 'subir');
  return {
    weight: work.next,
    base: work.base,
    stall: progressed ? 0 : (start?.stall ?? 0) + 1,
  };
}

// 1RM estimado (fórmula de Epley).
export function e1rm(weight, reps) {
  if (!(reps > 0)) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// O livro recomenda deload (ou uma semana sem treino) a cada 8 a 10 semanas.
export function deloadStatus(cycleStart, now, weeks) {
  const days = Math.max(0, Math.floor((now - parseIsoDate(cycleStart)) / 864e5));
  const w = days / 7;
  let level = 'ok';
  if (w >= weeks + 2) level = 'atrasado';
  else if (w >= weeks) level = 'agora';
  else if (w >= weeks - 1) level = 'proximo';
  return { weeks: Math.floor(w), days, level };
}

export function nextDayId(plan, sessions) {
  const days = plan.days;
  if (!days.length) return null;
  const last = sessions[sessions.length - 1];
  if (!last) return days[0].id;
  const idx = days.findIndex((d) => d.id === last.dayId);
  return days[(idx + 1) % days.length].id;
}

export function lastSetsFor(sessions, exId) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const sets = sessions[i].sets.filter((s) => s.exId === exId);
    if (sets.length) return { date: sessions[i].date, sets };
  }
  return null;
}

// Uma linha por treino: série mais pesada e melhor 1RM estimado.
export function exerciseHistory(sessions, exId) {
  const out = [];
  for (const s of sessions) {
    const sets = s.sets.filter((x) => x.exId === exId);
    if (!sets.length) continue;
    const top = sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
    out.push({
      date: s.date,
      topWeight: top.weight,
      topReps: top.reps,
      e1rm: Math.max(...sets.map((x) => e1rm(x.weight, x.reps))),
    });
  }
  return out;
}

// ---------- anilhas e aquecimento ----------

export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export function roundLoad(x, step) {
  return round2(Math.round(x / step) * step);
}

// Menor salto possível numa barra: um par da menor anilha.
export function barStep(settings) {
  const plates = settings.plates?.length ? settings.plates : DEFAULT_PLATES;
  return round2(2 * Math.min(...plates));
}

// Anilhas de cada lado da barra (guloso, do maior para o menor).
export function platesPerSide(total, bar, plates) {
  let side = round2((total - bar) / 2);
  if (side <= 0) return { perSide: [], rest: round2(Math.min(0, total - bar)) };
  const perSide = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side >= p - 1e-9) {
      perSide.push(p);
      side = round2(side - p);
    }
  }
  return { perSide, rest: round2(side * 2) };
}

// Aquecimento do livro antes do primeiro exercício pesado do grupo muscular.
// Descanso depois de cada série: 1 min entre elas e ~3 min antes da primeira série pesada.
const WARMUP = [
  { reps: 12, pct: 50, rest: '1 min', restSec: 60 },
  { reps: 10, pct: 50, rest: '1 min', restSec: 60 },
  { reps: 4, pct: 70, rest: '1 min', restSec: 60 },
  { reps: 1, pct: 90, rest: '3 min', restSec: 180 },
];

export function warmupSets(workWeight, exercise, settings) {
  if (!(workWeight > 0)) return [];
  const isBar = exercise.equip === 'barra';
  const step = isBar ? barStep(settings) : incFor(exercise, settings) >= 2 ? 2 : 1;
  const min = isBar ? settings.barKg ?? 20 : 0;
  return WARMUP.map((w) => ({ ...w, weight: Math.max(min, roundLoad((workWeight * w.pct) / 100, step)) }));
}

export function isWarmupEx(day, exercise) {
  if (typeof exercise.warmup === 'boolean') return exercise.warmup;
  return day.exercises[0]?.id === exercise.id;
}

// ---------- deload ----------

export function deloadWeight(weight, exercise, settings) {
  if (weight == null) return null;
  const pct = settings.deloadPct ?? 60;
  const isBar = exercise.equip === 'barra';
  const step = isBar ? barStep(settings) : incFor(exercise, settings);
  const w = roundLoad((weight * pct) / 100, step);
  return isBar ? Math.max(settings.barKg ?? 20, w) : w;
}

export function deloadDay(deload, now) {
  if (!deload) return null;
  return Math.floor((now - parseIsoDate(deload.start)) / 864e5) + 1;
}

// ---------- peso corporal e calorias ----------

// Média dos últimos 7 dias contra a dos 7 anteriores (kg por semana).
export function weightTrend(entries, now) {
  const dayMs = 864e5;
  const today = parseIsoDate(isoDate(now)).getTime();
  const avg = (from, to) => {
    const xs = entries.filter((e) => {
      const t = parseIsoDate(e.date).getTime();
      return t > today - to * dayMs && t <= today - from * dayMs;
    }).map((e) => e.kg);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const last = avg(0, 7);
  const prev = avg(7, 14);
  return {
    last: last == null ? null : round2(last),
    prev: prev == null ? null : round2(prev),
    rate: last != null && prev != null ? round2(last - prev) : null,
  };
}

// ---------- fases da dieta ----------

// Calorias em relação ao gasto diário e divisão de macros (% proteína / carbo / gordura).
export const PHASES = {
  crescer: { label: 'Crescer', factor: 1.1, split: [25, 55, 20] },
  secar: { label: 'Secar', factor: 0.8, split: [40, 40, 20] },
  manter: { label: 'Manter', factor: 1.0, split: [30, 50, 20] },
};

// Faixa de variação de peso por semana considerada boa em cada fase (kg/semana).
export function phaseRange(phase, weightKg, settings) {
  if (phase === 'secar') return { min: round2(-0.01 * weightKg), max: round2(-0.005 * weightKg) };
  if (phase === 'manter') return { min: -0.2, max: 0.2 };
  return { min: settings.gainMin, max: settings.gainMax };
}

// O que fazer com as calorias, olhando o ritmo da última semana.
export function phaseAdvice(phase, rate, weightKg, settings) {
  if (rate == null || !(weightKg > 0)) return null;
  const r = phaseRange(phase, weightKg, settings);
  if (rate < r.min) return { level: 'comer-mais', kcal: 150, range: r };
  if (rate > r.max) return { level: 'comer-menos', kcal: -150, range: r };
  return { level: 'ok', kcal: 0, range: r };
}

// Pontos de troca de fase pelo % de gordura: crescer até ~17% e secar até ~10% (homens).
export function phaseBfAlert(phase, bf, sex) {
  if (!(bf > 0)) return null;
  const high = sex === 'F' ? 27 : 17;
  const low = sex === 'F' ? 20 : 10;
  if (phase === 'crescer' && bf >= high) return { to: 'secar', limit: high };
  if (phase === 'secar' && bf <= low) return { to: 'crescer', limit: low };
  return null;
}

// Gasto diário pelo livro: metabolismo basal × fator de atividade
// (1,2 até 3 h de exercício por semana, 1,35 de 4 a 6 h, 1,5 acima de 6 h).
// A meta é o gasto × fator da fase, mais o ajuste acumulado (kcal).
export function calories(profile, weightKg) {
  const { sex = 'M', age, height, bf, hours, phase = 'crescer', adjust = 0 } = profile || {};
  if (!(weightKg > 0)) return null;
  let bmr;
  let method;
  if (bf > 0 && bf < 60) {
    bmr = 370 + 21.6 * weightKg * (1 - bf / 100); // Katch-McArdle
    method = 'katch';
  } else if (age > 0 && height > 0) {
    bmr = 10 * weightKg + 6.25 * height - 5 * age + (sex === 'F' ? -161 : 5); // Mifflin-St Jeor
    method = 'mifflin';
  } else return null;
  const factor = hours > 6 ? 1.5 : hours >= 4 ? 1.35 : 1.2;
  const tdee = bmr * factor;
  const ph = PHASES[phase] ?? PHASES.crescer;
  const target = Math.round(tdee * ph.factor + (adjust || 0));
  const [p, c, f] = ph.split;
  return {
    method,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target,
    split: ph.split,
    protein: Math.round((target * p) / 100 / 4),
    carbs: Math.round((target * c) / 100 / 4),
    fat: Math.round((target * f) / 100 / 9),
  };
}
