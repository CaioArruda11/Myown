'use strict';
// ============================================================================
// Dados FICTICIOS do painel "Efetividade 1a agenda".
//
// Um "modelo de mentira" pequeno, no formato do arquivo real:
//   - dCalendario com todos os dias de 02/01/2026 a 03/03/2027;
//   - instalacoes baixadas por AT x dia: total ('f1AGENDA_TOTAL') e dentro da
//     1a agenda ('f1AGENDA_PRAZO');
//   - carteira de hoje ('BACKLOG_INSTALACAO'): ordens abertas com a data e a
//     hora da 1a agenda, o status na ETA DIRECT D-0 de hoje (em branco = fora
//     de campo) e o STATUS_OFICIAL.
// Tudo e gerado por sorteio com semente fixa, entao as previas saem sempre
// iguais. Os mocks tem o MESMO formato das VARs marcadas com "<<< MODELO" na
// medida; o resto da medida e avaliado de verdade. Os valores de
// STATUS_OFICIAL diferentes de AGENDADO sao inventados.
// ============================================================================
const { serial } = require('./dax.js');

// "hoje" das previas: quinta-feira, 19/11/2026 (12h em Brasilia = 15h UTC)
const HOJE = serial(2026, 11, 19);
const UTC_NOW = HOJE + 15 / 24;

// AT, cor, volume medio por dia util, taxa "de casa" de instalacao na 1a agenda
const ATS = [
  ['PL', 'OURO', 46, 0.80], ['SA', 'OURO', 38, 0.77], ['IT', 'OURO', 30, 0.72], ['BT', 'OURO', 27, 0.76],
  ['BS', 'PRATA 1', 41, 0.70], ['LA', 'PRATA 1', 26, 0.64], ['JS', 'PRATA 1', 22, 0.61],
  ['VJ', 'PRATA 2', 35, 0.66], ['VN', 'PRATA 2', 29, 0.62], ['CL', 'PRATA 2', 33, 0.58], ['FO', 'PRATA 2', 21, 0.65], ['CA', 'PRATA 2', 19, 0.55],
  ['JG', 'BRONZE', 44, 0.60], ['BF', 'BRONZE', 37, 0.56], ['MA', 'BRONZE', 31, 0.50], ['RP', 'BRONZE', 24, 0.58], ['PI', 'BRONZE', 18, 0.47],
];

function rng(seed) { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }
const DAY = 86400000;
const EPOCH = Date.UTC(1899, 11, 30);
const dt = (s) => new Date(EPOCH + Math.round(Math.floor(s)) * DAY);
const dow = (s) => dt(s).getUTCDay(); // 0 = domingo
const pick = (r, lista) => { let x = r(); for (const [v, p] of lista) { if (x < p) return v; x -= p; } return lista[lista.length - 1][0]; };

// ---------------------------------------------------------------- CALENDARIO
const CALENDARIO = [];
for (let d = serial(2026, 1, 2); d <= serial(2027, 3, 3); d++) CALENDARIO.push(d);
const DIAS_ATE_HOJE = CALENDARIO.filter((d) => d <= HOJE);

// Deslocamento da taxa de todas as ATs em cada mes de 2026 (jan a dez):
// comeca fraco, melhora no meio do ano e recua em novembro.
const GERAL_MES = [-0.07, -0.08, -0.05, -0.03, -0.01, 0.015, 0.035, 0.045, 0.03, 0.015, -0.012, 0];
const diaRuim = (d) => { const h = (d * 2654435761) % 97; return h < 6 ? -0.10 : h < 14 ? -0.045 : h > 88 ? 0.03 : 0; };

// ---------------------------------------------------------------- BAIXADAS
function gerarBaixadas() {
  const r = rng(20261119);
  const out = [];
  ATS.forEach(([at, cor, vol, taxa], k) => {
    for (const d of DIAS_ATE_HOJE) {
      const w = dow(d);
      const fator = w === 0 ? 0.12 : w === 6 ? 0.55 : 1;
      const mes = dt(d).getUTCMonth();
      const onda = GERAL_MES[mes] + 0.025 * Math.sin((mes + k * 1.7) / 1.9) + diaRuim(d);
      const parcial = d === HOJE ? 0.38 : 1;
      const total = Math.round(vol * fator * parcial * (0.78 + 0.44 * r()));
      if (total <= 0) { r(); continue; }
      // segunda-feira pior (fim de semana deixa agenda acumulada)
      const p = Math.max(0.15, Math.min(0.98, taxa + onda + (r() - 0.5) * 0.18 - (w === 1 ? 0.05 : 0)));
      out.push({ at, cor, dia: d, total, prazo: Math.min(total, Math.round(total * p)) });
    }
  });
  return out;
}
const BAIXADAS = gerarBaixadas();

