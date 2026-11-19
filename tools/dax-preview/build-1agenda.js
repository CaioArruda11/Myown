'use strict';
// ============================================================================
// Painel "Efetividade 1a agenda": prints + PAGINA UNICA (previa + codigo)
//
//   node tools/dax-preview/build-1agenda.js           -> grava em efetividade-1-agenda/
//   node tools/dax-preview/build-1agenda.js <pasta>   -> grava em outra pasta
//
// Passos: (1) parse + checagem de sintaxe de TODAS as medidas da pasta,
// (2) avaliacao do painel com os dados ficticios de mocks-1agenda.js,
// (3) checagem do HTML contra as regras do visual HTML Content, (4) as medidas
// do analitico, ordem a ordem, tem que dar os mesmos numeros do painel,
// (5) menu: botoes nas posicoes certas e nenhum nome cortado, (6) botoes
// clicaveis e tamanhos de referencia no Chromium, (7) prints e index.html.
// Qualquer erro interrompe a geracao.
// ============================================================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const dax = require('./dax.js');
const M = require('./mocks-1agenda.js');
const R = require('./render.js');
const { compat } = require('./compat.js');
const MENU_MOCKS = require('./mocks.js').menu;

const repo = path.resolve(__dirname, '../..');
const src = path.join(repo, 'efetividade-1-agenda');
const out = path.resolve(process.argv[2] || src);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dax-1agenda-'));
fs.mkdirSync(out, { recursive: true });

const ARQ = {
  apoio: 'medidas_de_apoio_1agenda_v1.txt',
  painel: 'painel_efetividade_1agenda_html_v1.txt',
  menu: 'menu_lateral_instalacao_html_v2.txt',
  barra: 'barra_filtros_1agenda_html_v1.txt',
  barraAn: 'barra_filtros_analitico_1agenda_html_v1.txt',
  analitico: 'analitico_1agenda_v1.txt',
};
const caminho = (k) => path.join(src, ARQ[k]);
const ler = (k) => fs.readFileSync(caminho(k), 'utf8').replace(/\s+$/, '') + '\n';
const numBR = (t) => (t === '·' || t === '—' || t === '' ? 0 : Number(String(t).replace(/\./g, '').replace(',', '.')));

