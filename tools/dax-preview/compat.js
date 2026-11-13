'use strict';
// Confere o HTML gerado contra as regras do visual HTML Content (edicao certificada inclusa).
const TAGS = ['style', 'details', 'summary', 'em', 'div', 'section', 'article', 'aside', 'span', 'i', 'b', 'u', 'small', 'h2', 'p', 'svg', 'circle', 'rect', 'path'];
const ATTRS = ['class', 'style', 'title', 'tabindex', 'role', 'viewbox', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'd'];

/**
 * @param {string} html
 * @param {{estrito?: boolean}} [opts] estrito = regras a mais para visuais que passam o HTML por um
 *   filtro do tipo DOMPurify: um <style> na frente de tudo e descartado, e um bloco de CSS que
 *   contenha "<" seguido de letra (mesmo em comentario) e removido inteiro.
 */
function compat(html, opts) {
  const problems = [];
  if (html.includes('"')) problems.push('aspas duplas no HTML gerado');
  const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  if (opts && opts.estrito) {
    if (/^\s*<style/i.test(html)) problems.push('o HTML comeca com <style>: o bloco de CSS precisa ficar dentro do elemento principal');
    if (css.includes('<')) problems.push('o CSS contem o sinal "<" (' + css.slice(Math.max(0, css.indexOf('<') - 30), css.indexOf('<') + 20).replace(/\s+/g, ' ') + ')');
    if ((html.match(/<style/g) || []).length !== 1) problems.push('esperava exatamente um bloco <style>');
  }
  for (const bad of ['@import', '@font-face', 'url(', 'expression(', 'javascript:', '@container', '@property', '@layer', 'color-mix(']) if (css.includes(bad)) problems.push('CSS usa ' + bad);
  const body = html.replace(/<style>[\s\S]*?<\/style>/, '');
  const tags = new Set();
  const re = /<([a-zA-Z0-9]+)((?:\s+[a-zA-Z-]+(?:='[^']*')?)*)\s*\/?>/g;
  let m;
  while ((m = re.exec(body))) {
    const tag = m[1].toLowerCase();
    tags.add(tag);
    if (!TAGS.includes(tag)) problems.push('tag fora da lista: <' + tag + '>');
    const ar = /([a-zA-Z-]+)(?:='([^']*)')?/g;
    let a;
    while ((a = ar.exec(m[2]))) {
      const name = a[1].toLowerCase();
      if (name.startsWith('on')) problems.push('atributo de evento: ' + name);
      else if (!ATTRS.includes(name) && !name.startsWith('aria-') && !name.startsWith('data-')) problems.push('atributo fora da lista: ' + name + ' em <' + tag + '>');
      if (name === 'style') {
        if (!/^(\s*--[a-z]+:[^;]+;?)+$/.test(a[2])) problems.push('style com algo alem de variaveis CSS: ' + a[2]);
        if (!/\bclass='v'/.test(m[2])) problems.push('style fora do wrapper neutro .v: <' + tag + m[2] + '>');
      }
    }
  }
  // tags abertas x fechadas
  const open = {};
  body.replace(/<(\/?)([a-zA-Z0-9]+)[^>]*>/g, (_, c, t) => { t = t.toLowerCase(); open[t] = (open[t] || 0) + (c ? -1 : 1); return ''; });
  for (const [t, n] of Object.entries(open)) if (n !== 0) problems.push('<' + t + '> abre e fecha em quantidades diferentes (' + n + ')');
  return { problems, tags: [...tags].sort() };
}
module.exports = { compat };
