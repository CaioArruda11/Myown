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
// (5) menu e barra: botoes nativos nas posicoes documentadas, nada cortado, (6) botoes
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
  menu1ag: 'menu_lateral_1agenda_html_v2.txt',
  barra: 'barra_filtros_1agenda_html_v1.txt',
  tela: 'tela_analitico_1agenda_html_v1.txt',
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

// ------------------------------------------------------------ menu lateral (5 paginas)
const PAGINAS = ['INSTALAÇÃO 3D', 'CHEGADA NO SLOT', 'ROTEIRIZAÇÃO', 'TMR', 'EFETIVIDADE 1 AGENDA'];
function menuDaPagina(pg) {
  const txt = fs.readFileSync(caminho('menu'), 'utf8');
  if (!txt.includes('VAR _paginaAtual =\n    "INSTALAÇÃO 3D"\n')) throw new Error('menu: _paginaAtual mudou de formato');
  if (/ANAL[IÍ]TICO 1 AGENDA", \d/.test(txt)) throw new Error('menu: o analitico nao deve estar no menu');
  const f = path.join(tmp, 'menu-' + PAGINAS.indexOf(pg) + '.txt');
  fs.writeFileSync(f, txt.replace('VAR _paginaAtual =\n    "INSTALAÇÃO 3D"\n', 'VAR _paginaAtual =\n    ' + JSON.stringify(pg) + '\n'));
  const r = dax.evaluate(f, MENU_MOCKS.geral, { utcNow: M.UTC_NOW });
  const c = compat(r.html, { estrito: true });
  if (r.unusedMocks.length || c.problems.length) throw new Error('menu: ' + r.unusedMocks.concat(c.problems).join('; '));
  if ((r.html.match(/class='it[^']* on'/g) || []).length !== 1) throw new Error('menu: pagina atual nao marcada (' + pg + ')');
  return r.html;
}
const MENUS = Object.fromEntries(PAGINAS.map((p) => [p, menuDaPagina(p)]));
console.log('menu v2    : sintaxe ok | ' + PAGINAS.length + ' páginas, uma marcada em cada, sem o analítico | HTML ' + MENUS['EFETIVIDADE 1 AGENDA'].length);
// copia pronta da pagina da 1a agenda: tem que desenhar exatamente o mesmo menu, com o item da 1a agenda aceso
{
  const r = dax.evaluate(caminho('menu1ag'), MENU_MOCKS.geral, { utcNow: M.UTC_NOW });
  if (r.unusedMocks.length) throw new Error('menu 1ª agenda: ' + r.unusedMocks.join('; '));
  if (r.html !== MENUS['EFETIVIDADE 1 AGENDA']) throw new Error('menu 1ª agenda: a cópia pronta não é igual ao menu v2 com _paginaAtual = "EFETIVIDADE 1 AGENDA"');
  if (!/^Menu Lateral 1 Agenda HTML =/.test(ler('menu1ag'))) throw new Error('menu 1ª agenda: nome da medida mudou');
  console.log('menu 1AG   : sintaxe ok | cópia pronta = menu v2 com EFETIVIDADE 1 AGENDA aceso');
}

function barra(k, mocks) {
  const r = dax.evaluate(caminho(k), mocks, { utcNow: M.UTC_NOW });
  const c = compat(r.html, { estrito: true });
  if (r.unusedMocks.length || c.problems.length) throw new Error(ARQ[k] + ': ' + r.unusedMocks.concat(c.problems).join('; '));
  return r.html;
}
// geometria documentada na barra: borda esquerda das segmentacoes e do botao nativo, contando da borda direita
const GEO_BARRA = { caixas: [788, 610, 432], botao: 132, topoCaixa: 24, topoBotao: 15, alturaBotao: 32, larguraBotao: 116 };
const BARRA = barra('barra', M.barra.hoje);
const BARRA_ONTEM = barra('barra', M.barra.ontem);
barra('barra', M.barra.semData);
if (!/Baixar CSV/.test(BARRA) || !/19\/11\/2026 07:12/.test(BARRA) || !/18\/11\/2026 14:28/.test(BARRA_ONTEM)) throw new Error('barra: botão ou data da atualização fora do esperado');
console.log('barra      : sintaxe ok | ' + BARRA.length + ' (Baixar CSV, atualização 19/11/2026 07:12)');

// tela do analitico: pagina inteira no modelo do INST3D, com a area da tabela nativa
function tela(ats) {
  const r = dax.evaluate(caminho('tela'), {
    _atsCtx: ats.map((a) => ({ 'AREA ': a })),
    _coresCtx: [...new Set(M.ATS.filter((a) => ats.includes(a[0])).map((a) => a[1]))].map((c) => ({ 'COR_AREA ': c })),
    _qtdAtsTodas: M.ATS.length,
    _carga: M.HOJE + (14 * 60 + 28) / 1440,
  }, { utcNow: M.UTC_NOW });
  const c = compat(r.html, { estrito: true });
  if (r.unusedMocks.length || c.problems.length) throw new Error(ARQ.tela + ': ' + r.unusedMocks.concat(c.problems).join('; '));
  return r.html;
}
const TELA = tela(M.ATS.map((a) => a[0]));
const telaCtx = [['geral', M.ATS.map((a) => a[0]), 'Geral · 17 ATs'], ['cor', M.daCor('BRONZE'), 'BRONZE · 5 ATs'], ['AT', ['MA'], 'AT MA']]
  .map(([n, ats, esp]) => { const h = tela(ats); if (!h.includes('<span>' + esp + '</span>')) throw new Error('tela: filtro ' + n + ' sem "' + esp + '"'); return esp; });
// posicoes que a tela escreve (pagina 1280 x 720, visual em 0,0)
const POS_TELA = { tabela: [20, 112, 1240, 592], botao: [236, 17, 34, 34], situacao: [900, 79, 160, 26] };
const posTxt = (v) => 'X ' + v[0] + ' · Y ' + v[1] + ' · Largura ' + v[2] + ' · Altura ' + v[3];
for (const [k, v] of Object.entries(POS_TELA)) if (!TELA.includes(posTxt(v))) throw new Error('tela: posição de ' + k + ' fora do esperado (' + posTxt(v) + ')');
if (!/D-0 · carga de 19\/11 14:28/.test(TELA) || !/Exportar dados/.test(TELA)) throw new Error('tela: selo da carga ou dica do CSV fora do esperado');
console.log('tela       : sintaxe ok | ' + TELA.length + ' | filtros: ' + telaCtx.join(' / ') + ' | tabela ' + posTxt(POS_TELA.tabela));

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
  { id: 'geral', rotulo: 'Geral · nov/26', nota: 'Sem filtro de cor ou AT, mês em andamento. Embaixo, à direita, o card Backlog no lugar da lista de ordens.', cen: {}, pg: { mes: 'Novembro/2026' } },
  { id: 'bronze', rotulo: 'Cor BRONZE', nota: 'Filtro de cor: a curva vira a da cor e as duas metades (quadro e card Backlog) mostram só as ATs dela.', cen: { ats: M.daCor('BRONZE') }, pg: { mes: 'Novembro/2026', cor: 'BRONZE' } },
  { id: 'at', rotulo: 'AT MA · carga de ontem', nota: 'Uma AT selecionada. No topo direito, o aviso de que a carga do backlog é de ontem (coluna DATA_CARGA).', cen: { ats: ['MA'], carga: M.HOJE - 1 + 9.4 / 24 }, pg: { mes: 'Novembro/2026', at: 'MA' } },
  { id: 'out', rotulo: 'Mês fechado · out/26', nota: 'Trocar o mês muda só o lado esquerdo. O lado direito continua no dia de hoje, e a conta “salvando / perdendo” continua sendo a do mês atual.', cen: { fimSel: dax.serial(2026, 10, 31) }, pg: { mes: 'Outubro/2026' } },
  { id: 'atnb', rotulo: 'AT do backlog não bate', nota: 'Se a coluna escolhida para a AT não tiver as mesmas siglas da dAT[AREA ], o lado direito diz isso em vez de mostrar zeros, e lista os valores que a coluna trouxe.', cen: { atNaoBate: true }, pg: { mes: 'Novembro/2026' } },
  { id: 'atuma', rotulo: 'Coluna da AT errada', nota: 'A coluna escolhida para a AT traz outro código e só uma AT coincide com a dAT (o caso “só aparece LP”). A faixa amarela mostra os valores da coluna; ✓ = existe na dAT.', cen: { atSoUma: 'PL' }, pg: { mes: 'Novembro/2026' } },
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
  if (!AN[nome]) throw new Error('medida do analítico não encontrada: ' + nome);
  const r = dax.evaluate(AN[nome].arquivo, mocks, { utcNow: M.UTC_NOW });
  if (r.unusedMocks.length) throw new Error(nome + ': mocks sem VAR ' + r.unusedMocks.join(','));
  return r.html;
}
function ordemNoAnalitico(b, atsFiltro, selecao) {
  const dias = avalia('1AG Dias até a 1ª Agenda', { _agenda: b.Agenda });
  const diasN = dias === '' ? null : Number(dias);
  const idade = avalia('1AG Idade', { _abertura: b.Abertura });
  const sit = avalia('1AG Situação', { _umaOrdem: true, _dias: diasN });
  const campo = avalia('1AG Situação em Campo', { _umaOrdem: true, _st: b.Campo });
  const agd = avalia('1AG Agendamento', { _umaOrdem: true, _st: b.StOf });
  const tres = { _sit: sit, _campo: campo, _agd: agd };
  return {
    b, dias: diasN, idade: idade === '' ? null : Number(idade), sit, campo, agd,
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
  avalia('1AG Agendamento', { _umaOrdem: false, _st: 'AGENDADA' }) !== '' || avalia('1AG Prioridade', { _sit: null, _campo: null, _agd: null }) !== '') {
  throw new Error('analítico: a linha de total deveria ficar vazia');
}
// "AGENDAD" vale para AGENDADA e AGENDADO, e nao para PENDENTE AGENDAMENTO
for (const [st, esp] of [['AGENDADA', 'Agendada'], ['AGENDADO', 'Agendada'], ['PENDENTE AGENDAMENTO', 'Sem agendar'], ['REAGENDADA', 'Sem agendar'], ['', 'Sem agendar']]) {
  const v = avalia('1AG Agendamento', { _umaOrdem: true, _st: st });
  if (v !== esp) throw new Error('1AG Agendamento(' + st + ') = ' + v + ', esperado ' + esp);
}
const situacoesSeletor = (AN['Seletor Situacao 1AG'].corpo.match(/\{ "([^"]+)", \d+ \}/g) || []).map((s) => s.match(/"([^"]+)"/)[1]);

// numeros que o painel mostra (lidos do HTML gerado)
const frase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');
function numerosDoPainel(html) {
  const st = {};
  for (const m of html.matchAll(/<div class='st[^']*'[^>]*><small>(?:<i><\/i>)?([^<]+)<\/small><b>([^<]+)<\/b><em>([^<]*)<\/em><\/div>/g)) st[m[1]] = { v: numBR(m[2]), em: m[3] };
  const at = {};
  const re = /<div class='qr ([^']*)'><span class='qn'><i class='cd'><\/i><b>([^<]+)<\/b><\/span><b>([^<]+)<\/b><span class='qf[^']*'>([^<]+)<\/span><span class='qh'>([^<]+)<\/span><span class='qk[^']*'>([^<]+)<\/span><span class='qa'>([^<]+)<\/span><span class='qk[^']*'>([^<]+)<\/span><\/div>/g;
  for (const m of html.matchAll(re)) at[m[2]] = [3, 4, 5, 6, 7, 8].map((i) => numBR(m[i]));
  // card Backlog
  const card = {};
  const cab = html.match(/<div class='bkh'><b>Backlog<\/b><span><b>([^<]+)<\/b> ordens · <b class='x'>([^<]+)<\/b> fora do indicador<\/span><\/div>/);
  if (cab) { card.ordens = numBR(cab[1]); card.foraInd = numBR(cab[2]); }
  card.caixas = [...html.matchAll(/<div class='bvh'><span>([^<]+)<\/span><b>([^<]+)<\/b><\/div><div class='br ok'[^>]*><span><i><\/i>([^<]+)<\/span><b>([^<]+)<\/b><\/div><div class='br wn'[^>]*><span>⚠ ([^<]+)<\/span><b>([^<]+)<\/b><\/div>/g)]
    .map((m) => ({ nome: m[1], total: numBR(m[2]), [m[3]]: numBR(m[4]), [m[5]]: numBR(m[6]) }));
  card.idade = [...html.matchAll(/<div class='bhc[^']*'><b>([^<]*)<\/b><i><\/i><small>([^<]+)<\/small><\/div>/g)].map((m) => [m[2], numBR(m[1])]);
  const blocoCampo = (html.match(/<div class='bc'>([\s\S]*?)<\/div><div class='bo'>/) || [, ''])[1];
  const blocoFora = (html.match(/<div class='bo'>([\s\S]*?)(?:<p class='bkp'|<\/article>)/) || [, ''])[1];
  const totalBox = (b) => numBR((b.match(/<div class='bch'>(?:<i><\/i>|⚠ )[^<]+<b>([^<]+)<\/b>/) || [, 'x'])[1]);
  const linhas = (b) => [...b.matchAll(/<div class='bl[^']*'><span>([^<]+)<\/span><b>([^<]+)<\/b><\/div>/g)].map((m) => [m[1], numBR(m[2])]);
  card.campo = { total: totalBox(blocoCampo), linhas: linhas(blocoCampo) };
  card.fora = {
    total: totalBox(blocoFora), linhas: linhas(blocoFora),
    aVencer: numBR((blocoFora.match(/<small>de ([\d.]+) a vencer<\/small>/) || [, 'x'])[1]),
    cels: [...blocoFora.matchAll(/<div class='bf'><span>([^<]+)<b>([^<]+)<\/b><\/span><small>([^<]+)<\/small><\/div>/g)].map((m) => [m[1] + ' ' + m[3], numBR(m[2])]),
  };
  return { st, at, card };
}
function confere(rotulo, cen, atsFiltro) {
  const base = M.cenario(cen)._backlogModelo;
  const rows = base.map((b) => ordemNoAnalitico(b, atsFiltro));
  // numero da ordem e PON (o painel nao usa; so a tabela do analitico mostra): mesma linha do BACKLOG
  rows.forEach((r, i) => { r.ordem = (M.BACKLOG[i] || {}).Ordem || ''; r.pon = (M.BACKLOG[i] || {}).PON || ''; });
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
    carteira: p.st.Backlog.v, salvar: p.st['A vencer'].v, perdidas: p.st.Perdidas.v, hoje: p.st['Vencem hoje'].v, amanha: p.st['Amanhã'].v,
    semAgenda: numBR((p.st.Backlog.em.match(/^([\d.]+) sem 1ª agenda/) || [, '0'])[1]),
    foraHoje: numBR(p.st['Vencem hoje'].em.split(' ')[0]), amanhaSem: numBR(p.st['Amanhã'].em.split(' ')[0]),
    perdCampo: numBR((html.match(/Em campo hoje \(na ETA DIRECT D-0\): ([\d.]+)\./) || [, 'x'])[1]),
  };
  const dif = Object.keys(esperado).filter((k) => esperado[k] !== lido[k]);
  if (dif.length) throw new Error('analítico x painel (' + rotulo + '): ' + dif.map((k) => k + ' analítico ' + esperado[k] + ' / painel ' + lido[k]).join('; '));
  // por AT: carteira, perdidas, hoje, fora de campo, amanha, sem agendar
  let nAT = 0;
  for (const [nome, v] of Object.entries(p.at)) {
    const doCor = M.ATS.filter((a) => a[1] === nome).map((a) => a[0]);
    const b0 = doCor.length ? no.filter((r) => doCor.includes(r.b.AT)) : no.filter((r) => r.b.AT === nome);
    const e = [b0.length, b0.filter((r) => r.sit === 'Perdida').length, b0.filter((r) => r.sit === 'Vence hoje').length,
      b0.filter((r) => r.sit === 'Vence hoje' && r.campo === 'Fora de campo').length, b0.filter((r) => r.sit === 'Vence amanhã').length,
      b0.filter((r) => r.sit === 'Vence amanhã' && r.agd === 'Sem agendar').length];
    if (e.join() !== v.join()) throw new Error('linha ' + nome + ' (' + rotulo + '): analítico ' + e.join('/') + ' / painel ' + v.join('/'));
    nAT++;
  }
  // card Backlog: cada numero conferido contra as medidas do analitico (e o JS, para idade e status oficial)
  const c = p.card;
  const cx = Object.fromEntries(c.caixas.map((k) => [k.nome, k]));
  // em campo = vencem hoje e estao na ETA | fora de campo = o que precisa de acao
  const emCampo = no.filter((r) => r.sit === 'Vence hoje' && r.campo !== 'Fora de campo');
  const foraCampo = no.filter((r) => (r.sit === 'Vence hoje' && r.campo === 'Fora de campo') || (['Vence amanhã', 'No prazo'].includes(r.sit) && r.agd === 'Sem agendar'));
  const futuraSem = q((r) => r.sit === 'No prazo' && r.agd === 'Sem agendar');
  const conta = (lista, chave) => { const o = {}; lista.forEach((r) => { const k = chave(r); o[k] = (o[k] || 0) + 1; }); return o; };
  const espCampo0 = Object.entries(conta(emCampo, (r) => r.b.Campo)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const corteCampo = espCampo0.length > 7 ? 6 : 7;
  const espCampo = espCampo0.slice(0, corteCampo).map(([s, n]) => [frase(s), n]);
  if (espCampo0.length > corteCampo) espCampo.push(['Outros ' + (espCampo0.length - corteCampo) + ' status', espCampo0.slice(corteCampo).reduce((t, x) => t + x[1], 0)]);
  const espFora = Object.entries(conta(foraCampo, (r) => r.b.StOf)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const corte = espFora.length > 10 ? 9 : 10;
  const espForaLinhas = espFora.slice(0, corte).map(([s, n]) => [s === '' ? '(sem status)' : frase(s), n]);
  if (espFora.length > corte) espForaLinhas.push(['Outros ' + (espFora.length - corte) + ' status', espFora.slice(corte).reduce((t, x) => t + x[1], 0)]);
  const faixa = (d) => (d <= 3 ? 'D' + d : d <= 7 ? '4-7' : d <= 15 ? '8-15' : d <= 30 ? '16-30' : '+30');
  const espIdade = ['D0', 'D1', 'D2', 'D3', '4-7', '8-15', '16-30', '+30'].map((f) => [f, no.filter((r) => r.idade !== null && faixa(r.idade) === f).length]);
  const checks = [
    ['ordens', c.ordens, no.length], ['fora do indicador', c.foraInd, esperado.perdidas],
    ['vence hoje', cx['Vence hoje'] && cx['Vence hoje'].total, esperado.hoje],
    ['vence hoje · em campo', cx['Vence hoje'] && cx['Vence hoje']['em campo'], esperado.hoje - esperado.foraHoje],
    ['vence hoje · fora de campo', cx['Vence hoje'] && cx['Vence hoje']['fora de campo'], esperado.foraHoje],
    ['vence amanhã', cx['Vence amanhã'] && cx['Vence amanhã'].total, esperado.amanha],
    ['vence amanhã · agendada', cx['Vence amanhã'] && cx['Vence amanhã'].agendada, esperado.amanha - esperado.amanhaSem],
    ['vence amanhã · sem agendar', cx['Vence amanhã'] && cx['Vence amanhã']['sem agendar'], esperado.amanhaSem],
    ['em campo', c.campo.total, emCampo.length], ['fora de campo', c.fora.total, foraCampo.length],
    ['fora de campo · a vencer', c.fora.aVencer, esperado.salvar],
    ['fora de campo · hoje, amanhã e futura', JSON.stringify(c.fora.cels), JSON.stringify([['Hoje fora de campo', esperado.foraHoje], ['Amanhã sem agendar', esperado.amanhaSem], ['Futura sem agendar', futuraSem]])],
    ['lista em campo', JSON.stringify(c.campo.linhas), JSON.stringify(espCampo)],
    ['lista fora de campo', JSON.stringify(c.fora.linhas), JSON.stringify(espForaLinhas)],
    ['idade', JSON.stringify(c.idade), JSON.stringify(espIdade)],
  ];
  const ruins = checks.filter(([, a, b]) => a !== b);
  if (ruins.length) throw new Error('card Backlog (' + rotulo + '): ' + ruins.map(([k, a, b]) => k + ' painel ' + a + ' / esperado ' + b).join('\n  '));
  // as situacoes que a medida devolve sao as mesmas do seletor
  const sits = [...new Set(rows.map((r) => r.sit))].sort();
  if (sits.join('|') !== [...situacoesSeletor].sort().join('|')) throw new Error('seletor de situação x medida: ' + sits.join(', ') + ' / ' + situacoesSeletor.join(', '));
  console.log(('analítico = painel · ' + rotulo).padEnd(34) + ': ' + Object.entries(esperado).map(([k, v]) => k + ' ' + v).join(' | ') + ' | ' + nAT + ' linhas de cor/AT | card: ' + checks.length + ' conferências');
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
function tabelaNativa(linhas, maxLinhas) {
  const ord = linhas.filter((r) => r.filtro === 1).sort((x, y) => x.pri - y.pri || (x.b.Agenda || 0) - (y.b.Agenda || 0) || (x.ordem < y.ordem ? -1 : 1));
  const cols = ['Prior.', 'Ordem', 'PON', 'AT', 'Situação', 'Dias', '1ª agenda', 'Idade', 'Em campo hoje', 'ETA D-0 Status', 'STATUS_OFICIAL', 'Ação'];
  const num = [0, 5, 7];
  const td = (v, cls, st) => '<td' + (cls ? ' class="' + cls + '"' : '') + (st ? ' style="' + st + '"' : '') + '>' + v + '</td>';
  // amostra para o print: as primeiras de cada prioridade (na tabela real aparecem todas, na mesma ordem)
  const vistos = {};
  const amostra = ord.filter((r) => { vistos[r.pri] = (vistos[r.pri] || 0) + 1; return vistos[r.pri] <= 2; }).slice(0, maxLinhas);
  const corpo = amostra.map((r) => '<tr>' +
    td(r.pri, 'n') + td(r.ordem) + td(r.pon) + td(r.b.AT) +
    td(r.sit, 'sit', 'background:' + r.fundo + ';color:' + r.texto) + td(r.dias === null ? '' : r.dias, 'n') +
    td(r.b.Agenda === null ? '' : fmtData(r.b.Agenda)) + td(r.idade === null ? '' : r.idade, 'n') + td(r.campo) + td(frase(r.b.Campo)) + td(r.b.StOf) + td(r.acao) + '</tr>').join('');
  return {
    total: ord.length,
    html: '<div class="pbi"><div class="pbi-h"><span>⋯</span></div><table><thead><tr>' + cols.map((c, i) => '<th' + (num.includes(i) ? ' class="n"' : '') + '>' + c + (i === 0 ? ' ▲' : '') + '</th>').join('') + '</tr></thead><tbody>' + corpo + '</tbody></table>' +
      '<p class="pbi-n">Tabela nativa simulada. Amostra com 2 ordens de cada prioridade; na página aparecem as ' + ord.length.toLocaleString('pt-BR') + ' ordens do filtro, nesta mesma ordem.</p></div>',
  };
}
const CSS_NATIVO = '.pbi{position:absolute;inset:0;padding:10px 12px 0;border-radius:16px;background:#fff;box-shadow:0 1px 2px rgba(11,21,51,.04),0 6px 16px rgba(11,21,51,.05);font-family:"Segoe UI",Arial,sans-serif;overflow:hidden}' +
  '.pbi-h{position:absolute;right:12px;top:4px;color:#475467;font-size:16px;letter-spacing:1px}' +
  '.pbi table{width:100%;border-collapse:collapse;font-size:10px;color:#252423;white-space:nowrap}' +
  '.pbi th{padding:6px 5px;border-bottom:1px solid #8A8886;text-align:left;font-weight:700;color:#252423}' +
  '.pbi td{padding:3px 5px;height:22px;border-bottom:1px solid #EDEBE9}' +
  '.pbi .n{text-align:right}.pbi td.sit{font-weight:700}' +
  '.pbi-n{position:absolute;left:0;right:0;bottom:0;margin:0;padding:8px 14px;background:linear-gradient(180deg,rgba(255,255,255,0),#fff 40%);color:#63708B;font-size:11px}';

// ------------------------------------------------------------ 5, 6 e 7. prints + checagens
const jobs = [];
const noFrame = (nome, fn) => async (p) => { const fr = p.frames().find((f) => f.name() === nome); await fn(fr, p); await p.waitForTimeout(450); };
const arq = (nome, html) => { const f = path.join(tmp, nome + '.html'); fs.writeFileSync(f, html); return f; };
function print(nome, c, before) {
  jobs.push({ file: arq(nome, c.pagina), out: path.join(out, nome + '.png'), w: 1280, h: 720, scale: 2, before: before && noFrame('e1', before) });
}
const [GERAL, BRONZE, AT, OUT, ATNB, ATUMA] = CEN;
print('1-visao-geral', GERAL);
// o card Backlog de perto: so a coluna da direita do painel de referencia (1264 x 638)
// no tamanho em que o painel fica na pagina (1032 x 630, ao lado do menu): coluna da direita com 420 px
jobs.push({ file: arq('card', R.wrap(GERAL.html)), out: path.join(out, '2-card-backlog.png'), w: 1032, h: 630, scale: 2, clip: { x: 604, y: 0, width: 428, height: 630 } });
print('3-cor-BRONZE', BRONZE);
print('4-curva-semanal-e-destaque-da-cor', GERAL, async (f) => { await f.click('.b1 summary'); await f.hover('.hc .c-prata2'); });
print('5-AT-selecionada-carga-de-ontem', AT);
print('6-mes-fechado-o-lado-direito-nao-muda', OUT, async (f) => { await f.click('.b2 summary'); await f.locator('.v-dia .pt').nth(14).hover(); });
jobs.push({
  file: arq('com-menu', R.composeMenuBarra(MENUS['EFETIVIDADE 1 AGENDA'], BARRA, { html: GERAL.html }, { title: 'Efetividade 1ª agenda · com menu', nome: 'e1', caixas: GEO_BARRA.caixas })),
  out: path.join(out, '7-com-o-menu-lateral.png'), w: 1280, h: 720, scale: 2,
});
const TAB = tabelaNativa(LINHAS_AN, 24);
{
  const [tx, ty, tl, ta] = POS_TELA.tabela;
  const [sx, sy, sl, sa] = POS_TELA.situacao;
  const pag = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Analítico 1ª agenda</title><style>' +
    'html,body{margin:0;background:#C9D3E3;font-family:"Segoe UI",system-ui,Arial,sans-serif}' +
    '.pg{position:relative;width:1280px;height:720px;margin:0 auto;background:linear-gradient(180deg,#EEF3FA,#E3EBF6);overflow:hidden}' +
    'iframe{position:absolute;left:0;top:0;width:1280px;height:720px;border:0;background:transparent}' +
    '.nat{position:absolute;left:' + tx + 'px;top:' + ty + 'px;width:' + tl + 'px;height:' + ta + 'px;box-sizing:border-box;overflow:hidden}' +
    '.sl{position:absolute;left:' + sx + 'px;top:' + sy + 'px;width:' + sl + 'px;height:' + sa + 'px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:0 8px;font-size:11px;color:#0B1533}' +
    '.sl:after{content:"⌄";font-size:13px;margin-top:-5px;color:#63708B}' + CSS_NATIVO.replace(/border-radius:16px;/, 'border-radius:12px;') +
    '</style></head><body><div class="pg"><iframe name="tela" title="tela" srcdoc="' + R.wrap(TELA).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></iframe>' +
    '<div class="sl">Todos</div><div class="nat">' + TAB.html + '</div></div></body></html>';
  jobs.push({ file: arq('analitico', pag), out: path.join(out, '8-analitico-tabela-para-baixar.png'), w: 1280, h: 720, scale: 2 });
}
// a tela sozinha: a area tracejada e a seta ficam onde a tela diz, no tamanho da pagina e com zoom
for (const [w, h] of [[1280, 720], [1463, 823]]) {
  jobs.push({
    file: arq('tela-' + w, R.wrap(TELA)), out: w === 1280 ? path.join(out, '13-tela-do-analitico.png') : undefined, w, h, scale: 2,
    before: async (p) => {
      const r = await p.evaluate(() => {
        const kx = 1280 / window.innerWidth, ky = 720 / window.innerHeight;
        const ret = (q) => { const b = document.querySelector(q).getBoundingClientRect(); return [b.left * kx, b.top * ky, b.width * kx, b.height * ky].map((x) => Math.round(x)); };
        return { tabela: ret('.tz'), botao: ret('.tv'), situacao: ret('.ts') };
      });
      const ruins = Object.entries(POS_TELA).filter(([k, v]) => r[k].some((x, i) => Math.abs(x - v[i]) > 1));
      console.log(('tela ' + w + 'x' + h).padEnd(30) + ': ' + Object.entries(r).map(([k, v]) => k + ' ' + v.join('/')).join(' | ') + (ruins.length ? '' : ' | igual ao que a tela escreve'));
      if (ruins.length) throw new Error('tela ' + w + 'x' + h + ': ' + ruins.map(([k]) => k + ' ' + r[k].join('/') + ' / esperado ' + POS_TELA[k].join('/')).join('; '));
    },
  });
}
print('9-AT-do-backlog-nao-bate', ATNB);
print('12-coluna-da-AT-errada', ATUMA);

// posicao das segmentacoes e do botao nativo sobre a barra (e conferencia da geometria documentada)
{
  const W = 1032;
  const marca = (x, y, w, h, cor, rot) => '<div class="mk" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;border-color:' + cor + '"><span style="background:' + cor + '">' + rot + '</span></div>';
  const marcas = GEO_BARRA.caixas.map((d, i) => marca(10 + W - d, 60 + GEO_BARRA.topoCaixa, 160, 26, '#F97316', ['Mês', 'Cor', 'AT'][i] + ' · ' + d + ' px da direita')).join('') +
    marca(10 + W - GEO_BARRA.botao, 60 + GEO_BARRA.topoBotao, GEO_BARRA.larguraBotao, GEO_BARRA.alturaBotao, '#2563EB', 'botão · ' + GEO_BARRA.botao + ' px da direita');
  const pag = '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#E9EEF6;font-family:"Segoe UI",Arial,sans-serif}' +
    '.pg{position:relative;width:1052px;height:200px}iframe{position:absolute;left:10px;top:60px;width:' + W + 'px;height:62px;border:0}' +
    '.mk{position:absolute;box-sizing:border-box;border:1.5px dashed;border-radius:7px}.mk span{position:absolute;left:-1px;top:-19px;padding:1px 6px;border-radius:4px;color:#fff;font-size:10.5px;font-weight:600;white-space:nowrap}' +
    '.nt{position:absolute;left:10px;top:136px;width:1032px;color:#3F4C6B;font-size:12.5px;line-height:1.5}.nt b{color:#0B1533}' +
    '</style></head><body><div class="pg"><iframe srcdoc="' + R.wrap(BARRA).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></iframe>' + marcas +
    '<div class="nt"><b>Laranja:</b> segmentações nativas, 160 × 26 px, a 24 px do topo da barra. <b>Azul:</b> botão nativo, 116 × 32 px, a 15 px do topo, Ação › Navegação de página › ANALÍTICO 1 AGENDA. As distâncias são da borda direita da barra até a borda esquerda de cada um. A página do analítico não usa esta barra: ela tem a própria tela (print 8).</div></div></body></html>';
  jobs.push({
    file: arq('barra', pag), out: path.join(out, '10-barra-posicao-dos-botoes.png'), w: 1052, h: 200, scale: 2,
    before: async (p) => {
      const fr = p.frames().find((f) => f !== p.mainFrame());
      const r = await fr.evaluate(() => {
        const bx = document.querySelector('.bx').getBoundingClientRect();
        const dir = (e) => Math.round(bx.right + 4 - e.getBoundingClientRect().left); // a barra tem 4 px de margem de cada lado
        // a segmentacao (160 x 26) fica centralizada na caixa desenhada (168 x 28): 4 px para dentro e 1 px para baixo
        const caixas = [...document.querySelectorAll('.fx i')].map((e) => [dir(e) - 4, Math.round(e.getBoundingClientRect().top) + 1]);
        const bt = document.querySelector('.bt').getBoundingClientRect();
        const corte = [...document.querySelectorAll('.tt b,.tt small,.fx small,.up small,.up b,.bt span')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
        return { caixas, botao: [Math.round(bx.right + 4 - bt.left), Math.round(bt.top), Math.round(bt.width), Math.round(bt.height)], corte };
      });
      const ok = r.caixas.map((c) => c[0]).join() === GEO_BARRA.caixas.join() && r.caixas.every((c) => Math.abs(c[1] - GEO_BARRA.topoCaixa) <= 1) &&
        r.botao.join() === [GEO_BARRA.botao, GEO_BARRA.topoBotao, GEO_BARRA.larguraBotao, GEO_BARRA.alturaBotao].join() && !r.corte.length;
      console.log('barra 1032x62                 : caixas a ' + r.caixas.map((c) => c[0]).join(' / ') + ' px da direita (topo ' + r.caixas[0][1] + ') | botão ' + r.botao.join(' / ') + ' | textos cortados = ' + r.corte.length);
      if (!ok) throw new Error('barra fora da geometria documentada ' + JSON.stringify(r));
    },
  });
}

// posicao dos botoes nativos sobre o menu
{
  const topos = PAGINAS.map((p, i) => [p, 109 + 43 * i]);
  const caixas = topos.map(([p, t], i) => '<div class="bn" style="top:' + (10 + t) + 'px"></div><div class="rt" style="top:' + (10 + t) + 'px"><b>' + (i + 1) + '</b>' + p + '<small>topo ' + t + ' px' + (i === 4 ? ' · novo' : '') + '</small></div>').join('');
  const pag = '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#E9EEF6;font-family:"Segoe UI",Arial,sans-serif}' +
    '.pg{position:relative;width:560px;height:720px}iframe{position:absolute;left:20px;top:10px;width:200px;height:700px;border:0}' +
    '.bn{position:absolute;left:34px;width:172px;height:36px;box-sizing:border-box;border:1.5px dashed #F97316;border-radius:11px}' +
    '.rt{position:absolute;left:240px;height:36px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#0B1533;white-space:nowrap}' +
    '.rt b{width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:#F97316;color:#fff;font-size:11px}' +
    '.rt small{margin-left:6px;color:#63708B;font-weight:500}.nt{position:absolute;left:240px;top:360px;width:300px;color:#3F4C6B;font-size:12px;line-height:1.5}' +
    '</style></head><body><div class="pg"><iframe srcdoc="' + R.wrap(MENUS['EFETIVIDADE 1 AGENDA']).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></iframe>' + caixas +
    '<div class="nt"><b>Botões nativos</b> transparentes por cima do menu: 172 × 36 px, a 14 px da borda esquerda do visual, um a cada 43 px. Os quatro primeiros não mudam de lugar; só o quinto é novo. O analítico não tem item no menu: ele abre pelo botão Baixar CSV da barra.</div></div></body></html>';
  jobs.push({
    file: arq('botoes', pag), out: path.join(out, '11-menu-posicao-dos-botoes.png'), w: 560, h: 720, scale: 2,
    before: async (p) => {
      const fr = p.frames().find((f) => f !== p.mainFrame());
      const r = await fr.evaluate(() => [...document.querySelectorAll('.it')].map((e) => {
        const b = e.getBoundingClientRect();
        const cortado = [...e.querySelectorAll('.lb, .lb b, .lb small')].some((l) => l.scrollWidth > l.clientWidth + 1);
        return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height), cortado];
      }));
      const ok = r.length === PAGINAS.length && r.every((x, i) => x[0] === 14 && x[1] === 109 + 43 * i && x[2] === 172 && x[3] === 36 && !x[4]);
      console.log('menu 200x700                  : ' + r.map((x) => x[1]).join(' / ') + ' px | 172x36 a 14 px da borda | nomes cortados = ' + r.filter((x) => x[4]).length);
      if (!ok) throw new Error('menu: itens fora da geometria dos botoes nativos ' + JSON.stringify(r));
    },
  });
}

// tamanho de referencia e visual estreito: tudo cabe, nada cortado, botoes levam para a visao certa
const SEL_CORTE = '.kv b,.chip,.ks,.kc,.kp small,.kp b,.kd,.cr>*,.st small,.st b,.st em,.dk>*,.ins,.rl,.c,.ac,.xl,.qr>*,.seg .o,' +
  '.bkh>b,.bkh span,.bvh span,.bvh b,.br span,.br b,.bhh,.bhc b,.bhc small,.bch,.bl b,.bc .bl span,.bcs,.bf span,.bf small,.crh,.cr,.kv,.kp';
async function medir(p, rotulo) {
  const o = await p.evaluate((sel) => {
    const vis = (e) => getComputedStyle(e).display !== 'none';
    const view = [...document.querySelectorAll('.view')].find(vis);
    const mx = view.querySelector('.mx');
    const visivel = (e) => e.offsetParent && vis(e);
    const cut = [...document.querySelectorAll(sel)].filter((e) => visivel(e) && e.scrollWidth > e.clientWidth + 1);
    const cabCut = [...document.querySelectorAll('.qh0 span')].filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1);
    const card = document.querySelector('.bk');
    const tab = document.querySelector('.d0');
    const qt = document.querySelector('.qt');
    const status = [...document.querySelectorAll('.bo .bl span')];
    const proj = document.querySelector('.bkp');
    // idade: rotulos e numeros vizinhos nao podem se encostar (folga minima de 0,5 px)
    const encosta = [];
    for (const q of ['.bhc small', '.bhc b']) {
      const el = [...document.querySelectorAll(q)];
      const rr = el.map((e) => e.getBoundingClientRect());
      for (let k = 1; k < rr.length; k++) if (rr[k].width && rr[k - 1].width && rr[k].left - rr[k - 1].right < 0.5) encosta.push(el[k - 1].textContent + '|' + el[k].textContent);
    }
    return {
      encosta,
      linhas: view.querySelectorAll('.rw').length, semRolagem: mx.scrollHeight <= mx.clientHeight,
      grafico: Math.round(view.querySelector('.plot').getBoundingClientRect().height),
      cortados: cut.length + cabCut.length, exemplo: cut.concat(cabCut).slice(0, 4).map((e) => e.className + ':' + e.textContent.slice(0, 22)),
      card: card ? Math.round(card.getBoundingClientRect().height) : 0, cardCabe: card ? card.scrollHeight <= card.clientHeight + 1 : false,
      quadro: Math.round(tab.getBoundingClientRect().height), linhasQuadro: qt ? Math.floor(qt.clientHeight / 15) : 0,
      fundo: Math.round(Math.max(card.getBoundingClientRect().bottom, tab.getBoundingClientRect().bottom)), altura: window.innerHeight,
      status: status.length, statusCortados: status.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent),
      projecao: proj ? (proj.scrollWidth > proj.clientWidth + 1 ? 'cortada' : 'inteira') : '-',
    };
  }, SEL_CORTE);
  console.log(rotulo.padEnd(30) + ': ' + o.linhas + ' linhas sem rolagem = ' + o.semRolagem + ' | gráfico ' + o.grafico + 'px | card ' + o.card + 'px cabe = ' + o.cardCabe +
    ' | quadro ' + o.quadro + 'px (~' + o.linhasQuadro + ' linhas) | textos cortados = ' + o.cortados + (o.cortados ? ' ' + JSON.stringify(o.exemplo) : '') +
    ' | projeção ' + o.projecao + ' | idade encostada ' + o.encosta.length + (o.encosta.length ? ' ' + JSON.stringify(o.encosta) : '') + ' | status oficiais com reticências ' + o.statusCortados.length + '/' + o.status + (o.statusCortados.length ? ' ' + JSON.stringify(o.statusCortados.slice(0, 3)) : ''));
  if (!o.semRolagem || o.cortados || o.encosta.length || !o.cardCabe || o.projecao === 'cortada' || o.fundo > o.altura || o.linhasQuadro < 5) throw new Error('layout fora do tamanho de referencia (' + rotulo + ')');
  return o;
}
for (const [w, h] of [[1264, 638], [1032, 630], [1140, 700], [1180, 720], [1230, 720]]) {
  const tresVisoes = w === 1264 || w === 1032;
  jobs.push({
    // escala 2, como nos prints: o texto fica um pouco mais largo que na escala 1
    file: arq('ref-' + w, R.wrap(GERAL.html)), w, h, scale: 2,
    before: async (p) => {
      for (const [nome, clique] of tresVisoes ? [['Mês', null], ['Semana', '.b1 summary'], ['Dia', '.b2 summary']] : [['Mês', null]]) {
        if (clique) { await p.click(clique); await p.waitForTimeout(200); }
        await medir(p, 'painel ' + w + 'x' + h + ' · ' + nome);
      }
      if (w !== 1264) return;
      await p.reload(); await p.waitForTimeout(500);
      // Botoes: de qualquer estado, o clique em cada botao tem que mostrar a visao daquele botao.
      for (const [seg, views] of [['.sg', ['.v-mes', '.v-sem', '.v-dia']]]) {
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
  .replace('%%IMG_CARD%%', () => img('2-card-backlog', 'Card Backlog'))
  .replace('%%IMG_MENU%%', () => img('7-com-o-menu-lateral', 'Painel ao lado do menu lateral'))
  .replace('%%IMG_BARRA%%', () => img('10-barra-posicao-dos-botoes', 'Posição das segmentações e do botão sobre a barra'))
  .replace('%%IMG_BOTOES%%', () => img('11-menu-posicao-dos-botoes', 'Posição dos botões nativos sobre o menu'))
  .replace('%%IMG_ANALITICO%%', () => img('8-analitico-tabela-para-baixar', 'Página do analítico com a tabela nativa'))
  .replace('%%TB_ANALITICO%%', () => tbAnalitico)
  .replace('%%CODIGO%%', () => [
    ...apoio.map((m, i) => bloco('m' + i, (i + 1) + ' · ' + m.nome, i === 0 ? 'medida de apoio · numerador da sua % 1_AGENDA' : i === 1 ? 'medida de apoio · denominador da sua % 1_AGENDA' : 'opcional · a sua medida reescrita com DIVIDE', (m.nota ? m.nota + '\n' : '') + m.corpo + '\n', true)),
    bloco('mp', '4 · Painel Efetividade 1 Agenda HTML', 'medida principal · ' + linhasPrincipal + ' linhas · vai no visual HTML Content', principalTxt, false),
    bloco('mn', '5 · Menu Lateral Instalacao HTML (v2)', 'cole nas páginas do menu e troque só _paginaAtual · substitui o v1', ler('menu'), false),
    bloco('m1', '5b · Menu Lateral 1 Agenda HTML (v2)', 'cópia pronta para a página EFETIVIDADE 1 AGENDA: o item já vem aceso', ler('menu1ag'), false),
    bloco('bf', '6 · Barra Filtros 1 Agenda HTML', 'página do painel · 62 px · filtros, atualização e Baixar CSV', ler('barra'), false),
    bloco('ta', '7 · Tela Analitico 1 Agenda HTML', 'página do analítico · visual de 1280 × 720 · como a tela do INST3D', ler('tela'), false),
    bloco('an', '8 · Analítico: tabela do seletor + medidas 1AG', 'uma tabela e ' + (analitico.length - 1) + ' medidas · cole cada uma separadamente', ler('analitico'), false),
  ].join('\n  '))
  .replace('%%CENARIOS%%', () => json(CEN.map((c) => ({ nota: c.nota, html: c.pagina }))));
if (/%%[A-Z_]+%%/.test(pagina)) throw new Error('index.html: marcador sem trocar ' + pagina.match(/%%[A-Z_]+%%/)[0]);
fs.writeFileSync(path.join(out, 'index.html'), pagina);
console.log('página     : index.html com ' + CEN.length + ' cenários + ' + (apoio.length + analitico.length + 5) + ' blocos de código | ' + Math.round(pagina.length / 1024) + ' KB | tabela do analítico: ' + TAB.total + ' ordens no filtro');

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
    if (!a || !b || erros.length || faltam.length) throw new Error('index.html nao abriu como esperado ' + erros.join(' | ') + ' ' + faltam.join(' '));
  },
});

R.shots(jobs).then(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('arquivos gravados em ' + (path.relative(repo, out) || '.'));
}).catch((e) => { fs.rmSync(tmp, { recursive: true, force: true }); console.error('\nERRO: ' + e.message); process.exit(1); });