// ------------------------------------------------------------ 1. arquivos com varias medidas
// Cada medida comeca em uma linha "Nome =". O comentario logo acima vai junto.
function medidasDoArquivo(k) {
  const txt = fs.readFileSync(caminho(k), 'utf8');
  const linhas = txt.split('\n');
  const ini = [];
  linhas.forEach((l, i) => { if (/^[^\s/].*=\s*$/.test(l)) ini.push(i); });
  const volta = (f) => { while (f > 0 && /^\/\//.test(linhas[f - 1])) f--; return f; };
  return ini.map((a, j) => {
    const fim = j + 1 < ini.length ? volta(ini[j + 1]) : linhas.length;
    const corpo = linhas.slice(a, fim).join('\n').trim();
    const ast = dax.parse(dax.stripMeasureName(corpo + '\n'));
    const chk = dax.check(ast, corpo);
    const nome = linhas[a].replace(/=\s*$/, '').trim();
    if (chk.problems.length) throw new Error(ARQ[k] + ' / ' + nome + ': ' + chk.problems.join('; '));
    const arquivo = path.join(tmp, k + '-' + j + '.txt');
    fs.writeFileSync(arquivo, corpo + '\n');
    return { nome, nota: linhas.slice(volta(a), a).join('\n'), corpo, arquivo };
  });
}
const apoio = medidasDoArquivo('apoio');
console.log('apoio      : sintaxe ok | ' + apoio.map((m) => m.nome).join(', '));
const analitico = medidasDoArquivo('analitico');
const AN = Object.fromEntries(analitico.map((m) => [m.nome, m]));
console.log('analítico  : sintaxe ok | ' + analitico.map((m) => m.nome).join(', '));

// ------------------------------------------------------------ menu lateral (6 paginas)
const PAGINAS = ['INSTALAÇÃO 3D', 'CHEGADA NO SLOT', 'ROTEIRIZAÇÃO', 'TMR', 'EFETIVIDADE 1 AGENDA', 'ANALÍTICO 1 AGENDA'];
function menuDaPagina(pg) {
  const txt = fs.readFileSync(caminho('menu'), 'utf8');
  if (!txt.includes('VAR _paginaAtual =\n    "INSTALAÇÃO 3D"\n')) throw new Error('menu: _paginaAtual mudou de formato');
  const f = path.join(tmp, 'menu-' + PAGINAS.indexOf(pg) + '.txt');
  fs.writeFileSync(f, txt.replace('VAR _paginaAtual =\n    "INSTALAÇÃO 3D"\n', 'VAR _paginaAtual =\n    ' + JSON.stringify(pg) + '\n'));
  const r = dax.evaluate(f, MENU_MOCKS.geral, { utcNow: M.UTC_NOW });
  const c = compat(r.html, { estrito: true });
  if (r.unusedMocks.length || c.problems.length) throw new Error('menu: ' + r.unusedMocks.concat(c.problems).join('; '));
  if ((r.html.match(/class='it[^']* on'/g) || []).length !== 1) throw new Error('menu: pagina atual nao marcada (' + pg + ')');
  return r.html;
}
const MENUS = Object.fromEntries(PAGINAS.map((p) => [p, menuDaPagina(p)]));
console.log('menu v2    : sintaxe ok | 6 páginas, uma marcada em cada | HTML ' + MENUS['EFETIVIDADE 1 AGENDA'].length);

function barra(k) {
  const r = dax.evaluate(caminho(k), {}, { utcNow: M.UTC_NOW });
  const c = compat(r.html, { estrito: true });
  if (c.problems.length) throw new Error(ARQ[k] + ': ' + c.problems.join('; '));
  return r.html;
}
const BARRA = barra('barra');
const BARRA_AN = barra('barraAn');
console.log('barras     : sintaxe ok | painel ' + BARRA.length + ' | analítico ' + BARRA_AN.length);

// ------------------------------------------------------------ 2 e 3. painel
let primeiro = true;
function painel(cen) {
  const r = dax.evaluate(caminho('painel'), M.cenario(cen), { utcNow: M.UTC_NOW });
  if (r.unusedMocks.length) throw new Error('mocks sem VAR correspondente: ' + r.unusedMocks.join(', '));
  const c = compat(r.html, { estrito: true });
  if (c.problems.length) throw new Error('HTML fora das regras do HTML Content:\n  ' + [...new Set(c.problems)].join('\n  '));
  if (primeiro) {
    primeiro = false;
    console.log('painel     : sintaxe ok | medida ' + r.sourceChars + ' caracteres -> HTML ' + r.html.length + ' | tags: ' + c.tags.join(' '));
  }
  return r.html;
}

const CEN = [
  { id: 'geral', rotulo: 'Geral · nov/26', nota: 'Sem filtro de cor ou AT, mês em andamento. O lado direito aparece como fica depois de ligar as colunas Ordem e PON.', cen: {}, pg: { mes: 'Novembro/2026' } },
  { id: 'bronze', rotulo: 'Cor BRONZE', nota: 'Filtro de cor: a curva vira a da cor e as duas metades mostram só as ATs dela.', cen: { ats: M.daCor('BRONZE') }, pg: { mes: 'Novembro/2026', cor: 'BRONZE' } },
  { id: 'at', rotulo: 'AT MA · carga de ontem', nota: 'Uma AT selecionada. No topo direito, o aviso de que a carga do backlog é de ontem (coluna DATA_CARGA).', cen: { ats: ['MA'], carga: M.HOJE - 1 + 9.4 / 24 }, pg: { mes: 'Novembro/2026', at: 'MA' } },
  { id: 'out', rotulo: 'Mês fechado · out/26', nota: 'Trocar o mês muda só o lado esquerdo. O lado direito continua no dia de hoje, e a conta “salvando / perdendo” continua sendo a do mês atual.', cen: { fimSel: dax.serial(2026, 10, 31) }, pg: { mes: 'Outubro/2026' } },
  { id: 'cola', rotulo: 'Como vem ao colar', nota: 'Ordem e PON vêm como BLANK() na VAR _backlogModelo: os números já aparecem, e a lista avisa que falta ligar as duas colunas.', cen: { semNumero: true }, pg: { mes: 'Novembro/2026' } },
  { id: 'atnb', rotulo: 'AT do backlog não bate', nota: 'Se a coluna escolhida para a AT não tiver as mesmas siglas da dAT[AREA ], o lado direito diz isso em vez de mostrar zeros.', cen: { atNaoBate: true }, pg: { mes: 'Novembro/2026' } },
];
for (const c of CEN) {
  c.html = painel(c.cen);
  c.pagina = R.composeCorpo(c.html, Object.assign({ titulo: 'Efetividade 1ª agenda', nome: 'e1', title: 'Efetividade 1ª agenda · ' + c.rotulo }, c.pg));
}
// estados extremos: precisam avaliar e passar nas regras, mesmo sem print
painel({ semDados: true, semBacklog: true });
painel({ semBacklog: true });
painel({ semAgenda: true });
painel({ ats: ['PL'], carga: null });
painel({ fimSel: null });
painel({ fimSel: dax.serial(2026, 1, 31) });
painel({ ats: ['PL', 'SA', 'BS', 'MA'] });

// ------------------------------------------------------------ 4. analitico x painel
function avalia(nome, mocks) {
  const r = dax.evaluate(AN[nome].arquivo, mocks, { utcNow: M.UTC_NOW });
  if (r.unusedMocks.length) throw new Error(nome + ': mocks sem VAR ' + r.unusedMocks.join(','));
  return r.html;
}
function ordemNoAnalitico(b, atsFiltro, selecao) {
  const dias = avalia('1AG Dias até a 1ª Agenda', { _agenda: b.Agenda });
  const diasN = dias === '' ? null : Number(dias);
  const sit = avalia('1AG Situação', { _umaOrdem: true, _dias: diasN });
  const campo = avalia('1AG Situação em Campo', { _umaOrdem: true, _st: b.Campo });
  const agd = avalia('1AG Agendamento', { _umaOrdem: true, _st: b.StOf });
  const tres = { _sit: sit, _campo: campo, _agd: agd };
  return {
    b, dias: diasN, sit, campo, agd,
    pri: Number(avalia('1AG Prioridade', tres)),
    acao: avalia('1AG Ação', tres),
    fundo: avalia('1AG Cor Fundo', { _sit: sit }),
    texto: avalia('1AG Cor Texto', { _sit: sit }),
    filtro: Number(avalia('1AG No Filtro', {
      _sit: sit, _temSelecao: !!selecao, _selecao: (selecao || []).map((s) => ({ 'Situação 1AG': s })),
      _at: b.AT, _atsFiltro: atsFiltro.map((a) => ({ 'AREA ': a })),
    })),
  };
}
// linha de total: tudo vazio
if (avalia('1AG Situação', { _umaOrdem: false, _dias: 3 }) !== '' || avalia('1AG Situação em Campo', { _umaOrdem: false, _st: '' }) !== '' ||
  avalia('1AG Agendamento', { _umaOrdem: false, _st: 'AGENDADO' }) !== '' || avalia('1AG Prioridade', { _sit: null, _campo: null, _agd: null }) !== '') {
  throw new Error('analítico: a linha de total deveria ficar vazia');
}
const situacoesSeletor = (AN['Seletor Situacao 1AG'].corpo.match(/\{ "([^"]+)", \d+ \}/g) || []).map((s) => s.match(/"([^"]+)"/)[1]);

// numeros que o painel mostra (lidos do HTML gerado)
function numerosDoPainel(html) {
  const st = {};
  for (const m of html.matchAll(/<div class='st[^']*'[^>]*><small>(?:<i><\/i>)?([^<]+)<\/small><b>([^<]+)<\/b><em>([^<]*)<\/em><\/div>/g)) st[m[1]] = { v: numBR(m[2]), em: m[3] };
  const vg = {};
  for (const m of html.matchAll(/<div class='vg (t[A-Z])[^']*'[^>]*><small><i><\/i>([^<]+)<\/small><b>([^<]+)<\/b>/g)) vg[m[2]] = numBR(m[3]);
  const at = {};
  const re = /<div class='qr ([^']*)'><span class='qn'><i class='cd'><\/i><b>([^<]+)<\/b><\/span><b>([^<]+)<\/b><span class='qf[^']*'>([^<]+)<\/span><span class='qh'>([^<]+)<\/span><span class='qk[^']*'>([^<]+)<\/span><span class='qa'>([^<]+)<\/span><span class='qk[^']*'>([^<]+)<\/span><\/div>/g;
  for (const m of html.matchAll(re)) at[m[2]] = [3, 4, 5, 6, 7, 8].map((i) => numBR(m[i]));
  const abas = [...html.matchAll(/<span class='o (t[A-Z])'><i><\/i>([^<]+)<b>([^<]+)<\/b><\/span>/g)].map((m) => [m[2], numBR(m[3])]);
  return { st, vg, at, abas };
}
function confere(rotulo, cen, atsFiltro) {
  const rows = M.cenario(cen)._backlogModelo.map((b) => ordemNoAnalitico(b, atsFiltro));
  const no = rows.filter((r) => r.filtro === 1);
  const q = (f) => no.filter(f).length;
  const esperado = {
    carteira: no.length, salvar: q((r) => ['Vence hoje', 'Vence amanhã', 'No prazo'].includes(r.sit)), perdidas: q((r) => r.sit === 'Perdida'),
    hoje: q((r) => r.sit === 'Vence hoje'), amanha: q((r) => r.sit === 'Vence amanhã'),
    semAgenda: q((r) => r.sit === 'Sem 1ª agenda'), foraHoje: q((r) => r.sit === 'Vence hoje' && r.campo === 'Fora de campo'),
    amanhaSem: q((r) => r.sit === 'Vence amanhã' && r.agd === 'Sem agendar'), perdCampo: q((r) => r.sit === 'Perdida' && r.campo !== 'Fora de campo'),
  };
  const html = painel(cen);
  const p = numerosDoPainel(html);
  const lido = {
    carteira: p.st.Carteira.v, salvar: p.st['Salváveis'].v, perdidas: p.st.Perdidas.v, hoje: p.st['Vencem hoje'].v, amanha: p.st['Amanhã'].v,
    semAgenda: numBR((p.st.Carteira.em.match(/^([\d.]+) sem 1ª agenda/) || [, '0'])[1]),
    foraHoje: numBR(p.st['Vencem hoje'].em.split(' ')[0]), amanhaSem: numBR(p.st['Amanhã'].em.split(' ')[0]),
    perdCampo: numBR((html.match(/Em campo hoje \(na ETA DIRECT D-0\): ([\d.]+)\./) || [, 'x'])[1]),
  };
  const dif = Object.keys(esperado).filter((k) => esperado[k] !== lido[k]);
  if (dif.length) throw new Error('analítico x painel (' + rotulo + '): ' + dif.map((k) => k + ' analítico ' + esperado[k] + ' / painel ' + lido[k]).join('; '));
  // vencem hoje x em campo
  const grupos = { 'Fora de campo': 'Fora de campo', Insucesso: 'Insucesso', 'Não iniciada': 'Não iniciada', 'Em execução': 'Em execução', 'Concluída': 'Concluída' };
  for (const [rot, campo] of Object.entries(grupos)) {
    const e = q((r) => r.sit === 'Vence hoje' && r.campo === campo);
    if (p.vg[rot] !== e) throw new Error('vencem hoje · ' + rot + ': analítico ' + e + ' / painel ' + p.vg[rot]);
  }
  // por AT: carteira, perdidas, hoje, fora de campo, amanha, sem agendar
  let nAT = 0;
  for (const [nome, v] of Object.entries(p.at)) {
    const daAT = no.filter((r) => r.b.AT === nome);
    if (!daAT.length && !M.ATS.find((a) => a[1] === nome)) continue;
    const linhasCor = M.ATS.filter((a) => a[1] === nome).map((a) => a[0]);
    const base = linhasCor.length ? no.filter((r) => linhasCor.includes(r.b.AT)) : daAT;
    const e = [base.length, base.filter((r) => r.sit === 'Perdida').length, base.filter((r) => r.sit === 'Vence hoje').length,
      base.filter((r) => r.sit === 'Vence hoje' && r.campo === 'Fora de campo').length, base.filter((r) => r.sit === 'Vence amanhã').length,
      base.filter((r) => r.sit === 'Vence amanhã' && r.agd === 'Sem agendar').length];
    if (e.join() !== v.join()) throw new Error('linha ' + nome + ' (' + rotulo + '): analítico ' + e.join('/') + ' / painel ' + v.join('/'));
    nAT++;
  }
  const abas = Object.fromEntries(p.abas);
  if (abas.Perdidas !== esperado.perdidas || abas['Vencem hoje'] !== esperado.hoje || abas['Amanhã'] !== esperado.amanha) throw new Error('abas da lista (' + rotulo + ') ' + JSON.stringify(abas));
  // as situacoes que a medida devolve sao as mesmas do seletor
  const sits = [...new Set(rows.map((r) => r.sit))].sort();
  if (sits.join('|') !== [...situacoesSeletor].sort().join('|')) throw new Error('seletor de situação x medida: ' + sits.join(', ') + ' / ' + situacoesSeletor.join(', '));
  console.log(('analítico = painel · ' + rotulo).padEnd(34) + ': ' + Object.entries(esperado).map(([k, v]) => k + ' ' + v).join(' | ') + ' | ' + nAT + ' linhas de cor/AT iguais');
  return rows;
}
const LINHAS_AN = confere('geral', {}, M.ATS.map((a) => a[0]));
confere('cor BRONZE', { ats: M.daCor('BRONZE') }, M.daCor('BRONZE'));
confere('AT MA', { ats: ['MA'] }, ['MA']);
// filtro pelo seletor de situacao
{
  const so = LINHAS_AN.map((r) => ordemNoAnalitico(r.b, M.ATS.map((a) => a[0]), ['Vence hoje'])).filter((r) => r.filtro === 1);
  if (!so.length || so.some((r) => r.sit !== 'Vence hoje')) throw new Error('seletor de situação não filtrou');
  const fora = LINHAS_AN.filter((r) => !M.ATS.find((a) => a[0] === r.b.AT));
  if (!fora.length || fora.some((r) => r.filtro !== 0)) throw new Error('ordens de outro cluster deveriam ficar fora');
  console.log('analítico · filtros           : seletor "Vence hoje" -> ' + so.length + ' ordens | ' + fora.length + ' ordens de ATs fora da dAT ficaram de fora');
}

// ------------------------------------------------------------ tabela nativa simulada (pagina do analitico)
const fmtData = (s) => { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(s * 86400000)); const p2 = (n) => String(n).padStart(2, '0'); return p2(d.getUTCDate()) + '/' + p2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); };
const capital = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');
function tabelaNativa(linhas, maxLinhas) {
  const ord = linhas.filter((r) => r.filtro === 1).sort((x, y) => x.pri - y.pri || (x.b.Agenda || 0) - (y.b.Agenda || 0) || (x.b.Ordem < y.b.Ordem ? -1 : 1));
  const cols = ['Prior.', 'Ordem', 'PON', 'AT', 'Situação', 'Dias', '1ª agenda', 'Em campo hoje', 'ETA D-0 Status', 'STATUS_OFICIAL', 'Ação'];
  const td = (v, cls, st) => '<td' + (cls ? ' class="' + cls + '"' : '') + (st ? ' style="' + st + '"' : '') + '>' + v + '</td>';
  // amostra para o print: as primeiras de cada prioridade (na tabela real aparecem todas, na mesma ordem)
  const vistos = {};
  const amostra = ord.filter((r) => { vistos[r.pri] = (vistos[r.pri] || 0) + 1; return vistos[r.pri] <= 2; }).slice(0, maxLinhas);
  const corpo = amostra.map((r) => '<tr>' +
    td(r.pri, 'n') + td(r.b.Ordem) + td(r.b.PON) + td(r.b.AT) +
    td(r.sit, 'sit', 'background:' + r.fundo + ';color:' + r.texto) + td(r.dias === null ? '' : r.dias, 'n') +
    td(r.b.Agenda === null ? '' : fmtData(r.b.Agenda)) + td(r.campo) + td(capital(r.b.Campo)) + td(r.b.StOf) + td(r.acao) + '</tr>').join('');
  return {
    total: ord.length,
    html: '<div class="pbi"><div class="pbi-h"><span>⋯</span></div><table><thead><tr>' + cols.map((c, i) => '<th' + (i === 0 || i === 5 ? ' class="n"' : '') + '>' + c + (i === 0 ? ' ▲' : '') + '</th>').join('') + '</tr></thead><tbody>' + corpo + '</tbody></table>' +
      '<p class="pbi-n">Tabela nativa simulada. Amostra com 2 ordens de cada prioridade; na página aparecem as ' + ord.length.toLocaleString('pt-BR') + ' ordens do filtro, nesta mesma ordem.</p></div>',
  };
}
const CSS_NATIVO = '.pbi{position:absolute;inset:0;padding:10px 12px 0;border-radius:16px;background:#fff;box-shadow:0 1px 2px rgba(11,21,51,.04),0 6px 16px rgba(11,21,51,.05);font-family:"Segoe UI",Arial,sans-serif;overflow:hidden}' +
  '.pbi-h{position:absolute;right:12px;top:4px;color:#475467;font-size:16px;letter-spacing:1px}' +
  '.pbi table{width:100%;border-collapse:collapse;font-size:10.5px;color:#252423;white-space:nowrap}' +
  '.pbi th{padding:6px 6px;border-bottom:1px solid #8A8886;text-align:left;font-weight:700;color:#252423}' +
  '.pbi td{padding:3px 6px;height:22px;border-bottom:1px solid #EDEBE9}' +
  '.pbi .n{text-align:right}.pbi td.sit{font-weight:700}' +
  '.pbi-n{position:absolute;left:0;right:0;bottom:0;margin:0;padding:8px 14px;background:linear-gradient(180deg,rgba(255,255,255,0),#fff 40%);color:#63708B;font-size:11px}';

// ------------------------------------------------------------ 5, 6 e 7. prints + checagens
const jobs = [];
const noFrame = (nome, fn) => async (p) => { const fr = p.frames().find((f) => f.name() === nome); await fn(fr, p); await p.waitForTimeout(450); };
const arq = (nome, html) => { const f = path.join(tmp, nome + '.html'); fs.writeFileSync(f, html); return f; };
function print(nome, c, before) {
  jobs.push({ file: arq(nome, c.pagina), out: path.join(out, nome + '.png'), w: 1280, h: 720, scale: 2, before: before && noFrame('e1', before) });
}
const [GERAL, BRONZE, AT, OUT, COLA, ATNB] = CEN;
print('1-visao-geral', GERAL);
print('2-aba-amanha-sem-agendar', GERAL, async (f) => { await f.click('.c2 summary'); });
print('3-cor-BRONZE-aba-perdidas', BRONZE, async (f) => { await f.click('.c1 summary'); });
print('4-curva-semanal-e-destaque-da-cor', GERAL, async (f) => { await f.click('.b1 summary'); await f.hover('.hc .c-prata2'); });
print('5-AT-selecionada-carga-de-ontem', AT);
print('6-mes-fechado-o-lado-direito-nao-muda', OUT, async (f) => { await f.click('.b2 summary'); await f.locator('.v-dia .pt').nth(14).hover(); });
jobs.push({
  file: arq('com-menu', R.composeMenuBarra(MENUS['EFETIVIDADE 1 AGENDA'], BARRA, { html: GERAL.html }, { title: 'Efetividade 1ª agenda · com menu', nome: 'e1' })),
  out: path.join(out, '7-com-o-menu-lateral.png'), w: 1280, h: 720, scale: 2,
});
const TAB = tabelaNativa(LINHAS_AN, 24);
jobs.push({
  file: arq('analitico', R.composeMenuBarra(MENUS['ANALÍTICO 1 AGENDA'], BARRA_AN, { nativo: TAB.html }, { title: 'Analítico 1ª agenda', valores: ['Todos', 'Todos', 'Todos'], cssNativo: CSS_NATIVO })),
  out: path.join(out, '8-analitico-tabela-para-baixar.png'), w: 1280, h: 720, scale: 2,
});
print('9-como-vem-ao-colar', COLA);
print('10-AT-do-backlog-nao-bate', ATNB);

// posicao dos botoes nativos sobre o menu
{
  const topos = PAGINAS.map((p, i) => [p, 109 + 43 * i]);
  const caixas = topos.map(([p, t], i) => '<div class="bn" style="top:' + (10 + t) + 'px"></div><div class="rt" style="top:' + (10 + t) + 'px"><b>' + (i + 1) + '</b>' + p + '<small>topo ' + t + ' px' + (i >= 4 ? ' · novo' : '') + '</small></div>').join('');
  const pag = '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#E9EEF6;font-family:"Segoe UI",Arial,sans-serif}' +
    '.pg{position:relative;width:560px;height:720px}iframe{position:absolute;left:20px;top:10px;width:200px;height:700px;border:0}' +
    '.bn{position:absolute;left:34px;width:172px;height:36px;box-sizing:border-box;border:1.5px dashed #F97316;border-radius:11px}' +
    '.rt{position:absolute;left:240px;height:36px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#0B1533;white-space:nowrap}' +
    '.rt b{width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:#F97316;color:#fff;font-size:11px}' +
    '.rt small{margin-left:6px;color:#63708B;font-weight:500}.nt{position:absolute;left:240px;top:400px;width:300px;color:#3F4C6B;font-size:12px;line-height:1.5}' +
    '</style></head><body><div class="pg"><iframe srcdoc="' + R.wrap(MENUS['EFETIVIDADE 1 AGENDA']).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></iframe>' + caixas +
    '<div class="nt"><b>Botões nativos</b> transparentes por cima do menu: 172 × 36 px, a 14 px da borda esquerda do visual, um a cada 43 px. Os quatro primeiros não mudam de lugar; os dois últimos são novos.</div></div></body></html>';
  jobs.push({
    file: arq('botoes', pag), out: path.join(out, '11-menu-posicao-dos-botoes.png'), w: 560, h: 720, scale: 2,
    before: async (p) => {
      const fr = p.frames().find((f) => f !== p.mainFrame());
      const r = await fr.evaluate(() => [...document.querySelectorAll('.it')].map((e) => {
        const b = e.getBoundingClientRect();
        const cortado = [...e.querySelectorAll('.lb, .lb b, .lb small')].some((l) => l.scrollWidth > l.clientWidth + 1);
        return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height), cortado];
      }));
      const ok = r.every((x, i) => x[0] === 14 && x[1] === 109 + 43 * i && x[2] === 172 && x[3] === 36 && !x[4]);
      console.log('menu 200x700                  : ' + r.map((x) => x[1]).join(' / ') + ' px | 172x36 a 14 px da borda | nomes cortados = ' + r.filter((x) => x[4]).length);
      if (!ok) throw new Error('menu: itens fora da geometria dos botoes nativos ' + JSON.stringify(r));
    },
  });
}

// tamanho de referencia e visual estreito: tudo cabe, nada cortado, botoes levam para a visao certa
const SEL_CORTE = '.kv b,.chip,.ks,.kc,.kp small,.kp b,.kd,.cr>*,.st small,.st b,.st em,.dk>*,.ins,.rl,.c,.ac,.xl,.vhh>b,.vg small,.vg b,.qr>*,.seg .o,.oh span,.on,.op,.oa,.od';
async function medir(p, rotulo) {
  const o = await p.evaluate((sel) => {
    const vis = (e) => getComputedStyle(e).display !== 'none';
    const view = [...document.querySelectorAll('.view')].find(vis);
    const mx = view.querySelector('.mx');
    const visivel = (e) => e.offsetParent && vis(e);
    const cut = [...document.querySelectorAll(sel)].filter((e) => visivel(e) && e.scrollWidth > e.clientWidth + 1);
    const cabCut = [...document.querySelectorAll('.qh0 span')].filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1);
    const lv = [...document.querySelectorAll('.lv')].find(vis);
    const chips = [...lv.querySelectorAll('.os')];
    const proj = document.querySelector('.vhh span');
    return {
      linhas: view.querySelectorAll('.rw').length, semRolagem: mx.scrollHeight <= mx.clientHeight,
      grafico: Math.round(view.querySelector('.plot').getBoundingClientRect().height),
      cortados: cut.length + cabCut.length, exemplo: cut.concat(cabCut).slice(0, 4).map((e) => e.className + ':' + e.textContent.slice(0, 22)),
      ordens: (() => { const b = lv.getBoundingClientRect(); return [...lv.querySelectorAll('.or')].filter((r) => r.getBoundingClientRect().bottom <= b.bottom).length; })(),
      chips: chips.length, chipsCortados: chips.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent),
      projecao: proj ? (proj.scrollWidth > proj.clientWidth + 1 ? 'cortada' : 'inteira') : '-',
    };
  }, SEL_CORTE);
  console.log(rotulo.padEnd(30) + ': ' + o.linhas + ' linhas sem rolagem = ' + o.semRolagem + ' | gráfico ' + o.grafico + 'px | ordens visíveis ' + o.ordens +
    ' | textos cortados = ' + o.cortados + (o.cortados ? ' ' + JSON.stringify(o.exemplo) : '') + ' | projeção ' + o.projecao +
    ' | situações cortadas ' + o.chipsCortados.length + '/' + o.chips + (o.chipsCortados.length ? ' ' + JSON.stringify([...new Set(o.chipsCortados)].slice(0, 3)) : ''));
  if (!o.semRolagem || o.cortados) throw new Error('layout fora do tamanho de referencia (' + rotulo + ')');
  return o;
}
for (const [w, h] of [[1264, 638], [1032, 630]]) {
  jobs.push({
    // escala 2, como nos prints: o texto fica um pouco mais largo que na escala 1
    file: arq('ref-' + w, R.wrap(GERAL.html)), w, h, scale: 2,
    before: async (p) => {
      for (const [nome, clique] of [['Mês', null], ['Semana', '.b1 summary'], ['Dia', '.b2 summary']]) {
        if (clique) { await p.click(clique); await p.waitForTimeout(200); }
        await medir(p, 'painel ' + w + 'x' + h + ' · ' + nome);
      }
      // abas da lista: clica na posicao do botao (0 = Perdidas, 2 = Amanha), como o usuario
      for (const [nome, pos] of [['Amanhã', 2], ['Perdidas', 0]]) {
        await p.evaluate(([s, a]) => {
          const box = document.querySelector(s).getBoundingClientRect();
          const wd = (box.width - 4) / 3;
          const el = document.elementFromPoint(box.left + 2 + wd * (a + 0.5), box.top + box.height / 2);
          if (el && el.tagName === 'SUMMARY') el.click();
        }, ['.sl', pos]);
        await p.waitForTimeout(200);
        await medir(p, 'painel ' + w + 'x' + h + ' · lista ' + nome);
      }
      if (w !== 1264) return;
      await p.reload(); await p.waitForTimeout(500);
      // Botoes: de qualquer estado, o clique em cada botao tem que mostrar a visao daquele botao.
      for (const [seg, views] of [['.sg', ['.v-mes', '.v-sem', '.v-dia']], ['.sl', ['.l-p', '.l-h', '.l-a']]]) {
        let n = 0;
        for (const alvo of [1, 2, 0, 2, 1, 0, 1, 0, 2, 0, 1, 2, 1, 2, 0, 2, 0, 1, 0, 2, 2, 1, 1, 0]) {
          const r = await p.evaluate(([s, vs, a]) => {
            const box = document.querySelector(s).getBoundingClientRect();
            const wd = (box.width - 4) / 3;
            const el = document.elementFromPoint(box.left + 2 + wd * (a + 0.5), box.top + box.height / 2);
            const antes = vs.findIndex((v) => getComputedStyle(document.querySelector(v)).display !== 'none');
            if (el && el.tagName === 'SUMMARY') el.click();
            const depois = vs.findIndex((v) => getComputedStyle(document.querySelector(v)).display !== 'none');
            const visiveis = vs.filter((v) => getComputedStyle(document.querySelector(v)).display !== 'none').length;
            return { antes, depois, visiveis, clicou: !!(el && el.tagName === 'SUMMARY') };
          }, [seg, views, alvo]);
          if (r.visiveis !== 1 || r.depois !== alvo || (r.antes !== alvo && !r.clicou)) throw new Error('botoes ' + seg + ': clique em ' + alvo + ' -> ' + JSON.stringify(r));
          n++;
        }
        console.log(('botões ' + seg).padEnd(30) + ': ' + n + ' cliques em sequência, sempre na visão do botão clicado');
      }
    },
  });
}

