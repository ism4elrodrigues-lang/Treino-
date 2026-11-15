// Desenhos animados dos exercícios: boneco de traço simples que vai da pose A (início) à pose B (fim).
// Coordenadas no viewBox "20 -20 160 180", chão em y = 150. Vista lateral olhando para a direita,
// exceto os exercícios marcados com view: 'front'.

const SIDE_PARTS = [
  { pts: ['hip', 'kn', 'an', 'toe'] },
  { pts: ['hip', 'sh'] },
  { pts: ['sh', 'el', 'ha'], thin: true },
];
const FRONT_PARTS = [
  { pts: ['toeL', 'anL', 'knL', 'hipL', 'hipR', 'knR', 'anR', 'toeR'] },
  { pts: ['pv', 'nk'] },
  { pts: ['haL', 'elL', 'shL', 'shR', 'elR', 'haR'], thin: true },
];

// ---------- poses e cenários reaproveitados ----------

const STAND = { an: [100, 150], toe: [116, 150], kn: [100, 118], hip: [100, 86], sh: [100, 46], head: [102, 31] };
const LYING = { head: [45, 108], sh: [60, 112], hip: [114, 113], kn: [144, 114], an: [148, 150], toe: [160, 150] };
const INCLINED = { head: [60, 72], sh: [72, 84], hip: [112, 113], kn: [142, 112], an: [146, 150], toe: [158, 150] };
const FRONT = {
  head: [100, 31], nk: [100, 48], pv: [100, 86], shL: [88, 48], shR: [112, 48],
  hipL: [93, 86], hipR: [107, 86], knL: [92, 118], knR: [108, 118],
  anL: [92, 150], anR: [108, 150], toeL: [84, 150], toeR: [116, 150],
};
const BENT_FRONT = { ...FRONT, head: [100, 60], nk: [100, 70], shL: [86, 70], shR: [114, 70], knL: [90, 116], knR: [110, 116] };

const BENCH = [
  { t: 'rect', x: 34, y: 118, w: 112, h: 7 },
  { t: 'rect', x: 46, y: 124, w: 6, h: 27 },
  { t: 'rect', x: 128, y: 124, w: 6, h: 27 },
];
const INCLINE_BENCH = [
  { t: 'line', pts: [[132, 121], [108, 121], [62, 88]], w: 7 },
  { t: 'line', pts: [[112, 124], [112, 150]], w: 5 },
  { t: 'line', pts: [[76, 100], [76, 150]], w: 5 },
];
const pullBar = (y) => [
  { t: 'line', pts: [[100, y], [176, y], [176, 150]], w: 4 },
  { t: 'circle', cx: 100, cy: y, r: 4 },
];

const PLATE = [{ type: 'plate', at: 'ha' }];
const DB_SIDE = [{ type: 'db', at: 'ha' }];

// ---------- exercícios ----------

