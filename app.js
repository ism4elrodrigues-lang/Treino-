import * as L from './logic.js';
import { FIGS, mountHowto, figureSVG } from './figures.js';
import * as D from './diet.js';
import { FOODS } from './foods.js';

const KEY = 'treino-mss-v1';
const TIMER_KEY = 'treino-mss-timer';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kg = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const fmtDate = (iso) => L.parseIsoDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtDateLong = (iso) => L.parseIsoDate(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

const TAG = { subir: '▲ subir', manter: '= manter', voltar: '▼ voltar', abaixo: '! abaixo', deload: '◦ deload' };

// ---------- estado ----------

let state = load();
const ui = { tab: 'treino', drafts: {}, extra: {}, histEx: null, howto: {}, warm: {}, noteEdit: null, current: null, flash: null, planOpen: {}, planEx: null };
const smoothScroll = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

// Desenho do exercício: o escolhido no plano, ou o padrão pelo id do exercício do livro.
function figKey(ex) {
  if (typeof ex.fig === 'string') return FIGS[ex.fig] ? ex.fig : null;
  return FIGS[ex.id] ? ex.id : null;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const st = L.migrate(JSON.parse(raw));
      const limit = L.isoDate(new Date(Date.now() - 60 * 864e5));
      for (const k of Object.keys(st.diet.log)) if (k < limit) delete st.diet.log[k]; // guarda só 60 dias
      return st;
    }
  } catch (e) {
    console.warn('Falha ao ler dados salvos', e);
  }
  return L.initialState(new Date());
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    toast('Não foi possível salvar no aparelho. Faça um backup em Ajustes.', true);
  }
}

const dayById = (id) => state.plan.days.find((d) => d.id === id);
function findEx(exId) {
  for (const d of state.plan.days) {
    const ex = d.exercises.find((e) => e.id === exId);
    if (ex) return { day: d, ex };
  }
  return null;
}

function adviceText(r, ex) {
  switch (r.action) {
    case 'subir': return `Bateu ${ex.repMax} reps → suba para ${kg(r.next)} kg`;
    case 'voltar': return `Menos de ${ex.repMin} reps com a carga nova → volte para ${kg(r.next)} kg`;
    case 'abaixo': return `Abaixo de ${ex.repMin} reps → mantenha ${kg(r.next)} kg e tente de novo`;
    default: return `Dentro da faixa → mantenha ${kg(r.next)} kg e busque ${ex.repMax} reps`;
  }
}

// ---------- telas ----------

