// Comparações divertidas (peso levantado ≈ animal ou objeto) e conquistas. Funções puras.
import { e1rm, lastSetsFor, isoDate, weekStart, parseIsoDate } from './logic.js';

// Pesos aproximados (kg): médias de animais adultos e modelos comuns de objetos. Do menor para o maior.
export const THINGS = [
  { e: '🐔', s: 'uma galinha', p: 'galinhas', kg: 2.5 },
  { e: '🐈', s: 'um gato', p: 'gatos', kg: 4 },
  { e: '🦃', s: 'um peru', p: 'perus', kg: 10 },
  { e: '🐕', s: 'um labrador', p: 'labradores', kg: 30 },
  { e: '🐺', s: 'um lobo', p: 'lobos', kg: 40 },
  { e: '🐑', s: 'uma ovelha', p: 'ovelhas', kg: 70 },
  { e: '🐆', s: 'uma onça-pintada', p: 'onças-pintadas', kg: 85 },
  { e: '🐼', s: 'um panda-gigante', p: 'pandas-gigantes', kg: 110 },
  { e: '🏍️', s: 'uma moto', p: 'motos', kg: 130 },
  { e: '🦍', s: 'um gorila', p: 'gorilas', kg: 160 },
  { e: '🦁', s: 'um leão', p: 'leões', kg: 190 },
  { e: '🐅', s: 'um tigre', p: 'tigres', kg: 220 },
  { e: '🎹', s: 'um piano', p: 'pianos', kg: 250 },
  { e: '🐻', s: 'um urso-pardo', p: 'ursos-pardos', kg: 300 },
  { e: '🦓', s: 'uma zebra', p: 'zebras', kg: 350 },
  { e: '🐎', s: 'um cavalo', p: 'cavalos', kg: 500 },
  { e: '🐄', s: 'uma vaca', p: 'vacas', kg: 600 },
  { e: '🦬', s: 'um bisão', p: 'bisões', kg: 900 },
  { e: '🚗', s: 'um carro popular', p: 'carros populares', kg: 1000 },
  { e: '🦒', s: 'uma girafa', p: 'girafas', kg: 1200 },
  { e: '🦛', s: 'um hipopótamo', p: 'hipopótamos', kg: 1500 },
  { e: '🛻', s: 'uma caminhonete', p: 'caminhonetes', kg: 2000 },
  { e: '🦏', s: 'um rinoceronte', p: 'rinocerontes', kg: 2300 },
  { e: '🐬', s: 'uma orca', p: 'orcas', kg: 5000 },
  { e: '🐘', s: 'um elefante-africano', p: 'elefantes-africanos', kg: 6000 },
  { e: '🦖', s: 'um tiranossauro', p: 'tiranossauros', kg: 8000 },
  { e: '🚌', s: 'um ônibus', p: 'ônibus', kg: 12000 },
  { e: '🚒', s: 'um caminhão de bombeiros', p: 'caminhões de bombeiros', kg: 18000 },
  { e: '🐋', s: 'uma baleia-jubarte', p: 'baleias-jubarte', kg: 30000 },
  { e: '✈️', s: 'um Boeing 737', p: 'Boeings 737', kg: 41000 },
  { e: '🦕', s: 'um braquiossauro', p: 'braquiossauros', kg: 50000 },
  { e: '🚂', s: 'uma locomotiva', p: 'locomotivas', kg: 120000 },
  { e: '🐳', s: 'uma baleia-azul', p: 'baleias-azuis', kg: 150000 },
  { e: '🗽', s: 'a Estátua da Liberdade', p: 'Estátuas da Liberdade', kg: 200000 },
  { e: '🚀', s: 'um ônibus espacial na plataforma', p: 'ônibus espaciais na plataforma', kg: 2000000 },
  { e: '🗼', s: 'a Torre Eiffel', p: 'Torres Eiffel', kg: 7300000 },
  { e: '🛳️', s: 'o Titanic', p: 'Titanics', kg: 52000000 },
];

// Maior item que cabe no peso; vira "2 cavalos" quando passa de ~1,75 vezes.
export function compare(kg) {
  if (!(kg >= THINGS[0].kg)) return null;
  let i = 0;
  while (i + 1 < THINGS.length && THINGS[i + 1].kg <= kg) i++;
  const t = THINGS[i];
  const n = kg / t.kg;
  const count = n >= 1.75 ? Math.round(n) : 1;
  return { t, count, text: count > 1 ? `${count} ${t.p}` : t.s, next: THINGS[i + 1] ?? null };
}

