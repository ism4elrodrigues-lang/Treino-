import * as L from './logic.js';

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

const TAG = { subir: '▲ subir', manter: '= manter', voltar: '▼ voltar', abaixo: '! abaixo' };

// ---------- estado ----------

let state = load();
const ui = { tab: 'treino', drafts: {}, extra: {}, histEx: null };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return L.migrate(JSON.parse(raw));
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
  const views = { treino: viewTreino, historico: viewHistorico, plano: viewPlano, config: viewConfig };
  view.innerHTML = views[ui.tab]();
}

function deloadBanner() {
  const st = L.deloadStatus(state.cycleStart, new Date(), state.settings.deloadWeeks);
  if (st.level === 'ok') return '';
  const titles = {
    proximo: 'Deload chegando',
    agora: 'Hora da semana de deload',
    atrasado: 'Deload atrasado',
  };
  return `<div class="banner ${st.level}">
    <strong>${titles[st.level]}</strong>
    <p class="small">${st.weeks} semanas de treino pesado desde ${fmtDate(state.cycleStart)}. O livro recomenda, a cada 8–10 semanas,
    uma semana de deload (mesmos exercícios com ~60% da carga) ou uma semana sem treinar.</p>
    <button class="btn small" data-act="deload-done">Fiz o deload: começar novo ciclo</button>
  </div>`;
}

function viewTreino() {
  if (state.active) return viewActive();
  const days = state.plan.days;
  if (!days.length) return `<div class="empty">Nenhum dia no plano.<br><br><button class="btn" data-goto="plano">Montar o plano</button></div>`;
  const nextId = L.nextDayId(state.plan, state.sessions);
  const next = dayById(nextId);
  const last = state.sessions.at(-1);
  return `${deloadBanner()}
    <section class="card hero">
      <p class="muted small">Próximo treino</p>
      <h2>${esc(next.name)}</h2>
      <p class="muted small">${next.exercises.map((e) => esc(e.name)).join(' · ') || 'Sem exercícios'}</p>
      <button class="btn primary big" data-act="start" data-day="${next.id}">Começar treino</button>
    </section>
    <h3 class="section">Ou escolha outro dia</h3>
    <div class="daylist">
      ${days.map((d) => `<button class="btn" data-act="start" data-day="${d.id}">${esc(d.name)}</button>`).join('')}
    </div>
    ${last ? `<p class="muted small" style="margin-top:18px">Último treino: <b>${esc(last.dayName)}</b> em ${fmtDateLong(last.date)}</p>` : ''}`;
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
      <div><p class="muted small">Treino em andamento · ${fmtDate(a.date)}</p><h2>${esc(d.name)}</h2></div>
      <button class="btn ghost small danger" data-act="cancel">Cancelar</button>
    </div>
    ${d.exercises.map(exCard).join('')}
    <button class="btn primary big" data-act="finish">Finalizar treino</button>`;
}

function exCard(ex) {
  const a = state.active;
  const start = a.startProg[ex.id] ?? state.prog[ex.id] ?? null;
  const sets = a.sets.filter((s) => s.exId === ex.id);
  const work = L.replay(start, sets, ex, state.settings);
  const prev = L.lastSetsFor(state.sessions, ex.id);
  const done = sets.length >= ex.sets;
  const showRow = !done || ui.extra[ex.id];
  const draft = ui.drafts[ex.id] ?? {};
  const wValue = draft.w ?? (work.next ?? '');
  const inc = L.incFor(ex, state.settings);

  let advice = '';
  if (sets.length) {
    const r = work.results.at(-1);
    advice = `<div class="advice ${r.action}">${adviceText(r, ex)}</div>`;
  }

  const target = work.next != null
    ? `Carga ${sets.length ? 'da próxima série' : 'de hoje'}: <b>${kg(work.next)} kg</b>`
    : `Primeira vez: escolha uma carga para ${ex.repMin}–${ex.repMax} reps`;

  return `<section class="card" id="ex-${esc(ex.id)}">
    <div class="ex-head">
      <h3>${esc(ex.name)}</h3>
      <span class="chip">${ex.sets}×${ex.repMin}–${ex.repMax} · +${kg(inc)} kg</span>
    </div>
    <p class="target">${target}</p>
    ${prev ? `<p class="prev muted small">Última vez (${fmtDate(prev.date)}): ${prev.sets.map((s) => `${kg(s.weight)}×${s.reps}`).join(' · ')}</p>` : ''}
    ${(start?.stall ?? 0) >= L.STALL_LIMIT ? `<p class="warn">⚠ ${start.stall} treinos sem subir carga. Considere um deload ou trocar a variação do exercício.</p>` : ''}
    ${sets.length ? `<ul class="sets">${sets.map((s, i) => `<li>
        <span class="muted">Série ${i + 1}</span>
        <b>${kg(s.weight)} kg × ${s.reps}</b>
        <span class="tag ${work.results[i].action}">${TAG[work.results[i].action]}</span>
      </li>`).join('')}</ul>` : ''}
    ${advice}
    ${showRow ? `<div class="logrow">
        <span class="lbl">${done ? 'Extra' : `Série ${sets.length + 1}`}</span>
        <label class="field">kg<input inputmode="decimal" enterkeyhint="next" data-draft="w" data-ex="${esc(ex.id)}" value="${esc(wValue === '' ? '' : String(wValue).replace('.', ','))}" placeholder="kg"></label>
        <label class="field">reps<input inputmode="numeric" enterkeyhint="done" data-draft="r" data-ex="${esc(ex.id)}" value="${esc(draft.r ?? '')}" placeholder="${ex.repMin}–${ex.repMax}"></label>
        <button class="btn primary" data-act="log" data-ex="${esc(ex.id)}" aria-label="Registrar série">✓</button>
      </div>` : ''}
    <div class="row end" style="margin-top:8px">
      ${done && !ui.extra[ex.id] ? `<button class="btn ghost small" data-act="extra" data-ex="${esc(ex.id)}">+ série extra</button>` : ''}
      ${sets.length ? `<button class="btn ghost small" data-act="undo" data-ex="${esc(ex.id)}">Desfazer última</button>` : ''}
    </div>
  </section>`;
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
  for (const s of state.sessions) for (const x of s.sets) names.set(x.exId, x.exName);
  const ordered = [];
  for (const d of state.plan.days) for (const e of d.exercises) if (names.has(e.id)) ordered.push([e.id, e.name]);
  for (const [id, n] of names) if (!ordered.some(([o]) => o === id)) ordered.push([id, `${n} (removido)`]);

  if (!ui.histEx || !names.has(ui.histEx)) ui.histEx = ordered[0][0];
  const h = L.exerciseHistory(state.sessions, ui.histEx);
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
      return `<details class="sess"><summary>${esc(s.dayName)} · ${fmtDateLong(s.date)}</summary>
        <ul>${[...byEx.values()].map((g) => `<li>${esc(g.name)}: ${g.sets.map((x) => `${kg(x.weight)}×${x.reps}`).join(' · ')}</li>`).join('')}</ul>
        <div class="row end"><button class="btn ghost small danger" data-act="del-session" data-id="${esc(s.id)}">Apagar treino</button></div>
      </details>`;
    }).join('')}`;
}