function render() {
  document.querySelectorAll('.tabs button').forEach((b) => {
    if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const view = $('#view');
  const views = { treino: viewTreino, historico: viewHistorico, corpo: viewCorpo, plano: viewPlano, config: viewConfig };
  view.innerHTML = views[ui.tab]();
  document.body.classList.toggle('on-home', ui.tab === 'treino' && !state.active);
  view.querySelectorAll('[data-fig]').forEach((el) => mountHowto(el, el.dataset.fig));
}

function viewTreino() {
  if (state.active) return viewActive();
  const days = state.plan.days;
  if (!days.length) return `<div class="empty">Nenhum dia no plano.<br><br><button class="btn" data-goto="plano">Montar o plano</button></div>`;
  const now = new Date();
  const nextId = L.nextDayId(state.plan, state.sessions);
  const selId = ui.homeDay && dayById(ui.homeDay) ? ui.homeDay : nextId;
  const d = dayById(selId);
  const di = days.indexOf(d);
  const hour = now.getHours();
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const streak = L.weekStreak(state.sessions, now);
  const s = state.settings;
  const deloadOn = !!state.deload;

  // cartão do treino escolhido
  const totalSets = d.exercises.reduce((t, e) => t + e.sets, 0);
  const minutes = Math.max(10, Math.round((totalSets * (s.restSec + 45) / 60 + 5) / 5) * 5);
  const rows = d.exercises.map((e) => {
    const w = state.prog[e.id]?.weight ?? null;
    const shown = deloadOn ? L.deloadWeight(w, e, s) : w;
    const prev = L.lastSetsFor(heavy(), e.id);
    const up = !deloadOn && w != null && prev && w > prev.sets[0].weight;
    const load = shown != null ? `${kg(shown)} kg` : `<span class="muted">${e.equip === 'corporal' ? 'peso corporal' : 'a definir'}</span>`;
    return { e, up, load };
  });
  const ups = rows.filter((r) => r.up).length;
  const figEx = d.exercises.find((e) => figKey(e));
  const hero = `<section class="card home-hero">
    <div class="hh-top">
      <div class="hh-txt">
        <p class="eyebrow">${selId === nextId ? 'Treino de hoje' : 'Treino escolhido'} · dia ${di + 1} de ${days.length}${deloadOn ? ' · deload' : ''}</p>
        <h2>${esc(d.name)}</h2>
        <p class="hh-meta"><span>${d.exercises.length} exercício${d.exercises.length === 1 ? '' : 's'}</span><span>${totalSets} séries</span><span>~${minutes} min</span></p>
      </div>
      ${figEx ? `<div class="hh-fig">${figureSVG(figKey(figEx))}</div>` : ''}
    </div>
    ${rows.length ? `<ul class="hh-list">${rows.map(({ e, up, load }) => `<li><span class="nm">${esc(e.name)}</span><span class="ld">${load}${up ? '<span class="up" title="Carga maior que da última vez">▲</span>' : ''}</span></li>`).join('')}</ul>` : '<p class="small muted hh-empty">Sem exercícios neste dia. Adicione no Plano.</p>'}
    <div class="hh-cta">
      <button class="btn primary big" data-act="start" data-day="${d.id}">Começar treino</button>
      ${ups ? `<p class="small muted"><span class="upmark">▲</span> ${ups} exercício${ups > 1 ? 's' : ''} com carga maior que da última vez</p>` : ''}
    </div>
  </section>`;

  // sequência dos dias
  const done = L.roundDone(state.plan, state.sessions);
  const seq = `<section class="card home-seq">
    <div class="hs-top"><b>Sequência</b><span class="small muted">toque para trocar o treino</span></div>
    <div class="chips">${days.map((x, i) => {
      const cls = x.id === selId ? 'sel' : done.has(x.id) ? 'done' : '';
      return `<button type="button" class="chip ${cls}" data-act="home-day" data-day="${x.id}" aria-pressed="${x.id === selId}"><span class="n">${i + 1}</span>${esc(x.name)}${done.has(x.id) && x.id !== selId ? ' ✓' : ''}</button>`;
    }).join('')}</div>
  </section>`;

  // semana
  const grid = L.weekGrid(state.sessions, state.plan, now);
  const weekCount = grid.reduce((t, g) => t + g.sessions.length, 0);
  const wd = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const week = `<section class="card home-week">
    <div class="hs-top"><b>Esta semana</b><span class="small muted"><b class="num">${weekCount}</b> de ${days.length} treinos</span></div>
    <div class="wdays">${grid.map((g, i) => {
      const label = g.sessions.map((x) => (x.dayName || '?').slice(0, 1).toUpperCase()).join('');
      return `<div class="wday${g.sessions.length ? ' done' : ''}${g.today ? ' today' : ''}" title="${g.sessions.map((x) => esc(x.dayName)).join(', ')}">
        <span class="wd">${wd[i]}</span><span class="cell">${label || (g.today ? '•' : '')}</span></div>`;
    }).join('')}</div>
  </section>`;

  // peso
  const tr = L.weightTrend(state.body, now);
  const lastKg = state.body.at(-1)?.kg;
  let weight;
  if (lastKg == null) {
    weight = `<button type="button" class="card home-tile" data-act="home-peso"><span class="lbl">Peso</span><span class="small muted">Registre seu peso na aba Dieta para acompanhar o ritmo.</span></button>`;
  } else {
    const ref = tr.last ?? lastKg;
    const adv = L.phaseAdvice(state.profile.phase || 'crescer', tr.rate, ref, s);
    const pill = !adv ? '' : adv.level === 'ok' ? '<span class="pill ok">✓ no ritmo</span>' : adv.level === 'comer-mais' ? '<span class="pill up">↑ coma um pouco mais</span>' : '<span class="pill down">↓ coma um pouco menos</span>';
    weight = `<button type="button" class="card home-tile" data-act="home-peso" aria-label="Abrir peso e meta">
      <span class="lbl">Peso${tr.last != null ? ' · média de 7 dias' : ''}</span>
      <span class="ht-row"><span class="big num">${kg(Math.round(ref * 10) / 10)} <small>kg</small></span>
      ${tr.rate != null ? `<span class="small muted">${tr.rate >= 0 ? '+' : '−'}${kg(Math.round(Math.abs(tr.rate) * 10) / 10)} kg na semana</span>` : ''}${pill}</span>
    </button>`;
  }

  // último treino
  const li = state.sessions.length - 1;
  let lastCard = '';
  if (li >= 0) {
    const ls = state.sessions[li];
    const h = L.sessionHighlights(state.sessions, li);
    lastCard = `<section class="card home-last">
      <span class="ic">✓</span>
      <div><p><b>Último treino: ${esc(ls.dayName)}</b> <span class="small muted">· ${L.parseIsoDate(ls.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</span></p>
      <div class="tags">${ls.deload ? '<span class="tag">deload</span>' : ''}${h.ups ? `<span class="tag ok">▲ ${h.ups} carga${h.ups > 1 ? 's' : ''} subi${h.ups > 1 ? 'ram' : 'u'}</span>` : ''}${h.records ? `<span class="tag acc">${h.records} recorde${h.records > 1 ? 's' : ''}</span>` : ''}<span class="tag">${h.sets} séries</span></div></div>
    </section>`;
  }

  // deload: banner quando está na hora, senão uma linha discreta
  const st = L.deloadStatus(state.cycleStart, now, s.deloadWeeks);
  const banner = deloadBanner();
  const left = Math.max(1, s.deloadWeeks - st.weeks);
  const deload = banner || `<div class="home-deload"><span>Próximo deload em <b>${left} semana${left > 1 ? 's' : ''}</b></span>
    <span class="meter" aria-label="${st.weeks} de ${s.deloadWeeks} semanas do ciclo">${Array.from({ length: s.deloadWeeks }, (_, i) => `<i class="${i < st.weeks ? 'on' : ''}"></i>`).join('')}</span></div>`;

  return `<div class="home">
    <div class="greet"><div><p class="small muted">${now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${hello}</h1></div>
      ${streak >= 2 ? `<span class="streak">${streak} semanas seguidas</span>` : ''}</div>
    ${banner && (state.deload || st.level !== 'proximo') ? banner : ''}
    ${hero}${seq}${week}${weight}${lastCard}
    ${banner && (state.deload || st.level !== 'proximo') ? '' : deload}
  </div>`;
}

function viewActive() {
  const a = state.active;
  const d = dayById(a.dayId);
  if (!d) {
    return `<div class="empty">O dia deste treino foi removido do plano.<br><br>
      <button class="btn" data-act="finish">Salvar o que foi feito</button>
      <button class="btn danger" data-act="cancel">Descartar</button></div>`;
  }
  return `<div class="session-head">
      <div><p class="muted small">Treino em andamento · ${fmtDate(a.date)}${a.deload ? ' · <b>deload</b>' : ''}</p><h2>${esc(d.name)}</h2></div>
      <button class="btn ghost small danger" data-act="cancel">Cancelar</button>
    </div>
    ${sessionProgress(d)}
    ${(() => {
      const cur = currentItemId(d);
      return sessionItems(d).map((it) => {
        if (it.kind === 'warm') return it.id === cur ? warmCard(it) : warmLine(it);
        return it.id === cur ? exCard(it.ex, d) : exDone(it.ex) ? exCollapsed(it.ex) : exPending(it.ex, it.i);
      }).join('');
    })()}
    ${d.exercises.length && d.exercises.every(exDone) ? '<p class="complete">Treino completo! Toque em Finalizar para salvar.</p>' : ''}
    <button class="btn primary big" data-act="finish">Finalizar treino</button>`;
}

// Exercício terminado = todas as séries planejadas registradas.
const exSetsDone = (ex) => state.active.sets.filter((x) => x.exId === ex.id);
const exDone = (ex) => exSetsDone(ex).length >= ex.sets;

function sessionProgress(d) {
  const n = d.exercises.filter(exDone).length;
  const total = d.exercises.length;
  if (!total) return '';
  return `<div class="sprog">
    <div class="sprog-lbl"><span class="muted">${n === total ? 'Todos os exercícios feitos' : 'Exercícios feitos'}</span><span><b>${n}</b> <span class="muted">de ${total}</span></span></div>
    <div class="track"><i style="width:${((n / total) * 100).toFixed(1)}%"></i></div>
  </div>`;
}

// Itens do treino em ordem: o aquecimento (quando o exercício tem) vem como item próprio antes dele.
const WARM = 'w:';
function sessionItems(d) {
  const out = [];
  d.exercises.forEach((e, i) => {
    if (!state.active.deload && L.isWarmupEx(d, e)) out.push({ kind: 'warm', id: WARM + e.id, ex: e, i });
    out.push({ kind: 'ex', id: e.id, ex: e, i });
  });
  return out;
}
const warmCount = (ex) => (state.active.warmDone?.[ex.id] ?? []).filter(Boolean).length;
const warmSkipped = (ex) => !!state.active.warmSkip?.[ex.id];
// Aquecimento conta como resolvido quando as 4 séries foram feitas, quando foi pulado
// ou quando o exercício já começou.
function itemDone(it) {
  if (it.kind === 'ex') return exDone(it.ex);
  return warmCount(it.ex) >= 4 || warmSkipped(it.ex) || exSetsDone(it.ex).length > 0;
}

// Só um item fica aberto: o escolhido (ui.current) ou, se nenhum foi escolhido, o primeiro que falta.
// ui.current === 'none' significa que o usuário recolheu tudo.
function currentItemId(d) {
  if (ui.current === 'none') return null;
  const items = sessionItems(d);
  if (ui.current && items.some((it) => it.id === ui.current)) return ui.current;
  return items.find((it) => !itemDone(it))?.id ?? null;
}

// Próximo item depois de terminar um: primeiro um exercício que ficou pela metade, senão o próximo que falta.
function nextItemAfter(d, id) {
  const items = sessionItems(d);
  const pos = items.findIndex((it) => it.id === id);
  const order = [...items.slice(pos + 1), ...items.slice(0, Math.max(0, pos))];
  return order.find((it) => it.kind === 'ex' && !itemDone(it) && exSetsDone(it.ex).length > 0)
    ?? order.find((it) => !itemDone(it)) ?? null;
}

function goToItem(id) {
  setTimeout(() => {
    if (!state.active) return;
    const el = id ? document.getElementById(`ex-${id}`) : $('.complete');
    el?.scrollIntoView({ behavior: smoothScroll(), block: id ? 'start' : 'center' });
    el?.querySelector?.('[data-draft="r"]')?.focus({ preventScroll: true });
  }, 450);
}

function warmCard(it) {
  const ex = it.ex;
  const sets = exSetsDone(ex);
  const { work } = exWork(ex);
  const draft = ui.drafts[ex.id] ?? {};
  const wValue = draft.w ?? (work.next ?? '');
  return `<section class="card is-current warm-card" id="ex-${esc(it.id)}">
    <div class="ex-head">
      <div><h3>Aquecimento</h3><p class="small muted">antes de ${esc(ex.name)}</p></div>
      <div class="ex-head-r">
        <span class="chip">4 séries leves</span>
        <button type="button" class="btn small" data-act="ex-collapse" data-ex="${esc(it.id)}">Recolher ▴</button>
      </div>
    </div>
    ${sets.length
      ? `<p class="small muted">Calculado com a 1ª série feita: <b>${kg(sets[0].weight)} kg</b></p>`
      : `<label class="field warm-base">Carga da 1ª série de ${esc(ex.name)} (kg)
          <input inputmode="decimal" data-draft="w" data-ex="${esc(ex.id)}" value="${esc(wValue === '' ? '' : String(wValue).replace('.', ','))}" placeholder="kg"></label>`}
    <div id="warm-${esc(ex.id)}">${warmList(ex, warmBaseFor(ex, sets, work))}</div>
    <div class="row end"><button type="button" class="btn ghost small" data-act="warm-skip" data-ex="${esc(ex.id)}">Pular aquecimento</button></div>
  </section>`;
}

function warmLine(it) {
  const ex = it.ex;
  const n = warmCount(ex);
  const done = itemDone(it);
  const full = n >= 4;
  const cls = full ? 'is-done' : done ? 'is-skipped' : n ? 'is-started' : 'is-pending';
  const sum = full ? '4 de 4 séries feitas'
    : warmSkipped(ex) ? 'pulado'
    : done ? 'não feito'
    : n ? `${n} de 4 feitas` : '4 séries leves';
  return `<button type="button" class="done-line warm-line ${cls}${ui.flash === it.id ? ' flash' : ''}" id="ex-${esc(it.id)}" data-act="ex-expand" data-ex="${esc(it.id)}" aria-label="Aquecimento de ${esc(ex.name)}: ${sum}. Toque para abrir">
    <span class="check" aria-hidden="true">${full ? '✓' : '↗'}</span>
    <span class="name">Aquecimento</span>
    <span></span>
    <span class="sum">${sum} · antes de ${esc(ex.name)}</span>
    <span class="chev" aria-hidden="true">▾</span>
  </button>`;
}

function exWork(ex) {
  const a = state.active;
  const sets = exSetsDone(ex);
  const start = a.startProg[ex.id] ?? state.prog[ex.id] ?? null;
  const work = a.deload
    ? { next: L.deloadWeight(start?.weight ?? null, ex, state.settings), results: sets.map(() => ({ action: 'deload' })) }
    : L.replay(start, sets, ex, state.settings);
  return { sets, work };
}

// Linha verde de um exercício terminado; tocar abre o card completo.
function exCollapsed(ex) {
  const { sets, work } = exWork(ex);
  const nextTxt = state.active.deload ? '' : ` · próxima vez: <b>${kg(work.next)} kg</b>`;
  return `<button type="button" class="done-line is-done${ui.flash === ex.id ? ' flash' : ''}" id="ex-${esc(ex.id)}" data-act="ex-expand" data-ex="${esc(ex.id)}" aria-label="${esc(ex.name)}: feito. Toque para abrir">
    <span class="check" aria-hidden="true">✓</span>
    <span class="name">${esc(ex.name)}</span>
    <span class="dots" aria-hidden="true">${work.results.map((r) => `<i class="${r.action}"></i>`).join('')}</span>
    <span class="sum">${sets.map((x) => `${kg(x.weight)}×${x.reps}`).join(' · ')}${nextTxt}</span>
    <span class="chev" aria-hidden="true">▾</span>
  </button>`;
}

// Linha cinza de um exercício que falta (ou amarela fraca, se já tem séries registradas).
function exPending(ex, i) {
  const { sets, work } = exWork(ex);
  const started = sets.length > 0;
  const load = work.next != null ? `${started ? 'próxima' : 'hoje'}: <b>${kg(work.next)} kg</b>` : 'carga a definir';
  return `<button type="button" class="done-line ${started ? 'is-started' : 'is-pending'}" id="ex-${esc(ex.id)}" data-act="ex-expand" data-ex="${esc(ex.id)}" aria-label="${esc(ex.name)}: ${started ? 'em andamento' : 'falta fazer'}. Toque para abrir">
    <span class="check" aria-hidden="true">${i + 1}</span>
    <span class="name">${esc(ex.name)}</span>
    ${started ? `<span class="dots" aria-hidden="true">${work.results.map((r) => `<i class="${r.action}"></i>`).join('')}</span>` : '<span></span>'}
    <span class="sum">${started ? `em andamento · ${sets.length} de ${ex.sets} · ` : `${ex.sets}×${ex.repMin}–${ex.repMax} · `}${load}</span>
    <span class="chev" aria-hidden="true">▾</span>
  </button>`;
}

// Sessões normais (as de deload não entram em histórico, gráficos e "última vez").
const heavy = () => state.sessions.filter((s) => !s.deload);

function platesText(ex, weight) {
  if (ex.equip !== 'barra' || !(weight > 0)) return '';
  const bar = state.settings.barKg;
  if (weight < bar) return `Abaixo do peso da barra (${kg(bar)} kg)`;
  const r = L.platesPerSide(weight, bar, state.settings.plates);
  const txt = r.perSide.length ? r.perSide.map(kg).join(' + ') : 'só a barra';
  return `Por lado: ${txt}${r.rest ? ` (faltam ${kg(r.rest)} kg)` : ''}`;
}

// Carga de trabalho usada no aquecimento: a 1ª série feita, o que está digitado no campo kg, ou a sugerida.
function warmBaseFor(ex, sets, work) {
  if (sets[0]) return sets[0].weight;
  const d = ui.drafts[ex.id]?.w;
  return d != null ? num(d) : work.next;
}

function warmList(ex, base) {
  if (!(base > 0)) {
    return `<p class="small muted warm-empty">Digite acima a carga da 1ª série e o aquecimento é calculado na hora.</p>`;
  }
  const ws = L.warmupSets(base, ex, state.settings);
  const done = state.active?.warmDone?.[ex.id] ?? [];
  return `<ul class="warm">${ws.map((w, i) => `<li class="${done[i] ? 'done' : ''}">
      <span class="muted">${w.reps} rep${w.reps > 1 ? 's' : ''}</span>
      <b>${kg(w.weight)} kg</b>
      <span class="muted small">${w.pct}% · descanso ${w.rest}</span>
      <button type="button" class="btn icon small warm-ok${done[i] ? ' on' : ''}" data-act="warm-done" data-ex="${esc(ex.id)}" data-i="${i}" aria-pressed="${!!done[i]}"
        aria-label="${done[i] ? 'Desmarcar' : 'Feita: iniciar descanso de ' + w.rest}">✓</button>
      ${ex.equip === 'barra' ? `<span class="plates">${platesText(ex, w.weight)}</span>` : ''}
    </li>`).join('')}</ul>
    <p class="small muted">Toque em ✓ ao terminar cada série: o descanso começa sozinho.</p>`;
}

function exCard(ex, day) {
  const a = state.active;
  const s = state.settings;
  const start = a.startProg[ex.id] ?? state.prog[ex.id] ?? null;
  const idxs = [];
  a.sets.forEach((x, i) => { if (x.exId === ex.id) idxs.push(i); });
  const sets = idxs.map((i) => a.sets[i]);
  const deload = !!a.deload;
  const work = deload
    ? { next: L.deloadWeight(start?.weight ?? null, ex, s), results: sets.map(() => ({ action: 'deload' })) }
    : L.replay(start, sets, ex, s);
  const prev = L.lastSetsFor(heavy(), ex.id);
  const prevNotes = prev ? prev.sets.filter((x) => x.note) : [];
  const done = sets.length >= ex.sets;
  const showRow = !done || ui.extra[ex.id];
  const draft = ui.drafts[ex.id] ?? {};
  const wValue = draft.w ?? (work.next ?? '');
  const inc = L.incFor(ex, s);
  const fk = figKey(ex);
  const howtoOpen = !!ui.howto[ex.id];
  const howto = fk
    ? `<button type="button" class="howto-btn" data-act="howto" data-ex="${esc(ex.id)}" aria-expanded="${howtoOpen}">
        <span>Como fazer</span><span class="chev" aria-hidden="true">▾</span>
      </button>
      ${howtoOpen ? `<div class="howto" data-fig="${esc(fk)}"></div>` : ''}`
    : '';

  let advice = '';
  if (!deload && sets.length) {
    const r = work.results.at(-1);
    advice = `<div class="advice ${r.action}">${adviceText(r, ex)}</div>`;
  }

  let target;
  if (deload) {
    target = work.next != null
      ? `Carga de deload: <b>${kg(work.next)} kg</b> <span class="muted small">(${s.deloadPct}% de ${kg(start.weight)} kg)</span>`
      : `Deload: use uma carga leve, ~${s.deloadPct}% do normal`;
  } else {
    target = work.next != null
      ? `Carga ${sets.length ? 'da próxima série' : 'de hoje'}: <b>${kg(work.next)} kg</b>`
      : `Primeira vez: escolha uma carga para ${ex.repMin}–${ex.repMax} reps`;
  }
  const plates = platesText(ex, work.next);

  return `<section class="card is-current" id="ex-${esc(ex.id)}">
    <div class="ex-head">
      <h3>${esc(ex.name)}</h3>
      <div class="ex-head-r">
        <span class="chip">${ex.sets}×${ex.repMin}–${ex.repMax} · +${kg(inc)} kg</span>
        <button type="button" class="btn small" data-act="ex-collapse" data-ex="${esc(ex.id)}">Recolher ▴</button>
      </div>
    </div>
    <p class="target">${target}</p>
    ${plates ? `<p class="plates">${plates}</p>` : ''}
    ${howto}
    ${prev ? `<p class="prev muted small">Última vez (${fmtDate(prev.date)}): ${prev.sets.map((x) => `${kg(x.weight)}×${x.reps}`).join(' · ')}</p>` : ''}
    ${prevNotes.length ? `<p class="prev small note-prev">📝 ${prevNotes.map((x) => esc(x.note)).join(' · ')}</p>` : ''}
    ${!deload && (start?.stall ?? 0) >= L.STALL_LIMIT ? `<p class="warn">⚠ ${start.stall} treinos sem subir carga. Considere um deload ou trocar a variação do exercício.</p>` : ''}
    ${sets.length || showRow ? `<ol class="tl">${sets.map((x, i) => {
      const editing = ui.noteEdit === idxs[i];
      const act = work.results[i].action;
      return `<li>
        <span class="dot ${act}" aria-hidden="true">${i + 1}</span>
        <div class="tl-body">
          <div class="tl-line">
            <b class="tl-val">${kg(x.weight)} kg × ${x.reps}</b>
            <span class="tag ${act}">${TAG[act]}</span>
            <button type="button" class="btn ghost icon small" data-act="note" data-i="${idxs[i]}" aria-label="Anotação da série ${i + 1}">✎</button>
          </div>
          ${editing
            ? `<input class="note-in" id="note-${idxs[i]}" data-note="${idxs[i]}" value="${esc(x.note ?? '')}" placeholder="Ex.: dor no ombro, pegada mais fechada" maxlength="140" enterkeyhint="done">`
            : x.note ? `<p class="note">📝 ${esc(x.note)}</p>` : ''}
          ${i === sets.length - 1 ? advice : ''}
        </div>
      </li>`;
    }).join('')}
    ${showRow ? `<li class="tl-next">
        <span class="dot next" aria-hidden="true">${sets.length + 1}</span>
        <div class="tl-body">
          <span class="tl-now">${done ? 'Série extra' : `Série ${sets.length + 1} de ${ex.sets}`} · agora</span>
          <div class="logrow">
            <label class="field">kg<input inputmode="decimal" enterkeyhint="next" data-draft="w" data-ex="${esc(ex.id)}" value="${esc(wValue === '' ? '' : String(wValue).replace('.', ','))}" placeholder="kg"></label>
            <label class="field">reps<input inputmode="numeric" enterkeyhint="done" data-draft="r" data-ex="${esc(ex.id)}" value="${esc(draft.r ?? '')}" placeholder="${ex.repMin}–${ex.repMax}"></label>
            <button class="btn primary" data-act="log" data-ex="${esc(ex.id)}" aria-label="Registrar série ${sets.length + 1}">✓</button>
          </div>
        </div>
      </li>` : ''}</ol>` : ''}
    <div class="row end" style="margin-top:8px">
      ${done && !ui.extra[ex.id] ? `<button class="btn ghost small" data-act="extra" data-ex="${esc(ex.id)}">+ série extra</button>` : ''}
      ${sets.length ? `<button class="btn ghost small" data-act="undo" data-ex="${esc(ex.id)}">Desfazer última</button>` : ''}
    </div>
  </section>`;
}

function deloadBanner() {
  const pct = state.settings.deloadPct;
  if (state.deload) {
    const day = L.deloadDay(state.deload, new Date());
    const over = day > 7;
    return `<div class="banner proximo">
      <strong>${over ? 'Semana de deload concluída' : `Semana de deload · dia ${day} de 7`}</strong>
      <p class="small">${over ? 'Hora de voltar às cargas normais e começar um novo ciclo.' : `Os treinos desta semana mostram ~${pct}% da carga normal e não mexem na sua progressão.`}</p>
      <button class="btn small${over ? ' primary' : ''}" data-act="deload-end">${over ? 'Voltar às cargas normais' : 'Encerrar deload agora'}</button>
    </div>`;
  }
  const st = L.deloadStatus(state.cycleStart, new Date(), state.settings.deloadWeeks);
  if (st.level === 'ok') return '';
  const titles = { proximo: 'Deload chegando', agora: 'Hora da semana de deload', atrasado: 'Deload atrasado' };
  return `<div class="banner ${st.level}">
    <strong>${titles[st.level]}</strong>
    <p class="small">${st.weeks} semanas de treino pesado desde ${fmtDate(state.cycleStart)}. O livro recomenda, a cada 8–10 semanas,
    uma semana de deload (mesmos exercícios com ~${pct}% da carga) ou uma semana sem treinar.</p>
    <div class="row">
      <button class="btn small primary" data-act="deload-start">Começar semana de deload</button>
      <button class="btn small ghost" data-act="deload-done">Descansei a semana: novo ciclo</button>
    </div>
  </div>`;
}

function chartSvg(h) {
  const W = 340, H = 180, P = { l: 36, r: 10, t: 12, b: 24 };
  const vals = h.flatMap((p) => [p.topWeight, p.e1rm]);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 5; max += 5; }
  const pad = (max - min) * 0.1;
  min = Math.max(0, min - pad); max += pad;
  const x = (i) => P.l + (h.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (h.length - 1));
  const y = (v) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  const line = (key) => h.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução da carga">
    <line class="axis" x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}"/>
    <line class="axis" x1="${P.l}" y1="${P.t}" x2="${W - P.r}" y2="${P.t}" stroke-dasharray="2 4"/>
    <text x="${P.l - 4}" y="${P.t + 4}" text-anchor="end">${Math.round(max)}</text>
    <text x="${P.l - 4}" y="${H - P.b}" text-anchor="end">${Math.round(min)}</text>
    <text x="${P.l}" y="${H - 6}">${fmtDate(h[0].date)}</text>
    ${h.length > 1 ? `<text x="${W - P.r}" y="${H - 6}" text-anchor="end">${fmtDate(h.at(-1).date)}</text>` : ''}
    <polyline class="s2" points="${line('e1rm')}"/>
    <polyline class="s1" points="${line('topWeight')}"/>
    ${h.map((p, i) => `<circle class="d1" cx="${x(i).toFixed(1)}" cy="${y(p.topWeight).toFixed(1)}" r="3.5"/>`).join('')}
  </svg>
  <div class="legend"><span><i></i>Carga mais pesada</span><span><i class="l2"></i>1RM estimado</span></div>`;
}

function viewHistorico() {
  if (!state.sessions.length) return `<div class="empty">Nenhum treino registrado ainda.<br>Finalize um treino para ver sua evolução aqui.</div>`;

  // exercícios com histórico: primeiro na ordem do plano, depois os removidos
  const names = new Map();
  for (const s of heavy()) for (const x of s.sets) names.set(x.exId, x.exName);
  const ordered = [];
  for (const d of state.plan.days) for (const e of d.exercises) if (names.has(e.id)) ordered.push([e.id, e.name]);
  for (const [id, n] of names) if (!ordered.some(([o]) => o === id)) ordered.push([id, `${n} (removido)`]);

  if (!ordered.length) return `<div class="empty">Só há treinos de deload registrados por enquanto.</div>`;
  if (!ui.histEx || !names.has(ui.histEx)) ui.histEx = ordered[0][0];
  const h = L.exerciseHistory(heavy(), ui.histEx);
  const best = h.reduce((a, b) => (b.e1rm > a.e1rm ? b : a), h[0]);
  const prog = state.prog[ui.histEx];

  return `<section class="card">
      <label class="field">Exercício
        <select data-hist>${ordered.map(([id, n]) => `<option value="${esc(id)}" ${id === ui.histEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      </label>
      ${chartSvg(h)}
      <p class="small">Melhor 1RM estimado: <b>${kg(best.e1rm)} kg</b> (${fmtDate(best.date)})${prog?.weight != null ? ` · Próxima carga: <b>${kg(prog.weight)} kg</b>` : ''}</p>
      <table>
        <thead><tr><th>Data</th><th>Série mais pesada</th><th>1RM est.</th></tr></thead>
        <tbody>${h.slice().reverse().slice(0, 12).map((p) => `<tr><td>${fmtDate(p.date)}</td><td>${kg(p.topWeight)} kg × ${p.topReps}</td><td>${kg(p.e1rm)}</td></tr>`).join('')}</tbody>
      </table>
    </section>
    <h3 class="section">Treinos (${state.sessions.length})</h3>
    ${state.sessions.slice().reverse().slice(0, 60).map((s) => {
      const byEx = new Map();
      for (const x of s.sets) {
        if (!byEx.has(x.exId)) byEx.set(x.exId, { name: x.exName, sets: [] });
        byEx.get(x.exId).sets.push(x);
      }
      return `<details class="sess"><summary>${esc(s.dayName)} · ${fmtDateLong(s.date)}${s.deload ? ' · deload' : ''}</summary>
        <ul>${[...byEx.values()].map((g) => `<li>${esc(g.name)}: ${g.sets.map((x) => `${kg(x.weight)}×${x.reps}${x.note ? ` (📝 ${esc(x.note)})` : ''}`).join(' · ')}</li>`).join('')}</ul>
        <div class="row end"><button class="btn ghost small danger" data-act="del-session" data-id="${esc(s.id)}">Apagar treino</button></div>
      </details>`;
    }).join('')}`;
}

function bodyChart(body) {
  const W = 340, H = 170, P = { l: 36, r: 10, t: 12, b: 24 };
  const pts = body.slice(-60);
  const t = (e) => L.parseIsoDate(e.date).getTime();
  const avg = pts.map((e) => {
    const xs = body.filter((o) => t(o) <= t(e) && t(o) > t(e) - 7 * 864e5).map((o) => o.kg);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  });
  let min = Math.min(...pts.map((e) => e.kg)), max = Math.max(...pts.map((e) => e.kg));
  if (max - min < 1) { min -= 0.5; max += 0.5; }
  const t0 = t(pts[0]), t1 = t(pts.at(-1));
  const x = (e) => P.l + (t1 === t0 ? (W - P.l - P.r) / 2 : ((t(e) - t0) / (t1 - t0)) * (W - P.l - P.r));
  const y = (v) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do peso corporal">
    <line class="axis" x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}"/>
    <line class="axis" x1="${P.l}" y1="${P.t}" x2="${W - P.r}" y2="${P.t}" stroke-dasharray="2 4"/>
    <text x="${P.l - 4}" y="${P.t + 4}" text-anchor="end">${kg(Math.round(max * 10) / 10)}</text>
    <text x="${P.l - 4}" y="${H - P.b}" text-anchor="end">${kg(Math.round(min * 10) / 10)}</text>
    <text x="${P.l}" y="${H - 6}">${fmtDate(pts[0].date)}</text>
    ${pts.length > 1 ? `<text x="${W - P.r}" y="${H - 6}" text-anchor="end">${fmtDate(pts.at(-1).date)}</text>` : ''}
    <polyline class="s1" points="${pts.map((e, i) => `${x(e).toFixed(1)},${y(avg[i]).toFixed(1)}`).join(' ')}"/>
    ${pts.map((e) => `<circle class="d2" cx="${x(e).toFixed(1)}" cy="${y(e.kg).toFixed(1)}" r="3"/>`).join('')}
  </svg>
  <div class="legend"><span><i></i>Média de 7 dias</span><span><i class="l2 dot"></i>Pesagens</span></div>`;
}

const PHASE_INFO = {
  crescer: {
    sub: 'Ganhar músculo comendo um pouco a mais',
    vs: 'um pouco acima (+10%) do que você gasta',
    tips: ['Bata a meta de proteína todo dia: ela é a prioridade.', 'Não precisa comer tudo o que vê. Um pouco acima do gasto já basta.'],
  },
  secar: {
    sub: 'Perder gordura sem perder músculo',
    vs: 'abaixo (−20%) do que você gasta',
    tips: ['Proteína alta protege seus músculos durante a dieta.', 'Continue treinando pesado, com as mesmas cargas.', 'Uma refeição livre por semana ajuda a aguentar a dieta.'],
  },
  manter: {
    sub: 'Ficar no mesmo peso',
    vs: 'igual ao que você gasta',
    tips: ['Coma perto da meta e mantenha a proteína alta.'],
  },
};

function rangeText(phase, r) {
  if (phase === 'secar') return `perder de ${kg(-r.max)} a ${kg(-r.min)} kg por semana`;
  if (phase === 'manter') return `ficar entre −${kg(-r.min)} e +${kg(r.max)} kg por semana`;
  return `ganhar de ${kg(r.min)} a ${kg(r.max)} kg por semana`;
}

function whyText(phase, level) {
  if (level === 'comer-mais') {
    return phase === 'secar' ? 'Você está perdendo peso rápido demais, e isso leva músculo junto.'
      : phase === 'crescer' ? 'Você não está ganhando peso suficiente para crescer.'
      : 'Seu peso está caindo.';
  }
  return phase === 'secar' ? 'A perda de peso está devagar.'
    : phase === 'crescer' ? 'Você está ganhando peso rápido demais, e o excesso vira gordura.'
    : 'Seu peso está subindo.';
}

function viewMeta() {
  const s = state.settings;
  const pr = state.profile;
  const phase = L.PHASES[pr.phase] ? pr.phase : 'crescer';
  const info = PHASE_INFO[phase];
  const body = state.body;
  const now = new Date();
  const today = L.isoDate(now);
  const tr = L.weightTrend(body, now);
  const lastKg = body.at(-1)?.kg ?? null;
  const refKg = tr.last ?? lastKg;
  const cal = L.calories({ ...pr, phase }, refKg);
  const adv = L.phaseAdvice(phase, tr.rate, refKg, s);
  const bfAlert = L.phaseBfAlert(phase, pr.bf, pr.sex);
  const adjustedRecently = pr.adjustAt && (now - L.parseIsoDate(pr.adjustAt)) / 864e5 < 7;
  const dadosOpen = ui.dadosOpen ?? !cal;
  const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${kg(Math.abs(n))}`;

  // 1) fase
  const phases = `<section class="card">
      <h3>Qual é a sua fase agora?</h3>
      <div class="phases">
        ${Object.entries(L.PHASES).map(([k, p]) => `<button type="button" class="phase-btn" data-act="phase" data-phase="${k}" aria-pressed="${k === phase}">
            <b>${p.label}</b><span>${PHASE_INFO[k].sub}</span>
          </button>`).join('')}
      </div>
    </section>`;

  // 2) meta do dia
  const meta = cal
    ? `<section class="card">
        <h3>Sua meta por dia</h3>
        <p class="kcal-big"><b>${cal.target.toLocaleString('pt-BR')}</b> kcal</p>
        <p class="small muted">Isso é ${info.vs} (${cal.tdee.toLocaleString('pt-BR')} kcal)${pr.adjust ? `, já com o ajuste de ${signed(pr.adjust)} kcal` : ''}.</p>
        <div class="macros">
          <div class="prot"><span class="small">Proteína</span><b>${cal.protein} g</b></div>
          <div><span class="small">Carboidrato</span><b>${cal.carbs} g</b></div>
          <div><span class="small">Gordura</span><b>${cal.fat} g</b></div>
        </div>
        <ul class="tips small">${info.tips.map((t) => `<li>${t}</li>`).join('')}</ul>
        ${pr.adjust ? `<button class="btn ghost small" data-act="adjust-reset">Zerar ajuste de ${signed(pr.adjust)} kcal</button>` : ''}
      </section>`
    : `<section class="card">
        <h3>Sua meta por dia</h3>
        <p class="small muted" style="margin-top:6px">Para calcular, ${refKg == null ? 'registre seu peso abaixo e ' : ''}preencha <b>Seus dados</b> (idade e altura).</p>
      </section>`;

  // 3) como está indo
  let status;
  if (!adv) {
    status = `<p class="pill neutral">Ainda sem dados suficientes</p>
      <p class="small muted">Pese-se pelo menos 3 vezes por semana. Depois de 2 semanas o app diz se você deve comer mais, menos ou continuar igual.${tr.last != null ? ` Média dos últimos 7 dias: <b>${kg(tr.last)} kg</b>.` : ''}</p>`;
  } else if (adv.level !== 'ok' && adjustedRecently) {
    status = `<p class="pill neutral">⏳ Ajuste aplicado, aguardando</p>
      <p>Você ajustou a meta em ${fmtDate(pr.adjustAt)}. Siga a nova meta e espere uma semana para o peso responder; depois o app avalia de novo.</p>`;
  } else {
    const pill = { ok: ['ok', '✓ No ritmo certo'], 'comer-mais': ['up', '↑ Coma um pouco mais'], 'comer-menos': ['down', '↓ Coma um pouco menos'] }[adv.level];
    const moved = tr.rate === 0 ? 'seu peso ficou igual' : `você ${tr.rate > 0 ? 'ganhou' : 'perdeu'} <b>${kg(Math.abs(tr.rate))} kg</b>`;
    status = `<p class="pill ${pill[0]}">${pill[1]}</p>
      <p>Na última semana ${moved}. Na fase <b>${L.PHASES[phase].label}</b>, o ideal é ${rangeText(phase, adv.range)}.</p>
      ${adv.level === 'ok'
        ? '<p class="small muted">Continue com a mesma meta de calorias.</p>'
        : `<p class="small muted">${whyText(phase, adv.level)} ${adv.kcal > 0 ? 'Some' : 'Tire'} ${kg(Math.abs(adv.kcal))} kcal por dia na sua meta.</p>
          ${cal ? `<button class="btn primary" data-act="adjust-apply" data-kcal="${adv.kcal}">Aplicar: ${signed(adv.kcal)} kcal na meta</button>` : ''}`}`;
  }
  const bfBox = bfAlert
    ? `<div class="banner agora"><strong>${bfAlert.to === 'secar' ? `Você chegou a ~${bfAlert.limit}% de gordura` : `Você chegou a ~${bfAlert.limit}% de gordura: ótimo!`}</strong>
        <p class="small">${bfAlert.to === 'secar' ? 'O livro sugere parar de crescer aqui e fazer uma fase de secar.' : 'O livro sugere voltar a crescer a partir daqui.'}</p>
        <button class="btn small primary" data-act="phase" data-phase="${bfAlert.to}">Mudar para ${L.PHASES[bfAlert.to].label}</button></div>`
    : '';

  const progress = `<section class="card">
      <h3>Como está indo</h3>
      <div class="bodyrow">
        <label class="field">Data<input type="date" id="body-date" value="${today}" max="${today}"></label>
        <label class="field">Peso hoje (kg)<input id="body-kg" inputmode="decimal" placeholder="${lastKg != null ? String(lastKg).replace('.', ',') : 'ex.: 80,5'}"></label>
        <button class="btn primary" data-act="body-add">Salvar</button>
      </div>
      <p class="small muted">Dica: pese-se de manhã, em jejum. O peso varia de um dia para o outro; o que vale é a média da semana.</p>
      <div class="status">${status}</div>
      ${bfBox}
      ${body.length >= 2 ? bodyChart(body) : ''}
    </section>`;

  // 4) dados
  const dados = `<details class="card dados" id="dados" ${dadosOpen ? 'open' : ''}>
      <summary><b>Seus dados</b> <span class="small muted">usados para calcular a meta</span></summary>
      <div class="ex-edit" style="border:0"><div class="grid">
        <label class="field wide">Sexo<select data-prof="sex"><option value="M" ${pr.sex !== 'F' ? 'selected' : ''}>Masculino</option><option value="F" ${pr.sex === 'F' ? 'selected' : ''}>Feminino</option></select></label>
        <label class="field wide">Idade<input inputmode="numeric" data-prof="age" value="${pr.age ?? ''}" placeholder="anos"></label>
        <label class="field wide">Altura (cm)<input inputmode="numeric" data-prof="height" value="${pr.height ?? ''}" placeholder="ex.: 178"></label>
        <label class="field wide">% de gordura (se souber)<input inputmode="decimal" data-prof="bf" value="${pr.bf != null ? String(pr.bf).replace('.', ',') : ''}" placeholder="ex.: 13"></label>
        <label class="field full">Horas de treino por semana<input inputmode="decimal" data-prof="hours" value="${pr.hours != null ? String(pr.hours).replace('.', ',') : ''}" placeholder="ex.: 5"></label>
      </div></div>
      <p class="small muted">Como é calculado: o app estima quanto você gasta por dia (metabolismo × nível de atividade${cal ? `, usando ${kg(refKg)} kg e ${cal.method === 'katch' ? 'seu % de gordura' : 'idade e altura'}` : ''}) e aplica a fase: +10% para crescer, −20% para secar. Proteína, carboidrato e gordura seguem a divisão do livro para cada fase (${Object.values(L.PHASES).map((p) => `${p.label.toLowerCase()} ${p.split.join('/')}`).join(', ')}).</p>
    </details>`;

  const list = body.length ? `<h3 class="section">Pesagens</h3>
    <section class="card">
      <table>
        <thead><tr><th>Data</th><th>Peso</th><th></th></tr></thead>
        <tbody>${body.slice().reverse().slice(0, 20).map((e) => `<tr><td>${fmtDateLong(e.date)}</td><td>${kg(e.kg)} kg</td>
          <td style="text-align:right"><button class="btn ghost icon small danger" data-act="body-del" data-date="${e.date}" aria-label="Apagar pesagem de ${fmtDate(e.date)}">✕</button></td></tr>`).join('')}</tbody>
      </table>
    </section>` : '';

  return phases + meta + progress + dados + list;
}

// ---------- dieta: cardápio e registro do dia ----------

const FOOD_MAP = new Map(FOODS.map((f) => [f.id, f]));
const foodById = (id) => FOOD_MAP.get(id) ?? state.diet.foods.find((f) => f.id === id);
const allFoods = () => [...state.diet.foods, ...FOODS];
const g0 = (n) => Math.round(n).toLocaleString('pt-BR');
const MACRO = { kcal: ['Calorias', 'kcal'], p: ['Proteína', 'g'], c: ['Carboidrato', 'g'], f: ['Gordura', 'g'] };

function dietGoal() {
  const tr = L.weightTrend(state.body, new Date());
  const refKg = tr.last ?? state.body.at(-1)?.kg ?? null;
  return D.goalFromCalories(L.calories(state.profile, refKg));
}

function todayLog() {
  const k = L.isoDate(new Date());
  state.diet.log[k] ??= D.emptyDay();
  return state.diet.log[k];
}

function macroBars(totals, goal, mode, keys = ['kcal', 'p', 'c', 'f']) {
  const cmp = D.compare(totals, goal);
  return `<div class="mbars">${keys.map((k) => [k, MACRO[k]]).map(([k, [label, unit]]) => {
    const c = cmp[k];
    const pct = c.target > 0 ? Math.min(100, (c.value / c.target) * 100) : 0;
    let hint;
    if (mode === 'hoje') {
      const left = c.target - c.value;
      hint = left > 0 ? `faltam ${g0(left)} ${unit}` : left < 0 ? `passou ${g0(-left)} ${unit}` : 'na meta';
    } else {
      hint = c.status === 'ok' ? '✓ ok' : c.diff < 0 ? `faltam ${g0(-c.diff)} ${unit}` : `${g0(c.diff)} ${unit} a mais`;
    }
    const cls = mode === 'hoje' ? (c.value > c.target * 1.05 && k === 'kcal' ? 'alto' : 'neutro') : c.status;
    return `<div class="mbar ${cls}">
      <div class="mrow"><span>${label}</span><span><b>${g0(c.value)}</b> / ${g0(c.target)} ${unit}</span></div>
      <div class="track"><i style="width:${pct.toFixed(1)}%"></i></div>
      <span class="mhint">${hint}</span>
    </div>`;
  }).join('')}</div>`;
}

function dietSubnav() {
  const tabs = [['hoje', 'Hoje'], ['cardapio', 'Cardápio'], ['meta', 'Meta e peso']];
  return `<div class="subnav" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-act="diet-tab" data-t="${k}" aria-selected="${ui.dietTab === k}">${l}</button>`).join('')}</div>`;
}

function viewCorpo() {
  const hasMenu = state.diet.menu.meals.some((m) => m.items.length);
  ui.dietTab ??= !dietGoal() ? 'meta' : hasMenu ? 'hoje' : 'cardapio';
  const body = ui.dietTab === 'hoje' ? viewHoje() : ui.dietTab === 'cardapio' ? viewCardapio() : viewMeta();
  return dietSubnav() + body;
}

function noGoalBox() {
  return `<section class="card"><p>Primeiro defina sua meta: escolha a fase e preencha seus dados.</p>
    <button class="btn primary" data-act="diet-tab" data-t="meta">Ir para Meta e peso</button></section>`;
}

function mismatchBanner(goal) {
  const menu = state.diet.menu;
  if (!menu.meals.some((m) => m.items.length)) return '';
  const tot = D.menuTotals(menu, foodById);
  const cmp = D.compare(tot, goal);
  if (cmp.kcal.status === 'ok' && cmp.p.status !== 'baixo') return '';
  return `<div class="banner agora"><strong>O cardápio não bate com a meta</strong>
    <p class="small">Meta: ${g0(goal.kcal)} kcal e ${g0(goal.p)} g de proteína. Cardápio: ${g0(tot.kcal)} kcal e ${g0(tot.p)} g de proteína.</p>
    ${ui.dietTab !== 'cardapio' ? '<button class="btn small" data-act="diet-tab" data-t="cardapio">Ver como ajustar</button>' : ''}</div>`;
}

// --- Cardápio ---

function foodResults(mealId, q) {
  const hits = D.searchFoods(allFoods(), q);
  if (!q.trim()) return '<p class="small muted">Digite o nome do alimento, por exemplo "frango", "arroz" ou "banana".</p>';
  return `${hits.length ? `<ul class="fres">${hits.map((f) => `<li><button type="button" data-act="food-add" data-meal="${mealId}" data-food="${esc(f.id)}">
      <span>${esc(f.name)}${f.custom ? ' <em class="small muted">(seu)</em>' : ''}</span>
      <span class="small muted">${g0(f.kcal)} kcal · ${kg(Math.round(f.p * 10) / 10)} g prot · por 100 g</span>
    </button></li>`).join('')}</ul>` : '<p class="small muted">Nada encontrado.</p>'}
    <button type="button" class="btn ghost small" data-act="food-new" data-meal="${mealId}">Não achou? Cadastrar alimento pelo rótulo</button>`;
}

function newFoodForm(mealId) {
  return `<div class="newfood">
    <p class="small"><b>Cadastrar alimento</b> · copie os valores do rótulo</p>
    <label class="field">Nome<input id="nf-name" placeholder="ex.: Whey protein marca X"></label>
    <div class="grid4">
      <label class="field">Porção do rótulo (g)<input id="nf-portion" inputmode="decimal" value="100"></label>
      <label class="field">Calorias (kcal)<input id="nf-kcal" inputmode="decimal"></label>
      <label class="field">Proteína (g)<input id="nf-p" inputmode="decimal"></label>
      <label class="field">Carboidrato (g)<input id="nf-c" inputmode="decimal"></label>
      <label class="field">Gordura total (g)<input id="nf-f" inputmode="decimal"></label>
    </div>
    <div class="row"><button class="btn primary" data-act="food-save" data-meal="${mealId}">Salvar e adicionar</button>
      <button class="btn ghost" data-act="food-new-cancel">Cancelar</button></div>
  </div>`;
}

function suggestionBox(goal) {
  const menu = state.diet.menu;
  if (!menu.meals.some((m) => m.items.length)) return '';
  const sug = D.suggestions(menu, foodById, goal);
  if (!sug.length) return `<div class="advice subir">✓ O cardápio bate com a sua meta.</div>`;
  const why = { proteina: 'para bater a proteína', calorias: 'para acertar as calorias', gordura: 'para reduzir a gordura' };
  return `<section class="card sug"><h3>Como ajustar</h3>
    <ul>${sug.map((x, i) => x.hint
      ? `<li><span>${{
          proteina: 'Adicione uma fonte de proteína, como peito de frango, ovos, atum ou iogurte. Proteína em todas as refeições ajuda.',
          carbo: 'Adicione uma fonte de carboidrato, como arroz, batata, pão ou fruta.',
          pouco: `Mesmo com os ajustes, ainda faltam uns <b>${g0(x.kcal)} kcal</b>. Acrescente mais alimentos ou mais uma refeição (um lanche, por exemplo).`,
        }[x.hint]}</span></li>`
      : `<li><span><b>${esc(x.meal)}</b> → ${esc(x.food)}: <b>${x.deltaG > 0 ? '+' : '−'}${Math.abs(x.deltaG)} g</b> <span class="small muted">${why[x.why]} (${x.kcal > 0 ? '+' : ''}${x.kcal} kcal)</span></span>
          <button class="btn small primary" data-act="sug-apply" data-i="${i}">Aplicar</button></li>`).join('')}</ul>
  </section>`;
}

function viewCardapio() {
  const goal = dietGoal();
  const menu = state.diet.menu;
  const tot = D.menuTotals(menu, foodById);
  const empty = !menu.meals.some((m) => m.items.length);
  const sampleBox = goal && empty ? `<section class="card sample">
      <h3>Começar com um cardápio de exemplo?</h3>
      <p class="small muted">O app monta café da manhã, almoço, lanche e jantar com alimentos comuns (pão, ovos, frango, arroz, feijão, patinho, batata doce, frutas e salada), já nas quantidades da sua meta de ${g0(goal.kcal)} kcal e ${g0(goal.p)} g de proteína. Depois é só trocar o que não gostar.</p>
      <button class="btn primary" data-act="menu-sample">Montar cardápio de exemplo</button>
      <p class="small muted">Ou monte do zero com "+ Alimento" em cada refeição abaixo.</p>
    </section>` : '';
  return `${sampleBox}${goal ? (empty ? '' : `<section class="card">
        <h3>Total do cardápio × meta</h3>
        ${macroBars(tot, goal, 'cardapio')}
      </section>
      ${suggestionBox(goal)}`) : noGoalBox()}
    ${menu.meals.map((m) => {
      const mt = D.mealTotals(m, foodById);
      const hasProt = m.items.some((it) => (foodById(it.foodId)?.p ?? 0) >= 10);
      const isTreino = /treino/i.test(m.name);
      return `<section class="card meal">
        <div class="row">
          <input class="grow meal-name" aria-label="Nome da refeição" data-meal-name="${m.id}" value="${esc(m.name)}">
          <button class="btn icon small danger" data-act="meal-del" data-meal="${m.id}" aria-label="Remover refeição">🗑</button>
        </div>
        <p class="small muted">${g0(mt.kcal)} kcal · ${g0(mt.p)} g proteína · ${g0(mt.c)} g carbo · ${g0(mt.f)} g gordura</p>
        ${m.items.length ? `<ul class="items">${m.items.map((it, idx) => {
          const f = foodById(it.foodId);
          if (!f) return `<li><span class="muted">Alimento removido</span><span></span><button class="btn icon small danger" data-act="item-del" data-meal="${m.id}" data-idx="${idx}" aria-label="Remover">✕</button></li>`;
          const x = D.foodMacros(f, it.g);
          return `<li>
            <span class="iname">${esc(f.name)}<span class="small muted">${g0(x.kcal)} kcal · ${kg(Math.round(x.p * 10) / 10)} g prot</span></span>
            <label class="gfield"><input inputmode="numeric" aria-label="Gramas de ${esc(f.name)}" data-item-g="${idx}" data-meal="${m.id}" value="${it.g}"><span>g</span></label>
            <button class="btn icon small danger" data-act="item-del" data-meal="${m.id}" data-idx="${idx}" aria-label="Remover ${esc(f.name)}">✕</button>
          </li>`;
        }).join('')}</ul>` : '<p class="small muted">Nenhum alimento ainda.</p>'}
        ${m.items.length && !hasProt ? '<p class="tip small">Dica do livro: coloque proteína em todas as refeições.</p>' : ''}
        ${isTreino ? '<p class="tip small">Perto do treino, o livro sugere uns 30–40 g de proteína.</p>' : ''}
        ${ui.addTo === m.id
          ? (ui.newFood === m.id ? newFoodForm(m.id) : `<div class="foodsearch">
              <input id="food-q" type="search" data-food-q="${m.id}" placeholder="Buscar alimento" value="${esc(ui.q ?? '')}" autocomplete="off">
              <div id="food-res">${foodResults(m.id, ui.q ?? '')}</div>
              <button class="btn ghost small" data-act="food-close">Fechar</button>
            </div>`)
          : `<button class="btn small" data-act="food-open" data-meal="${m.id}">+ Alimento</button>`}
      </section>`;
    }).join('')}
    <button class="btn" data-act="meal-add">+ Refeição</button>
    ${goal && !empty ? '<button class="btn ghost small" style="margin-left:8px" data-act="menu-sample">Trocar pelo cardápio de exemplo</button>' : ''}
    <p class="small muted" style="margin-top:14px">Valores por 100 g da Tabela TACO (NEPA/Unicamp, 4ª ed.). São médias: marcas e preparos variam um pouco.</p>`;
}

// --- Hoje ---

function viewHoje() {
  const goal = dietGoal();
  if (!goal) return noGoalBox();
  const menu = state.diet.menu;
  if (!menu.meals.some((m) => m.items.length)) {
    return `<section class="card"><p>Monte seu cardápio primeiro. Depois é só marcar o que comeu aqui.</p>
      <button class="btn primary" data-act="diet-tab" data-t="cardapio">Montar cardápio</button></section>`;
  }
  const day = todayLog();
  const tot = D.dayTotals(menu, day, foodById);
  const v = D.dayVerdict(tot, goal);
  const anyMarked = Object.values(day.done).some(Boolean) || Object.keys(day.swaps).length || day.extras.length;
  return `${mismatchBanner(goal)}
    <section class="card">
      <h3>Hoje · ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</h3>
      ${macroBars(tot, goal, 'hoje', ['kcal', 'p'])}
      ${anyMarked ? `<p class="pill ${v.level === 'ok' ? 'ok' : v.level === 'alto' ? 'down' : 'neutral'}">${v.level === 'ok' ? '✓ ' : ''}${v.lines.join(' · ')}</p>` : '<p class="small muted">Toque em "Comi" a cada refeição.</p>'}
    </section>
    ${menu.meals.filter((m) => m.items.length).map((m) => {
      const mt = D.mealTotals(m, foodById);
      const swap = day.swaps[m.id];
      const done = !!day.done[m.id];
      return `<section class="card meal-day ${done || swap ? 'is-done' : ''}">
        <div class="row">
          <div class="grow"><h3>${esc(m.name)}</h3>
            <p class="small muted">${swap ? `Trocado: ~${g0(swap.kcal)} kcal${swap.p ? ` · ${g0(swap.p)} g prot` : ''}` : `${g0(mt.kcal)} kcal · ${g0(mt.p)} g prot`}</p></div>
          ${swap ? `<button class="btn small" data-act="swap-undo" data-meal="${m.id}">Desfazer troca</button>`
            : `<button class="btn ${done ? 'ok-on' : 'primary'}" data-act="day-done" data-meal="${m.id}" aria-pressed="${done}">${done ? '✓ Comi' : 'Comi'}</button>`}
        </div>
        ${!swap ? `<p class="small muted mitems">${m.items.map((it) => { const f = foodById(it.foodId); return f ? `${esc(f.name)} ${it.g} g` : ''; }).filter(Boolean).join(' · ')}</p>` : ''}
        ${ui.swapOpen === m.id ? `<div class="quick">
            <p class="small">Comeu outra coisa? Coloque uma estimativa.</p>
            <div class="grid2"><label class="field">Calorias (kcal)<input id="sw-kcal" inputmode="numeric" placeholder="ex.: 800"></label>
            <label class="field">Proteína (g, se souber)<input id="sw-p" inputmode="numeric" placeholder="ex.: 30"></label></div>
            <div class="row"><button class="btn primary small" data-act="swap-save" data-meal="${m.id}">Salvar</button><button class="btn ghost small" data-act="swap-close">Cancelar</button></div>
          </div>` : !swap && !done ? `<button class="btn ghost small" data-act="swap-open" data-meal="${m.id}">Comi diferente</button>` : ''}
      </section>`;
    }).join('')}
    <section class="card">
      <h3>Fora do cardápio</h3>
      ${day.extras.length ? `<ul class="items">${day.extras.map((x, i) => `<li><span class="iname">${esc(x.label || 'Extra')}<span class="small muted">${g0(x.kcal)} kcal${x.p ? ` · ${g0(x.p)} g prot` : ''}</span></span><span></span>
        <button class="btn icon small danger" data-act="extra-del" data-i="${i}" aria-label="Remover">✕</button></li>`).join('')}</ul>` : ''}
      ${ui.extraOpen ? `<div class="quick">
          <label class="field">O que foi<input id="ex-label" placeholder="ex.: 1 pedaço de bolo"></label>
          <div class="grid2"><label class="field">Calorias (kcal)<input id="ex-kcal" inputmode="numeric"></label>
          <label class="field">Proteína (g, se souber)<input id="ex-p" inputmode="numeric"></label></div>
          <div class="row"><button class="btn primary small" data-act="extra-save">Adicionar</button><button class="btn ghost small" data-act="extra-close">Cancelar</button></div>
        </div>` : '<button class="btn small" data-act="extra-open">+ Comi algo a mais</button>'}
    </section>
    ${state.profile.phase === 'secar' ? '<p class="tip small">Na fase de secar, o livro sugere uma refeição livre por semana para aguentar a dieta.</p>' : ''}`;
}

const dietActions = {
  'diet-tab'(el) { ui.dietTab = el.dataset.t; ui.addTo = null; render(); window.scrollTo(0, 0); },
  'food-open'(el) { ui.addTo = el.dataset.meal; ui.newFood = null; ui.q = ''; render(); $('#food-q')?.focus(); },
  'food-close'() { ui.addTo = null; render(); },
  'menu-sample'() {
    const goal = dietGoal();
    if (!goal) return;
    const hasItems = state.diet.menu.meals.some((m) => m.items.length);
    if (hasItems && !confirm('Substituir o seu cardápio atual pelo cardápio de exemplo?')) return;
    state.diet.menu = D.buildSampleMenu(goal, foodById);
    ui.addTo = null;
    save();
    toast('Cardápio de exemplo montado. Troque à vontade o que não gostar.');
    render();
    window.scrollTo(0, 0);
  },
  'food-new'(el) { ui.newFood = el.dataset.meal; render(); $('#nf-name')?.focus(); },
  'food-new-cancel'() { ui.newFood = null; render(); },
  'food-add'(el) {
    const m = state.diet.menu.meals.find((x) => x.id === el.dataset.meal);
    if (!m) return;
    m.items.push({ foodId: el.dataset.food, g: 100 });
    ui.addTo = null;
    save();
    toast('Adicionado com 100 g. Ajuste a quantidade se precisar.');
    render();
  },
  'food-save'(el) {
    const name = $('#nf-name').value.trim();
    const vals = { portion: num($('#nf-portion').value), kcal: num($('#nf-kcal').value), p: num($('#nf-p').value) ?? 0, c: num($('#nf-c').value) ?? 0, f: num($('#nf-f').value) ?? 0 };
    if (!name) return toast('Dê um nome ao alimento.', true);
    if (!(vals.portion > 0) || vals.kcal == null) return toast('Preencha a porção e as calorias do rótulo.', true);
    const food = { id: L.uid('food'), name, custom: true, ...D.per100FromLabel(vals) };
    state.diet.foods.push(food);
    const m = state.diet.menu.meals.find((x) => x.id === el.dataset.meal);
    m?.items.push({ foodId: food.id, g: Math.round(vals.portion) });
    ui.addTo = null;
    ui.newFood = null;
    save();
    toast(`${name} cadastrado e adicionado (${Math.round(vals.portion)} g).`);
    render();
  },
  'item-del'(el) {
    const m = state.diet.menu.meals.find((x) => x.id === el.dataset.meal);
    m?.items.splice(Number(el.dataset.idx), 1);
    save();
    render();
  },
  'meal-add'() {
    state.diet.menu.meals.push({ id: L.uid('m'), name: 'Nova refeição', items: [] });
    save();
    render();
  },
  'meal-del'(el) {
    const m = state.diet.menu.meals.find((x) => x.id === el.dataset.meal);
    if (!m || !confirm(`Remover a refeição "${m.name}"?`)) return;
    state.diet.menu.meals = state.diet.menu.meals.filter((x) => x !== m);
    save();
    render();
  },
  'sug-apply'(el) {
    const goal = dietGoal();
    const s = D.suggestions(state.diet.menu, foodById, goal)[Number(el.dataset.i)];
    const m = s && state.diet.menu.meals.find((x) => x.id === s.mealId);
    const it = m?.items[s.idx];
    if (!it) return;
    it.g = Math.max(0, it.g + s.deltaG);
    if (it.g === 0) m.items.splice(s.idx, 1);
    save();
    toast('Ajuste aplicado.');
    render();
  },
  'day-done'(el) {
    const day = todayLog();
    day.done[el.dataset.meal] = !day.done[el.dataset.meal];
    navigator.vibrate?.(20);
    save();
    render();
  },
  'swap-open'(el) { ui.swapOpen = el.dataset.meal; render(); $('#sw-kcal')?.focus(); },
  'swap-close'() { ui.swapOpen = null; render(); },
  'swap-save'(el) {
    const kcal = num($('#sw-kcal').value);
    if (!(kcal > 0)) return toast('Coloque uma estimativa de calorias.', true);
    const day = todayLog();
    day.swaps[el.dataset.meal] = { kcal, p: num($('#sw-p').value) ?? 0 };
    delete day.done[el.dataset.meal];
    ui.swapOpen = null;
    save();
    render();
  },
  'swap-undo'(el) {
    delete todayLog().swaps[el.dataset.meal];
    save();
    render();
  },
  'extra-open'() { ui.extraOpen = true; render(); $('#ex-label')?.focus(); },
  'extra-close'() { ui.extraOpen = false; render(); },
  'extra-save'() {
    const kcal = num($('#ex-kcal').value);
    if (!(kcal > 0)) return toast('Coloque uma estimativa de calorias.', true);
    todayLog().extras.push({ label: $('#ex-label').value.trim(), kcal, p: num($('#ex-p').value) ?? 0 });
    ui.extraOpen = false;
    save();
    render();
  },
  'extra-del'(el) {
    todayLog().extras.splice(Number(el.dataset.i), 1);
    save();
    render();
  },
};


function viewPlano() {
  const figOpts = (sel) => `<option value="" ${sel ? '' : 'selected'}>Sem desenho</option>`
    + Object.entries(FIGS).map(([k, f]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
  const equipOpts = (sel) =>Object.entries(L.EQUIP).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
  return `<p class="muted small" style="margin-top:4px">Toque num dia para ver os exercícios e num exercício para editar. Tudo é salvo na hora.</p>
    ${state.plan.days.map((d, di) => {
      const open = !!ui.planOpen[d.id];
      return `<section class="card plan-day${open ? ' is-open' : ''}">
      <button type="button" class="plan-day-head" data-act="plan-day" data-day="${d.id}" aria-expanded="${open}">
        <span class="pd-num">${di + 1}</span>
        <span class="pd-main"><b>${esc(d.name)}</b>
          <span class="small muted">${d.exercises.length} exercício${d.exercises.length === 1 ? '' : 's'}${!open && d.exercises.length ? ` · ${d.exercises.map((e) => esc(e.name)).join(' · ')}` : ''}</span></span>
        <span class="chev" aria-hidden="true">${open ? '▴' : '▾'}</span>
      </button>
      ${open ? `<div class="row pd-tools">
        <input class="grow" aria-label="Nome do dia" data-pf="dayName" data-day="${d.id}" value="${esc(d.name)}">
        <button class="btn icon small" data-act="day-move" data-day="${d.id}" data-dir="-1" ${di === 0 ? 'disabled' : ''} aria-label="Subir dia">↑</button>
        <button class="btn icon small" data-act="day-move" data-day="${d.id}" data-dir="1" ${di === state.plan.days.length - 1 ? 'disabled' : ''} aria-label="Descer dia">↓</button>
        <button class="btn icon small danger" data-act="day-del" data-day="${d.id}" aria-label="Remover dia">🗑</button>
      </div>
      <div class="pex-list">
      ${d.exercises.map((e, ei) => {
        const editing = ui.planEx === e.id;
        const next = state.prog[e.id]?.weight;
        return `<div class="pex${editing ? ' is-open' : ''}">
        <button type="button" class="pex-line" data-act="plan-ex" data-ex="${e.id}" aria-expanded="${editing}">
          <span class="pex-main"><b>${esc(e.name)}</b>
            <span class="small muted">${e.sets}×${e.repMin}–${e.repMax} · ${L.EQUIP[e.equip] ?? ''} · +${kg(L.incFor(e, state.settings))} kg${next != null ? ` · próxima: ${kg(next)} kg` : ''}${L.isWarmupEx(d, e) ? ' · aquecimento' : ''}</span></span>
          <span class="chev" aria-hidden="true">${editing ? '▴' : '✎'}</span>
        </button>
        ${editing ? `<div class="ex-edit">
          <div class="row">
            <input class="grow" aria-label="Nome do exercício" data-pf="name" data-day="${d.id}" data-ex="${e.id}" value="${esc(e.name)}">
            <button class="btn icon small" data-act="ex-move" data-day="${d.id}" data-ex="${e.id}" data-dir="-1" ${ei === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
            <button class="btn icon small" data-act="ex-move" data-day="${d.id}" data-ex="${e.id}" data-dir="1" ${ei === d.exercises.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button>
            <button class="btn icon small danger" data-act="ex-del" data-day="${d.id}" data-ex="${e.id}" aria-label="Remover">✕</button>
          </div>
          <div class="grid">
            <label class="field">Séries<input inputmode="numeric" data-pf="sets" data-day="${d.id}" data-ex="${e.id}" value="${e.sets}"></label>
            <label class="field">Reps mín.<input inputmode="numeric" data-pf="repMin" data-day="${d.id}" data-ex="${e.id}" value="${e.repMin}"></label>
            <label class="field">Reps máx.<input inputmode="numeric" data-pf="repMax" data-day="${d.id}" data-ex="${e.id}" value="${e.repMax}"></label>
            <label class="field">+kg<input inputmode="decimal" data-pf="inc" data-day="${d.id}" data-ex="${e.id}" value="${e.inc ?? ''}" placeholder="${kg(state.settings.inc[e.equip])}"></label>
            <label class="field wide">Equipamento<select data-pf="equip" data-day="${d.id}" data-ex="${e.id}">${equipOpts(e.equip)}</select></label>
            <label class="field wide">Próxima carga (kg)<input inputmode="decimal" data-pf="target" data-day="${d.id}" data-ex="${e.id}" value="${next != null ? String(next).replace('.', ',') : ''}" placeholder="—"></label>
            <label class="field full">Desenho<select data-pf="fig" data-day="${d.id}" data-ex="${e.id}">${figOpts(figKey(e))}</select></label>
            <label class="check full"><input type="checkbox" data-pf="warmup" data-day="${d.id}" data-ex="${e.id}" ${L.isWarmupEx(d, e) ? 'checked' : ''}> Mostrar aquecimento antes deste exercício</label>
          </div>
          <div class="row end"><button class="btn small" data-act="plan-ex" data-ex="${e.id}">Pronto ▴</button></div>
        </div>` : ''}
      </div>`;
      }).join('')}
      </div>
      <button class="btn small" data-act="ex-add" data-day="${d.id}">+ Exercício</button>` : ''}
    </section>`;
    }).join('')}
    <button class="btn" data-act="day-add">+ Adicionar dia</button>
    <button class="btn ghost small" style="margin-left:8px" data-act="plan-reset">Restaurar plano do livro</button>`;
}

function viewConfig() {
  const st = L.deloadStatus(state.cycleStart, new Date(), state.settings.deloadWeeks);
  const s = state.settings;
  return `<section class="card">
      <h3>Descanso e deload</h3>
      <div class="ex-edit" style="border:0">
        <div class="grid">
          <label class="field wide">Descanso entre séries (seg)<input inputmode="numeric" data-sf="restSec" value="${s.restSec}"></label>
          <label class="field wide">Deload a cada (semanas)<input inputmode="numeric" data-sf="deloadWeeks" value="${s.deloadWeeks}"></label>
          <label class="field wide">Carga no deload (%)<input inputmode="numeric" data-sf="deloadPct" value="${s.deloadPct}"></label>
        </div>
      </div>
      <p class="small muted">Ciclo atual desde ${fmtDateLong(state.cycleStart)} (${st.weeks} semana${st.weeks === 1 ? '' : 's'}).</p>
      <button class="btn small" data-act="deload-done">Fiz deload: começar novo ciclo hoje</button>
    </section>
    <section class="card">
      <h3>Incremento padrão por equipamento</h3>
      <div class="ex-edit" style="border:0"><div class="grid">
        ${Object.entries(L.EQUIP).map(([k, v]) => `<label class="field wide">${v} (kg)<input inputmode="decimal" data-inc="${k}" value="${String(s.inc[k]).replace('.', ',')}"></label>`).join('')}
      </div></div>
    </section>
    <section class="card">
      <h3>Barra e anilhas</h3>
      <p class="small muted">Usado para mostrar quais anilhas colocar de cada lado.</p>
      <div class="ex-edit" style="border:0"><div class="grid">
        <label class="field wide">Peso da barra (kg)<input inputmode="decimal" data-sf="barKg" value="${String(s.barKg).replace('.', ',')}"></label>
        <label class="field wide">Anilhas disponíveis (kg)<input data-plates value="${s.plates.map(kg).join('; ')}"></label>
      </div></div>
    </section>
    <section class="card">
      <h3>Ritmo bom na fase Crescer</h3>
      <p class="small muted">Faixa de ganho por semana considerada boa. Para quem já é avançado, algo como 0,1–0,25 kg; iniciantes podem ganhar mais rápido.</p>
      <div class="ex-edit" style="border:0"><div class="grid">
        <label class="field wide">Mínimo (kg/semana)<input inputmode="decimal" data-sf="gainMin" value="${String(s.gainMin).replace('.', ',')}"></label>
        <label class="field wide">Máximo (kg/semana)<input inputmode="decimal" data-sf="gainMax" value="${String(s.gainMax).replace('.', ',')}"></label>
      </div></div>
    </section>
    <section class="card">
      <h3>Backup</h3>
      <p class="small muted">Os dados ficam só neste aparelho. Exporte de vez em quando para não perder nada ou para usar em outro celular.</p>
      <div class="row">
        <button class="btn" data-act="export">Exportar backup</button>
        <label class="btn" style="display:inline-flex;align-items:center">Importar backup<input type="file" accept="application/json,.json" data-import hidden></label>
      </div>
    </section>
    <section class="card">
      <h3>Como o app decide a carga</h3>
      <ul class="small rules">
        <li><b>Bateu o topo da faixa (6 reps)</b> → suba a carga já na próxima série (+5 kg na barra, +2 kg nos halteres).</li>
        <li><b>Entre 4 e 5 reps</b> → mantenha a carga e busque 6.</li>
        <li><b>Menos de 4 reps logo após subir</b> → volte para a carga anterior.</li>
        <li><b>${L.STALL_LIMIT} treinos seguidos sem subir</b> → aviso de estagnação: considere deload ou trocar a variação.</li>
        <li>A carga em que você terminar o treino é a sugerida para o próximo.</li>
        <li>Descanse 2–4 min entre séries pesadas e faça deload a cada 8–10 semanas.</li>
      </ul>
    </section>
    <section class="card">
      <h3>Zona de perigo</h3>
      <button class="btn danger" data-act="reset-all">Apagar todos os dados</button>
    </section>`;
}

// ---------- ações ----------

function toast(msg, error = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('error', error);
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 3500);
}

let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* sem áudio */ }
}
function beep() {
  if (!audioCtx) return;
  [0, 0.35, 0.7].forEach((t) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.25);
    o.connect(g).connect(audioCtx.destination);
    o.start(audioCtx.currentTime + t);
    o.stop(audioCtx.currentTime + t + 0.3);
  });
}

const actions = {
  start(el) {
    const d = dayById(el.dataset.day);
    if (!d) return;
    const startProg = {};
    for (const e of d.exercises) if (state.prog[e.id]) startProg[e.id] = { ...state.prog[e.id] };
    ui.homeDay = null;
    state.active = { id: L.uid('s'), dayId: d.id, date: L.isoDate(new Date()), startProg, sets: [], deload: !!state.deload };
    ui.warm = {};
    ui.noteEdit = null;
    ui.current = null;
    ui.drafts = {};
    ui.extra = {};
    save();
    render();
    window.scrollTo(0, 0);
  },

  log(el) {
    unlockAudio();
    const exId = el.dataset.ex;
    const found = findEx(exId);
    if (!found) return;
    const card = el.closest('section');
    const w = num($('[data-draft="w"]', card).value);
    const rRaw = $('[data-draft="r"]', card).value.trim();
    const r = /^\d+$/.test(rRaw) ? parseInt(rRaw, 10) : null;
    if (w == null || w < 0) return toast('Informe a carga em kg.', true);
    if (r == null) return toast('Informe as repetições.', true);
    state.active.sets.push({ exId, exName: found.ex.name, weight: w, reps: r, t: Date.now() });
    delete ui.drafts[exId];
    delete ui.extra[exId];
    save();
    navigator.vibrate?.(30);
    startTimer(state.settings.restSec);
    const justFinished = exSetsDone(found.ex).length === found.ex.sets;
    let next = null;
    if (justFinished) {
      // terminou o exercício: fica verde e fechado, e o próximo que falta abre
      next = nextItemAfter(found.day, exId);
      ui.current = next ? next.id : 'none';
      ui.flash = exId;
    }
    render();
    ui.flash = null;
    if (justFinished) goToItem(next?.id ?? null);
  },

  'home-day'(el) {
    ui.homeDay = el.dataset.day;
    render();
    $('.home-hero')?.scrollIntoView({ behavior: smoothScroll(), block: 'start' });
  },

  'home-peso'() {
    ui.tab = 'corpo';
    ui.dietTab = 'meta';
    render();
    window.scrollTo(0, 0);
  },

  'ex-expand'(el) {
    ui.current = el.dataset.ex;
    render();
    document.getElementById(`ex-${el.dataset.ex}`)?.scrollIntoView({ behavior: smoothScroll(), block: 'start' });
  },

  'ex-collapse'(el) {
    ui.current = 'none';
    delete ui.extra[el.dataset.ex];
    ui.flash = el.dataset.ex;
    render();
    ui.flash = null;
    document.getElementById(`ex-${el.dataset.ex}`)?.scrollIntoView({ behavior: smoothScroll(), block: 'nearest' });
  },

  undo(el) {
    const exId = el.dataset.ex;
    const sets = state.active.sets;
    for (let i = sets.length - 1; i >= 0; i--) {
      if (sets[i].exId === exId) { sets.splice(i, 1); break; }
    }
    save();
    render();
  },

  extra(el) {
    ui.extra[el.dataset.ex] = true;
    render();
  },

  'warm-done'(el) {
    unlockAudio();
    const a = state.active;
    const id = el.dataset.ex;
    const i = Number(el.dataset.i);
    a.warmDone ??= {};
    const arr = (a.warmDone[id] ??= []);
    arr[i] = !arr[i];
    if (arr[i]) {
      const ex = findEx(id)?.ex;
      const sets = a.sets.filter((x) => x.exId === id);
      const work = L.replay(a.startProg[id] ?? state.prog[id] ?? null, sets, ex, state.settings);
      const w = L.warmupSets(warmBaseFor(ex, sets, work), ex, state.settings)[i];
      if (w) startTimer(w.restSec, i === 3 ? 'Antes da série pesada' : 'Descanso do aquecimento');
      navigator.vibrate?.(30);
    }
    save();
    if (arr[i] && warmCount(findEx(id).ex) >= 4) {
      // aquecimento completo: fica verde e o exercício abre
      ui.current = id;
      ui.flash = WARM + id;
      render();
      ui.flash = null;
      goToItem(id);
      return;
    }
    render();
  },

  'warm-skip'(el) {
    const id = el.dataset.ex;
    const a = state.active;
    a.warmSkip ??= {};
    a.warmSkip[id] = true;
    ui.current = id;
    save();
    render();
    goToItem(id);
  },

  note(el) {
    const i = Number(el.dataset.i);
    ui.noteEdit = ui.noteEdit === i ? null : i;
    render();
    $(`#note-${i}`)?.focus();
  },

  'deload-start'() {
    state.deload = { start: L.isoDate(new Date()) };
    save();
    toast(`Semana de deload iniciada: cargas a ~${state.settings.deloadPct}%.`);
    render();
  },

  'deload-end'() {
    state.deload = null;
    state.cycleStart = L.isoDate(new Date());
    save();
    toast('Deload encerrado. Novo ciclo começou hoje.');
    render();
  },

  'body-add'() {
    const date = $('#body-date').value || L.isoDate(new Date());
    const v = num($('#body-kg').value);
    if (v == null || v < 20 || v > 400) return toast('Informe seu peso em kg.', true);
    state.body = state.body.filter((e) => e.date !== date);
    state.body.push({ date, kg: v });
    state.body.sort((a, b) => a.date.localeCompare(b.date));
    save();
    toast('Peso registrado.');
    render();
  },

  phase(el) {
    const ph = el.dataset.phase;
    if (state.profile.phase === ph) return;
    state.profile.phase = ph;
    state.profile.adjust = 0;
    state.profile.adjustAt = null;
    save();
    toast(`Fase: ${L.PHASES[ph].label}`);
    render();
    window.scrollTo(0, 0);
  },

  'adjust-apply'(el) {
    const k = Number(el.dataset.kcal);
    state.profile.adjust = (state.profile.adjust || 0) + k;
    state.profile.adjustAt = L.isoDate(new Date());
    save();
    toast(`Meta ajustada em ${k > 0 ? '+' : '−'}${Math.abs(k)} kcal.`);
    render();
  },

  'adjust-reset'() {
    state.profile.adjust = 0;
    state.profile.adjustAt = null;
    save();
    render();
  },

  'body-del'(el) {
    if (!confirm('Apagar este registro de peso?')) return;
    state.body = state.body.filter((e) => e.date !== el.dataset.date);
    save();
    render();
  },

  howto(el) {
    const id = el.dataset.ex;
    ui.howto[id] = !ui.howto[id];
    render();
  },

  finish() {
    const a = state.active;
    if (!a.sets.length) {
      if (confirm('Nenhuma série registrada. Descartar este treino?')) {
        state.active = null;
        save();
        render();
      }
      return;
    }
    const d = dayById(a.dayId);
    const exIds = a.deload ? [] : [...new Set(a.sets.map((s) => s.exId))]; // deload não mexe na progressão
    for (const exId of exIds) {
      const ex = findEx(exId)?.ex;
      if (!ex) continue;
      const start = a.startProg[exId] ?? state.prog[exId] ?? null;
      const work = L.replay(start, a.sets.filter((s) => s.exId === exId), ex, state.settings);
      state.prog[exId] = L.commitExercise(start, work);
    }
    state.sessions.push({
      id: a.id,
      date: a.date,
      dayId: a.dayId,
      dayName: d?.name ?? 'Treino',
      sets: a.sets.map(({ exId, exName, weight, reps, note }) => (note ? { exId, exName, weight, reps, note } : { exId, exName, weight, reps })),
      ...(a.deload ? { deload: true } : {}),
    });
    state.active = null;
    save();
    stopTimer();
    const next = dayById(L.nextDayId(state.plan, state.sessions));
    toast(`Treino salvo! Próximo: ${next?.name ?? '—'}`);
    render();
    window.scrollTo(0, 0);
  },

  cancel() {
    if (!confirm('Cancelar o treino? As séries registradas hoje serão descartadas.')) return;
    state.active = null;
    save();
    stopTimer();
    render();
  },

  'deload-done'() {
    if (!confirm('Marcar deload como feito e começar um novo ciclo hoje?')) return;
    state.cycleStart = L.isoDate(new Date());
    save();
    toast('Novo ciclo iniciado.');
    render();
  },

  'del-session'(el) {
    if (!confirm('Apagar este treino do histórico? (As cargas sugeridas não mudam.)')) return;
    state.sessions = state.sessions.filter((s) => s.id !== el.dataset.id);
    save();
    render();
  },

  'plan-day'(el) {
    const id = el.dataset.day;
    ui.planOpen[id] = !ui.planOpen[id];
    if (!ui.planOpen[id]) ui.planEx = null;
    render();
  },

  'plan-ex'(el) {
    ui.planEx = ui.planEx === el.dataset.ex ? null : el.dataset.ex;
    render();
  },

  'day-add'() {
    const id = L.uid('d');
    state.plan.days.push({ id, name: `Dia ${state.plan.days.length + 1}`, exercises: [] });
    ui.planOpen[id] = true;
    save();
    render();
  },

  'day-del'(el) {
    const d = dayById(el.dataset.day);
    if (!d || !confirm(`Remover o dia "${d.name}" do plano? O histórico é mantido.`)) return;
    state.plan.days = state.plan.days.filter((x) => x !== d);
    save();
    render();
  },

  'day-move'(el) {
    move(state.plan.days, state.plan.days.findIndex((d) => d.id === el.dataset.day), Number(el.dataset.dir));
    save();
    render();
  },

  'ex-add'(el) {
    const d = dayById(el.dataset.day);
    const id = L.uid('e');
    d.exercises.push({ id, name: 'Novo exercício', equip: 'barra', sets: 3, repMin: 4, repMax: 6, inc: null });
    ui.planEx = id;
    save();
    render();
  },

  'ex-del'(el) {
    const d = dayById(el.dataset.day);
    const e = d?.exercises.find((x) => x.id === el.dataset.ex);
    if (!e || !confirm(`Remover "${e.name}"? O histórico é mantido.`)) return;
    d.exercises = d.exercises.filter((x) => x !== e);
    save();
    render();
  },

  'ex-move'(el) {
    const d = dayById(el.dataset.day);
    move(d.exercises, d.exercises.findIndex((x) => x.id === el.dataset.ex), Number(el.dataset.dir));
    save();
    render();
  },

  'plan-reset'() {
    if (!confirm('Substituir o plano atual pelo plano padrão do livro? O histórico é mantido.')) return;
    state.plan = L.defaultPlan();
    save();
    render();
  },

  export() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `treino-backup-${L.isoDate(new Date())}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },

  'reset-all'() {
    if (!confirm('Apagar TODOS os dados (plano, histórico e cargas)? Isso não pode ser desfeito.')) return;
    if (!confirm('Tem certeza? Faça um backup antes, se quiser guardar.')) return;
    state = L.initialState(new Date());
    save();
    stopTimer();
    render();
  },
};

function move(arr, i, dir) {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

function onPlanField(el) {
  const d = dayById(el.dataset.day);
  if (!d) return;
  const f = el.dataset.pf;
  if (f === 'dayName') {
    d.name = el.value.trim() || d.name;
    return save();
  }
  const e = d.exercises.find((x) => x.id === el.dataset.ex);
  if (!e) return;
  const int = (v, min) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= min ? n : null;
  };
  switch (f) {
    case 'name': e.name = el.value.trim() || e.name; break;
    case 'equip': e.equip = el.value; break;
    case 'fig': e.fig = el.value; break;
    case 'warmup': e.warmup = el.checked; break;
    case 'sets': e.sets = int(el.value, 1) ?? e.sets; break;
    case 'repMin': e.repMin = int(el.value, 1) ?? e.repMin; break;
    case 'repMax': e.repMax = int(el.value, 1) ?? e.repMax; break;
    case 'inc': { const n = num(el.value); e.inc = n > 0 ? n : null; break; }
    case 'target': {
      const n = num(el.value);
      if (n == null || n < 0) delete state.prog[e.id];
      else state.prog[e.id] = { weight: n, base: null, stall: 0 };
      break;
    }
  }
  if (e.repMax < e.repMin) [e.repMin, e.repMax] = [e.repMax, e.repMin];
  save();
  render();
}

Object.assign(actions, dietActions);

// ---------- timer de descanso ----------

const timer = { end: null, total: 0, alerted: false, label: 'Descanso' };
let tickId = null;

function startTimer(sec, label = 'Descanso') {
  timer.end = Date.now() + sec * 1000;
  timer.total = sec;
  timer.label = label;
  timer.alerted = false;
  persistTimer();
  ensureTick();
  renderTimer();
}

function stopTimer() {
  timer.end = null;
  persistTimer();
  renderTimer();
}

function persistTimer() {
  try {
    if (timer.end) localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
    else localStorage.removeItem(TIMER_KEY);
  } catch { /* opcional */ }
}

function ensureTick() {
  if (!tickId) tickId = setInterval(renderTimer, 250);
}

function renderTimer() {
  const el = $('#timer');
  if (!timer.end) {
    el.hidden = true;
    clearInterval(tickId);
    tickId = null;
    return;
  }
  const left = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
  el.hidden = false;
  $('#timer-text').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('#timer-label').textContent = left ? timer.label || 'Descanso' : 'Bora, próxima série!';
  $('#timer-bar').style.width = `${timer.total ? (100 * (timer.total - left)) / timer.total : 100}%`;
  el.classList.toggle('done', left === 0);
  if (left === 0 && !timer.alerted) {
    timer.alerted = true;
    persistTimer();
    navigator.vibrate?.([300, 150, 300]);
    beep();
  }
}

// ---------- eventos ----------

document.addEventListener('click', (ev) => {
  const tab = ev.target.closest('[data-tab]');
  if (tab) {
    ui.tab = tab.dataset.tab;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const go = ev.target.closest('[data-goto]');
  if (go) {
    ui.tab = go.dataset.goto;
    render();
    return;
  }
  const t = ev.target.closest('[data-tact]');
  if (t) {
    const a = t.dataset.tact;
    if (a === 'stop') stopTimer();
    else {
      const delta = a === 'plus' ? 15 : -15;
      const now = Date.now();
      timer.end = Math.max(now, timer.end) + delta * 1000;
      if (timer.end <= now) timer.end = now;
      timer.total = Math.max(timer.total, Math.ceil((timer.end - now) / 1000));
      timer.alerted = timer.end <= now;
      persistTimer();
      ensureTick();
      renderTimer();
    }
    return;
  }
  const act = ev.target.closest('[data-act]');
  if (act && actions[act.dataset.act]) actions[act.dataset.act](act);
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.foodQ) {
    ui.q = el.value;
    const box = document.getElementById('food-res');
    if (box) box.innerHTML = foodResults(el.dataset.foodQ, el.value);
    return;
  }
  if (el.dataset.draft) {
    const d = (ui.drafts[el.dataset.ex] ??= {});
    d[el.dataset.draft] = el.value;
    const box = el.dataset.draft === 'w' && document.getElementById(`warm-${el.dataset.ex}`);
    const found = box && findEx(el.dataset.ex);
    if (found && !state.active.sets.some((x) => x.exId === el.dataset.ex)) box.innerHTML = warmList(found.ex, num(el.value));
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target.hasAttribute?.('data-note')) {
    ev.preventDefault();
    ev.target.blur();
    render();
    return;
  }
  if (ev.key !== 'Enter' || !ev.target.dataset?.draft) return;
  ev.preventDefault();
  const row = ev.target.closest('.logrow');
  if (!row) return ev.target.blur();
  if (ev.target.dataset.draft === 'w') row.querySelector('[data-draft="r"]').focus();
  else row.querySelector('[data-act="log"]').click();
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.pf) return onPlanField(el);
  if (el.dataset.sf) {
    const n = num(el.value);
    if (n != null && n > 0) state.settings[el.dataset.sf] = n;
    if (state.settings.gainMax < state.settings.gainMin) [state.settings.gainMin, state.settings.gainMax] = [state.settings.gainMax, state.settings.gainMin];
    save();
    return render();
  }
  if (el.hasAttribute('data-plates')) {
    const list = el.value.split(/[;\s]+/).map(num).filter((n) => n > 0);
    if (list.length) state.settings.plates = [...new Set(list)].sort((a, b) => b - a);
    save();
    return render();
  }
  if (el.dataset.itemG != null) {
    const m = state.diet.menu.meals.find((x) => x.id === el.dataset.meal);
    const it = m?.items[Number(el.dataset.itemG)];
    const g = num(el.value);
    if (it && g != null && g >= 0) it.g = Math.round(g);
    save();
    return render();
  }
  if (el.dataset.mealName) {
    const m = state.diet.menu.meals.find((x) => x.id === el.dataset.mealName);
    if (m) m.name = el.value.trim() || m.name;
    save();
    return render();
  }
  if (el.dataset.prof) {
    const f = el.dataset.prof;
    if (f === 'sex') state.profile.sex = el.value;
    else {
      const n = num(el.value);
      state.profile[f] = n != null && n > 0 ? n : null;
    }
    save();
    return render();
  }
  if (el.hasAttribute('data-note')) {
    const set = state.active?.sets[Number(el.dataset.note)];
    if (set) {
      const t = el.value.trim();
      if (t) set.note = t;
      else delete set.note;
      save();
    }
    ui.noteEdit = null; // sem render aqui para não engolir o toque em outro botão
    return;
  }
  if (el.dataset.inc) {
    const n = num(el.value);
    if (n > 0) state.settings.inc[el.dataset.inc] = n;
    save();
    return render();
  }
  if (el.hasAttribute('data-hist')) {
    ui.histEx = el.value;
    return render();
  }
  if (el.hasAttribute('data-import')) {
    const file = el.files?.[0];
    if (!file) return;
    try {
      const next = L.migrate(JSON.parse(await file.text()));
      if (!confirm(`Importar backup com ${next.sessions.length} treinos? Os dados atuais serão substituídos.`)) return;
      state = next;
      save();
      toast('Backup importado.');
      render();
    } catch (e) {
      toast(e.message || 'Arquivo inválido.', true);
    } finally {
      el.value = '';
    }
  }
});

document.addEventListener('toggle', (ev) => {
  if (ev.target.id === 'dados') ui.dadosOpen = ev.target.open;
}, true);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderTimer();
});

// ---------- inicialização ----------

try {
  const saved = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null');
  if (saved?.end) {
    Object.assign(timer, saved);
    ensureTick();
  }
} catch { /* opcional */ }

render();
renderTimer();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});