// ------------------------------------------------------------ pagina unica
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Realce simples de DAX: comentarios, textos, numeros, VAR/RETURN, funcoes e [colunas]. */
function realce(codigo) {
  let o = '';
  let i = 0;
  const n = codigo.length;
  const span = (cls, txt) => '<span class="' + cls + '">' + escHtml(txt) + '</span>';
  while (i < n) {
    const c = codigo[i];
    if ((i === 0 || codigo[i - 1] === '\n') && /[^\s/]/.test(c)) {
      let j = codigo.indexOf('\n', i); if (j < 0) j = n;
      const linha = codigo.slice(i, j);
      if (/^(?!VAR\b|RETURN\b)[^"'()\[\]]+=\s*$/.test(linha)) { o += span('k-nm', linha); i = j; continue; }
    }
    if (c === '/' && codigo[i + 1] === '/') { let j = codigo.indexOf('\n', i); if (j < 0) j = n; o += span('k-c', codigo.slice(i, j)); i = j; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < n) { if (codigo[j] === '"') { if (codigo[j + 1] === '"') { j += 2; continue; } break; } j++; }
      o += span('k-s', codigo.slice(i, j + 1)); i = j + 1; continue;
    }
    if (c === '[') { const j = codigo.indexOf(']', i); o += span('k-m', codigo.slice(i, j + 1)); i = j + 1; continue; }
    if (c === "'") { const j = codigo.indexOf("'", i + 1); o += span('k-t', codigo.slice(i, j + 1)); i = j + 1; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_.]/.test(codigo[j])) j++;
      const w = codigo.slice(i, j);
      let k = j;
      while (k < n && codigo[k] === ' ') k++;
      if (w === 'VAR' || w === 'RETURN') o += span('k-k', w);
      else if (codigo[k] === '(' && w === w.toUpperCase()) o += span('k-f', w);
      else if (w[0] === '_') o += span('k-v', w);
      else o += escHtml(w);
      i = j; continue;
    }
    if (/[0-9]/.test(c)) { let j = i; while (j < n && /[0-9.]/.test(codigo[j])) j++; o += span('k-n', codigo.slice(i, j)); i = j; continue; }
    o += escHtml(c); i++;
  }
  return o;
}
const PRINTS = jobs.filter((j) => j.out).map((j) => path.basename(j.out, '.png'));
const principalTxt = ler('painel');
const linhasPrincipal = principalTxt.split('\n').length - 1;
const json = (x) => JSON.stringify(x).replace(/</g, '\\u003c');
const bloco = (id, titulo, sub, codigo, aberto) =>
  '<div class="code" id="' + id + '"><div class="code-h"><div><b>' + titulo + '</b><small>' + sub + '</small></div>' +
  '<button class="cp" data-alvo="' + id + '-pre">Copiar</button></div>' +
  '<pre id="' + id + '-pre"' + (aberto ? '' : ' class="alto"') + '><code>' + realce(codigo) + '</code></pre></div>';