// ----------------------------------------------------------------- BACKLOG
// Uma linha por ordem aberta. Dif = dias da 1a agenda ate hoje (negativo = ja
// passou). Quem tem taxa pior carrega mais ordem perdida e menos agendamento.
const PENDENCIAS = [['PENDENTE CLIENTE', 0.34], ['PENDENTE TÉCNICA', 0.26], ['AGUARDANDO AGENDAMENTO', 0.22], ['REAGENDAR', 0.14], ['', 0.04]];
const CAMPO_HOJE = [['CONCLUÍDA', 0.30], ['NÃO INICIADA', 0.27], ['EM ROTA', 0.14], ['INICIADA', 0.12], ['NÃO CONCLUÍDA', 0.09], ['SUSPENSA', 0.05], ['CANCELADA', 0.03]];
const CAMPO_PERDIDA = [['NÃO INICIADA', 0.40], ['EM ROTA', 0.16], ['INICIADA', 0.14], ['CONCLUÍDA', 0.20], ['NÃO CONCLUÍDA', 0.10]];
function gerarBacklog() {
  const r = rng(1119);
  const out = [];
  let seq = 8613000;
  const linha = (at, taxa, extra) => {
    const x = r();
    const perdida = 0.09 + (1 - taxa) * 0.30;
    let dif;
    if (x < 0.02) dif = null;
    else if (x < 0.02 + perdida) dif = -(1 + Math.floor(Math.pow(r(), 2.1) * 12));
    else if (x < 0.02 + perdida + 0.17) dif = 0;
    else if (x < 0.02 + perdida + 0.35) dif = 1;
    else dif = 2 + Math.floor(r() * 7);
    // hora da 1a agenda: manha 08:30, tarde 14:00; algumas no fim do periodo (12:00/18:00) e
    // algumas antigas sem hora (00:00), como aparece na coluna DATA_PRIMEIRA_AGENDA
    const hora = pick(r, [[8.5, 0.48], [14, 0.38], [12, 0.06], [18, 0.04], [0, 0.04]]);
    const agenda = dif === null ? null : HOJE + dif + hora / 24;
    let campo = '';
    if (dif === 0) { if (r() > 0.22 + (1 - taxa) * 0.28) campo = pick(r, CAMPO_HOJE); }
    else if (dif !== null && dif < 0) { if (r() < 0.30) campo = pick(r, CAMPO_PERDIDA); }
    else if (dif === 1) { if (r() < 0.04) campo = 'NÃO INICIADA'; }
    // de manha a ordem ja andou mais que a da tarde
    if (dif === 0 && hora === 14 && campo === 'CONCLUÍDA' && r() < 0.6) campo = 'NÃO INICIADA';
    let stof;
    if (dif === 1) stof = r() < 0.82 - (1 - taxa) * 0.45 ? 'AGENDADO' : pick(r, PENDENCIAS);
    else if (dif === 0) stof = r() < 0.9 ? 'AGENDADO' : 'PENDENTE TÉCNICA';
    else if (dif !== null && dif < 0) stof = r() < 0.2 ? 'AGENDADO' : pick(r, [['REAGENDAR', 0.4], ['PENDENTE CLIENTE', 0.32], ['PENDENTE TÉCNICA', 0.28]]);
    else stof = r() < 0.74 ? 'AGENDADO' : pick(r, PENDENCIAS);
    seq += 1 + Math.floor(r() * 23);
    out.push(Object.assign({ Ordem: 'SA-' + seq, PON: 'PON' + String(810000 + (seq % 97553)), AT: at, Agenda: agenda, Campo: campo, StOf: stof }, extra || {}));
  };
  ATS.forEach(([at, , vol, taxa]) => {
    const qtd = Math.round(vol * (1.55 + (1 - taxa) * 1.9));
    for (let i = 0; i < qtd; i++) linha(at, taxa);
  });
  // ordens de outro cluster (AT fora da dAT): a medida tem que ignorar
  for (let i = 0; i < 40; i++) linha(i % 2 ? 'ZX' : 'QW', 0.6);
  return out;
}
const BACKLOG = gerarBacklog();

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
  const fim = Math.max(mesFim, semRef + 6, HOJE);
  return { ini, fim, mesIni, mesFim };
}

/**
 * @param {object} o
 *   fimSel      ultima data do filtro de mes (serial) | null = sem filtro
 *   ats         siglas das ATs no filtro | null = todas
 *   carga       data da carga do backlog (serial) | padrao: hoje 07:10 | null = coluna nao ligada
 *   semNumero   true = Ordem e PON nao ligados (como a medida vem ao colar)
 *   semAgenda   true = DATA_PRIMEIRA_AGENDA vazia
 *   atNaoBate   true = a coluna AT do backlog tem outros nomes (nao bate com a dAT)
 *   semBacklog  true = backlog vazio
 *   semDados    true = nenhuma baixada na janela
 */
function cenario(o) {
  const opt = o || {};
  const fimSel = opt.fimSel === undefined ? serial(2026, 11, 30) : opt.fimSel;
  const j = janela(fimSel, 12, 12);
  const noFiltro = (at) => !opt.ats || opt.ats.includes(at);
  return {
    _fimSel: fimSel,
    // a grade ignora o filtro de cor/AT (REMOVEFILTERS( dAT )): traz todas as ATs
    _gradeModelo: opt.semDados ? [] : BAIXADAS.filter((x) => x.dia >= j.ini && x.dia <= j.fim)
      .map((x) => ({ 'AREA ': x.at, 'COR_AREA ': x.cor, Data: x.dia, '@n': x.prazo, '@d': x.total })),
    _atsCtx: ATS.filter((a) => noFiltro(a[0])).map((a) => ({ 'AREA ': a[0] })),
    _calModelo: CALENDARIO.filter((d) => d >= j.mesIni && d <= j.mesFim).map((d) => ({ Data: d })),
    // o backlog nao tem relacionamento com a dAT: vem inteiro e a medida filtra pela coluna AT
    _backlogModelo: opt.semBacklog ? [] : BACKLOG.map((b) => ({
      Ordem: opt.semNumero ? null : b.Ordem,
      PON: opt.semNumero ? null : b.PON,
      AT: opt.atNaoBate ? 'SPO-' + b.AT : b.AT,
      Agenda: opt.semAgenda ? null : b.Agenda,
      Campo: b.Campo,
      StOf: b.StOf,
    })),
    _dataCarga: opt.carga === undefined ? HOJE + 7.2 / 24 : opt.carga,
  };
}

const daCor = (cor) => ATS.filter((a) => a[1] === cor).map((a) => a[0]);

module.exports = { HOJE, UTC_NOW, ATS, CALENDARIO, BAIXADAS, BACKLOG, cenario, daCor };
