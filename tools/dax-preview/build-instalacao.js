'use strict';
// ============================================================================
// Painel "Instalacao em ate 3 dias": prints + PAGINA UNICA (previa + codigo)
//
//   node tools/dax-preview/build-instalacao.js           -> grava em instalacao-3d/
//   node tools/dax-preview/build-instalacao.js <pasta>   -> grava em outra pasta
//
// Passos: (1) parse + checagem de sintaxe das medidas, (2) avaliacao da medida
// principal com os dados ficticios de mocks-instalacao.js, (3) checagem do HTML
// contra as regras do visual HTML Content, (4) teste dos botoes clicaveis e do
// tamanho de referencia no Chromium, (5) prints e index.html.
// Qualquer erro em (1)-(4) interrompe a geracao.
// ============================================================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const dax = require('./dax.js');
const M = require('./mocks-instalacao.js');
const R = require('./render.js');
const { compat } = require('./compat.js');

const repo = path.resolve(__dirname, '../..');
const src = path.join(repo, 'instalacao-3d');
const out = path.resolve(process.argv[2] || src);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dax-preview-'));
fs.mkdirSync(out, { recursive: true });

const PRINCIPAL = path.join(src, 'painel_instalacao_3d_html_v1.txt');
const APOIO = path.join(src, 'medidas_de_apoio_v1.txt');
const MENU = path.join(src, 'menu_lateral_instalacao_html_v1.txt');
const BARRA = path.join(src, 'barra_filtros_instalacao_html_v1.txt');

