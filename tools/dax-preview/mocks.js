'use strict';
// Dados ficticios usados nas previas. Os do cenario "print" repetem os numeros
// do print enviado (Outubro/2026); os demais sao inventados para testar estados.
const { serial } = require('./dax.js');

// ---------------------------------------------------------------- CORPO BSC
// Indicador, NomeTela, Grupo, Ordem, AnaliticoAT, resultado, meta, menorMelhor, pontos disponiveis
const IND = [
  ['1 AGENDA', 'Efetividade 1ª Agenda', 'NEGÓCIO', 1, 1, 0.5563, 0.732, 0, 10],
  ['TMR', 'Tempo de Reparo', 'NEGÓCIO', 2, 1, 33.5325, 24, 1, 8],
  ['CHEGADA NO SLOT', 'Chegada no Slot', 'NEGÓCIO', 3, 1, 0.772, 0.80, 0, 8],
  ['INSTALAÇÃO 3D', 'Instalação em até D3', 'NEGÓCIO', 4, 1, 0.4641, 0.81, 0, 10],
  ['PRODUTIVIDADE PU', 'Produtividade PU', 'NEGÓCIO', 5, 1, 2.754, 2.7, 0, 8],
  ['ROTEIRIZAÇÃO AUTOMÁTICA', 'Roteirização Automática', 'NEGÓCIO', 6, 1, 0.7922, 0.85, 0, 4],
  ['IRT', 'IRT', 'NEGÓCIO', 7, 1, 0.058, 0.04, 1, 8],
  ['EFICIÊNCIA DE CAMPO', 'Eficiência de Campo', 'NEGÓCIO', 8, 1, null, 0.9, 0, 10],
  ['IFI 7 DIAS', 'IFI FTTH 7 Dias', 'QUALIDADE', 9, 1, 0.047, 0.035, 1, 15],
  ['IRR 7 DIAS', 'Repetidas FTTH 7 Dias', 'QUALIDADE', 10, 1, 0.125, 0.09, 1, 15],
  ['INDISPONIBILIDADE FTTH', 'Indisponibilidade FTTH', 'QUALIDADE', 11, 0, null, null, 1, 2],
  ['INDISPONIBILIDADE MÓVEL', 'Indisponibilidade Móvel', 'QUALIDADE', 12, 0, null, null, 1, 2],
];
const tabIndBase = (over) => IND.map((r) => {
  const o = over && over[r[0]] ? over[r[0]] : {};
  return {
    Indicador: r[0], NomeTela: r[1], Grupo: r[2], Ordem: r[3], AnaliticoAT: r[4],
    __ResultadoBruto: 'res' in o ? o.res : r[5], __Meta: 'meta' in o ? o.meta : r[6], __MenorMelhor: r[7], __PtsDisp: r[8],
  };
});

const ATS = [
  ['PL', 'OURO', 65.04], ['JG', 'BRONZE', 64.38], ['BF', 'BRONZE', 64.33], ['VJ', 'PRATA 2', 63.16],
  ['MA', 'BRONZE', 62.40], ['BS', 'PRATA 1', 62.24], ['RP', 'BRONZE', 61.02], ['VN', 'PRATA 2', 60.71],
  ['SA', 'OURO', 60.10], ['CL', 'PRATA 2', 59.84], ['IT', 'OURO', 59.02], ['PI', 'BRONZE', 58.77],
  ['LA', 'PRATA 1', 58.10], ['BT', 'OURO', 57.45], ['FO', 'PRATA 2', 56.90], ['JS', 'PRATA 1', 55.31],
  ['CA', 'PRATA 2', 54.62],
];
// Pontos por indicador de cada AT (alimentam o mapa de calor). Os totais batem com a lista acima.
const PESOS = { Agenda: 10, TMR: 8, Slot: 8, Instalacao: 10, Produtividade: 8, Roteirizacao: 4, IRT: 8, EficienciaCampo: 10, IFI7: 15, IRR7: 15 };
const PADRAO = { Agenda: 0.78, TMR: 0.74, Slot: 0.97, Instalacao: 0.6, Produtividade: 1.02, Roteirizacao: 0.93, IRT: 0.7, EficienciaCampo: null, IFI7: 0.76, IRR7: 0.73 };
const PADRAO_BOM = { Agenda: 1.04, TMR: 1.1, Slot: 1.03, Instalacao: 0.95, Produtividade: 1.02, Roteirizacao: 1.03, IRT: 1.08, EficienciaCampo: 1.03, IFI7: 1.06, IRR7: 0.87 };
const ruido = (txt) => { let h = 7; for (const ch of txt) h = (h * 31 + ch.charCodeAt(0)) % 9973; return (h % 41) / 100 - 0.2; };
const areas = (cor, k, padrao) => ATS.filter((a) => !cor || cor === 'GERAL' || a[1] === cor).map((a) => {
  const alvo = a[2] * (k || 1);
  const pad = padrao || PADRAO;
  const bruto = {};
  let soma = 0;
  for (const ind of Object.keys(PESOS)) {
    bruto[ind] = pad[ind] === null ? null : PESOS[ind] * Math.min(1.3, pad[ind] * (1 + ruido(a[0] + ind)));
    soma += bruto[ind] || 0;
  }
  const row = { 'AREA ': a[0], __CorArea: a[1] };
  let total = 0;
  for (const ind of Object.keys(PESOS)) {
    const v = bruto[ind] === null ? null : Math.min(1.3 * PESOS[ind], (bruto[ind] * alvo) / soma);
    row['__Pontos' + ind] = v === null ? null : Math.round(v * 100) / 100;
    total += v || 0;
  }
  row.__Pontos = Math.round(total * 100) / 100;
  return row;
});

