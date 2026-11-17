'use strict';
// ============================================================================
// Dados ficticios da pagina "Projeção BSC". Sem dependencias: o mesmo arquivo
// roda no Node (build-projecao.js) e dentro da previa interativa (navegador).
//
// Cenario GERAL: os 12 indicadores do print da pagina ja montada (real, meta,
// atingimento e pontos iguais aos da tela, nota 81,02; mes anterior 79,57).
// Cores e ATs: derivados do
// Geral com uma variacao fixa, so para a pagina responder aos filtros.
// ============================================================================

// Indicador, NomeTela, Sigla, Grupo, Ordem, AnaliticoAT, resultado, meta, menorMelhor, peso
const IND = [
  ['1 AGENDA', 'Efetividade 1ª Agenda', 'AGE', 'NEGÓCIO', 1, 1, 0.547, 0.732, 0, 10],
  ['TMR', 'Tempo de Reparo', 'TMR', 'NEGÓCIO', 2, 1, 29.453611, 24, 1, 8],
  ['CHEGADA NO SLOT', 'Chegada no Slot', 'SLT', 'NEGÓCIO', 3, 1, 0.8333, 0.80, 0, 8],
  ['INSTALAÇÃO 3D', 'Instalação em até D3', 'D3', 'NEGÓCIO', 4, 1, 0.4455, 0.81, 0, 10],
  ['PRODUTIVIDADE PU', 'Produtividade PU', 'PU', 'NEGÓCIO', 5, 1, 2.558, 2.67, 0, 8],
  ['ROTEIRIZAÇÃO AUTOMÁTICA', 'Roteirização Automática', 'ROT', 'NEGÓCIO', 6, 1, 0.852, 0.85, 0, 4],
  ['IRT', 'IRT', 'IRT', 'NEGÓCIO', 7, 1, 0.058, 0.04, 1, 8],
  ['EFICIÊNCIA DE CAMPO', 'Eficiência de Campo', 'EFC', 'NEGÓCIO', 8, 1, 1.0278, 0.90, 0, 10],
  ['IFI 7 DIAS', 'IFI FTTH 7 Dias', 'IFI', 'QUALIDADE', 9, 1, 0.03021, 0.02, 1, 8],
  ['IRR 7 DIAS', 'Repetidas FTTH 7 Dias', 'IRR', 'QUALIDADE', 10, 1, 0.09124, 0.05, 1, 8],
  ['INDISPONIBILIDADE FTTH', 'Indisponibilidade FTTH', 'FTTH', 'QUALIDADE', 11, 0, 0.002, 0.001, 1, 8],
  ['INDISPONIBILIDADE MÓVEL', 'Indisponibilidade Móvel', 'MÓV', 'QUALIDADE', 12, 0, 0.005317, 0.0058, 1, 10],
];
const CHAVES = IND.map((r) => r[0]);
// niveis da arvore 'Seletor Nível BSC' (0% a 130%, de 10 em 10)
const NIVEIS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130];

// ATs e cores: os mesmos nomes das previas do corpo do BSC
const ATS = [
  ['PL', 'OURO'], ['JG', 'BRONZE'], ['BF', 'BRONZE'], ['VJ', 'PRATA 2'], ['MA', 'BRONZE'], ['BS', 'PRATA 1'],
  ['RP', 'BRONZE'], ['VN', 'PRATA 2'], ['SA', 'OURO'], ['CL', 'PRATA 2'], ['IT', 'OURO'], ['PI', 'BRONZE'],
  ['LA', 'PRATA 1'], ['BT', 'OURO'], ['FO', 'PRATA 2'], ['JS', 'PRATA 1'], ['CA', 'PRATA 2'],
];
const CORES = ['BRONZE', 'OURO', 'PRATA 1', 'PRATA 2'];
const QTD = { _qtdATGeral: 17, _qtdATOuro: 4, _qtdATBronze: 5, _qtdATPrata1: 3, _qtdATPrata2: 5 };

// variacao fixa por texto: -1 .. +1
function ruido(txt) { let h = 7; for (const ch of txt) h = (h * 31 + ch.charCodeAt(0)) % 9973; return (h % 201) / 100 - 1; }

// resultados "bons" (para ver o outro extremo): quase tudo na meta
const BOM = {
  '1 AGENDA': 0.752, 'TMR': 22.4, 'CHEGADA NO SLOT': 0.846, 'INSTALAÇÃO 3D': 0.776, 'PRODUTIVIDADE PU': 2.81, 'ROTEIRIZAÇÃO AUTOMÁTICA': 0.887,
  'IRT': 0.038, 'EFICIÊNCIA DE CAMPO': 0.921, 'IFI 7 DIAS': 0.0188, 'IRR 7 DIAS': 0.0541, 'INDISPONIBILIDADE FTTH': 0.00093, 'INDISPONIBILIDADE MÓVEL': 0.0044,
};

