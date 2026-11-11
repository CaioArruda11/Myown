'use strict';
// ============================================================================
// Dados FICTICIOS do painel "Instalacao em ate 3 dias".
//
// Um "modelo de mentira" pequeno, no formato do arquivo real:
//   - dCalendario so com DIAS UTEIS (sem sabado, domingo e feriado), comecando
//     em 02/01/2026, como no print enviado;
//   - instalacoes por AT x dia: total ('fINSTALACAO + ME_3D_TOTAL') e no prazo
//     ('fINSTALACAO + ME_3D');
//   - carga do dia ('ETA DIRECT D-0'): ordens pendentes com AT e data de abertura.
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

// ---------------------------------------------------------------- CALENDARIO
// Dias uteis de 02/01/2026 a 31/08/2027 (426 linhas no arquivo real).
const FERIADOS = [[2026, 1, 1], [2026, 2, 16], [2026, 2, 17], [2026, 4, 3], [2026, 4, 21], [2026, 5, 1], [2026, 6, 4], [2026, 9, 7], [2026, 10, 12],
  [2026, 11, 2], [2026, 11, 20], [2026, 12, 25], [2027, 1, 1], [2027, 2, 8], [2027, 2, 9], [2027, 3, 26], [2027, 4, 21], [2027, 5, 27]].map((f) => serial(f[0], f[1], f[2]));
const CALENDARIO = [];
for (let d = serial(2026, 1, 2); d <= serial(2027, 8, 31); d++) if (dow(d) !== 0 && dow(d) !== 6 && !FERIADOS.includes(d)) CALENDARIO.push(d);
const UTEIS_ATE_HOJE = CALENDARIO.filter((d) => d <= HOJE);

// Deslocamento da taxa de todas as ATs em cada mes de 2026 (jan a nov):
// comeca fraco, melhora ate bater a meta no meio do ano e recua em novembro.
const GERAL_MES = [-0.06, -0.075, -0.04, -0.02, 0.0, 0.025, 0.062, 0.075, 0.058, 0.04, -0.005, 0];
// Alguns dias em que a operacao inteira foi pior (chuva, sistema fora...).
const diaRuim = (d) => { const h = (d * 2654435761) % 97; return h < 6 ? -0.09 : h < 14 ? -0.04 : h > 88 ? 0.03 : 0; };

// ---------------------------------------------------------------- INSTALADAS
// Uma linha por AT x dia util, do inicio do calendario ate hoje (hoje = carga parcial).
function gerarInstaladas() {
  const r = rng(20261111);
  const out = [];
  ATS.forEach(([at, cor, vol, taxa], k) => {
    for (const d of UTEIS_ATE_HOJE) {
      const mes = dt(d).getUTCMonth();
      // movimento comum a todas as ATs (mes a mes) + onda propria da AT + dias ruins na operacao
      const onda = GERAL_MES[mes] + 0.022 * Math.sin((mes + k * 1.7) / 1.9) + diaRuim(d);
      const parcial = d === HOJE ? 0.38 : 1;
      const total = Math.round(vol * 1.25 * parcial * (0.78 + 0.44 * r()));
      if (total <= 0) { r(); continue; }
      const p = Math.max(0.2, Math.min(0.99, taxa + onda + (r() - 0.5) * 0.16 - (dow(d) === 1 ? 0.035 : 0)));
      out.push({ at, cor, dia: d, total, prazo: Math.min(total, Math.round(total * p)) });
    }
  });
  return out;
}
const INSTALADAS = gerarInstaladas();