// ------------------------------------------------------------ 1. medidas de apoio
// O arquivo tem varias medidas: cada uma comeca em uma linha "Nome =".
function medidasDeApoio() {
  const txt = fs.readFileSync(APOIO, 'utf8');
  const linhas = txt.split('\n');
  const ini = [];
  linhas.forEach((l, i) => { if (/^[^\s/].*=\s*$/.test(l)) ini.push(i); });
  return ini.map((a, k) => {
    // o comentario logo acima da medida vai junto com ela
    let c = a;
    while (c > 0 && /^\/\//.test(linhas[c - 1])) c--;
    const fim = k + 1 < ini.length ? (() => { let f = ini[k + 1]; while (f > 0 && /^\/\//.test(linhas[f - 1])) f--; return f; })() : linhas.length;
    const corpo = linhas.slice(a, fim).join('\n').trim();
    const ast = dax.parse(dax.stripMeasureName(corpo + '\n'));
    const chk = dax.check(ast, corpo);
    if (chk.problems.length) throw new Error('medidas de apoio: ' + chk.problems.join('; '));
    return { nome: linhas[a].replace(/=\s*$/, '').trim(), nota: linhas.slice(c, a).join('\n'), corpo };
  });
}
const apoio = medidasDeApoio();
console.log('apoio  : sintaxe ok | ' + apoio.map((m) => m.nome).join(', '));

// ------------------------------------------------------------ menu lateral
const mnu = dax.evaluate(MENU, require('./mocks.js').menu.geral, { utcNow: M.UTC_NOW });
{
  const c = compat(mnu.html, { estrito: true });
  if (mnu.unusedMocks.length || c.problems.length) throw new Error('menu: ' + mnu.unusedMocks.concat(c.problems).join('; '));
  console.log('menu   : sintaxe ok | medida ' + fs.readFileSync(MENU, 'utf8').length + ' caracteres -> HTML ' + mnu.html.length);
}

const bar = dax.evaluate(BARRA, {}, { utcNow: M.UTC_NOW });
{
  const c = compat(bar.html, { estrito: true });
  if (c.problems.length) throw new Error('barra: ' + c.problems.join('; '));
  console.log('barra  : sintaxe ok | HTML ' + bar.html.length);
}

// ------------------------------------------------------------ 2 e 3. medida principal
let primeiro = true;
function painel(cen) {
  const r = dax.evaluate(PRINCIPAL, M.cenario(cen), { utcNow: M.UTC_NOW });
  if (r.unusedMocks.length) throw new Error('mocks sem VAR correspondente: ' + r.unusedMocks.join(', '));
  const c = compat(r.html, { estrito: true });
  if (c.problems.length) throw new Error('HTML fora das regras do HTML Content:\n  ' + [...new Set(c.problems)].join('\n  '));
  if (primeiro) {
    primeiro = false;
    console.log('painel : sintaxe ok | medida ' + r.sourceChars + ' caracteres -> HTML ' + r.html.length + ' | tags: ' + c.tags.join(' '));
  }
  return r.html;
}

const CEN = [
  { id: 'geral', rotulo: 'Geral · nov/26', nota: 'Sem filtro de cor ou AT, mês em andamento. O lado direito aparece como fica depois de ligar a coluna de abertura.', cen: {}, pg: { mes: 'Novembro/2026' } },
  { id: 'bronze', rotulo: 'Cor BRONZE', nota: 'Filtro de cor: a curva vira a da cor e as duas metades mostram só as ATs dela.', cen: { ats: M.daCor('BRONZE') }, pg: { mes: 'Novembro/2026', cor: 'BRONZE' } },
  { id: 'at', rotulo: 'AT MA · agendas variadas', nota: 'Uma AT selecionada, em uma carga com ordens agendadas para outros dias ou sem agenda: aparecem a coluna Agenda e o aviso “em risco”. No topo direito, o aviso opcional de carga atrasada.', cen: { ats: ['MA'], comAgenda: true, carga: M.HOJE - 1 + 9.4 / 24 }, pg: { mes: 'Novembro/2026', at: 'MA' } },
  { id: 'out', rotulo: 'Mês fechado · out/26', nota: 'Trocar o mês muda só o lado esquerdo. O lado direito continua no dia de hoje.', cen: { fimSel: dax.serial(2026, 10, 31) }, pg: { mes: 'Outubro/2026' } },
  { id: 'hoje', rotulo: 'Sem a data de criação', nota: 'Se a data de criação não vier: o lado direito separa só já perdidas x dentro do indicador, e vencem hoje e amanhã ficam em “—”.', cen: { semAbertura: true }, pg: { mes: 'Novembro/2026' } },
  { id: 'nada', rotulo: 'Nada ligado no D-0', nota: 'Carga lida, mas sem a coluna do indicador nem a abertura: o lado direito avisa o que falta.', cen: { semAbertura: true, semInd: true }, pg: { mes: 'Novembro/2026' } },
];
for (const c of CEN) {
  c.html = painel(c.cen);
  c.pagina = R.composeInstalacao(c.html, Object.assign({ title: 'Instalação 3D · ' + c.rotulo }, c.pg));
}
// estados extremos: precisam avaliar e passar nas regras, mesmo sem print
painel({ semDados: true, semPend: true });
painel({ semPend: true, ats: ['PL'] });
painel({ comAgenda: true, ats: ['PL', 'SA', 'BS', 'MA'] });
painel({ carga: M.HOJE + 0.3, fimSel: null });
painel({ fimSel: dax.serial(2026, 1, 31) });

// ------------------------------------------------------------ 4 e 5. prints + checagens
const L = R.LAYOUT_I3;
const jobs = [];
const noPainel = (fn) => async (p) => { const fr = p.frames().find((f) => f.name() === 'i3'); await fn(fr, p); await p.waitForTimeout(450); };
const arq = (nome, html) => { const f = path.join(tmp, nome + '.html'); fs.writeFileSync(f, html); return f; };
function print(nome, c, before) {
  jobs.push({ file: arq(nome, c.pagina), out: path.join(out, nome + '.png'), w: L.page.w, h: L.page.h, scale: 2, before: before && noPainel(before) });
}
const [GERAL, BRONZE, AT, OUT, HOJE, NADA] = CEN;
print('1-visao-geral', GERAL);
print('2-curva-semanal-e-destaque-da-cor', GERAL, async (f) => { await f.click('.b1 summary'); await f.hover('.hc .c-prata2'); });
print('3-curva-diaria-e-dica', GERAL, async (f) => { await f.click('.b2 summary'); await f.locator('.v-dia .pt').nth(5).hover(); });
print('4-cor-BRONZE-ordens-perdidas', BRONZE, async (f) => { await f.click('.c1 summary'); });
print('5-AT-selecionada-com-agenda-e-aviso-de-carga', AT, async (f) => { await f.click('.b1 summary'); });
print('6-mes-fechado-o-lado-direito-nao-muda', OUT, async (f) => { await f.click('.b2 summary'); await f.locator('.v-dia .pt').nth(14).hover(); });

// o painel ao lado de um menu lateral (visual mais estreito)
jobs.push({ file: arq('estreito', R.wrap(GERAL.html)), out: path.join(out, '7-visual-estreito-1032x630.png'), w: 1032, h: 630, scale: 2 });
print('8-so-a-coluna-do-indicador', HOJE);
print('9-nada-ligado-no-lado-direito', NADA);
jobs.push({ file: arq('com-menu', R.composeInstalacaoMenu(mnu.html, GERAL.html, { title: 'Instalação 3D · com menu', barra: bar.html })), out: path.join(out, '10-com-o-menu-lateral.png'), w: 1280, h: 720, scale: 2 });

// tamanho de referencia: tudo cabe, nada cortado, botoes levam para a visao certa
jobs.push({
  file: arq('ref', R.wrap(GERAL.html)), w: L.vis.w, h: L.vis.h, scale: 1,
  before: async (p) => {
    const medir = () => p.evaluate(() => {
      const vis = (e) => getComputedStyle(e).display !== 'none';
      const view = [...document.querySelectorAll('.view')].find(vis);
      const mx = view.querySelector('.mx');
      const sel = '.kv b,.chip,.ks,.kc,.kp small,.kp b,.kd,.cr>*,.st small,.st b,.st em,.dk>*,.ins,.rl,.c,.ac,.xl,.dr b,.dr em,.as>*,.al,.seg .o,.oh span,.or>*';
      const cut = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1);
      return {
        linhas: view.querySelectorAll('.rw').length, semRolagem: mx.scrollHeight <= mx.clientHeight,
        grafico: Math.round(view.querySelector('.plot').getBoundingClientRect().height),
        cortados: cut.length, exemplo: cut.slice(0, 4).map((e) => e.className + ':' + e.textContent.slice(0, 18)),
        ordens: [...document.querySelectorAll('.lv')].filter(vis).map((e) => { const b = e.getBoundingClientRect(); return [...e.querySelectorAll('.or')].filter((r) => r.getBoundingClientRect().bottom <= b.bottom).length; })[0],
      };
    });
    for (const [nome, clique] of [['Mês', null], ['Semana', '.b1 summary'], ['Dia', '.b2 summary']]) {
      if (clique) { await p.click(clique); await p.waitForTimeout(200); }
      const o = await medir();
      console.log(('painel ' + L.vis.w + 'x' + L.vis.h + ' · ' + nome).padEnd(26) + ': ' + o.linhas + ' linhas sem rolagem = ' + o.semRolagem + ' | gráfico ' + o.grafico + 'px | ordens visíveis ' + o.ordens +
        ' | textos cortados = ' + o.cortados + (o.cortados ? ' ' + JSON.stringify(o.exemplo) : ''));
      if (!o.semRolagem || o.cortados) throw new Error('layout fora do tamanho de referencia (' + nome + ')');
    }
    // Botoes: de qualquer estado, o clique em cada botao tem que mostrar a visao daquele botao.
    for (const [seg, views] of [['.sg', ['.v-mes', '.v-sem', '.v-dia']], ['.sl', ['.l-p', '.l-h', '.l-a']]]) {
      let n = 0;
      for (const alvo of [1, 2, 0, 2, 1, 0, 1, 0, 2, 0, 1, 2, 1, 2, 0, 2, 0, 1, 0, 2, 2, 1, 1, 0]) {
        const r = await p.evaluate(([s, vs, a]) => {
          const box = document.querySelector(s).getBoundingClientRect();
          const w = (box.width - 4) / 3;
          const x = box.left + 2 + w * (a + 0.5);
          const y = box.top + box.height / 2;
          const el = document.elementFromPoint(x, y);
          const antes = vs.findIndex((v) => getComputedStyle(document.querySelector(v)).display !== 'none');
          if (el && el.tagName === 'SUMMARY') el.click();
          const depois = vs.findIndex((v) => getComputedStyle(document.querySelector(v)).display !== 'none');
          const visiveis = vs.filter((v) => getComputedStyle(document.querySelector(v)).display !== 'none').length;
          return { antes, depois, visiveis, clicou: !!(el && el.tagName === 'SUMMARY') };
        }, [seg, views, alvo]);
        // clicar no botao ja ativo nao faz nada; nos outros, troca para a visao do botao
        if (r.visiveis !== 1 || r.depois !== alvo || (r.antes !== alvo && !r.clicou)) throw new Error('botoes ' + seg + ': clique em ' + alvo + ' -> ' + JSON.stringify(r));
        n++;
      }
      console.log('botões ' + seg + '               : ' + n + ' cliques em sequência, sempre na visão do botão clicado');
    }
  },
});

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
const principalTxt = fs.readFileSync(PRINCIPAL, 'utf8').replace(/\s+$/, '') + '\n';
const linhasPrincipal = principalTxt.split('\n').length - 1;
const json = (x) => JSON.stringify(x).replace(/</g, '\\u003c');
const bloco = (id, titulo, sub, codigo, aberto) =>
  '<div class="code" id="' + id + '"><div class="code-h"><div><b>' + titulo + '</b><small>' + sub + '</small></div>' +
  '<button class="cp" data-alvo="' + id + '-pre">Copiar</button></div>' +
  '<pre id="' + id + '-pre"' + (aberto ? '' : ' class="alto"') + '><code>' + realce(codigo) + '</code></pre></div>';

const pagina = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Painel · Instalação em até 3 dias</title>
<style>
:root{--ink:#0B1533;--ink2:#3F4C6B;--mut:#63708B;--ln:#DDE3EE;--sf:#FFFFFF;--bg:#E9EEF6;--d0:#0C1016;--d1:#161C26;--a1:#7DD3FC;--pri:#334155}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 "Segoe UI",system-ui,-apple-system,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1340px;margin:0 auto;padding:0 20px}
header{color:#fff;background:radial-gradient(60% 160% at 0% 0%,rgba(148,163,184,.22),transparent 60%),linear-gradient(115deg,var(--d1),var(--d0))}
header .wrap{padding-top:30px;padding-bottom:26px}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--a1)}
h1{margin:6px 0 8px;font-size:30px;line-height:1.15;letter-spacing:-.02em}
header p{margin:0;max-width:820px;color:rgba(255,255,255,.76)}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.tags span{padding:3px 10px;border-radius:99px;background:rgba(255,255,255,.10);font-size:12px;font-weight:600}
nav{position:sticky;top:0;z-index:20;background:rgba(233,238,246,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--ln)}
nav .wrap{display:flex;gap:4px;overflow-x:auto;padding-top:8px;padding-bottom:8px}
nav a{flex:none;padding:6px 12px;border-radius:8px;color:var(--ink2);font-size:13px;font-weight:600;text-decoration:none}
nav a:hover{background:#fff;color:var(--ink)}
section{padding:34px 0 6px;scroll-margin-top:44px}
h2{margin:0 0 4px;font-size:21px;letter-spacing:-.01em}
h2 small{margin-left:8px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.lead{margin:0 0 16px;max-width:860px;color:var(--ink2)}
.card{background:var(--sf);border:1px solid var(--ln);border-radius:16px;box-shadow:0 1px 2px rgba(11,21,51,.04),0 8px 22px rgba(11,21,51,.05)}
/* ---- previa ---- */
.pv{padding:14px}
.pills{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.pills button{padding:7px 13px;border:1px solid var(--ln);border-radius:99px;background:#F5F7FB;color:var(--ink2);font:600 13px/1 inherit;font-family:inherit;cursor:pointer}
.pills button:hover{color:var(--ink);border-color:#C5CCDA}
.pills button[aria-pressed="true"]{background:var(--pri);border-color:var(--pri);color:#fff}
.nota{margin:0 0 12px;color:var(--ink2);font-size:13.5px}
.nota b{color:var(--ink)}
.stage{position:relative;width:100%;aspect-ratio:1280/720;overflow:hidden;border-radius:12px;background:#E3EBF6;box-shadow:inset 0 0 0 1px var(--ln)}
.stage iframe{position:absolute;left:0;top:0;width:1280px;height:720px;border:0;transform-origin:0 0}
.dica{display:flex;flex-wrap:wrap;gap:6px 18px;margin:12px 2px 0;color:var(--mut);font-size:12.5px}
.dica b{color:var(--ink2)}
.prints{margin:10px 2px 0;color:var(--mut);font-size:12.5px}
.prints a{margin-left:8px;color:var(--pri);font-weight:600}
.leg{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:16px}
.leg div{padding:14px 16px}
.leg b{display:block;margin-bottom:2px}
.leg i{display:inline-block;min-width:22px;height:22px;margin-right:8px;border-radius:7px;background:var(--pri);color:#fff;font:700 12px/22px inherit;font-family:inherit;text-align:center;font-style:normal}
.leg span{color:var(--ink2);font-size:13.5px}
/* ---- passos ---- */
ol.steps{margin:0;padding:6px 22px 6px 44px}
ol.steps li{padding:9px 0;border-bottom:1px solid #EDF0F6}
ol.steps li:last-child{border-bottom:0}
ol.steps b{color:var(--ink)}
code.i{padding:1px 6px;border-radius:5px;background:#EEF2F6;color:#1E293B;font:12.5px/1.4 Consolas,"Cascadia Mono",Menlo,monospace;white-space:nowrap}
/* ---- codigo ---- */
.code{margin-bottom:14px;overflow:hidden;scroll-margin-top:60px;border-radius:14px;background:#0F141C;box-shadow:0 8px 22px rgba(11,21,51,.12)}
.code-h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px 10px 16px;background:#161C26;border-bottom:1px solid rgba(255,255,255,.08);color:#fff}
.code-h b{display:block;font-size:14px}
.code-h small{display:block;color:rgba(255,255,255,.6);font-size:12px}
.cp{flex:none;padding:7px 14px;border:0;border-radius:8px;background:var(--a1);color:#06202E;font:700 13px/1 inherit;font-family:inherit;cursor:pointer}
.cp:hover{background:#A5E3FD}
.cp.ok{background:#34D399}
pre{margin:0;padding:14px 16px;overflow:auto;color:#D5DBEA;font:12.5px/1.5 Consolas,"Cascadia Mono",Menlo,monospace;tab-size:4}
pre.alto{max-height:560px}
.k-nm{color:#FFFFFF;font-weight:700}.k-c{color:#7C8AA5}.k-s{color:#A7E3B4}.k-n{color:#F5C16C}.k-k{color:#F28FB1;font-weight:700}.k-f{color:#7DD3FC}.k-m{color:#C4B5FD}.k-t{color:#FDBA74}.k-v{color:#E5E9F2}
/* ---- tabelas ---- */
.tb{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{padding:9px 14px;border-bottom:1px solid #EDF0F6;text-align:left;vertical-align:top}
th{background:#F5F7FB;color:var(--mut);font-size:11px;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap}
tr:last-child td{border-bottom:0}
td:first-child{font-weight:600;white-space:nowrap}
.esc{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}
.esc span{padding:3px 10px;border-radius:6px;font-size:12.5px;font-weight:700}
.eG{background:#DDF5EA;color:#04704B}.eY{background:#FFF1C7;color:#7A5600}.eO{background:#FFD9BC;color:#8A3404}.eR{background:#FBC6C6;color:#A3161A}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}
.two .card{padding:16px 18px}
.card.falta{border-left:4px solid #E0A100}
.okc{color:#04704B}.pend{color:#7A5600}.falt{color:#A3161A}
.two h3{margin:0 0 6px;font-size:15px}
.two p,.two li{color:var(--ink2);font-size:13.5px}
.two ul{margin:6px 0 0;padding-left:18px}
footer{padding:26px 0 40px;color:var(--mut);font-size:12.5px}
@media (max-width:640px){h1{font-size:24px}.wrap{padding:0 12px}.pv{padding:10px}ol.steps{padding-left:34px}}
</style>
</head>
<body>
<header><div class="wrap">
  <div class="eyebrow">Power BI · visual HTML · v1.2</div>
  <h1>Painel · Instalação em até 3 dias</h1>
  <p>Prévia do painel e todo o código DAX na mesma página, já com os nomes das suas tabelas. Lado esquerdo: a curva do indicador por mês, semana ou dia, aberta por cor e por AT. Lado direito: fixo no dia de hoje (D-0), com as ordens que já perdemos e as que estão para vencer.</p>
  <div class="tags"><span>1 medida principal</span><span>2 medidas de apoio + 1 opcional</span><span>ligado às suas tabelas</span><span>${linhasPrincipal} linhas de DAX</span><span>prévia com dados fictícios</span></div>
</div></header>
<nav><div class="wrap"><a href="#previa">Prévia</a><a href="#falta">O que falta</a><a href="#montar">Como montar</a><a href="#menu">Menu</a><a href="#filtros">Filtros</a><a href="#codigo">Código</a><a href="#modelo">Mapa do modelo</a><a href="#regras">Regras de cálculo</a></div></nav>

<div class="wrap">
<section id="previa">
  <h2>Prévia <small>interativa</small></h2>
  <p class="lead">É o HTML que a própria medida gera, avaliado com dados fictícios. Os botões funcionam como no Power BI: troque a curva em <b>Mês | Semana | Dia</b> e a lista em <b>Perdidas | Vencem hoje | Amanhã</b>.</p>
  <div class="card pv">
    <div class="pills" id="pills">${CEN.map((c, i) => '<button data-i="' + i + '" aria-pressed="' + (i === 0) + '">' + c.rotulo + '</button>').join('')}</div>
    <p class="nota" id="nota"></p>
    <div class="stage" id="stage"><iframe id="quadro" title="Prévia do painel"></iframe></div>
    <div class="dica"><span><b>Passe o mouse</b> nos pontos da curva e nas células para ver os volumes</span><span><b>Passe o mouse</b> em uma cor (faixa escura) para destacar as ATs dela</span><span><b>?</b> abre o “como ler”</span></div>
    <div class="prints">Prints em tamanho cheio (bons para ver no celular):${PRINTS.map((n, i) => '<a href="' + encodeURI(n) + '.png" target="_blank" rel="noopener">' + (i + 1) + '</a>').join('')}</div>
  </div>
  <div class="leg">
    <div class="card"><b><i>1</i>Resultado do mês</b><span>Número grande do mês do filtro, distância da meta, quantas instalações faltaram (ou sobraram), volumes e as 4 cores.</span></div>
    <div class="card"><b><i>2</i>Curva</b><span>12 meses, 12 semanas ou os dias do mês. Linha tracejada = meta. A cor do ponto mostra a distância da meta; o ponto vazado é o período ainda em andamento.</span></div>
    <div class="card"><b><i>3</i>Abertura por cor e AT</b><span>Cada linha é uma cor ou uma AT e cada coluna é o mesmo período do gráfico de cima. ATs em ordem de resultado no mês.</span></div>
    <div class="card"><b><i>4</i>Hoje · D-0</b><span>Carteira pendente na carga do dia: já perdidas, vencem hoje, vencem amanhã e no prazo. Não muda com o filtro de mês.</span></div>
    <div class="card"><b><i>5</i>Onde estão</b><span>A mesma conta por cor (alinhada com os 4 números de cima) e por AT, com a cor mais forte onde há mais ordens.</span></div>
    <div class="card"><b><i>6</i>Ordens</b><span>Lista das ordens de cada situação: em risco primeiro (sem agenda ou agenda depois do prazo), depois as mais antigas.</span></div>
  </div>
</section>

<section id="falta">
  <h2>Regra do lado direito <small>igual ao seu Power Query</small></h2>
  <p class="lead">A medida repete, com a data de hoje, a regra da sua coluna <code class="i">[Indicador Instalação 3D]</code>. A data de início do prazo é a <code class="i">[Data de Venda]</code>, a mesma do seu Power Query.</p>
  <div class="two">
    <div class="card"><h3>Prazo com pesos</h3>
      <p>O dia da criação não conta. Cada dia seguinte, até hoje, consome: dia útil <b>1</b>, sábado <b>0,75</b>, domingo <b>0,25</b>, feriado da <code class="i">dFeriados</code> <b>0,5</b> (o feriado vale mesmo se cair no fim de semana, como no seu código). Prazo consumido <b>acima de 3</b> = <b>fora do indicador</b>; 3 ou menos = dentro.</p></div>
    <div class="card"><h3>Vence hoje, vence amanhã</h3>
      <p><b>Vence hoje:</b> está dentro, mas amanhã o consumo passa de 3 (hoje é o último dia). <b>Vence amanhã:</b> amanhã ainda está dentro e no dia seguinte passa de 3. Já perdida: consumo atual acima de 3.</p></div>
    <div class="card falta"><h3>Por que recalcula em vez de ler a coluna</h3>
      <p>A coluna do Power Query só muda quando a base atualiza, e a medida precisa separar quem vence hoje e amanhã. Recalculando com a mesma regra os números batem com a coluna no dia da atualização. Se a ordem não tiver data, a medida usa o valor da coluna (<code class="i">_valorFora</code>).</p></div>
    <div class="card falta"><h3>Só instalações pendentes</h3>
      <p>Se a carga traz também reparos ou atividades concluídas, é preciso filtrar (modelo comentado na <code class="i">_pendModelo</code>). Ordens com status "CARGA FUTURA" (data depois de hoje) ficam como dentro do indicador.</p></div>
  </div>
</section>

<section id="montar">
  <h2>Como montar <small>no seu arquivo</small></h2>
  <p class="lead">O painel é um visual só e já usa os nomes do seu modelo.</p>
  <div class="card"><ol class="steps">
    <li><b>Crie as duas medidas de apoio:</b> <code class="i">INSTALACAO_3D NO PRAZO</code> e <code class="i">INSTALACAO_3D TOTAL</code>. São o numerador e o denominador da sua <code class="i">% INSTALACAO_3D</code>, cada um em uma medida. A terceira (a sua medida reescrita com <code class="i">DIVIDE</code>) é opcional.</li>
    <li><b>Crie a medida principal</b> (bloco 4 do código). As tabelas, a <code class="i">dCalendario[Data]</code> e as duas medidas já estão com os nomes do seu arquivo.</li>
    <li><b>Insira o visual HTML</b>, arraste a medida para o campo de valores e deixe o visual sem título e com fundo transparente. O ideal é usar o mesmo visual dos seus outros painéis (dá para copiar um deles e colar neste arquivo).</li>
    <li><b>Tamanho de referência:</b> 1264 × 638 px, em uma página 1280 × 720 com uma faixa de filtros em cima. O painel se ajusta sozinho; a partir de cerca de 1030 px de largura ele continua inteiro (cabe ao lado de um menu lateral).</li>
    <li><b>Filtros da página:</b> mês (ou qualquer coluna da <code class="i">dCalendario</code>), cor e AT (colunas da <code class="i">dAT</code>). O lado direito ignora o mês por conta própria: não precisa mexer em “Editar interações”.</li>
    <li><b>Confira o lado esquerdo:</b> o número grande do mês tem que ser igual ao da sua <code class="i">% INSTALACAO_3D</code> com o mesmo filtro.</li>
    <li><b>Lado direito:</b> a coluna do indicador e a data de criação já estão ligadas na <code class="i">_pendModelo</code>; confira a regra em <a href="#falta">Regra do lado direito</a>.</li>
  </ol></div>
</section>

<section id="codigo">
  <h2>Código <small>DAX</small></h2>
  <p class="lead">Os mesmos textos estão na pasta em <code class="i">medidas_de_apoio_v1.txt</code> e <code class="i">painel_instalacao_3d_html_v1.txt</code>.</p>
  ${apoio.map((m, i) => bloco('m' + i, (i + 1) + ' · ' + m.nome, i === 0 ? 'medida de apoio · numerador da sua medida' : i === 1 ? 'medida de apoio · denominador da sua medida' : 'opcional · a sua medida reescrita com DIVIDE', (m.nota ? m.nota + '\n' : '') + m.corpo + '\n', true)).join('\n  ')}
  ${bloco('bf', '6 · Barra Filtros Instalacao HTML', 'terceiro visual HTML, por baixo das segmentações nativas · 62 px de altura', fs.readFileSync(BARRA, 'utf8').replace(/\s+$/, '') + '\n', false)}
  ${bloco('mn', '5 · Menu Lateral Instalacao HTML', 'segundo visual HTML, ao lado do painel · 4 páginas · cole em cada página e troque só _paginaAtual', fs.readFileSync(MENU, 'utf8').replace(/\s+$/, '') + '\n', false)}
  ${bloco('mp', '4 · Painel Instalacao 3D HTML', 'medida principal · ' + linhasPrincipal + ' linhas · vai no visual HTML Content', principalTxt, false)}
</section>

<section id="menu">
  <h2>Menu lateral <small>4 páginas</small></h2>
  <p class="lead">Mesmo modelo do menu do BSC: INSTALAÇÃO 3D, CHEGADA NO SLOT, ROTEIRIZAÇÃO e TMR. Em cada página, coloque o visual do menu com 200 px de largura e troque só a VAR <code class="i">_paginaAtual</code>. Os botões nativos transparentes (um por item, 36 px de altura, 7 px de intervalo, começando a 109 px do topo) fazem a navegação. A cor e a AT vêm da <code class="i">dAT</code>, sem usar a tabela <code class="i">'Seletor Cor'</code>.</p>
  <div class="card pv"><img src="10-com-o-menu-lateral.png" alt="Painel ao lado do menu lateral" style="width:100%;border-radius:12px;display:block"></div>
</section>

<section id="filtros">
  <h2>Barra de filtros <small>para os filtros não destoarem</small></h2>
  <p class="lead">Um terceiro visual HTML, com 62 px de altura, desenha a faixa escura, o título e uma caixa com rótulo para cada filtro. As segmentações nativas ficam por cima das caixas, com fundo transparente e texto branco (é a mesma ideia dos botões nativos sobre o menu). Apague a forma com borda preta que está por trás do filtro hoje.</p>
  <div class="card"><ol class="steps">
    <li><b>Visual HTML</b> com a medida do bloco 6: 62 px de altura e a mesma largura do painel, logo acima dele.</li>
    <li><b>Uma segmentação por caixa</b> (estilo Lista suspensa), com 160 × 26 px. A partir da borda direita da barra, elas começam a 536, 358 e 180 px; todas a 24 px do topo da barra.</li>
    <li><b>Formato de cada segmentação:</b> cabeçalho desligado; valores em Segoe UI 10, cor branca, sem tela de fundo; em Geral → Efeitos, tela de fundo, borda e sombra desligadas.</li>
    <li><b>Traga as segmentações para a frente</b> (Formato → Trazer para a frente).</li>
  </ol></div>
</section>

<section id="modelo">
  <h2>Mapa do modelo <small>o que a medida lê</small></h2>
  <p class="lead">Tudo que a medida principal lê do modelo está em 6 VARs marcadas com <code class="i">&lt;&lt;&lt; MODELO</code>. No seu teste a medida já calculou com os dados reais; só faltou a formatação, corrigida na v1.2.</p>
  <div class="card tb"><table>
    <tr><th>O painel precisa de</th><th>Nome usado no código</th><th>Onde aparece</th><th>Situação</th></tr>
    <tr><td>Calendário</td><td><code class="i">dCalendario[Data]</code></td><td><code class="i">_fimSel</code> <code class="i">_gradeModelo</code> <code class="i">_calModelo</code></td><td><b class="okc">Funcionou no seu teste.</b> Só a coluna de data é usada. O eixo diário mostra os dias que existem nela; um dia que não esteja na <code class="i">dCalendario</code> não aparece na curva.</td></tr>
    <tr><td>Instalações no prazo</td><td><code class="i">'fINSTALACAO + ME_3D'[num_Total]</code></td><td><code class="i">[INSTALACAO_3D NO PRAZO]</code></td><td><b class="okc">Funcionou no seu teste.</b></td></tr>
    <tr><td>Total de instalações</td><td><code class="i">'fINSTALACAO + ME_3D_TOTAL'[num_Total]</code></td><td><code class="i">[INSTALACAO_3D TOTAL]</code></td><td><b class="okc">Funcionou no seu teste.</b> As duas tabelas precisam estar relacionadas com a <code class="i">dCalendario</code> e com a <code class="i">dAT</code>.</td></tr>
    <tr><td>AT e cor da área</td><td><code class="i">dAT[AREA ]</code> <code class="i">dAT[COR_AREA ]</code></td><td><code class="i">_gradeModelo</code> <code class="i">_atsCtx</code></td><td><b class="okc">Funcionou no seu teste</b> (17 ATs e as 4 cores apareceram). Cores esperadas: OURO, PRATA 1, PRATA 2, BRONZE (tabela <code class="i">_coresCfg</code>).</td></tr>
    <tr><td>Carga do dia</td><td><code class="i">'ETA DIRECT D-0'</code></td><td><code class="i">_pendModelo</code></td><td><b class="okc">Funcionou no seu teste</b> (1.315 atividades lidas). Não precisa de relacionamento com a <code class="i">dAT</code>: o filtro de cor e AT é aplicado pela coluna AT.</td></tr>
    <tr><td>AT da ordem</td><td><code class="i">'ETA DIRECT D-0'[AT]</code></td><td><code class="i">_pendModelo</code></td><td><b class="okc">Confirmado no print.</b> Os valores têm que ser os mesmos da <code class="i">dAT[AREA ]</code>.</td></tr>
    <tr><td>Número da ordem e PON</td><td><code class="i">[Número da Ordem de Serviço]</code> <code class="i">[PON]</code></td><td><code class="i">_pendModelo</code></td><td><b class="okc">Ligadas</b> (nomes do seu Power Query). Na lista, um clique no PON seleciona o valor inteiro para copiar com Ctrl+C.</td></tr>
    <tr><td>Situação da ordem</td><td><code class="i">'ETA DIRECT D-0'[Indicador Instalação 3D]</code></td><td><code class="i">_pendModelo</code> <code class="i">_valorFora</code></td><td><b class="okc">Ligada.</b> Só é usada quando a ordem não tem data; senão a medida recalcula a regra.</td></tr><tr><td>Feriados</td><td><code class="i">dFeriados[Data]</code></td><td><code class="i">_feriados</code></td><td><b class="okc">Ligada</b> (aparece no seu modelo). Cada feriado pesa 0,5.</td></tr>
    <tr><td>Data de início do prazo</td><td><code class="i">'ETA DIRECT D-0'[Data de Venda]</code></td><td><code class="i">_pendModelo</code></td><td><b class="okc">Ligada.</b> Separa quem vence hoje e quem vence amanhã.</td></tr>
    
    <tr><td>Data da carga <em>(opcional)</em></td><td><code class="i">BLANK()</code></td><td><code class="i">_dataCarga</code></td><td>Com ela o painel avisa quando a carga de hoje ainda não entrou.</td></tr>
  </table></div>
</section>

<section id="regras">
  <h2>Regras de cálculo <small>para conferir</small></h2>
  <div class="two">
    <div class="card"><h3>Indicador e cores</h3>
      <p>Indicador = <code class="i">[INSTALACAO_3D NO PRAZO]</code> ÷ <code class="i">[INSTALACAO_3D TOTAL]</code>, a mesma conta da sua medida. Meta de 81% (VAR <code class="i">_meta</code>).</p>
      <p>A cor de pontos e células compara o resultado com a meta, na mesma escala do BSC:</p>
      <div class="esc"><span class="eG">na meta</span><span class="eY">até 10% abaixo</span><span class="eO">até 20% abaixo</span><span class="eR">mais de 20% abaixo</span></div>
      <ul><li>Mês de referência = mês do filtro. Sem filtro, ou com mês futuro, vale o mês atual.</li><li>A curva começa onde a base começa: meses e semanas sem nenhuma instalação antes do primeiro dado não aparecem.</li><li>Semana = segunda a domingo; o rótulo <b>S46</b> é o mesmo número da coluna “Semana do Ano” da <code class="i">dCalendario</code>.</li><li>Dia = os dias do mês que existem na <code class="i">dCalendario</code>.</li><li>A linha “Geral” e as linhas das cores são sempre o total, mesmo com filtro, para servir de comparação.</li></ul>
    </div>
    <div class="card"><h3>Hoje · D-0</h3>
      <p>Idade = prazo consumido desde o dia seguinte à criação: útil 1, sábado 0,75, domingo 0,25, feriado 0,5. Passou de 3 (VAR <code class="i">_prazoDias</code>) = fora do indicador.</p>
      <ul><li><b>Já perdida:</b> consumo acima de 3.</li><li><b>Vence hoje:</b> hoje é o último dia dentro.</li><li><b>Vence amanhã:</b> amanhã é o último dia dentro.</li><li><b>No prazo:</b> o resto.</li></ul>
      <p>“Hoje” é o relógio do Power BI no fuso UTC−3 (VAR <code class="i">_fuso</code>), igual no Desktop e no serviço.</p>
    </div>
  </div>
</section>

<footer>Gerado por <code class="i">node tools/dax-preview/build-instalacao.js</code> a partir dos arquivos .txt desta pasta. A prévia confere a sintaxe e o HTML gerado; ela não substitui o teste no Power BI com os dados reais.</footer>
</div>

<script type="application/json" id="cenarios">${json(CEN.map((c) => ({ nota: c.nota, html: c.pagina })))}</script>
<script>
(function () {
  var cen = JSON.parse(document.getElementById('cenarios').textContent);
  var quadro = document.getElementById('quadro');
  var stage = document.getElementById('stage');
  var nota = document.getElementById('nota');
  var pills = document.getElementById('pills');
  function escala() { quadro.style.transform = 'scale(' + stage.clientWidth / 1280 + ')'; }
  function mostrar(i) {
    quadro.srcdoc = cen[i].html;
    nota.textContent = cen[i].nota;
    Array.prototype.forEach.call(pills.children, function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
  }
  pills.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) mostrar(Number(b.dataset.i)); });
  window.addEventListener('resize', escala);
  if (window.ResizeObserver) new ResizeObserver(escala).observe(stage);
  escala();
  mostrar(0);

  // Copiar: usa a area de transferencia; se o navegador bloquear, seleciona o texto para Ctrl+C.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.cp');
    if (!b) return;
    var pre = document.getElementById(b.dataset.alvo);
    var txt = pre.textContent;
    function ok(msg) { b.textContent = msg; b.classList.add('ok'); setTimeout(function () { b.textContent = 'Copiar'; b.classList.remove('ok'); }, 1800); }
    function selecionar() {
      var r = document.createRange(); r.selectNodeContents(pre);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      try { if (document.execCommand('copy')) { ok('Copiado'); return; } } catch (err) {}
      ok('Selecionado: Ctrl+C');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { ok('Copiado'); }, selecionar);
    else selecionar();
  });
})();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'index.html'), pagina);
console.log('página : index.html com ' + CEN.length + ' cenários + ' + (apoio.length + 1) + ' medidas | ' + Math.round(pagina.length / 1024) + ' KB');

// a propria pagina: prova que abre, escala a previa e troca de cenario
jobs.push({
  file: path.join(out, 'index.html'), w: 1360, h: 900, scale: 1, wait: 1500,
  before: async (p) => {
    const erros = [];
    p.on('pageerror', (e) => erros.push(String(e)));
    const temPainel = async () => { const f = p.frames().find((x) => x.name() === 'i3'); return !!f && (await f.locator('.i3 .hero').count()) === 2; };
    const a = await temPainel();
    await p.click('#pills button:nth-child(4)');
    await p.waitForTimeout(1200);
    const b = await temPainel();
    const k = await p.evaluate(() => document.getElementById('quadro').style.transform);
    console.log('index.html             : prévia carregada = ' + a + ' | troca de cenário = ' + b + ' | ' + k + ' | erros de script = ' + erros.length);
    if (!a || !b || erros.length) throw new Error('index.html nao abriu como esperado ' + erros.join(' | '));
  },
});

R.shots(jobs).then(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('arquivos gravados em ' + path.relative(repo, out));
}).catch((e) => { fs.rmSync(tmp, { recursive: true, force: true }); console.error('\nERRO: ' + e.message); process.exit(1); });
