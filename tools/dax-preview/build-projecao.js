'use strict';
// ============================================================================
// Previas da pagina "Projeção BSC" (projecao e diagnostico) e do menu v8
//
//   node tools/dax-preview/build-projecao.js           -> grava em projecao-diagnostico-bsc/previas/
//   node tools/dax-preview/build-projecao.js <pasta>   -> grava em outra pasta
//
// Passos: (1) sintaxe das medidas, (2) avaliacao com os dados ficticios de
// mocks-projecao.js em todos os estados, (3) checagem contra as regras do
// HTML Content, (4) previa interativa: os seletores "nativos" sao simulados e
// a propria medida DAX e reavaliada no navegador a cada clique, (5) prints.
// ============================================================================
const fs = require('fs');
const path = require('path');
const dax = require('./dax.js');
const P = require('./mocks-projecao.js');
const M = require('./mocks.js');
const R = require('./render.js');
const { compat } = require('./compat.js');

const repo = path.resolve(__dirname, '../..');
const pasta = path.join(repo, 'projecao-diagnostico-bsc');
const out = path.resolve(process.argv[2] || path.join(pasta, 'previas'));
fs.mkdirSync(out, { recursive: true });

const CORPO = path.join(pasta, '2_medida_bsc_projecao_html.txt');
const MENU = path.join(pasta, '3_medida_menu_lateral_v8.txt');
const MENU_V7 = path.join(__dirname, 'ref', 'menu_lateral_html_v7.txt'); // menu recebido, para o antes x depois

const REAL = 'Atingimento real';
const ESPERADO = 'Atingimento esperado (meta)';

// ------------------------------------------------------------------ estados
const ESTADOS = {
  todos: {},
  soD3: { marcados: ['INSTALAÇÃO 3D'] },
  parcial: { marcados: P.CHAVES.filter((c) => !['INDISPONIBILIDADE FTTH', 'IRT', 'IFI 7 DIAS', 'TMR'].includes(c)) },
  real: { cenario: REAL },
  corAT: { cor: 'BRONZE', at: 'RP', marcados: ['INSTALAÇÃO 3D', '1 AGENDA', 'IRR 7 DIAS', 'EFICIÊNCIA DE CAMPO', 'TMR', 'INDISPONIBILIDADE FTTH'] },
  cor: { cor: 'OURO' },
  semDados: { dados: 'semDados' },
  bom: { dados: 'bom' },
  vazio: { dados: 'vazio' },
};

// ---------------------------------------------- (1)-(3) sintaxe e avaliacao
let primeiro = true;
function corpo(estado, tema) {
  const mk = P.mocksProjecao(estado);
  if (tema) mk._tema = tema;
  const r = dax.evaluate(CORPO, mk, {});
  if (r.unusedMocks.length) throw new Error('corpo: mocks sem VAR correspondente: ' + r.unusedMocks.join(', '));
  const c = compat(r.html);
  if (c.problems.length) throw new Error('corpo: HTML fora das regras do HTML Content:\n  ' + [...new Set(c.problems)].join('\n  '));
  if (primeiro) {
    primeiro = false;
    console.log('corpo  : sintaxe ok | medida ' + r.sourceChars + ' caracteres -> HTML ' + r.html.length + ' | tags: ' + c.tags.join(' '));
  }
  return r.html;
}
function menu(file, mocks) {
  const r = dax.evaluate(file, mocks, { utcNow: M.UTC_NOW });
  if (r.unusedMocks.length) throw new Error('menu: mocks sem VAR correspondente: ' + r.unusedMocks.join(', '));
  const c = compat(r.html);
  if (c.problems.length) throw new Error('menu: HTML fora das regras do HTML Content:\n  ' + [...new Set(c.problems)].join('\n  '));
  return r.html;
}
for (const [nome, e] of Object.entries(ESTADOS)) { corpo(e); process.stdout.write(nome + ' '); }
for (const tema of ['OCEANO', 'AURORA']) corpo(ESTADOS.todos, tema);
// todas as combinacoes de cor x AT x cenario (pega erro que so aparece em um filtro)
let combos = 0;
for (const cor of ['GERAL'].concat(P.CORES)) for (const at of [null].concat(P.ATS.map((a) => a[0]))) for (const cen of [REAL, ESPERADO]) for (const ating of [100, 80, 0]) { corpo({ cor, at, cenario: cen, ating }); combos++; }
corpo({ niveis: { 'INSTALAÇÃO 3D': 0, 'IRT': 100 }, ating: 50 });
for (const cor of ['GERAL'].concat(P.CORES)) for (const at of [null, 'RP', 'PL']) for (const semMesAnt of [false, true]) corpo({ cor, at, semMesAnt, niveis: { 'INSTALAÇÃO 3D': 70, 'IFI 7 DIAS': 'tudo' } });
console.log('\ncorpo  : ' + combos + ' combinacoes de cor x AT x cenario x % avaliadas sem erro');
for (const pg of ['BSC', 'Projeção BSC', 'IFI', 'Abertura Hierarquia']) menu(MENU, Object.assign(P.mocksMenu({}), { _paginaAtual: pg }));
console.log('menu   : sintaxe ok');