export const FIGS = {
  supino_reto_barra: {
    name: 'Supino reto com barra',
    musc: 'Peito, tríceps e ombro anterior',
    phases: ['Barra em cima', 'Barra no peito'],
    props: BENCH,
    weights: PLATE,
    A: { ...LYING, el: [61, 89], ha: [62, 66] },
    B: { el: [44, 124], ha: [58, 104] },
    cues: [
      'Escápulas juntas e para baixo, pés firmes no chão e glúteos no banco.',
      'Desça controlando até a barra tocar a parte de baixo do peito, cotovelos a uns 45° do tronco.',
      'Empurre a barra de volta até estender os braços, sem quicar no peito.',
    ],
  },
  supino_incl_barra: {
    name: 'Supino inclinado com barra',
    musc: 'Parte superior do peito, ombro anterior e tríceps',
    phases: ['Barra em cima', 'Barra no peito'],
    props: INCLINE_BENCH,
    weights: PLATE,
    A: { ...INCLINED, el: [74, 60], ha: [76, 36] },
    B: { el: [56, 96], ha: [70, 80] },
    cues: [
      'Banco inclinado entre 30° e 45°, escápulas juntas e pés firmes no chão.',
      'Desça a barra até a parte de cima do peito, logo abaixo da clavícula.',
      'Empurre para cima até estender os braços, sem tirar os glúteos do banco.',
    ],
  },
  supino_incl_halter: {
    name: 'Supino inclinado com halteres',
    musc: 'Parte superior do peito, ombro anterior e tríceps',
    phases: ['Halteres em cima', 'Halteres embaixo'],
    props: INCLINE_BENCH,
    weights: DB_SIDE,
    A: { ...INCLINED, el: [74, 60], ha: [76, 36] },
    B: { el: [56, 96], ha: [68, 78] },
    cues: [
      'Comece com os halteres sobre os ombros, braços estendidos e palmas para a frente.',
      'Desça até os halteres ficarem na altura do peito, cotovelos um pouco abaixo do banco.',
      'Empurre de volta aproximando os halteres em cima, sem bater um no outro.',
    ],
  },
  supino_fechado: {
    name: 'Supino fechado',
    musc: 'Tríceps e peito',
    phases: ['Barra em cima', 'Barra no peito'],
    props: BENCH,
    weights: PLATE,
    A: { ...LYING, el: [61, 89], ha: [62, 66] },
    B: { el: [46, 122], ha: [60, 104] },
    cues: [
      'Pegada na largura dos ombros, mais fechada que no supino normal.',
      'Desça com os cotovelos próximos ao corpo até a barra tocar a parte de baixo do peito.',
      'Empurre até estender os braços, focando em contrair o tríceps.',
    ],
  },
  panturrilha_pe: {
    name: 'Panturrilha em pé',
    musc: 'Panturrilhas',
    phases: ['Calcanhar embaixo', 'Na ponta dos pés'],
    props: [{ t: 'rect', x: 108, y: 140, w: 26, h: 10 }],
    weights: DB_SIDE,
    A: { an: [102, 145], toe: [117, 140], kn: [100, 112], hip: [100, 80], sh: [100, 40], head: [102, 25], el: [101, 64], ha: [102, 88] },
    B: { an: [106, 128], kn: [104, 96], hip: [102, 64], sh: [102, 24], head: [104, 9], el: [103, 48], ha: [104, 72] },
    cues: [
      'Ponta dos pés na borda do degrau, calcanhares para fora.',
      'Desça os calcanhares o máximo que conseguir, alongando a panturrilha.',
      'Suba até ficar na ponta dos pés, segure 1 segundo e desça devagar.',
    ],
  },
  terra: {
    name: 'Levantamento terra',
    musc: 'Posterior de coxa, glúteos, lombar e costas',
    phases: ['Barra no chão', 'Em pé'],
    weights: PLATE,
    A: { head: [122, 76], sh: [110, 86], el: [109, 111], ha: [108, 136], hip: [76, 106], kn: [108, 122], an: [98, 150], toe: [114, 150] },
    B: { head: [102, 31], sh: [100, 46], el: [101, 71], ha: [102, 96], hip: [97, 86], kn: [99, 119] },
    cues: [
      'Barra sobre o meio do pé, canelas quase encostando nela.',
      'Costas retas e peito aberto; puxe empurrando o chão com as pernas.',
      'Estenda quadril e joelhos juntos, mantendo a barra rente ao corpo até ficar em pé.',
    ],
  },
  remada_barra: {
    name: 'Remada curvada com barra',
    musc: 'Dorsais, trapézio e bíceps',
    phases: ['Braços estendidos', 'Barra no abdômen'],
    weights: PLATE,
    A: { an: [98, 150], toe: [114, 150], kn: [106, 122], hip: [80, 98], sh: [116, 76], head: [128, 67], el: [117, 100], ha: [118, 124] },
    B: { el: [96, 88], ha: [106, 110] },
    cues: [
      'Tronco inclinado uns 45° à frente, joelhos levemente flexionados e costas retas.',
      'Puxe a barra até a parte baixa do peito ou o abdômen, levando os cotovelos para trás.',
      'Desça controlando, sem dar tranco com o tronco para subir a carga.',
    ],
  },
  barra_fixa: {
    name: 'Barra fixa com carga',
    musc: 'Dorsais e bíceps',
    phases: ['Pendurado', 'Queixo acima da barra'],
    props: pullBar(6),
    weights: [{ type: 'plate', at: 'hip', dx: 8, dy: 14, r: 9 }],
    A: { ha: [100, 6], el: [100, 29], sh: [100, 52], head: [106, 39], hip: [98, 92], kn: [102, 122], an: [86, 138], toe: [94, 144] },
    B: { el: [84, 20], sh: [100, 10], head: [107, -5], hip: [98, 50], kn: [102, 80], an: [86, 96], toe: [94, 102] },
    cues: [
      'Pegada um pouco mais larga que os ombros; carga presa no cinto, se usar.',
      'Puxe levando os cotovelos para baixo e para trás até o queixo passar a barra.',
      'Desça controlando até estender os braços, sem balançar o corpo.',
    ],
  },
  abd_cabo: {
    name: 'Abdominal no cabo',
    musc: 'Abdômen',
    phases: ['Tronco ereto', 'Contraído'],
    props: [
      { t: 'line', pts: [[150, -12], [172, -12], [172, 150]], w: 4 },
      { t: 'circle', cx: 150, cy: -12, r: 5 },
    ],
    weights: [{ type: 'cable', at: 'ha', from: [150, -12] }, { type: 'handle', at: 'ha' }],
    A: { toe: [70, 140], an: [78, 146], kn: [104, 146], hip: [104, 112], sh: [110, 74], head: [116, 61], el: [122, 88], ha: [118, 68] },
    B: { sh: [136, 104], head: [148, 112], el: [146, 124], ha: [144, 104] },
    cues: [
      'Ajoelhado de frente para o cabo, segure a corda ao lado da cabeça.',
      'Enrole o tronco levando os cotovelos em direção aos joelhos, sem mexer o quadril.',
      'Volte devagar até o tronco ficar ereto. Faixa de 10–15 repetições.',
    ],
  },
  desenv_militar: {
    name: 'Desenvolvimento militar com barra',
    musc: 'Ombros e tríceps',
    phases: ['Barra no peito', 'Braços em cima'],
    weights: PLATE,
    A: { ...STAND, el: [113, 64], ha: [114, 41] },
    B: { el: [103, 22], ha: [103, -2] },
    cues: [
      'Barra na altura da clavícula, pegada um pouco mais larga que os ombros.',
      'Empurre para cima e leve a cabeça à frente assim que a barra passar por ela.',
      'Glúteos e abdômen contraídos para não arquear a lombar.',
    ],
  },
  elev_lateral: {
    name: 'Elevação lateral com halteres',
    musc: 'Ombro lateral',
    phases: ['Braços ao lado', 'Braços na horizontal'],
    view: 'front',
    weights: [{ type: 'db', at: 'haL' }, { type: 'db', at: 'haR' }],
    A: { ...FRONT, elL: [84, 70], haL: [83, 94], elR: [116, 70], haR: [117, 94] },
    B: { elL: [66, 51], haL: [44, 53], elR: [134, 51], haR: [156, 53] },
    cues: [
      'Em pé, halteres ao lado do corpo e cotovelos levemente dobrados.',
      'Suba os braços pelas laterais até a altura dos ombros, sem passar disso.',
      'Desça devagar, sem balançar o tronco para ajudar.',
    ],
  },
  crucifixo_inv: {
    name: 'Crucifixo invertido com halteres',
    musc: 'Ombro posterior e parte alta das costas',
    phases: ['Braços para baixo', 'Braços abertos'],
    view: 'front',
    weights: [{ type: 'db', at: 'haL' }, { type: 'db', at: 'haR' }],
    A: { ...BENT_FRONT, elL: [84, 92], haL: [84, 114], elR: [116, 92], haR: [116, 114] },
    B: { elL: [64, 68], haL: [42, 70], elR: [136, 68], haR: [158, 70] },
    cues: [
      'Tronco inclinado quase paralelo ao chão, costas retas e joelhos levemente dobrados.',
      'Abra os braços para os lados até a altura dos ombros, apertando as escápulas.',
      'Desça controlando; use carga leve o suficiente para não roubar com o tronco.',
    ],
  },
  panturrilha_sentado: {
    name: 'Panturrilha sentado',
    musc: 'Panturrilhas (sóleo)',
    phases: ['Calcanhar embaixo', 'Na ponta dos pés'],
    props: [
      { t: 'rect', x: 52, y: 110, w: 44, h: 7 },
      { t: 'rect', x: 70, y: 117, w: 6, h: 33 },
      { t: 'rect', x: 118, y: 138, w: 22, h: 12 },
    ],
    weights: [{ type: 'plate', at: 'kn', dy: -14 }],
    A: { hip: [80, 104], sh: [82, 64], head: [85, 50], kn: [112, 106], an: [114, 142], toe: [128, 138], el: [98, 88], ha: [110, 98] },
    B: { kn: [113, 92], an: [116, 126], el: [98, 78], ha: [110, 86] },
    cues: [
      'Sentado, com a almofada sobre as coxas perto dos joelhos e a ponta dos pés no apoio.',
      'Desça os calcanhares o máximo possível.',
      'Suba na ponta dos pés, segure 1 segundo e desça devagar.',
    ],
  },
  agachamento: {
    name: 'Agachamento livre',
    musc: 'Quadríceps, glúteos e posterior de coxa',
    phases: ['Em pé', 'Embaixo'],
    weights: PLATE,
    A: { ...STAND, el: [88, 56], ha: [98, 42] },
    B: { kn: [118, 124], hip: [84, 118], sh: [106, 84], head: [115, 71], el: [94, 94], ha: [104, 80] },
    cues: [
      'Barra apoiada no trapézio, pés na largura dos ombros e pontas levemente para fora.',
      'Desça levando o quadril para trás até as coxas ficarem pelo menos paralelas ao chão.',
      'Joelhos na direção dos pés e coluna neutra; suba empurrando o chão.',
    ],
  },
  leg_press: {
    name: 'Leg press',
    musc: 'Quadríceps e glúteos',
    phases: ['Pernas estendidas', 'Joelhos dobrados'],
    props: [
      { t: 'line', pts: [[96, 150], [176, 70]], w: 4 },
      { t: 'line', pts: [[84, 128], [74, 128], [38, 94]], w: 7 },
      { t: 'line', pts: [[72, 131], [72, 150]], w: 5 },
    ],
    weights: [{ type: 'sled', at: 'an' }],
    A: { hip: [70, 120], sh: [44, 92], head: [34, 80], el: [56, 112], ha: [72, 126], kn: [94, 96], an: [118, 72], toe: [110, 64] },
    B: { kn: [66, 86], an: [100, 90], toe: [92, 82] },
    cues: [
      'Costas e quadril bem apoiados no banco, pés na largura dos ombros no meio da plataforma.',
      'Desça até os joelhos formarem uns 90°, sem tirar o quadril do banco.',
      'Empurre pelos calcanhares sem travar totalmente os joelhos no final.',
    ],
  },
  terra_romeno: {
    name: 'Levantamento terra romeno',
    musc: 'Posterior de coxa, glúteos e lombar',
    phases: ['Em pé', 'Quadril para trás'],
    weights: PLATE,
    A: { ...STAND, el: [101, 71], ha: [102, 96] },
    B: { an: [100, 150], kn: [102, 120], hip: [76, 100], sh: [114, 86], head: [126, 80], el: [114, 110], ha: [114, 134] },
    cues: [
      'Comece em pé com a barra na frente das coxas e joelhos levemente dobrados.',
      'Leve o quadril para trás descendo a barra rente às pernas até sentir alongar o posterior.',
      'Costas sempre retas; volte empurrando o quadril para a frente.',
    ],
  },
  elev_pernas: {
    name: 'Elevação de pernas na barra',
    musc: 'Abdômen e flexores do quadril',
    phases: ['Pendurado', 'Pernas elevadas'],
    props: pullBar(-6),
    A: { ha: [100, -6], el: [100, 17], sh: [100, 40], head: [106, 27], hip: [99, 80], kn: [99, 112], an: [99, 144], toe: [108, 146] },
    B: { hip: [96, 82], kn: [128, 80], an: [158, 78], toe: [159, 68] },
    cues: [
      'Pendurado na barra com os braços estendidos e o corpo parado.',
      'Suba as pernas até ficarem paralelas ao chão (ou mais), sem balançar.',
      'Desça devagar. Faixa de 10–15 repetições.',
    ],
  },
  rosca_barra: {
    name: 'Rosca direta com barra',
    musc: 'Bíceps e antebraço',
    phases: ['Braços estendidos', 'Barra em cima'],
    weights: PLATE,
    A: { ...STAND, el: [101, 72], ha: [103, 98] },
    B: { ha: [116, 52] },
    cues: [
      'Cotovelos colados ao corpo durante todo o movimento.',
      'Suba a barra contraindo o bíceps, sem balançar o tronco.',
      'Desça devagar até estender os braços por completo.',
    ],
  },
  rosca_alt: {
    name: 'Rosca alternada com halteres',
    musc: 'Bíceps e antebraço',
    phases: ['Braço estendido', 'Haltere em cima'],
    weights: DB_SIDE,
    A: { ...STAND, el: [101, 72], ha: [103, 98] },
    B: { ha: [116, 52] },
    cues: [
      'Um braço de cada vez, cotovelo parado ao lado do corpo.',
      'Gire a palma para cima enquanto sobe o haltere.',
      'Desça devagar e só então suba o outro braço. Conte as reps de cada lado.',
    ],
  },
  triceps_testa: {
    name: 'Tríceps testa',
    musc: 'Tríceps',
    phases: ['Braços estendidos', 'Barra na testa'],
    props: BENCH,
    weights: PLATE,
    A: { ...LYING, el: [61, 89], ha: [62, 66] },
    B: { ha: [42, 100] },
    cues: [
      'Deitado no banco, barra em cima do peito com os braços estendidos.',
      'Dobre só os cotovelos, descendo a barra até perto da testa.',
      'Estenda os braços de volta sem abrir os cotovelos para os lados.',
    ],
  },
};

