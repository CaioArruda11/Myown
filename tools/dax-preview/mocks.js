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