function viewPlano() {
  const equipOpts = (sel) => Object.entries(L.EQUIP).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
  return `<p class="muted small" style="margin-top:4px">Alterações são salvas na hora. O incremento em branco usa o padrão do equipamento (Ajustes).</p>
    ${state.plan.days.map((d, di) => `<section class="card">
      <div class="row">
        <input class="grow" aria-label="Nome do dia" data-pf="dayName" data-day="${d.id}" value="${esc(d.name)}">
        <button class="btn icon small" data-act="day-move" data-day="${d.id}" data-dir="-1" ${di === 0 ? 'disabled' : ''} aria-label="Subir dia">↑</button>
        <button class="btn icon small" data-act="day-move" data-day="${d.id}" data-dir="1" ${di === state.plan.days.length - 1 ? 'disabled' : ''} aria-label="Descer dia">↓</button>
        <button class="btn icon small danger" data-act="day-del" data-day="${d.id}" aria-label="Remover dia">🗑</button>
      </div>
      ${d.exercises.map((e, ei) => `<div class="ex-edit">
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
          <label class="field wide">Próxima carga (kg)<input inputmode="decimal" data-pf="target" data-day="${d.id}" data-ex="${e.id}" value="${state.prog[e.id]?.weight != null ? String(state.prog[e.id].weight).replace('.', ',') : ''}" placeholder="—"></label>
        </div>
      </div>`).join('')}
      <button class="btn small" style="margin-top:8px" data-act="ex-add" data-day="${d.id}">+ Exercício</button>
    </section>`).join('')}
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
    state.active = { id: L.uid('s'), dayId: d.id, date: L.isoDate(new Date()), startProg, sets: [] };
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
    render();
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
    const exIds = [...new Set(a.sets.map((s) => s.exId))];
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
      sets: a.sets.map(({ exId, exName, weight, reps }) => ({ exId, exName, weight, reps })),
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

  'day-add'() {
    state.plan.days.push({ id: L.uid('d'), name: `Dia ${state.plan.days.length + 1}`, exercises: [] });
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
    d.exercises.push({ id: L.uid('e'), name: 'Novo exercício', equip: 'barra', sets: 3, repMin: 4, repMax: 6, inc: null });
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

// ---------- timer de descanso ----------

const timer = { end: null, total: 0, alerted: false };
let tickId = null;

function startTimer(sec) {
  timer.end = Date.now() + sec * 1000;
  timer.total = sec;
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
  $('#timer-label').textContent = left ? 'Descanso' : 'Bora, próxima série!';
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
  if (el.dataset.draft) {
    const d = (ui.drafts[el.dataset.ex] ??= {});
    d[el.dataset.draft] = el.value;
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.dataset?.draft) return;
  ev.preventDefault();
  if (ev.target.dataset.draft === 'w') ev.target.closest('.logrow').querySelector('[data-draft="r"]').focus();
  else ev.target.closest('.logrow').querySelector('[data-act="log"]').click();
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.pf) return onPlanField(el);
  if (el.dataset.sf) {
    const n = parseInt(el.value, 10);
    if (Number.isFinite(n) && n > 0) state.settings[el.dataset.sf] = n;
    save();
    return render();
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