const corpoBase = {
  _corSelecionada: 'GERAL', _areaSelecionada: null, _temAreaSelecionada: false,
  _totalPontosDisponiveis: 100,
  _qtdATGeral: 17, _qtdATOuro: 4, _qtdATBronze: 5, _qtdATPrata1: 3, _qtdATPrata2: 5,
  _pontosGeral: 66.17, _pontosBronze: 68.55, _pontosOuro: 65.54, _pontosPrata2: 64.95, _pontosPrata1: 63.94,
  _tabIndBase: tabIndBase(), _areasValidas: areas('GERAL'),
};

const corpo = {
  // mesmos numeros do print
  print: corpoBase,
  // faixa BRONZE filtrada + AT selecionada
  bronzeAT: Object.assign({}, corpoBase, {
    _corSelecionada: 'BRONZE', _areaSelecionada: 'MA', _temAreaSelecionada: true,
    _areasValidas: areas('BRONZE'),
    _tabIndBase: tabIndBase({
      '1 AGENDA': { res: 0.542 }, 'TMR': { res: 30.2 }, 'CHEGADA NO SLOT': { res: 0.781 }, 'INSTALAÇÃO 3D': { res: 0.53 }, 'PRODUTIVIDADE PU': { res: 2.61 },
      'IRT': { res: 0.036 }, 'EFICIÊNCIA DE CAMPO': { res: 0.874 }, 'IFI 7 DIAS': { res: 0.061 }, 'IRR 7 DIAS': { res: 0.142 },
    }),
  }),
  // so a cor OURO filtrada
  ouro: Object.assign({}, corpoBase, { _corSelecionada: 'OURO', _areasValidas: areas('OURO') }),
  // resultado bom: quase tudo verde, para ver o outro extremo da escala
  bom: Object.assign({}, corpoBase, {
    _pontosGeral: 101.4, _pontosBronze: 104.2, _pontosOuro: 102.3, _pontosPrata2: 99.1, _pontosPrata1: 93.6,
    _areasValidas: areas('GERAL', 1.56, PADRAO_BOM),
    _tabIndBase: tabIndBase({
      '1 AGENDA': { res: 0.76 }, 'TMR': { res: 21.5 }, 'CHEGADA NO SLOT': { res: 0.83 }, 'INSTALAÇÃO 3D': { res: 0.78 },
      'ROTEIRIZAÇÃO AUTOMÁTICA': { res: 0.88 }, 'IRT': { res: 0.037 }, 'EFICIÊNCIA DE CAMPO': { res: 0.93 },
      'IFI 7 DIAS': { res: 0.033 }, 'IRR 7 DIAS': { res: 0.104 },
      'INDISPONIBILIDADE FTTH': { res: 0.0031, meta: 0.004 }, 'INDISPONIBILIDADE MÓVEL': { res: 0.0052, meta: 0.005 },
    }),
  }),
  // nenhum dado no periodo
  vazio: Object.assign({}, corpoBase, {
    _pontosGeral: null, _pontosBronze: null, _pontosOuro: null, _pontosPrata2: null, _pontosPrata1: null,
    _areasValidas: [],
    _tabIndBase: IND.map((r) => ({ Indicador: r[0], NomeTela: r[1], Grupo: r[2], Ordem: r[3], AnaliticoAT: r[4], __ResultadoBruto: null, __Meta: r[6], __MenorMelhor: r[7], __PtsDisp: r[8] })),
  }),
};