// ----------------------------------------------------------------- PENDENTES
// Idade em DIAS UTEIS desde a abertura: 0-1 no prazo, 2 vence amanha,
// 3 vence hoje, 4+ ja perdida. A abertura cai no dia util correspondente
// (algumas no sabado seguinte, para testar abertura fora do calendario).
function gerarPendentes() {
  const r = rng(771);
  const out = [];
  let seq = 418250000;
  const n = UTEIS_ATE_HOJE.length;
  ATS.forEach(([at, , vol, taxa]) => {
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
      let dia = UTEIS_ATE_HOJE[n - 1 - idade];
      if (idade > 0 && dow(dia) === 5 && r() < 0.25) dia += 1; // aberta no sabado: conta a partir da segunda
      const abertura = dia + (8 + Math.floor(r() * 11)) / 24 + Math.floor(r() * 60) / 1440;
      // ultimo dia do prazo = 3o dia util depois da abertura
      const depois = CALENDARIO.filter((d) => d > Math.floor(abertura));
      const vence = depois[2];
      let agenda = null;
      const y = r();
      if (idade <= 3) {
        const noPrazo = CALENDARIO.filter((d) => d >= HOJE && d <= vence);
        if (y < 0.68 && noPrazo.length) agenda = noPrazo[Math.floor(r() * noPrazo.length)]; // dentro do prazo
        else if (y < 0.86) agenda = CALENDARIO.filter((d) => d > vence)[Math.floor(r() * 3)]; // depois do prazo
      } else if (y < 0.62) agenda = CALENDARIO.filter((d) => d >= HOJE)[Math.floor(r() * 4)];
      seq += 1 + Math.floor(r() * 37);
      out.push({ Ordem: String(seq), AT: at, Abertura: abertura, Agenda: agenda });
    }
  });
  return out;
}
const PENDENTES = gerarPendentes();

// ------------------------------------------------------------------ CENARIOS
// Repete em JS as janelas que a medida pede ao modelo.
const eomonth = (s, m) => { const d = dt(s); return serial(d.getUTCFullYear(), d.getUTCMonth() + m + 2, 0); };
function janela(fimSel, qtdMeses, qtdSemanas) {
  const ref = fimSel === null || fimSel > HOJE ? HOJE : fimSel;
  const d = dt(ref);
  const mesIni = serial(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  const mesFim = eomonth(ref, 0);
  const semRef = ref - ((dow(ref) + 6) % 7);
  const m0 = dt(mesIni);
  const ini = Math.min(serial(m0.getUTCFullYear(), m0.getUTCMonth() + 1 - (qtdMeses - 1), 1), semRef - 7 * (qtdSemanas - 1));
  const fim = Math.max(mesFim, semRef + 6);
  return { ini, fim, calIni: Math.min(ini, HOJE - 90), calFim: Math.max(fim, HOJE + 30) };
}

/**
 * @param {object} o
 *   fimSel      ultima data do filtro de mes (serial) | null = sem filtro
 *   ats         siglas das ATs no filtro | null = todas
 *   carga       data da ultima carga (serial) | padrao: coluna nao ligada (BLANK)
 *   comAgenda   true = coluna de agendamento ligada
 *   semAbertura true = como a medida sai de fabrica: coluna de abertura ainda nao ligada
 *   semPend     true = carga do dia vazia
 *   semDados    true = nenhuma instalacao na janela
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
    _calModelo: CALENDARIO.filter((d) => d >= j.calIni && d <= j.calFim).map((d) => ({ Data: d })),
    // a carga do dia nao tem relacionamento com a dAT: vem inteira e a medida filtra pela coluna AT
    _pendModelo: opt.semPend ? [] : PENDENTES.map((p) => ({
      Ordem: p.Ordem, AT: p.AT, Abertura: opt.semAbertura ? null : p.Abertura, Agenda: opt.comAgenda && !opt.semAbertura ? p.Agenda : null,
    })),
    _dataCarga: opt.carga === undefined ? null : opt.carga,
  };
}

const daCor = (cor) => ATS.filter((a) => a[1] === cor).map((a) => a[0]);

module.exports = { HOJE, UTC_NOW, ATS, CALENDARIO, INSTALADAS, PENDENTES, cenario, daCor };