// -------------------------------------------------- (4) previa interativa
// Posicoes na pagina 1280 x 720 (as do print: menu a esquerda, filtros no topo)
const L = {
  page: { w: 1280, h: 720 },
  menu: { x: 20, y: 6, w: 238, h: 700 },
  cor: { x: 264, y: 6, w: 331, h: 114 },
  at: { x: 601, y: 6, w: 90, h: 114 },
  mes: { x: 697, y: 6, w: 98, h: 114 },
  cen: { x: 801, y: 6, w: 165, h: 114 },
  niv: { x: 972, y: 6, w: 290, h: 114 },
  corpo: { x: 275, y: 130, w: 987, h: 576 },
};
const box = (r) => 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px';
const embed = (v) => JSON.stringify(v).replace(/<\//g, '<\\/');
const cjs = (file) => '(function(){var module={exports:{}};var require=function(){return {};};\n' + fs.readFileSync(file, 'utf8') + '\nreturn module.exports;})()';

const paginaInterativa = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>Projeção BSC · prévia interativa</title><style>' +
'html,body{margin:0;background:#C9D3E3;font-family:"Segoe UI",system-ui,Arial,sans-serif}' +
'#esc{transform-origin:0 0}' +
'.pg{position:relative;width:' + L.page.w + 'px;height:' + L.page.h + 'px;margin:0 auto;background:linear-gradient(180deg,#EEF3FA,#E3EBF6);overflow:hidden}' +
'iframe{position:absolute;border:0;background:transparent;color-scheme:normal}' +
'.sl{position:absolute;box-sizing:border-box;padding:9px 11px;border-radius:12px;background:rgba(255,255,255,.72);box-shadow:0 1px 2px rgba(16,24,40,.04);font-size:12px;color:#1F2937;user-select:none}' +
'.sl>b{display:block;font-weight:500;margin-bottom:14px;white-space:nowrap}.sl.big>b{font-size:14px}' +
'.sl.novo{background:#fff;box-shadow:0 0 0 1.5px #334155,0 4px 12px rgba(16,24,40,.10)}' +
'.sl.novo>b{margin-bottom:9px;font-weight:600}' +
'.sl.novo:before{content:"NOVO";position:absolute;right:9px;bottom:8px;padding:1px 6px;border-radius:99px;background:#334155;color:#fff;font-size:7.5px;font-weight:700;letter-spacing:.08em}' +
'.bt{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin:0 8px}.bt span{height:56px;display:flex;align-items:center;justify-content:center;background:#F3F7FC;border:1px solid #E3EAF3;font-size:11px;color:#475467;cursor:pointer}' +
'.bt span.sel{background:#665BDC;border-color:#665BDC;color:#fff}' +
'.dd{position:relative;height:24px;display:flex;align-items:center;justify-content:space-between;padding:0 7px;border:1px solid #E3EAF3;background:#fff;font-size:11px;color:#344054;cursor:pointer;white-space:nowrap;overflow:hidden}' +
'.dd:after{content:"⌄";font-size:13px;margin-top:-5px;color:#667085}' +
'.dd select{position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;cursor:pointer}' +
'.op{display:flex;align-items:center;gap:7px;height:25px;font-size:11px;color:#344054;cursor:pointer;white-space:nowrap}' +
'.op i{flex:none;width:12px;height:12px;border-radius:50%;border:1.5px solid #98A2B3;box-sizing:border-box}' +
'.op.sel i{border-color:#334155;background:radial-gradient(#334155 0 3px,#fff 3.6px)}.op.sel{font-weight:600;color:#111827}' +
'.pop{position:absolute;z-index:9;left:' + L.niv.x + 'px;top:' + (L.niv.y + 76) + 'px;width:' + L.niv.w + 'px;max-height:330px;overflow-y:auto;box-sizing:border-box;padding:4px 0;background:#fff;border:1px solid #D0D7E2;box-shadow:0 10px 24px rgba(16,24,40,.22);font-size:11.5px;color:#344054;display:none}' +
'.pop.on{display:block}' +
// arvore: seta + caixa (cheia = indicador inteiro, quadrado = so um %), como a segmentacao do Power BI
'.tr,.lv{display:flex;align-items:center;gap:7px;height:24px;padding:0 10px;cursor:pointer;white-space:nowrap}.tr:hover,.lv:hover{background:#F3F7FC}' +
'.tr u{width:12px;text-decoration:none;color:#667085;font-size:11px}.lv{padding-left:42px}' +
'.cb{flex:none;width:13px;height:13px;border:1.5px solid #98A2B3;box-sizing:border-box;display:flex;align-items:center;justify-content:center}' +
'.cb.on{background:#1F2937;border-color:#1F2937}.cb.pa:before{content:"";width:7px;height:7px;background:#1F2937}' +
'.tr.all{border-bottom:1px solid #EEF1F6;padding-left:29px}' +
'.bar{box-sizing:border-box;width:' + L.page.w + 'px;margin:0 auto;padding:9px 20px 11px;background:#0C1016;color:#CBD5E1;font-size:12px;line-height:1.5}' +
'.bar b{color:#fff}.bar a{color:#7DD3FC;margin-left:10px;cursor:pointer;text-decoration:underline}.bar a.sel{color:#fff;font-weight:700;text-decoration:none}' +
'</style></head><body><div id="esc">' +
'<div class="pg">' +
'<iframe name="menu" title="Menu lateral" style="' + box(L.menu) + '"></iframe>' +
'<div class="sl big" style="' + box(L.cor) + '"><b>Selecione a cor</b><div class="bt" id="cor"></div></div>' +
'<div class="sl" style="' + box(L.at) + '"><b>Selecione a AT</b><div class="dd"><span id="atTxt">Todos</span><select id="at"></select></div></div>' +
'<div class="sl" style="' + box(L.mes) + '"><b>Selecione o Mês</b><div class="dd">Nov/2026</div></div>' +
'<div class="sl novo" style="' + box(L.cen) + '"><b>Cenário</b><div id="cen"></div></div>' +
'<div class="sl novo" style="' + box(L.niv) + '"><b>Indicador &amp; % Atingimento</b><div class="dd" id="nivDd"><span id="nivTxt">Todos</span></div></div>' +
'<div class="pop" id="nivPop"></div>' +
'<iframe name="corpo" title="Corpo: projeção e diagnóstico" style="' + box(L.corpo) + '"></iframe>' +
'</div>' +
'<div class="bar"><b>Prévia interativa.</b> Os filtros acima imitam os seletores nativos do Power BI: clique na cor, na AT, no cenário e na árvore Indicador &amp; % (abra o indicador pela seta para escolher o %). ' +
'A cada clique a própria medida DAX é reavaliada aqui no navegador, com dados fictícios.<br>Dados: ' +
'<a data-d="print">do print</a><a data-d="semDados">2 indicadores sem resultado</a><a data-d="bom">resultado bom</a><a data-d="vazio">mês sem dados</a></div>' +
'</div><script>\n' +
'var DAX=' + cjs(path.join(__dirname, 'dax.js')) + ';\n' +
'var P=' + cjs(path.join(__dirname, 'mocks-projecao.js')) + ';\n' +
'var SRC={corpo:' + embed(fs.readFileSync(CORPO, 'utf8')) + ',menu:' + embed(fs.readFileSync(MENU, 'utf8')) + '};\n' +
'var REAL=' + embed(REAL) + ',ESPERADO=' + embed(ESPERADO) + ';\n' +
`
// estado dos "seletores nativos". marcados: null = nada marcado (o Power BI trata como todos)
var st = { cor: 'GERAL', at: null, cenario: ESPERADO, marcados: null, ating: 100, niveis: {}, nivAberto: null, dados: 'print', aberto: false, semMesAnt: false };
try { if (location.hash.length > 1) Object.assign(st, JSON.parse(decodeURIComponent(location.hash.slice(1)))); } catch (e) {}

function wrap(html) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:"Segoe UI",wf_segoe-ui_normal,helvetica,arial,sans-serif;font-size:12pt;color:#000}</style></head>' +
    '<body><div id="sandbox-host"><div id="htmlViewer"><div id="htmlContent" class="htmlViewerEntry">' + html + '</div></div></div></body></html>';
}
function q(id) { return document.getElementById(id); }
function nomeDe(chave) { return P.IND.filter(function (r) { return r[0] === chave; })[0][1]; }

function desenhar() {
  // ---- cor (blocos): clicar de novo desmarca -> GERAL
  q('cor').innerHTML = P.CORES.map(function (c) { return '<span data-c="' + c + '" class="' + (st.cor === c ? 'sel' : '') + '">' + c + '</span>'; }).join('');
  // ---- AT (lista suspensa): so as ATs da cor filtrada
  var ats = P.ATS.filter(function (a) { return st.cor === 'GERAL' || a[1] === st.cor; }).map(function (a) { return a[0]; }).sort();
  if (st.at && ats.indexOf(st.at) < 0) st.at = null;
  q('at').innerHTML = '<option value="">Todos</option>' + ats.map(function (a) { return '<option' + (st.at === a ? ' selected' : '') + '>' + a + '</option>'; }).join('');
  q('atTxt').textContent = st.at || 'Todos';
  // ---- cenario (lista com selecao unica)
  q('cen').innerHTML = [ESPERADO, REAL].map(function (c) { return '<div class="op' + (st.cenario === c ? ' sel' : '') + '" data-c="' + c + '"><i></i>' + c + '</div>'; }).join('');
  // ---- arvore Indicador & %: indicador inteiro ou um % dele
  var nk = Object.keys(st.niveis), nome = function (k) { return nomeDe(k) + (st.niveis[k] === 'tudo' ? '' : ' · ' + st.niveis[k] + '%'); };
  q('nivTxt').textContent = !nk.length ? 'Todos' : nk.length === 1 ? nome(nk[0]) : 'Seleções múltiplas';
  q('nivPop').className = 'pop' + (st.aberto === 'niv' ? ' on' : '');
  var tudo = nk.length === P.CHAVES.length && nk.every(function (k) { return st.niveis[k] === 'tudo'; });
  q('nivPop').innerHTML = '<div class="tr all" data-n="*"><i class="cb' + (tudo ? ' on' : nk.length ? ' pa' : '') + '"></i>Selecionar tudo</div>' + P.IND.map(function (r) {
    var v = st.niveis[r[0]], ab = st.nivAberto === r[0];
    return '<div class="tr" data-n="' + r[0] + '"><u data-x="' + r[0] + '">' + (ab ? '⌄' : '›') + '</u><i class="cb' + (v === 'tudo' ? ' on' : v !== undefined ? ' pa' : '') + '"></i>' + r[1] + '</div>' +
      (ab ? P.NIVEIS.map(function (l) { return '<div class="lv" data-l="' + l + '"><i class="cb' + (v === 'tudo' || v === l ? ' on' : '') + '"></i>' + l + '%</div>'; }).join('') : '');
  }).join('');
  [].forEach.call(document.querySelectorAll('.bar a'), function (a) { a.className = a.getAttribute('data-d') === st.dados ? 'sel' : ''; });
  // ---- visuais HTML: a medida e reavaliada com o estado dos filtros
  var e = { cor: st.cor, at: st.at, cenario: st.cenario, marcados: st.marcados, ating: st.ating, niveis: st.niveis, dados: st.dados, semMesAnt: st.semMesAnt };
  window.frames.corpo.document.open(); window.frames.corpo.document.write(wrap(DAX.evaluateSource(SRC.corpo, P.mocksProjecao(e), {}).html)); window.frames.corpo.document.close();
  var mn = wrap(DAX.evaluateSource(SRC.menu, P.mocksMenu(e), {}).html);
  if (mn !== desenhar.menu) { desenhar.menu = mn; window.frames.menu.document.open(); window.frames.menu.document.write(mn); window.frames.menu.document.close(); }
}

document.addEventListener('click', function (ev) {
  var t = ev.target.closest('[data-x],[data-c],[data-d],[data-n],[data-l],#nivDd');
  var dentro = ev.target.closest('#nivPop,#nivDd');
  if (!dentro && st.aberto) { st.aberto = false; if (!t) return desenhar(); }
  if (!t) return;
  if (t.id === 'nivDd') st.aberto = st.aberto === 'niv' ? false : 'niv';
  else if (t.hasAttribute('data-x')) st.nivAberto = st.nivAberto === t.getAttribute('data-x') ? null : t.getAttribute('data-x');
  else if (t.hasAttribute('data-n')) {
    // caixa do indicador: marca/desmarca o indicador inteiro (todos os %)
    var n = t.getAttribute('data-n');
    if (n === '*') { var cheio = Object.keys(st.niveis).length === P.CHAVES.length; st.niveis = {}; if (!cheio) P.CHAVES.forEach(function (k) { st.niveis[k] = 'tudo'; }); }
    else if (st.niveis[n] !== undefined) delete st.niveis[n]; else st.niveis[n] = 'tudo';
  } else if (t.hasAttribute('data-l')) {
    // um % do indicador aberto (selecao multipla com CTRL desativada: soma aos outros indicadores)
    var l = +t.getAttribute('data-l'), k = st.nivAberto;
    if (st.niveis[k] === l) delete st.niveis[k]; else st.niveis[k] = l;
  }
  else if (t.parentNode.id === 'cor') st.cor = st.cor === t.getAttribute('data-c') ? 'GERAL' : t.getAttribute('data-c');
  else if (t.parentNode.id === 'cen') st.cenario = t.getAttribute('data-c');
  else if (t.hasAttribute('data-d')) st.dados = t.getAttribute('data-d');
  desenhar();
});
q('at').addEventListener('change', function () { st.at = this.value || null; desenhar(); });
function escala() { var k = Math.min(1, document.documentElement.clientWidth / ${L.page.w}); q('esc').style.transform = k < 1 ? 'scale(' + k + ')' : ''; q('esc').style.height = k < 1 ? q('esc').scrollHeight * k + 'px' : ''; }
window.addEventListener('resize', escala);
desenhar(); escala();
` + '</script></body></html>';

const interativa = path.join(out, 'previa-interativa.html');
fs.writeFileSync(interativa, paginaInterativa);

// ------------------------------------------------------------- (5) prints
const jobs = [];
const hash = (e) => '#' + encodeURIComponent(JSON.stringify(e));
const clip = { x: 0, y: 0, width: L.page.w, height: L.page.h };
function pagina(nome, estado, antes) {
  jobs.push({ file: interativa, hash: hash(estado), out: path.join(out, nome + '.png'), w: L.page.w, h: L.page.h + 70, scale: 2, clip, before: antes, wait: 1900 });
}
const tudoMarcado = P.CHAVES.slice();
const D3_70 = { niveis: { 'INSTALAÇÃO 3D': 70 } };
const TUDO = {}; P.CHAVES.forEach((k) => { TUDO[k] = 'tudo'; });
pagina('1-todos-os-indicadores-na-meta', {});
pagina('2-so-instalacao-D3-na-meta', { niveis: { 'INSTALAÇÃO 3D': 'tudo' } });
pagina('3-so-instalacao-D3-a-70-por-cento', D3_70);
pagina('4-arvore-aberta-D3-70', Object.assign({ aberto: 'niv', nivAberto: 'INSTALAÇÃO 3D' }, D3_70));
pagina('5-D3-80-e-repetidas-60', { niveis: { 'INSTALAÇÃO 3D': 80, 'IRR 7 DIAS': 60 } });
pagina('6-D3-80-repetidas-60-e-IFI-inteiro', { niveis: { 'INSTALAÇÃO 3D': 80, 'IRR 7 DIAS': 60, 'IFI 7 DIAS': 'tudo' } });
pagina('7-cenario-real-so-diagnostico', ESTADOS.real);
pagina('8-cor-e-AT-selecionadas', { cor: 'BRONZE', at: 'RP', niveis: { 'INSTALAÇÃO 3D': 80, '1 AGENDA': 'tudo', 'IRR 7 DIAS': 70 } });
pagina('10-indicadores-sem-resultado', ESTADOS.semDados);
pagina('11-resultado-bom', ESTADOS.bom);
pagina('12-sem-dados-no-mes-anterior', Object.assign({ semMesAnt: true }, D3_70));

// menu: antes (v7 recebido) x depois (v8), com a posicao dos botoes nativos
{
  const mk = M.menu.geral;
  const cell = (titulo, html, itens) => '<figure><figcaption>' + titulo + '</figcaption><div class="mw"><iframe srcdoc="' + R.wrap(html).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></iframe>' +
    itens.map((t, i) => '<i class="' + (t[2] || '') + '" style="top:' + t[0] + 'px"><b>' + t[0] + '</b>' + t[1] + '</i>').join('') + '</div></figure>';
  const antes = [[109, ''], [152, ''], [195, ''], [238, ''], [281, ''], [324, ''], [367, '']];
  const depois = [[109, 'não muda'], [152, 'botão novo', 'nv'], [195, 'era 152'], [238, 'era 195'], [281, 'era 238'], [324, 'era 281'], [367, 'era 324'], [410, 'era 367']];
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Menu v8 · antes e depois</title><style>' +
    'body{margin:0;padding:20px 26px 24px;width:800px;box-sizing:border-box;background:linear-gradient(180deg,#EEF3FA,#E3EBF6);font-family:"Segoe UI",system-ui,Arial,sans-serif;display:flex;gap:18px;align-items:flex-start}' +
    'figure{margin:0}figcaption{margin:0 0 8px 2px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#475467}' +
    '.mw{position:relative;width:238px;height:700px;margin-right:96px}iframe{display:block;width:238px;height:700px;border:0;background:transparent}' +
    '.mw i{position:absolute;left:246px;height:36px;display:flex;align-items:center;gap:7px;font-style:normal;font-size:11px;color:#667085;white-space:nowrap}' +
    '.mw i:before{content:"";width:10px;height:36px;box-sizing:border-box;border:1.5px solid #98A2B3;border-left:0;border-radius:0 4px 4px 0}' +
    '.mw i b{color:#0B1533;font-size:12px}.mw i b:after{content:"px";font-weight:500;color:#667085}' +
    '.mw i.nv,.mw i.nv b{color:#B45309}.mw i.nv:before{border-color:#B45309}' +
    '</style></head><body>' +
    cell('Antes · v7 (7 itens)', menu(MENU_V7, mk), antes) +
    cell('Depois · v8 (8 itens) · topo de cada botão', menu(MENU, mk), depois) +
    '</body></html>';
  const f = path.join(out, '_menu.html');
  fs.writeFileSync(f, html);
  jobs.push({ file: f, out: path.join(out, '9-menu-antes-e-depois-posicao-dos-botoes.png'), w: 800, h: 760, scale: 2, wait: 900, after: () => fs.unlinkSync(f) });
}

// conferencias no tamanho de referencia
{
  const f = path.join(out, '_corpo.html');
  fs.writeFileSync(f, R.wrap(corpo(ESTADOS.todos)));
  jobs.push({
    file: f, w: L.corpo.w, h: L.corpo.h, scale: 1, wait: 900,
    before: async (p) => {
      const o = await p.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const cut = [...document.querySelectorAll('.nm,.gt-e,.gt-s,.gt-l,.hz-t,.ls-n,.ls-r,.fa-c,.fa-s,.n,.ins,.pl,.ph h2')].filter((e) => e.scrollWidth > e.clientWidth + 1).length;
        return { cabe: q('.rows').scrollHeight <= q('.rows').clientHeight, cortados: cut };
      });
      console.log('corpo ' + L.corpo.w + 'x' + L.corpo.h + ': 12 indicadores + total sem rolagem = ' + o.cabe + ' | textos cortados = ' + o.cortados);
    },
    after: () => fs.unlinkSync(f),
  });
  const g = path.join(out, '_menu2.html');
  fs.writeFileSync(g, R.wrap(menu(MENU, P.mocksMenu({ cor: 'BRONZE', at: 'MA' }))));
  jobs.push({
    file: g, w: L.menu.w, h: L.menu.h, scale: 1, wait: 600,
    before: async (p) => {
      const o = await p.evaluate(() => ({
        itens: [...document.querySelectorAll('.nav > *')].map((e) => { const r = e.getBoundingClientRect(); return r.top + '/' + r.height; }),
        cabe: document.querySelector('.sb').scrollHeight <= document.querySelector('.sb').clientHeight,
      }));
      console.log('menu ' + L.menu.w + 'x' + L.menu.h + ': topo/altura dos itens = ' + o.itens.join('  ') + ' | tudo cabe = ' + o.cabe);
    },
    after: () => fs.unlinkSync(g),
  });
}

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  for (const j of jobs) {
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: j.scale || 2 });
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e)));
    await page.goto('file://' + path.resolve(j.file) + (j.hash || ''));
    await page.waitForTimeout(j.wait || 900);
    if (erros.length) throw new Error(path.basename(j.file) + ': erro na pagina: ' + erros.join(' | '));
    if (j.before) await j.before(page);
    if (j.out) await page.screenshot({ path: j.out, clip: j.clip });
    await page.close();
    if (j.after) j.after();
  }
  // a previa interativa responde aos cliques? (clica no cenario real e confere a nota)
  {
    const page = await browser.newPage({ viewport: { width: L.page.w, height: L.page.h + 70 } });
    await page.goto('file://' + interativa);
    await page.waitForTimeout(600);
    const nota = async () => (await page.frames().find((f) => f.name() === 'corpo').locator('.g-v b').textContent());
    const a = await nota();
    await page.click('#cen .op:last-child');
    await page.waitForTimeout(300);
    const b = await nota();
    await page.click('#cen .op:first-child'); await page.waitForTimeout(200);
    await page.click('#nivDd'); await page.click('#nivPop u[data-x="INSTALAÇÃO 3D"]'); await page.click('#nivPop .lv[data-l="70"]');
    await page.waitForTimeout(300);
    const c = await nota();
    await page.click('#nivPop u[data-x="INSTALAÇÃO 3D"]'); await page.click('#nivPop .tr[data-n="IRR 7 DIAS"]');
    await page.waitForTimeout(300);
    const d = await nota();
    console.log('previa interativa: nada marcado = ' + a + ' | cenario real = ' + b + ' | so D3 a 70% = ' + c + ' | + Repetidas inteira = ' + d);
    await page.close();
  }
  await browser.close();
  console.log('previas gravadas em ' + path.relative(repo, out));
})();