/**
 * Monta os mocks das VARs de primeiro nivel da medida "BSC Projeção HTML".
 * @param {object} e estado dos filtros:
 *   cor: 'GERAL' | 'OURO' | 'BRONZE' | 'PRATA 1' | 'PRATA 2'
 *   at: sigla da AT ou null
 *   cenario: texto do seletor de cenario, ou null (nada marcado)
 *   niveis: { chave: % | 'tudo' } da arvore "Indicador & %" (vazio = nada marcado)
 *   semMesAnt: true = mes anterior sem dados
 *   ating: % do seletor de atingimento (0 a 100), ou null (nada marcado = 100)
 *   marcados: lista de chaves marcadas no seletor de indicadores, ou null (nada marcado = todos)
 *   dados: 'print' (padrao) | 'bom' | 'vazio' | 'semDados' (2 indicadores sem resultado)
 */
function mocksProjecao(e) {
  const st = e || {};
  const cor = st.cor || 'GERAL';
  const at = st.at || null;
  const corDaAT = at ? (ATS.find((a) => a[0] === at) || [null, 'GERAL'])[1] : null;
  const ehFaixa = CORES.includes(cor);
  const modo = at && (!ehFaixa || corDaAT === cor) ? 'AT' : ehFaixa ? 'COR' : 'GERAL';
  const dados = st.dados || 'print';
  const tab = IND.map((r) => {
    const [chave, nome, sigla, grupo, ordem, analitico, res0, meta, mm, peso] = r;
    let res = dados === 'bom' ? BOM[chave] : res0;
    if (analitico) {
      // cor e AT mexem no resultado dos indicadores com abertura por AT
      if (ehFaixa) res *= 1 + 0.09 * ruido(cor + chave);
      if (modo === 'AT') res *= 1 + 0.2 * ruido(at + chave);
    }
    if (dados === 'vazio') res = null;
    if (dados === 'semDados' && (chave === 'EFICIÊNCIA DE CAMPO' || chave === 'INDISPONIBILIDADE MÓVEL')) res = null;
    const ating = res === null ? null : mm ? meta / res : res / meta;
    let pts = ating === null ? null : peso * Math.min(1.3, ating);
    if (modo === 'AT' && !analitico) pts = null; // consolidado nao tem ponto por AT
    return { Indicador: chave, NomeTela: nome, Sigla: sigla, Grupo: grupo, Ordem: ordem, AnaliticoAT: analitico,
      __ResultadoBruto: res, __Meta: meta, __MenorMelhor: mm, __PtsDisp: peso, __PtsBruto: pts,
      // mes anterior: um pouco abaixo do atual, variando por indicador (ou sem dados)
      __PtsMesAnt: pts === null || st.semMesAnt ? null : Math.min(peso * 1.3, pts * (0.95 + 0.05 * ruido('M1' + cor + (at || '') + chave))) };
  });
  // mes anterior do print: 79,57 no Geral
  if (dados === 'print' && modo === 'GERAL' && !st.semMesAnt) {
    const soma = tab.reduce((s, r) => s + (r.__PtsMesAnt || 0), 0);
    tab.forEach((r) => { if (r.__PtsMesAnt !== null) r.__PtsMesAnt *= 79.57 / soma; });
  }
  const marcados = st.marcados && st.marcados.length ? st.marcados : CHAVES;
  const m = {
    _corSelecionada: cor, _areaSelecionada: at, _temAreaSelecionada: !!at,
    _cenarioSel: st.cenario || 'Atingimento esperado (meta)',
    _atingEsperado: (st.ating === undefined || st.ating === null ? 100 : st.ating) / 100,
    _indMarcados: marcados.map((c) => ({ Chave: c })),
    // arvore "Indicador & %": { chave: 70 } marca so o 70%; { chave: 'tudo' } marca o indicador inteiro
    _niveisMarcados: [].concat(...Object.keys(st.niveis || {}).map((c) => (st.niveis[c] === 'tudo' ? NIVEIS : [st.niveis[c]]).map((n) => ({ 'Chave Nível': c, 'Atingimento Nível': n / 100 })))),
    _qtdNiveis: NIVEIS.length,
    _filtroMesAnterior: [],
    _totalPontosDisponiveis: IND.reduce((s, r) => s + r[9], 0),
    _tabIndBase: tab,
  };
  if (at) m._corDaAT = corDaAT;
  return m;
}

/** Mocks do menu lateral para o mesmo estado de filtros. */
function mocksMenu(e) {
  const st = e || {};
  return Object.assign({ _paginaAtual: 'Projeção BSC', _corSelecionada: st.cor || 'GERAL', _areaSelecionada: st.at || null, _temAreaSelecionada: !!st.at }, QTD);
}

const API = { IND, CHAVES, NIVEIS, ATS, CORES, mocksProjecao, mocksMenu };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
