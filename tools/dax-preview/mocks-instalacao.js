'use strict';
// ============================================================================
// Dados FICTICIOS do painel "Instalacao em ate 3 dias".
//
// Um "modelo de mentira" pequeno: instalacoes concluidas por AT e por dia
// (total e no prazo) + carteira de ordens pendentes na carga de hoje.
// Tudo e gerado por sorteio com semente fixa, entao as previas saem sempre
// iguais. Os mocks tem o MESMO formato das VARs marcadas com "<<< MODELO" na
// medida; o resto da medida e avaliado de verdade.
// ============================================================================
const { serial } = require('./dax.js');

// "hoje" das previas: quarta-feira, 11/11/2026 (12h em Brasilia = 15h UTC)
const HOJE = serial(2026, 11, 11);
const UTC_NOW = HOJE + 15 / 24;

// AT, cor, volume medio por dia util, taxa "de casa" de instalacao no prazo
const ATS = [
  ['PL', 'OURO', 46, 0.86], ['SA', 'OURO', 38, 0.83], ['IT', 'OURO', 30, 0.80], ['BT', 'OURO', 27, 0.84],
  ['BS', 'PRATA 1', 41, 0.81], ['LA', 'PRATA 1', 26, 0.77], ['JS', 'PRATA 1', 22, 0.74],
  ['VJ', 'PRATA 2', 35, 0.79], ['VN', 'PRATA 2', 29, 0.76], ['CL', 'PRATA 2', 33, 0.72], ['FO', 'PRATA 2', 21, 0.78], ['CA', 'PRATA 2', 19, 0.69],
  ['JG', 'BRONZE', 44, 0.75], ['BF', 'BRONZE', 37, 0.71], ['MA', 'BRONZE', 31, 0.66], ['RP', 'BRONZE', 24, 0.73], ['PI', 'BRONZE', 18, 0.62],
];

function rng(seed) { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }
const DAY = 86400000;
const EPOCH = Date.UTC(1899, 11, 30);
const dt = (s) => new Date(EPOCH + Math.round(s) * DAY);
const dow = (s) => dt(s).getUTCDay(); // 0 = domingo

// Deslocamento da taxa de todas as ATs em cada mes, de set/2025 a nov/2026:
// comeca fraco, melhora ate bater a meta no meio do ano e recua em novembro.
const GERAL_MES = [-0.02, -0.03, -0.035, -0.045, -0.06, -0.075, -0.04, -0.02, 0.0, 0.025, 0.062, 0.075, 0.058, 0.04, -0.005];
// Alguns dias em que a operacao inteira foi pior (chuva, sistema fora...).
const diaRuim = (d) => { const h = (d * 2654435761) % 97; return h < 6 ? -0.09 : h < 14 ? -0.04 : h > 88 ? 0.03 : 0; };

// ---------------------------------------------------------------- INSTALADAS
// Uma linha por AT x dia, de 430 dias atras ate hoje (hoje = carga parcial).
function gerarInstaladas() {
  const r = rng(20261111);
  const out = [];
  ATS.forEach(([at, cor, vol, taxa], k) => {
    for (let d = HOJE - 430; d <= HOJE; d++) {
      const w = dow(d);
      const fator = w === 0 ? 0.12 : w === 6 ? 0.55 : 1;
      const mes = dt(d).getUTCFullYear() * 12 + dt(d).getUTCMonth();
      // movimento comum a todas as ATs (mes a mes) + onda propria da AT + dias ruins na operacao
      const onda = (GERAL_MES[mes - (2025 * 12 + 8)] || 0) + 0.022 * Math.sin((mes + k * 1.7) / 1.9) + diaRuim(d);
      const parcial = d === HOJE ? 0.38 : 1;
      const total = Math.round(vol * fator * parcial * (0.78 + 0.44 * r()));
      if (total <= 0) { r(); continue; }
      const p = Math.max(0.2, Math.min(0.99, taxa + onda + (r() - 0.5) * 0.16 - (w === 1 ? 0.035 : 0)));
      out.push({ at, cor, dia: d, total, prazo: Math.min(total, Math.round(total * p)) });
    }
  });
  return out;
}
const INSTALADAS = gerarInstaladas();