const img = (n, alt) => '<img src="' + encodeURI(n) + '.png" alt="' + alt + '" loading="lazy">';
const tbAnalitico = analitico.map((m, i) => '<tr><td>' + escHtml(m.nome) + '</td><td>' + (i === 0 ? 'tabela (Modelagem › Nova tabela)' : 'medida') + '</td></tr>').join('');

const pagina = fs.readFileSync(path.join(__dirname, 'pagina-1agenda.html'), 'utf8')
  .replace('%%LINHAS%%', () => String(linhasPrincipal))
  .replace('%%PILLS%%', () => CEN.map((c, i) => '<button data-i="' + i + '" aria-pressed="' + (i === 0) + '">' + c.rotulo + '</button>').join(''))
  .replace('%%PRINTS%%', () => PRINTS.map((n, i) => '<a href="' + encodeURI(n) + '.png" target="_blank" rel="noopener">' + (i + 1) + '</a>').join(''))
  .replace('%%IMG_MENU%%', () => img('7-com-o-menu-lateral', 'Painel ao lado do menu lateral'))
  .replace('%%IMG_BOTOES%%', () => img('11-menu-posicao-dos-botoes', 'Posição dos botões nativos sobre o menu'))
  .replace('%%IMG_ANALITICO%%', () => img('8-analitico-tabela-para-baixar', 'Página do analítico com a tabela nativa'))
  .replace('%%TB_ANALITICO%%', () => tbAnalitico)
  .replace('%%CODIGO%%', () => [
    ...apoio.map((m, i) => bloco('m' + i, (i + 1) + ' · ' + m.nome, i === 0 ? 'medida de apoio · numerador da sua % 1_AGENDA' : i === 1 ? 'medida de apoio · denominador da sua % 1_AGENDA' : 'opcional · a sua medida reescrita com DIVIDE', (m.nota ? m.nota + '\n' : '') + m.corpo + '\n', true)),
    bloco('mp', '4 · Painel Efetividade 1 Agenda HTML', 'medida principal · ' + linhasPrincipal + ' linhas · vai no visual HTML Content', principalTxt, false),
    bloco('mn', '5 · Menu Lateral Instalacao HTML (v2)', 'cole nas 6 páginas e troque só _paginaAtual · substitui o v1', ler('menu'), false),
    bloco('bf', '6 · Barra Filtros 1 Agenda HTML', 'página do painel · 62 px de altura, por baixo das segmentações nativas', ler('barra'), false),
    bloco('ba', '7 · Barra Filtros Analitico 1 Agenda HTML', 'página do analítico · mesma barra, com a dica de como baixar', ler('barraAn'), false),
    bloco('an', '8 · Analítico: tabela do seletor + medidas 1AG', 'uma tabela e ' + (analitico.length - 1) + ' medidas · cole cada uma separadamente', ler('analitico'), false),
  ].join('\n  '))
  .replace('%%CENARIOS%%', () => json(CEN.map((c) => ({ nota: c.nota, html: c.pagina }))));
