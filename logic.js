// Regras de treino baseadas em "Malhar, Secar, Definir" (Michael Matthews).
// Funções puras, sem DOM, para poderem ser testadas com `node --test`.

export const EQUIP = {
  barra: 'Barra',
  halter: 'Halteres',
  maquina: 'Máquina / cabo',
  corporal: 'Peso corporal + carga',
};

export const DEFAULT_SETTINGS = {
  restSec: 180,
  deloadWeeks: 8,
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