// ----------------------------------------------------------------- PENDENTES
// Idade em dias corridos desde a abertura: 0-1 no prazo, 2 vence amanha,
// 3 vence hoje, 4+ ja perdida.
function gerarPendentes() {
  const r = rng(771);
  const out = [];
  let seq = 250118000;
  ATS.forEach(([at, cor, vol, taxa]) => {
    const qtd = Math.round(vol * (1.15 + (1 - taxa) * 2.4));
    for (let i = 0; i < qtd; i++) {
      const x = r();
      // quem tem taxa pior carrega mais ordem velha
      const velha = 0.06 + (1 - taxa) * 0.55;
      let idade;
      if (x < velha) idade = 4 + Math.floor(Math.pow(r(), 2.2) * 9);
      else if (x < velha + 0.13) idade = 3;
      else if (x < velha + 0.32) idade = 2;
      else if (x < velha + 0.62) idade = 1;
      else idade = 0;
      const abertura = HOJE - idade + (8 + Math.floor(r() * 11)) / 24 + Math.floor(r() * 60) / 1440;
      const vence = HOJE - idade + 3;
      let agenda = null;
      const y = r();
      if (idade <= 3) {
        if (y < 0.68) agenda = HOJE + Math.floor(r() * (vence - HOJE + 1)); // dentro do prazo
        else if (y < 0.86) agenda = vence + 1 + Math.floor(r() * 3);        // depois do prazo
      } else if (y < 0.62) agenda = HOJE + Math.floor(r() * 4);
      seq += 1 + Math.floor(r() * 37);
      out.push({ Ordem: '8-' + seq, AT: at, Cor: cor, Abertura: abertura, Agenda: agenda });
    }
  });
  return out;
}
const PENDENTES = gerarPendentes();

// ------------------------------------------------------------------ CENARIOS
// Repete em JS a janela que a medida pede ao modelo (12 meses + semana cheia).
const eomonth = (s, m) => { const d = dt(s); return serial(d.getUTCFullYear(), d.getUTCMonth() + m + 2, 0); };
function janela(fimSel, qtdMeses, qtdSemanas) {
  const ref = fimSel === null || fimSel > HOJE ? HOJE : fimSel;
  const d = dt(ref);
  const mesIni = serial(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  const mesFim = eomonth(ref, 0);
  const semRef = ref - ((dow(ref) + 6) % 7);
  const m0 = dt(mesIni);
  const ini = Math.min(serial(m0.getUTCFullYear(), m0.getUTCMonth() + 1 - (qtdMeses - 1), 1), semRef - 7 * (qtdSemanas - 1));
  return { ini, fim: Math.max(mesFim, semRef + 6) };
}

/**
 * @param {object} o
 *   fimSel   ultima data do filtro de mes (serial) | null = sem filtro
 *   ats      siglas das ATs no filtro | null = todas
 *   carga    data da ultima carga (serial) | null = modelo sem a coluna
 *   semAgenda true = base sem data de agendamento
 *   semPend  true = nenhuma ordem pendente
 *   semDados true = nenhuma instalacao na janela
 */
function cenario(o) {
  const opt = o || {};
  const fimSel = opt.fimSel === undefined ? serial(2026, 11, 30) : opt.fimSel;
  const j = janela(fimSel, 12, 12);
  const noFiltro = (at) => !opt.ats || opt.ats.includes(at);
  return {
    _fimSel: fimSel,
    // a grade ignora o filtro de cor/AT (REMOVEFILTERS( dAT )): traz todas as ATs
    _gradeModelo: opt.semDados ? [] : INSTALADAS.filter((x) => x.dia >= j.ini && x.dia <= j.fim)
      .map((x) => ({ 'AREA ': x.at, 'COR_AREA ': x.cor, Data: x.dia, '@n': x.prazo, '@d': x.total })),
    _atsCtx: ATS.filter((a) => noFiltro(a[0])).map((a) => ({ 'AREA ': a[0] })),
    // a carteira pendente respeita o filtro de cor/AT e ignora o de mes
    _pendModelo: opt.semPend ? [] : PENDENTES.filter((p) => noFiltro(p.AT))
      .map((p) => (opt.semAgenda ? Object.assign({}, p, { Agenda: null }) : p)),
    _dataCarga: opt.carga === undefined ? HOJE + 8.6 / 24 : opt.carga,
  };
}

const daCor = (cor) => ATS.filter((a) => a[1] === cor).map((a) => a[0]);

module.exports = { HOJE, UTC_NOW, ATS, INSTALADAS, PENDENTES, cenario, daCor };