if (/%%[A-Z_]+%%/.test(pagina)) throw new Error('index.html: marcador sem trocar ' + pagina.match(/%%[A-Z_]+%%/)[0]);
fs.writeFileSync(path.join(out, 'index.html'), pagina);
console.log('página     : index.html com ' + CEN.length + ' cenários + ' + (apoio.length + analitico.length + 4) + ' blocos de código | ' + Math.round(pagina.length / 1024) + ' KB | tabela do analítico: ' + TAB.total + ' ordens no filtro');

// a propria pagina: prova que abre, escala a previa e troca de cenario
jobs.push({
  file: path.join(out, 'index.html'), w: 1360, h: 900, scale: 1, wait: 1500,
  before: async (p) => {
    const erros = [];
    p.on('pageerror', (e) => erros.push(String(e)));
    const temPainel = async () => { const f = p.frames().find((x) => x.name() === 'e1'); return !!f && (await f.locator('.e1 .hero').count()) === 2; };
    const a = await temPainel();
    await p.click('#pills button:nth-child(4)');
    await p.waitForTimeout(1200);
    const b = await temPainel();
    const k = await p.evaluate(() => document.getElementById('quadro').style.transform);
    const imgs = await p.evaluate(() => [...document.images].map((i) => decodeURI(i.getAttribute('src'))));
    const faltam = imgs.filter((n) => !fs.existsSync(path.join(out, n)));
    console.log('index.html                    : prévia carregada = ' + a + ' | troca de cenário = ' + b + ' | ' + k + ' | erros de script = ' + erros.length + ' | imagens ' + (imgs.length - faltam.length) + '/' + imgs.length + ' na pasta');
    if (!a || !b || erros.length || faltam.length) throw new Error('index.html nao abriu como esperado ' + erros.join(' | '));
  },
});

R.shots(jobs).then(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('arquivos gravados em ' + (path.relative(repo, out) || '.'));
}).catch((e) => { fs.rmSync(tmp, { recursive: true, force: true }); console.error('\nERRO: ' + e.message); process.exit(1); });