// --------------------------------------------------------------------- MENU
const QTD = { _qtdATGeral: 17, _qtdATOuro: 4, _qtdATBronze: 5, _qtdATPrata1: 3, _qtdATPrata2: 5 };
const menu = {
  geral: Object.assign({ _corSelecionada: 'GERAL', _areaSelecionada: null, _temAreaSelecionada: false }, QTD),
  bronzeAT: Object.assign({ _corSelecionada: 'BRONZE', _areaSelecionada: 'MA', _temAreaSelecionada: true }, QTD),
  ouro: Object.assign({ _corSelecionada: 'OURO', _areaSelecionada: null, _temAreaSelecionada: false }, QTD),
};

// ------------------------------------------------------------------- STATUS
// "hoje" das previas: 09/11/2026 (12h em Brasilia = 15h UTC)
const HOJE = serial(2026, 11, 9);
const UTC_NOW = HOJE + 15 / 24;
const dts = (lags) => {
  const names = ['_dtIFI', '_dtIRR7D', '_dtTMR', '_dtEficiencia', '_dtEfetividade', '_dtInsta3D', '_dtChegada', '_dtRoteirizacao'];
  const o = {};
  names.forEach((n, i) => { o[n] = lags[i] === null ? null : HOJE - lags[i]; });
  return o;
};
const status = {
  misto: dts([1, 1, 0, 3, 1, 12, 1, null]),
  emDia: dts([1, 1, 0, 1, 1, 1, 0, 1]),
  print: dts([40, 18, 11, 12, 11, 13, 18, 6]),
};

module.exports = { corpo, menu, status, HOJE, UTC_NOW };

// ------------------------------------------------------- RANKING DE TECNICOS
// Base ficticia: N tecnicos distribuidos em supervisores, com varios sem dado
// em parte dos indicadores (como no print: muita linha com 1/5 ou 2/5).
const SUPS = ['RENATO SALES', 'JAILTON FERREIRA DA PASCIENCIA', 'FRANCISCO NUNES VIEIRA', 'RENATO FELIPE DA MOTA MATTOS', 'ALEX ALVES ROBERTO',
  'TIAGO SILVA COELHO', 'NILTON CESAR DA SILVA', 'JUNEILANDO DE BRITO', 'MARCOS VINICIUS LOPES', 'PAULO HENRIQUE RAMOS'];
const NOMES = ['Fernando', 'Flavio', 'Jaqueline', 'Leonio', 'Marcos', 'Nathan', 'Thiago', 'Alexandre', 'Rudnaldo', 'Cristiano', 'Anderson', 'Bruno', 'Carlos', 'Diego', 'Eduardo',
  'Fabio', 'Gabriel', 'Henrique', 'Igor', 'Joao', 'Kleber', 'Lucas', 'Mateus', 'Nelson', 'Otavio', 'Paulo', 'Rafael', 'Sergio', 'Tiago', 'Vitor', 'Wesley', 'Yuri'];
const SOBRE = ['Ranieli Santos De Oliveira', 'Siqueira De Oliveira', 'Barros Da Silva', 'Gabriel Alves', 'Antonio De Toledo', 'Tavares Silva', 'Dos Santos Carvalho',
  'Osvandir Aparecido', 'De Souza Araujo', 'Alves Da Silva', 'Pereira Lima', 'Costa Ribeiro', 'Souza Martins', 'Rocha Fernandes', 'Gomes Barbosa', 'Almeida Pinto', 'Cardoso Melo'];