// ---------- desenho ----------

const NS = 'http://www.w3.org/2000/svg';
const CYCLE = 2800; // ms por repetição: vai, segura, volta, segura
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function shape(u) {
  if (u < 0.4) return ease(u / 0.4);
  if (u < 0.5) return 1;
  if (u < 0.9) return 1 - ease((u - 0.5) / 0.4);
  return 0;
}

function mk(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  parent.appendChild(el);
  return el;
}
const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

const running = new Set();
let rafId = null;
function loop(now) {
  for (const f of running) {
    if (!f.svg.isConnected) { running.delete(f); continue; }
    if (!f.playing) continue;
    f.offset = (now - f.t0) % CYCLE;
    f.draw(shape(f.offset / CYCLE));
  }
  rafId = running.size ? requestAnimationFrame(loop) : null;
}

function buildFigure(key) {
  const def = FIGS[key];
  const A = def.A;
  const B = { ...A, ...def.B };
  const parts = def.view === 'front' ? FRONT_PARTS : SIDE_PARTS;

  const wrap = document.createElement('div');
  wrap.className = 'fig';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '20 -20 160 180');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Desenho: ${def.phases[0].toLowerCase()} até ${def.phases[1].toLowerCase()}`);
  wrap.appendChild(svg);

  mk('line', { class: 'fig-floor', x1: 20, y1: 151, x2: 180, y2: 151 }, svg);
  for (const p of def.props || []) {
    if (p.t === 'rect') mk('rect', { class: 'fig-prop', x: p.x, y: p.y, width: p.w, height: p.h, rx: 2 }, svg);
    else if (p.t === 'circle') mk('circle', { class: 'fig-prop', cx: p.cx, cy: p.cy, r: p.r }, svg);
    else mk('polyline', { class: 'fig-prop-line', points: p.pts.map(pt).join(' '), 'stroke-width': p.w }, svg);
  }

  const weights = (def.weights || []).map((w) => {
    const g = mk('g', {}, svg);
    if (w.type === 'plate') {
      mk('circle', { class: 'fig-plate', r: w.r ?? 13, cx: 0, cy: 0 }, g);
      mk('circle', { class: 'fig-hub', r: 3, cx: 0, cy: 0 }, g);
    } else if (w.type === 'db') {
      mk('circle', { class: 'fig-plate', r: 7, cx: 0, cy: 0 }, g);
    } else if (w.type === 'handle') {
      mk('circle', { class: 'fig-hub', r: 4, cx: 0, cy: 0 }, g);
    } else if (w.type === 'sled') {
      mk('line', { class: 'fig-sled', x1: -8, y1: -16, x2: 16, y2: 8 }, g);
      mk('circle', { class: 'fig-plate', r: 11, cx: 18, cy: -18 }, g);
    } else if (w.type === 'cable') {
      const line = mk('line', { class: 'fig-cable', x1: w.from[0], y1: w.from[1] }, svg);
      svg.removeChild(g);
      return { w, line };
    }
    return { w, g };
  });

  const lines = parts.map((p) => ({ p, el: mk('polyline', { class: p.thin ? 'fig-limb thin' : 'fig-limb' }, svg) }));
  const head = mk('circle', { class: 'fig-head', r: 9 }, svg);

  const phase = document.createElement('span');
  phase.className = 'fig-phase';
  wrap.appendChild(phase);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fig-ctl';
  wrap.appendChild(btn);

  function draw(k) {
    const P = {};
    for (const j in B) {
      const a = A[j] ?? B[j];
      P[j] = [a[0] + (B[j][0] - a[0]) * k, a[1] + (B[j][1] - a[1]) * k];
    }
    for (const { p, el } of lines) el.setAttribute('points', p.pts.map((n) => pt(P[n])).join(' '));
    head.setAttribute('cx', P.head[0]);
    head.setAttribute('cy', P.head[1]);
    for (const { w, g, line } of weights) {
      const at = P[w.at];
      const x = at[0] + (w.dx ?? 0);
      const y = at[1] + (w.dy ?? 0);
      if (line) { line.setAttribute('x2', x); line.setAttribute('y2', y); }
      else g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    }
    phase.textContent = k < 0.5 ? def.phases[0] : def.phases[1];
    f.k = k;
  }

  const reduce = reduceMotion();
  const f = { svg, draw, playing: !reduce, t0: performance.now(), offset: 0, k: 0 };
  const label = () => {
    btn.textContent = reduce ? (f.k < 0.5 ? 'Ver fim' : 'Ver início') : f.playing ? 'Pausar' : 'Animar';
  };
  btn.addEventListener('click', () => {
    if (reduce) draw(f.k < 0.5 ? 1 : 0);
    else {
      f.playing = !f.playing;
      if (f.playing) f.t0 = performance.now() - f.offset;
    }
    label();
  });

  draw(0);
  label();
  if (!reduce) {
    running.add(f);
    if (!rafId) rafId = requestAnimationFrame(loop);
  }
  return wrap;
}

// Preenche um container com o desenho, os músculos e as dicas do exercício.
export function mountHowto(container, key) {
  const def = FIGS[key];
  if (!def) return;
  container.textContent = '';
  container.appendChild(buildFigure(key));
  const txt = document.createElement('div');
  txt.className = 'howto-text';
  const musc = document.createElement('p');
  musc.className = 'musc';
  musc.append('Músculos: ');
  const b = document.createElement('b');
  b.textContent = def.musc;
  musc.append(b);
  const ol = document.createElement('ol');
  ol.className = 'cues';
  for (const c of def.cues) {
    const li = document.createElement('li');
    li.textContent = c;
    ol.append(li);
  }
  txt.append(musc, ol);
  container.appendChild(txt);
}
