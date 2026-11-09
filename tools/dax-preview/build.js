'use strict';
// ============================================================================
// Gera as previas das 3 medidas HTML do BSC a partir dos proprios arquivos .txt
//
//   node tools/dax-preview/build.js            -> grava em preview/bsc-v4/
//   node tools/dax-preview/build.js <pasta>    -> grava em outra pasta
//
// Passos: (1) parse + checagem de sintaxe de cada medida, (2) avaliacao da
// camada de apresentacao com os dados ficticios de mocks.js, (3) checagem do
// HTML contra as regras do visual HTML Content, (4) prints com o Chromium.
// Qualquer erro em (1)-(3) interrompe a geracao e aponta a linha.
// ============================================================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const dax = require('./dax.js');
const M = require('./mocks.js');
const R = require('./render.js');
const { compat } = require('./compat.js');

const repo = path.resolve(__dirname, '../..');
const out = path.resolve(process.argv[2] || path.join(repo, 'preview/bsc-v4'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dax-preview-'));
fs.mkdirSync(out, { recursive: true });

const FILES = {
  corpo: path.join(repo, 'bsc_corpo_html_v4.txt'),
  menu: path.join(repo, 'menu_lateral_html_v5.txt'),
  status: path.join(repo, 'bsc_status_bases_html_v2.txt'),
};

const seen = {};
function run(which, mocks) {
  const r = dax.evaluate(FILES[which], mocks, { utcNow: M.UTC_NOW });
  if (r.unusedMocks.length) throw new Error(which + ': mocks sem VAR correspondente: ' + r.unusedMocks.join(', '));
  const c = compat(r.html);
  if (c.problems.length) throw new Error(which + ': HTML fora das regras do HTML Content:\n  ' + [...new Set(c.problems)].join('\n  '));
  if (!seen[which]) {
    seen[which] = true;
    console.log(which.padEnd(7) + ': sintaxe ok | medida ' + r.sourceChars + ' caracteres -> HTML ' + r.html.length + ' | tags: ' + c.tags.join(' '));
  }
  return r.html;
}

const L = R.LAYOUT;
const jobs = [];
const write = (dir, name, html) => { const f = path.join(dir, name); fs.writeFileSync(f, html); return f; };

// ---- pagina completa (menu + filtros nativos simulados + status + corpo) ----
function dash(name, c, mn, st, o) {
  const html = R.compose({ corpo: run('corpo', M.corpo[c]), menu: run('menu', M.menu[mn]), status: run('status', M.status[st]) }, o);
  const f = write(o.keep ? out : tmp, (o.keep || name) + '.html', html);
  jobs.push({ file: f, out: path.join(out, name + '.png'), w: L.page.w, h: L.page.h, scale: 2 });
}
dash('1-dados-do-print', 'print', 'geral', 'print', { title: 'BSC v4 · prévia', keep: 'previa-interativa' });
dash('2-bronze-AT-selecionada', 'bronzeAT', 'bronzeAT', 'misto', { title: 'BSC v4 · BRONZE + AT MA', cor: 'BRONZE', at: 'MA' });
dash('3-resultado-bom', 'bom', 'geral', 'emDia', { title: 'BSC v4 · resultado bom' });

// ---- painel de atualizacao: estados e tamanhos ----
{
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const cell = (label, cen, w, h) => '<figure><figcaption>' + label + '</figcaption><iframe style="width:' + w + 'px;height:' + h + 'px" srcdoc="' +
    esc(R.wrap(run('status', M.status[cen]))) + '"></iframe></figure>';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Atualização das bases · estados</title><style>' +
    'body{margin:0;padding:18px 20px;background:linear-gradient(180deg,#EEF3FA,#E3EBF6);font-family:"Segoe UI",system-ui,Arial,sans-serif;display:flex;flex-wrap:wrap;gap:16px 20px;align-items:flex-start;width:680px;box-sizing:border-box}' +
    'figure{margin:0}figcaption{margin:0 0 5px 2px;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#667085}' +
    'iframe{display:block;border:0;border-radius:12px;background:rgba(255,255,255,.72)}' +
    '</style></head><body>' +
    cell('Parte em dia, parte atrasada, uma sem data', 'misto', 308, 114) +
    cell('Todas em dia', 'emDia', 308, 114) +
    cell('Datas do print (todas atrasadas)', 'print', 308, 114) +
    cell('Visual estreito: 1 coluna', 'misto', 200, 226) +
    cell('Visual largo (a partir de 430px): 4 x 2', 'misto', 640, 112) +
    '</body></html>';
  jobs.push({ file: write(tmp, 'status.html', html), out: path.join(out, '4-atualizacao-das-bases-estados.png'), w: 680, h: 560, scale: 2 });
}

// ---- corpo: ajuda aberta + corpo em um visual menor ----
{
  const f = write(tmp, 'corpo.html', R.wrap(run('corpo', M.corpo.print)));
  jobs.push({
    file: f, out: path.join(out, '5-ajuda-como-ler.png'), w: L.corpo.w, h: L.corpo.h, scale: 2,
    before: async (p) => { await p.hover('.help'); await p.waitForTimeout(400); },
  });
  jobs.push({ file: f, out: path.join(out, '6-corpo-em-visual-menor-860x480.png'), w: 860, h: 480, scale: 2 });
  // confere se tudo cabe sem rolagem no tamanho de referencia
  jobs.push({
    file: f, w: L.corpo.w, h: L.corpo.h, scale: 1,
    before: async (p) => {
      const o = await p.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const fits = (e) => e.scrollHeight <= e.clientHeight;
        const cut = [...document.querySelectorAll('.nm,.score,.sub,.at-id,.card-name')].filter((e) => e.scrollWidth > e.clientWidth + 1).length;
        return { tabela: fits(q('.rows')), ranking: fits(q('.ats')), cortados: cut };
      });
      console.log('corpo ' + L.corpo.w + 'x' + L.corpo.h + ': 12 indicadores sem rolagem = ' + o.tabela + ' | 17 ATs sem rolagem = ' + o.ranking + ' | textos cortados = ' + o.cortados);
    },
  });
}

R.shots(jobs).then(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('previas gravadas em ' + path.relative(repo, out));
});