// Volume = soma de carga × repetições.
export const sessionVolume = (s) => s.sets.reduce((t, x) => t + (x.weight || 0) * (x.reps || 0), 0);
export const totalVolume = (sessions) => sessions.reduce((t, s) => t + sessionVolume(s), 0);
export function heaviestSet(s) {
  return s.sets.reduce((best, x) => (!best || x.weight > best.weight ? x : best), null);
}

// Maior sequência de semanas seguidas com treino (em qualquer época).
export function longestWeekStreak(sessions) {
  const weeks = [...new Set(sessions.map((s) => isoDate(weekStart(parseIsoDate(s.date)))))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const w of weeks) {
    const d = parseIsoDate(w);
    run = prev && Math.round((d - prev) / (7 * 864e5)) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

function anyRecord(sessions) {
  for (let i = 1; i < sessions.length; i++) {
    const s = sessions[i];
    if (s.deload) continue;
    const before = sessions.slice(0, i).filter((x) => !x.deload);
    for (const exId of new Set(s.sets.map((x) => x.exId))) {
      const hist = before.flatMap((x) => x.sets.filter((y) => y.exId === exId));
      if (!hist.length || !lastSetsFor(before, exId)) continue;
      const best = Math.max(...s.sets.filter((x) => x.exId === exId).map((x) => e1rm(x.weight, x.reps)));
      if (best > Math.max(...hist.map((y) => e1rm(y.weight, y.reps)))) return true;
    }
  }
  return false;
}

// Conquistas. extra.proteinDays = dias registrados batendo a proteína (vem da dieta).
export function achievements(sessions, extra = {}) {
  const heavy = Math.max(0, ...sessions.flatMap((s) => s.sets.map((x) => x.weight || 0)));
  const bestVol = Math.max(0, ...sessions.map(sessionVolume));
  const total = totalVolume(sessions);
  const streak = longestWeekStreak(sessions);
  const deloads = sessions.filter((s) => s.deload).length;
  const prot = extra.proteinDays ?? 0;
  const goal = (value, target) => ({ ok: value >= target, prog: Math.min(1, value / target) });
  return [
    { id: 'primeiro', e: '🏁', t: 'Primeiro treino', d: 'Finalizou o 1º treino', ...goal(sessions.length, 1) },
    { id: 'panda', e: '🐼', t: 'Levantou um panda', d: 'Série de 110 kg ou mais', ...goal(heavy, 110) },
    { id: 'leao', e: '🦁', t: 'Levantou um leão', d: 'Série de 190 kg ou mais', ...goal(heavy, 190) },
    { id: 'elefante', e: '🐘', t: 'Levantou um elefante', d: 'Treino com 6 t de volume', ...goal(bestVol, 6000) },
    { id: 'onibus', e: '🚌', t: 'Levantou um ônibus', d: 'Treino com 12 t de volume', ...goal(bestVol, 12000) },
    { id: 'recorde', e: '🏅', t: 'Primeiro recorde', d: 'Bateu seu 1RM estimado', ok: anyRecord(sessions), prog: null },
    { id: 'semanas', e: '🔥', t: '4 semanas seguidas', d: 'Treinou 4 semanas sem falhar', ...goal(streak, 4) },
    { id: 'cinquenta', e: '📅', t: '50 treinos', d: 'Finalizou 50 treinos', ...goal(sessions.length, 50) },
    { id: 'baleia', e: '🐳', t: 'Baleia-azul', d: '150 t acumuladas', ...goal(total, 150000) },
    { id: 'estatua', e: '🗽', t: 'Estátua da Liberdade', d: '200 t acumuladas', ...goal(total, 200000) },
    { id: 'deload', e: '🔋', t: 'Deload feito', d: 'Treinou uma semana de deload', ...goal(deloads, 1) },
    { id: 'proteina', e: '🥩', t: 'Proteína em dia', d: '7 dias batendo a proteína', ...goal(prot, 7) },
  ];
}

// Conquistas que passaram a valer entre duas listas.
export function newlyUnlocked(before, after) {
  const had = new Set(before.filter((a) => a.ok).map((a) => a.id));
  return after.filter((a) => a.ok && !had.has(a.id));
}