function rng(seed) { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }
function baseRanking(n, seed) {
  const r = rng(seed);
  const rows = [];
  const dono = {};
  for (let i = 0; i < n; i++) {
    const nome = NOMES[i % NOMES.length] + ' ' + SOBRE[(i * 7) % SOBRE.length] + (i >= NOMES.length * 4 ? ' ' + (i % 9 + 2) : '');
    if (dono[nome]) continue;
    dono[nome] = SUPS[Math.floor(r() * SUPS.length)];
    const q = 0.55 + r() * 0.9; // qualidade geral do tecnico
    const tem = () => r() < 0.46;
    const pct = (meta, on) => { if (!on) return [null, null, null]; const den = 3 + Math.floor(r() * 40); const num = Math.max(0, Math.round(den * meta * (0.2 + r() * 2.2) / q)); return [num / den, num, den]; };
    const a = pct(0.04, tem()), b = pct(0.02, tem()), c = pct(0.10, tem()), d = pct(0.05, tem());
    const temPU = r() < 0.5; const dPU = 10 + Math.floor(r() * 30); const nPU = Math.round(dPU * (2.2 + r() * 2.2) * Math.min(1.2, q));
    rows.push({ Entidade: nome, '@IFI': a[0], '@IFI7': b[0], '@IRR': c[0], '@IRR7': d[0], '@PU': temPU ? nPU / dPU : null,
      '@nIFI': a[1], '@dIFI': a[2], '@nIFI7': b[1], '@dIFI7': b[2], '@nIRR': c[1], '@dIRR': c[2], '@nIRR7': d[1], '@dIRR7': d[2], '@nPU': temPU ? nPU : null, '@dPU': temPU ? dPU : null });
  }
  return { rows, dono };
}
function rankingCenario(n, seed, o) {
  const opt = o || {};
  const { rows, dono } = baseRanking(n, seed);
  const sup = !!opt.supervisor;
  // sem7d: ninguem tem os indicadores de 7 dias (base sem linhas no mes), como no print enviado
  if (opt.sem7d) for (const t of rows) for (const k of ['@IFI7', '@nIFI7', '@dIFI7', '@IRR7', '@nIRR7', '@dIRR7']) t[k] = k.startsWith('@n') || k.startsWith('@d') ? 0 : (k === '@IFI7' ? NaN : null);
  let base = rows;
  if (sup) {
    // agrega por supervisor (soma numeradores e denominadores)
    const m = {};
    for (const t of rows) {
      const s = dono[t.Entidade];
      const g = m[s] || (m[s] = { Entidade: s, '@nIFI': 0, '@dIFI': 0, '@nIFI7': 0, '@dIFI7': 0, '@nIRR': 0, '@dIRR': 0, '@nIRR7': 0, '@dIRR7': 0, '@nPU': 0, '@dPU': 0 });
      for (const k of Object.keys(g)) if (k !== 'Entidade') g[k] += t[k] || 0;
    }
    // mesma ordem de colunas das outras bases (UNION casa as colunas pela posicao)
    const div = (x, y) => (y ? x / y : null);
    base = Object.values(m).map((g) => ({ Entidade: g.Entidade, '@IFI': div(g['@nIFI'], g['@dIFI']), '@IFI7': div(g['@nIFI7'], g['@dIFI7']), '@IRR': div(g['@nIRR'], g['@dIRR']),
      '@IRR7': div(g['@nIRR7'], g['@dIRR7']), '@PU': div(g['@nPU'], g['@dPU']), '@nIFI': g['@nIFI'], '@dIFI': g['@dIFI'], '@nIFI7': g['@nIFI7'], '@dIFI7': g['@dIFI7'],
      '@nIRR': g['@nIRR'], '@dIRR': g['@dIRR'], '@nIRR7': g['@nIRR7'], '@dIRR7': g['@dIRR7'], '@nPU': g['@nPU'], '@dPU': g['@dPU'] }));
  }
  const geral = Object.assign({ Entidade: '__GERAL__', '@IFI': 0.082, '@IFI7': opt.ifi7 === undefined ? NaN : opt.ifi7, '@IRR': 0.294, '@IRR7': opt.irr7 === undefined ? null : opt.irr7, '@PU': 2.4,
    '@nIFI': 412, '@dIFI': 5024, '@nIFI7': opt.sem7d ? 0 : null, '@dIFI7': opt.sem7d ? 0 : null, '@nIRR': 1310, '@dIRR': 4456, '@nIRR7': null, '@dIRR7': null, '@nPU': 9120, '@dPU': 3800 }, opt.geral || {});
  const sel = opt.sel || null;
  const linhaSel = sel ? base.find((x) => x.Entidade === sel) : null;
  const ctx = linhaSel || geral;
  const mocks = {
    _visao: sup ? 'SUPERVISOR' : 'TÉCNICO', _tecSel: sup ? null : sel, _supSel: sup ? sel : null, _supsContexto: [],
    _baseTec: sup ? [] : base, _baseSup: sup ? base : [], _baseGeral: [geral],
    _irr7Atual: ctx['@IRR7'], _irr7M1: opt.m1 ? opt.m1[0] : 0.047, _ifi7Atual: ctx['@IFI7'], _ifi7M1: opt.m1 ? opt.m1[1] : null, _puAtual: ctx['@PU'], _puM1: opt.m1 ? opt.m1[2] : 2.7,
  };
  // CALCULATE dentro do ranking: supervisor(es) do tecnico ou quantidade de tecnicos do supervisor
  const calculate = (node, get) => {
    const e = get('_e');
    if (node.args[0].name === 'DISTINCTCOUNT') return rows.filter((t) => dono[t.Entidade] === e).length;
    return dono[e] || '';
  };
  return { mocks, calculate, nomes: base.map((x) => x.Entidade) };
}
module.exports.ranking = rankingCenario;
