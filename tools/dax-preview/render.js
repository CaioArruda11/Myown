'use strict';
// Monta as paginas de previa (cada visual em um iframe, como no Power BI) e tira os prints.
const fs = require('fs');
const path = require('path');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Documento isolado que imita o DOM do visual HTML Content (wrappers sem altura definida). */
function wrap(html) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:"Segoe UI",wf_segoe-ui_normal,helvetica,arial,sans-serif;font-size:12pt;color:#000}' +
    '</style></head><body><div id="sandbox-host"><div id="htmlViewer"><div id="htmlContent" class="htmlViewerEntry">' +
    html + '</div></div></div></body></html>';
}

// Posicoes medidas no print (pagina 1280 x 720).
const LAYOUT = {
  page: { w: 1280, h: 720 },
  menu: { x: 20, y: 6, w: 238, h: 700 },
  cor: { x: 275, y: 6, w: 400, h: 114 },
  at: { x: 686, y: 6, w: 118, h: 114 },
  mes: { x: 813, y: 6, w: 132, h: 114 },
  status: { x: 954, y: 6, w: 308, h: 114 },
  corpo: { x: 275, y: 130, w: 987, h: 576 },
};

function compose(parts, opts) {
  const o = opts || {};
  const L = LAYOUT;
  const box = (r) => 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px';
  const frame = (r, html, name, id) => '<iframe name="' + id + '" title="' + name + '" style="' + box(r) + '" srcdoc="' + esc(wrap(html)) + '"></iframe>';
  const cores = ['BRONZE', 'OURO', 'PRATA 1', 'PRATA 2'].map((c) => '<span class="' + (o.cor === c ? 'sel' : '') + '">' + c + '</span>').join('');
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + (o.title || 'Prévia') + '</title><style>' +
    'html,body{margin:0;background:#C9D3E3;font-family:"Segoe UI",system-ui,Arial,sans-serif}' +
    '.pg{position:relative;width:' + L.page.w + 'px;height:' + L.page.h + 'px;margin:0 auto;background:linear-gradient(180deg,#EEF3FA,#E3EBF6);overflow:hidden}' +
    'iframe{position:absolute;border:0;background:transparent;color-scheme:normal}' +
    '.sl{position:absolute;box-sizing:border-box;padding:9px 11px;border-radius:12px;background:rgba(255,255,255,.72);box-shadow:0 1px 2px rgba(16,24,40,.04);font-size:12px;color:#1F2937}' +
    '.sl b{display:block;font-weight:500;margin-bottom:14px}.sl.big b{font-size:14px}' +
    '.sl .bt{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin:0 20px}.sl .bt span{height:56px;display:flex;align-items:center;justify-content:center;background:#F3F7FC;border:1px solid #E3EAF3;font-size:11px;color:#475467}' +
    '.sl .bt span.sel{background:#665BDC;border-color:#665BDC;color:#fff}' +
    '.sl .dd{height:24px;display:flex;align-items:center;justify-content:space-between;padding:0 7px;border:1px solid #E3EAF3;background:#fff;font-size:11px;color:#344054}.sl .dd:after{content:"⌄";font-size:13px;margin-top:-5px;color:#667085}' +
    '.nativo{position:absolute;font:600 9px "Segoe UI",Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#98A2B3}' +
    '</style></head><body><div class="pg">' +
    frame(L.menu, parts.menu, 'Menu lateral', 'menu') +
    '<div class="sl big" style="' + box(L.cor) + '"><b>Selecione a cor</b><div class="bt">' + cores + '</div></div>' +
    '<div class="sl" style="' + box(L.at) + '"><b>Selecione a AT</b><div class="dd">' + (o.at || 'Todos') + '</div></div>' +
    '<div class="sl" style="' + box(L.mes) + '"><b>Selecione o Mês</b><div class="dd">' + (o.mes || 'Outubro/2026') + '</div></div>' +
    frame(L.status, parts.status, 'Status das bases', 'status') +
    frame(L.corpo, parts.corpo, 'Corpo BSC', 'corpo') +
    '</div></body></html>';
}

async function shots(jobs) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  for (const j of jobs) {
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: j.scale || 2 });
    await page.goto('file://' + path.resolve(j.file));
    await page.waitForTimeout(j.wait || 900);
    if (j.before) await j.before(page);
    if (j.out) await page.screenshot({ path: j.out, clip: j.clip });
    if (j.after) await j.after(page);
    await page.close();
  }
  await browser.close();
}

module.exports = { wrap, compose, shots, LAYOUT };
