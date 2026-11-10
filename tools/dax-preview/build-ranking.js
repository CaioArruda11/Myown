'use strict';
// ============================================================================
// Previas da tela "Ranking de Tecnicos" (pagina Abertura Hierarquia)
//
//   node tools/dax-preview/build-ranking.js           -> grava em preview/ranking-v2/
//   node tools/dax-preview/build-ranking.js <pasta>   -> grava em outra pasta
//
// Mesmos passos do build.js: sintaxe da medida, avaliacao com dados ficticios
// (mocks.js), checagem contra as regras do HTML Content e prints.
// ============================================================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const dax = require('./dax.js');
const M = require('./mocks.js');
const R = require('./render.js');
const { compat } = require('./compat.js');

const repo = path.resolve(__dirname, '../..');
const out = path.resolve(process.argv[2] || path.join(repo, 'preview/ranking-v2'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dax-preview-'));
fs.mkdirSync(out, { recursive: true });

const NOVO = path.join(repo, 'ranking_tecnicos_html_v2.txt');
const ANTIGO = path.join(repo, 'ranking_tecnicos_html_v1_original.txt');
const MENU = path.join(repo, 'menu_lateral_html_v6.txt');
const TEMA = 'GRAFITE';

let first = true;
function ranking(file, cen, check) {
  const r = dax.evaluate(file, cen.mocks, { utcNow: M.UTC_NOW, calculate: cen.calculate });
  if (r.unusedMocks.length) throw new Error('mocks sem VAR correspondente: ' + r.unusedMocks.join(', '));
  if (check) {
    const c = compat(r.html);
    if (c.problems.length) throw new Error('HTML fora das regras do HTML Content:\n  ' + [...new Set(c.problems)].join('\n  '));
    if (first) { first = false; console.log('ranking: sintaxe ok | medida ' + r.sourceChars + ' caracteres -> HTML ' + r.html.length + ' | tags: ' + c.tags.join(' ')); }
  }
  return r.html;
}
const menu = dax.evaluate(MENU, Object.assign({}, M.menu.geral, { _paginaAtual: 'Abertura Hierarquia', _tema: TEMA }), { utcNow: M.UTC_NOW }).html;

const base = M.ranking(253, 11);
const CEN = {
  geral: base,
  tecnico: M.ranking(253, 11, { sel: base.nomes[40], m1: [0.061, 0.031, 3.1] }),
  supervisor: M.ranking(253, 11, { supervisor: true, irr7: 0.058, ifi7: 0.026, m1: [0.047, 0.031, 2.7] }),
};

const L = R.LAYOUT_RK;
const jobs = [];
const noRk = (fn) => async (p) => { const fr = p.frames().find((f) => f.name() === 'rk'); await fn(fr); await p.waitForTimeout(500); };
function pagina(name, html, o) {
  const opt = o || {};
  const f = path.join(opt.keep ? out : tmp, (opt.keep || name) + '.html');
  fs.writeFileSync(f, R.composeRanking({ menu, rk: html }, opt));
  jobs.push({ file: f, out: path.join(out, name + '.png'), w: L.page.w, h: L.page.h, scale: 2, before: opt.before });
}

pagina('0-antes', ranking(ANTIGO, CEN.geral, false), { title: 'Ranking · versão anterior' });
pagina('1-visao-geral', ranking(NOVO, CEN.geral, true), { title: 'Ranking v2 · prévia', keep: 'previa-interativa' });
pagina('2-tecnico-selecionado', ranking(NOVO, CEN.tecnico, true), { title: 'Ranking v2 · técnico selecionado' });
pagina('3-visao-supervisor', ranking(NOVO, CEN.supervisor, true), { title: 'Ranking v2 · supervisão', visao: 'SUPERVISOR' });
pagina('4-botao-piores', ranking(NOVO, CEN.geral, true), { title: 'Ranking v2 · piores primeiro', before: noRk((f) => f.click('.tg-ord summary')) });
pagina('5-botao-criticos-e-dica', ranking(NOVO, CEN.geral, true), {
  title: 'Ranking v2 · só críticos',
  before: noRk(async (f) => { await f.click('.tg-crit summary'); await f.locator('.row.low .ic:not(.tN)').nth(3).hover(); }),
});

// confere medidas do visual no tamanho de referencia
{
  const f = path.join(tmp, 'rk.html');
  fs.writeFileSync(f, R.wrap(ranking(NOVO, CEN.geral, true)));
  jobs.push({
    file: f, w: L.rk.w, h: L.rk.h, scale: 1,
    before: async (p) => {
      const o = await p.evaluate(() => {
        const cut = [...document.querySelectorAll('.dr,.gt-l,.kp small,.kp b,.ph,.gh,.pts,.hit,.ic')].filter((e) => e.scrollWidth > e.clientWidth + 1).length;
        const rows = [...document.querySelectorAll('.row')];
        const box = document.querySelector('.rows').getBoundingClientRect();
        const vis = rows.filter((e) => { const r = e.getBoundingClientRect(); return r.top >= box.top && r.bottom <= box.bottom; }).length;
        return { linhas: rows.length, visiveis: vis, cortados: cut };
      });
      console.log('ranking ' + L.rk.w + 'x' + L.rk.h + ': ' + o.linhas + ' linhas, ' + o.visiveis + ' visiveis sem rolar | textos cortados = ' + o.cortados);
    },
  });
}

R.shots(jobs).then(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('previas gravadas em ' + path.relative(repo, out));
});
