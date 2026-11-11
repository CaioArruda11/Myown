'use strict';
// ============================================================================
// Mini-avaliador de DAX para PREVIA das medidas HTML deste repositorio.
//
// Le o arquivo .txt da medida, faz o parse da medida INTEIRA (pega parenteses
// e aspas desbalanceados, variavel usada antes de ser declarada, funcao
// inexistente) e avalia a camada de apresentacao. Tudo que depende do modelo
// (CALCULATE, SELECTEDVALUE, medidas...) precisa vir como "mock": o valor da
// VAR de primeiro nivel e trocado pelo dado ficticio e a expressao original
// nao e executada.
//
// Nao substitui o Power BI: serve para conferir sintaxe e ver o HTML gerado.
// ============================================================================

function lineCol(src, pos) {
  const pre = src.slice(0, pos);
  const line = pre.split('\n').length;
  return 'linha ' + line + ', col ' + (pos - pre.lastIndexOf('\n'));
}

function tokenize(src) {
  const toks = [];
  const n = src.length;
  let i = 0;
  const isIdStart = (c) => /[A-Za-z_À-ɏ]/.test(c);
  const isId = (c) => /[A-Za-z0-9_.À-ɏ]/.test(c);
  const closeBracket = (from) => {
    const k = src.indexOf(']', from);
    if (k < 0) throw new Error('"[" sem "]" em ' + lineCol(src, from));
    return k;
  };
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if ((c === '/' && src[i + 1] === '/') || (c === '-' && src[i + 1] === '-')) {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2);
      if (j < 0) throw new Error('comentario /* sem fechar em ' + lineCol(src, i));
      i = j + 2;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = '';
      for (;;) {
        if (j >= n) throw new Error('string sem fechar, aberta em ' + lineCol(src, i));
        if (src[j] === '"') {
          if (src[j + 1] === '"') { s += '"'; j += 2; continue; }
          break;
        }
        s += src[j++];
      }
      toks.push({ t: 'str', v: s, pos: i });
      i = j + 1;
      continue;
    }
    if (c === "'") {
      const j = src.indexOf("'", i + 1);
      if (j < 0) throw new Error("nome de tabela sem fechar em " + lineCol(src, i));
      const table = src.slice(i + 1, j);
      const pos = i;
      i = j + 1;
      if (src[i] === '[') {
        const k = closeBracket(i);
        toks.push({ t: 'col', table, v: src.slice(i + 1, k), pos });
        i = k + 1;
      } else toks.push({ t: 'table', v: table, pos });
      continue;
    }
    if (c === '[') {
      const k = closeBracket(i);
      toks.push({ t: 'col', table: null, v: src.slice(i + 1, k), pos: i });
      i = k + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      while (j < n && /[0-9.]/.test(src[j])) j++;
      toks.push({ t: 'num', v: parseFloat(src.slice(i, j)), pos: i });
      i = j;
      continue;
    }
    if (isIdStart(c)) {
      let j = i;
      while (j < n && isId(src[j])) j++;
      const id = src.slice(i, j);
      const pos = i;
      i = j;
      if (src[i] === '[') {
        const k = closeBracket(i);
        toks.push({ t: 'col', table: id, v: src.slice(i + 1, k), pos });
        i = k + 1;
      } else toks.push({ t: 'id', v: id, pos });
      continue;
    }
    const two = src.substr(i, 2);
    if (['&&', '||', '<=', '>=', '<>', '=='].includes(two)) { toks.push({ t: 'op', v: two, pos: i }); i += 2; continue; }
    if ('=<>&+-*/^(),{}'.includes(c)) { toks.push({ t: 'op', v: c, pos: i }); i++; continue; }
    throw new Error('caractere inesperado "' + c + '" em ' + lineCol(src, i));
  }
  toks.push({ t: 'eof', pos: n });
  return toks;
}

function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v) => toks[p].t === 'op' && toks[p].v === v;
  const isKw = (v) => toks[p].t === 'id' && toks[p].v.toUpperCase() === v;
  const fail = (msg) => { throw new Error(msg + ' em ' + lineCol(src, toks[p].pos)); };
  const expectOp = (v) => { if (!isOp(v)) fail('esperava "' + v + '", veio "' + (toks[p].v === undefined ? toks[p].t : toks[p].v) + '"'); p++; };

  function expr() {
    if (isKw('VAR')) {
      const vars = [];
      while (isKw('VAR')) {
        p++;
        if (peek().t !== 'id') fail('esperava nome de variavel apos VAR');
        const name = toks[p].v;
        const pos = toks[p].pos;
        p++;
        expectOp('=');
        vars.push({ name, pos, expr: expr() });
      }
      if (!isKw('RETURN')) fail('esperava VAR ou RETURN (falta "&", "," ou parentese antes daqui?)');
      p++;
      return { k: 'block', vars, ret: expr() };
    }
    return orE();
  }
  function bin(next, ops) {
    return function () {
      let l = next();
      while (toks[p].t === 'op' && ops.includes(toks[p].v)) {
        const op = toks[p].v;
        p++;
        l = { k: 'bin', op, l, r: next() };
      }
      return l;
    };
  }
  function unary() {
    if (isOp('-') || isOp('+')) { const op = toks[p].v; p++; return { k: 'un', op, e: unary() }; }
    if (isKw('NOT') && !(toks[p + 1].t === 'op' && toks[p + 1].v === '(' && false)) { p++; return { k: 'un', op: 'NOT', e: unary() }; }
    return primary();
  }
  const mul = bin(unary, ['*', '/']);
  const add = bin(mul, ['+', '-']);
  const cat = bin(add, ['&']);
  const cmp = bin(cat, ['=', '==', '<>', '<', '>', '<=', '>=']);
  const andE = bin(cmp, ['&&']);
  const orE = bin(andE, ['||']);

  function primary() {
    const t = toks[p];
    if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
    if (t.t === 'str') { p++; return { k: 'str', v: t.v }; }
    if (t.t === 'col') { p++; return { k: 'col', table: t.table, name: t.v, pos: t.pos }; }
    if (t.t === 'table') { p++; return { k: 'table', name: t.v }; }
    if (isOp('(')) { p++; const e = expr(); expectOp(')'); return e; }
    if (isOp('{')) {
      p++;
      const items = [];
      if (!isOp('}')) {
        for (;;) {
          if (isOp('{')) {
            p++;
            const tup = [];
            for (;;) { tup.push(expr()); if (isOp(',')) { p++; continue; } break; }
            expectOp('}');
            items.push({ k: 'tuple', items: tup });
          } else items.push(expr());
          if (isOp(',')) { p++; continue; }
          break;
        }
      }
      expectOp('}');
      return { k: 'tctor', items };
    }
    if (t.t === 'id') {
      p++;
      if (isOp('(')) {
        p++;
        const args = [];
        if (!isOp(')')) {
          for (;;) { args.push(expr()); if (isOp(',')) { p++; continue; } break; }
        }
        expectOp(')');
        return { k: 'call', name: t.v.toUpperCase(), args, pos: t.pos };
      }
      return { k: 'id', name: t.v, pos: t.pos };
    }
    fail('expressao inesperada: "' + (t.v === undefined ? t.t : t.v) + '"');
  }

  const ast = expr();
  if (toks[p].t !== 'eof') fail('sobrou texto depois do fim da expressao: "' + toks[p].v + '"');
  return ast;
}

// ---------------------------------------------------------------------------
// Checagem estatica: variaveis declaradas antes do uso + funcoes conhecidas
// ---------------------------------------------------------------------------
const MODEL_FUNCS = ['CALCULATE', 'CALCULATETABLE', 'SELECTEDVALUE', 'HASONEVALUE', 'VALUES', 'ALL', 'ALLSELECTED',
  'TREATAS', 'REMOVEFILTERS', 'DISTINCTCOUNT', 'KEEPFILTERS', 'SUM', 'AVERAGE', 'COUNT', 'ISFILTERED',
  'SUMMARIZE', 'DATESBETWEEN', 'RELATED'];
const SYMBOLS = ['ASC', 'DESC', 'STRING', 'INTEGER', 'DOUBLE', 'BOOLEAN', 'DATETIME', 'CURRENCY'];

function check(ast, src) {
  const problems = [];
  const funcs = new Set();
  (function walk(node, scope) {
    if (!node || typeof node !== 'object') return;
    switch (node.k) {
      case 'block': {
        const s = { names: new Set(), parent: scope };
        for (const v of node.vars) {
          walk(v.expr, s);
          const key = v.name.toLowerCase();
          for (let o = s; o; o = o.parent) if (o.names.has(key)) problems.push('variavel ' + v.name + ' declarada duas vezes no mesmo escopo ou em um escopo externo (' + lineCol(src, v.pos) + ')');
          s.names.add(key);
        }
        walk(node.ret, s);
        return;
      }
      case 'id': {
        if (SYMBOLS.includes(node.name.toUpperCase())) return;
        let found = false;
        for (let s = scope; s; s = s.parent) if (s.names.has(node.name.toLowerCase())) { found = true; break; }
        if (!found && node.name.startsWith('_')) problems.push('variavel ' + node.name + ' usada antes de ser declarada (' + lineCol(src, node.pos) + ')');
        return;
      }
      case 'call':
        funcs.add(node.name);
        if (!(node.name in FN) && !MODEL_FUNCS.includes(node.name)) problems.push('funcao desconhecida ' + node.name + ' (' + lineCol(src, node.pos) + ')');
        node.args.forEach((a) => walk(a, scope));
        return;
      case 'bin': walk(node.l, scope); walk(node.r, scope); return;
      case 'un': walk(node.e, scope); return;
      case 'tctor': case 'tuple': node.items.forEach((a) => walk(a, scope)); return;
      default:
    }
  })(ast, null);
  return { problems, funcs: [...funcs].sort() };
}

// ---------------------------------------------------------------------------
// Valores: number | string | boolean | null (BLANK) | Array<row> (tabela)
// Datas sao numeros seriais (dias desde 30/12/1899), como no DAX.
// ---------------------------------------------------------------------------
const DAY = 86400000;
const EPOCH = Date.UTC(1899, 11, 30);
const serial = (y, m, d) => (Date.UTC(y, m - 1, d) - EPOCH) / DAY;
const fromSerial = (s) => new Date(EPOCH + Math.round(s * DAY));

const num = (v) => (v === null || v === undefined || v === '' ? 0 : v === true ? 1 : v === false ? 0 : typeof v === 'number' ? v : Number(v));
const str = (v) => {
  if (v === null || v === undefined) return '';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number') return String(Math.round(v * 1e12) / 1e12);
  return String(v);
};
const truthy = (v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : !!num(v));

function compare(a, b) {
  if (typeof a === 'string' || typeof b === 'string') {
    const x = str(a).toLowerCase();
    const y = str(b).toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const x = num(a);
  const y = num(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function roundHalfAway(x, d) {
  const f = Math.pow(10, d);
  return (Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9)) / f;
}

function formatNumber(x, pat, loc) {
  const secs = pat.split(';');
  let sec = secs[0];
  let val = x;
  let autoNeg = false;
  if (secs.length >= 3 && roundHalfAway(x, 10) === 0) sec = secs[2];
  else if (secs.length >= 2 && x < 0) { sec = secs[1]; val = -x; } else if (x < 0) { autoNeg = true; val = -x; }
  const m = sec.match(/^([^0#.]*)([0#,]*)(?:\.([0#]*))?([\s\S]*)$/);
  const prefix = m[1];
  const intMask = m[2] || '';
  const decMask = m[3] || '';
  const suffix = m[4] || '';
  if (sec.includes('%')) val *= 100;
  const dec = decMask.length;
  const r = roundHalfAway(val, dec);
  let [ip, fp] = r.toFixed(dec).split('.');
  const minInt = (intMask.match(/0/g) || []).length;
  while (ip.length < minInt) ip = '0' + ip;
  const ptBR = /^pt/i.test(loc || '');
  if (intMask.includes(',')) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ptBR ? '.' : ',');
  if (autoNeg && r === 0) autoNeg = false;
  return (autoNeg ? '-' : '') + prefix + ip + (dec ? (ptBR ? ',' : '.') + fp : '') + suffix;
}

function formatDate(s, pat) {
  const d = fromSerial(s);
  const p2 = (n) => String(n).padStart(2, '0');
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesesL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const diasL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  return pat.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|nn|n|ss|s/gi, (tk) => {
    switch (tk.toLowerCase()) {
      case 'yyyy': return String(d.getUTCFullYear());
      case 'yy': return p2(d.getUTCFullYear() % 100);
      case 'mmmm': return mesesL[d.getUTCMonth()];
      case 'mmm': return meses[d.getUTCMonth()];
      case 'dddd': return diasL[d.getUTCDay()];
      case 'ddd': return dias[d.getUTCDay()];
      case 'mm': return p2(d.getUTCMonth() + 1);
      case 'm': return String(d.getUTCMonth() + 1);
      case 'dd': return p2(d.getUTCDate());
      case 'd': return String(d.getUTCDate());
      case 'hh': return p2(d.getUTCHours());
      case 'h': return String(d.getUTCHours());
      case 'nn': return p2(d.getUTCMinutes());
      case 'n': return String(d.getUTCMinutes());
      case 'ss': return p2(d.getUTCSeconds());
      default: return String(d.getUTCSeconds());
    }
  });
}

function daxFormat(v, pat, loc) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  const x = num(v);
  if (Number.isNaN(x)) return 'NaN';
  if (/[dyhs]/i.test(pat) && !/[0#]/.test(pat)) return formatDate(x, pat);
  return formatNumber(x, pat, loc);
}

// ---------------------------------------------------------------------------
// Avaliador
// ---------------------------------------------------------------------------
const FN = {};
let CLOCK = { utcNow: serial(2026, 11, 9) + 15 / 24 };

function ev(node, ctx) {
  switch (node.k) {
    case 'num': case 'str': return node.v;
    case 'block': {
      const env = { vars: new Map(), parent: ctx.env };
      const c2 = { env, row: ctx.row, rt: ctx.rt, top: false };
      for (const v of node.vars) {
        if (ctx.top && Object.prototype.hasOwnProperty.call(ctx.rt.mocks, v.name)) {
          env.vars.set(v.name.toLowerCase(), { done: true, val: ctx.rt.mocks[v.name], name: v.name, mocked: true });
          ctx.rt.usedMocks.add(v.name);
        } else env.vars.set(v.name.toLowerCase(), { done: false, expr: v.expr, ctx: c2, name: v.name });
      }
      if (ctx.top) ctx.rt.topVars = env.vars;
      return ev(node.ret, c2);
    }
    case 'id': {
      const key = node.name.toLowerCase();
      for (let e = ctx.env; e; e = e.parent) {
        if (e.vars.has(key)) {
          const slot = e.vars.get(key);
          if (!slot.done) {
            if (slot.busy) throw new Error('referencia circular em ' + slot.name);
            slot.busy = true;
            ctx.rt.stack.push(slot.name);
            slot.val = ev(slot.expr, slot.ctx);
            ctx.rt.stack.pop();
            slot.done = true;
            slot.busy = false;
          }
          return slot.val;
        }
      }
      if (SYMBOLS.includes(node.name.toUpperCase())) return { sym: node.name.toUpperCase() };
      throw new Error('identificador desconhecido: ' + node.name + ' [avaliando ' + ctx.rt.stack.join(' > ') + ']');
    }
    case 'col': {
      for (let r = ctx.row; r; r = r.parent) if (Object.prototype.hasOwnProperty.call(r.row, node.name)) return r.row[node.name];
      throw new Error('coluna/medida [' + node.name + '] fora de contexto: a VAR que a usa precisa de mock [avaliando ' + ctx.rt.stack.join(' > ') + ']');
    }
    case 'table':
      throw new Error("tabela do modelo '" + node.name + "' precisa de mock [avaliando " + ctx.rt.stack.join(' > ') + ']');
    case 'un': {
      const v = ev(node.e, ctx);
      if (node.op === 'NOT') return !truthy(v);
      return node.op === '-' ? -num(v) : num(v);
    }
    case 'bin': {
      if (node.op === '&&') return truthy(ev(node.l, ctx)) && truthy(ev(node.r, ctx));
      if (node.op === '||') return truthy(ev(node.l, ctx)) || truthy(ev(node.r, ctx));
      const a = ev(node.l, ctx);
      const b = ev(node.r, ctx);
      switch (node.op) {
        case '&': return str(a) + str(b);
        case '+': return a === null && b === null ? null : num(a) + num(b);
        case '-': return a === null && b === null ? null : num(a) - num(b);
        case '*': return a === null || b === null ? null : num(a) * num(b);
        case '/': return a === null ? null : num(a) / num(b);
        case '=': case '==': return compare(a, b) === 0;
        case '<>': return compare(a, b) !== 0;
        case '<': return compare(a, b) < 0;
        case '>': return compare(a, b) > 0;
        case '<=': return compare(a, b) <= 0;
        case '>=': return compare(a, b) >= 0;
        default: throw new Error('operador ' + node.op);
      }
    }
    case 'tctor':
      return node.items.map((it) => {
        if (it.k === 'tuple') { const row = {}; it.items.forEach((e, i) => { row['Value' + (i + 1)] = ev(e, ctx); }); return row; }
        return { Value: ev(it, ctx) };
      });
    case 'call': {
      const f = FN[node.name];
      if (!f && node.name === 'CALCULATE' && ctx.rt.calculate) return ctx.rt.calculate(node, (name) => ev({ k: 'id', name, pos: 0 }, ctx));
      if (!f) throw new Error('funcao ' + node.name + ' depende do modelo: a VAR precisa de mock [avaliando ' + ctx.rt.stack.join(' > ') + ']');
      return f(node.args, ctx);
    }
    default: throw new Error('no desconhecido ' + node.k);
  }
}

const inRow = (ctx, row) => ({ env: ctx.env, row: { row, parent: ctx.row }, rt: ctx.rt, top: false });
const tbl = (node, ctx) => {
  const t = ev(node, ctx);
  if (!Array.isArray(t)) throw new Error('esperava tabela [avaliando ' + ctx.rt.stack.join(' > ') + ']');
  return t;
};
const A = (f) => (args, ctx) => f(...args.map((a) => ev(a, ctx)));

Object.assign(FN, {
  IF: (a, c) => (truthy(ev(a[0], c)) ? ev(a[1], c) : a[2] ? ev(a[2], c) : null),
  SWITCH: (a, c) => {
    const v = ev(a[0], c);
    let i = 1;
    for (; i + 1 < a.length; i += 2) if (compare(v, ev(a[i], c)) === 0) return ev(a[i + 1], c);
    return i < a.length ? ev(a[i], c) : null;
  },
  TRUE: () => true,
  FALSE: () => false,
  BLANK: () => null,
  ISBLANK: A((v) => v === null || v === undefined),
  NOT: A((v) => !truthy(v)),
  AND: A((x, y) => truthy(x) && truthy(y)),
  OR: A((x, y) => truthy(x) || truthy(y)),
  COALESCE: (a, c) => { for (const e of a) { const v = ev(e, c); if (v !== null && v !== undefined) return v; } return null; },
  FORMAT: A((v, p, l) => daxFormat(v, p, l)),
  MIN: A((x, y) => (compare(x, y) <= 0 ? x : y)),
  MAX: A((x, y) => (compare(x, y) >= 0 ? x : y)),
  DIVIDE: A((x, y, alt) => (num(y) === 0 ? (alt === undefined ? null : alt) : x === null ? null : num(x) / num(y))),
  INT: A((x) => (x === null ? null : Math.floor(num(x) + 1e-9))),
  TRUNC: A((x) => (x === null ? null : Math.trunc(num(x)))),
  MOD: A((x, y) => num(x) - num(y) * Math.floor(num(x) / num(y))),
  ROUND: A((x, d) => (x === null ? null : roundHalfAway(num(x), num(d)))),
  ABS: A((x) => (x === null ? null : Math.abs(num(x)))),
  UPPER: A((s) => str(s).toUpperCase()),
  LOWER: A((s) => str(s).toLowerCase()),
  LEN: A((s) => str(s).length),
  LEFT: A((s, n) => str(s).slice(0, n === undefined ? 1 : num(n))),
  RIGHT: A((s, n) => { const t = str(s); return t.slice(t.length - (n === undefined ? 1 : num(n))); }),
  TRIM: A((s) => str(s).trim().replace(/ +/g, ' ')),
  SUBSTITUTE: A((s, a, b, n) => {
    const parts = str(s).split(str(a));
    if (n === undefined) return parts.join(str(b));
    const k = num(n);
    if (k < 1 || k >= parts.length) return str(s);
    return parts.slice(0, k).join(str(a)) + str(b) + parts.slice(k).join(str(a));
  }),
  MID: A((s, start, n) => str(s).substr(num(start) - 1, num(n))),
  SEARCH: A((find, within, start, nf) => {
    const i = str(within).toLowerCase().indexOf(str(find).toLowerCase(), (start === undefined ? 1 : num(start)) - 1);
    if (i < 0) { if (nf === undefined) throw new Error('SEARCH nao encontrou'); return nf; }
    return i + 1;
  }),
  DATE: A((y, m, d) => serial(num(y), num(m), num(d))),
  TIME: A((h, m, s) => (num(h) * 3600 + num(m) * 60 + num(s)) / 86400),
  YEAR: A((s) => fromSerial(Math.floor(num(s))).getUTCFullYear()),
  MONTH: A((s) => fromSerial(Math.floor(num(s))).getUTCMonth() + 1),
  DAY: A((s) => fromSerial(Math.floor(num(s))).getUTCDate()),
  EOMONTH: A((s, m) => { const d = fromSerial(Math.floor(num(s))); return serial(d.getUTCFullYear(), d.getUTCMonth() + num(m) + 2, 0); }),
  EDATE: A((s, m) => {
    const d = fromSerial(Math.floor(num(s)));
    const fim = fromSerial(serial(d.getUTCFullYear(), d.getUTCMonth() + num(m) + 2, 0)).getUTCDate();
    return serial(d.getUTCFullYear(), d.getUTCMonth() + num(m) + 1, Math.min(d.getUTCDate(), fim));
  }),
  WEEKDAY: A((s, tipo) => {
    const w = fromSerial(Math.floor(num(s))).getUTCDay(); // 0 = domingo
    const t = tipo === undefined ? 1 : num(tipo);
    return t === 2 ? (w === 0 ? 7 : w) : t === 3 ? (w + 6) % 7 : w + 1;
  }),
  // semana 1 = a que contem 1o de janeiro; tipo 1 = comeca no domingo, tipo 2 = na segunda
  WEEKNUM: A((s, tipo) => {
    const d = fromSerial(Math.floor(num(s)));
    const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
    const w1 = new Date(jan1).getUTCDay(); // 0 = domingo
    const desloc = (tipo === undefined ? 1 : num(tipo)) === 2 ? (w1 + 6) % 7 : w1;
    return Math.floor(((d.getTime() - jan1) / DAY + desloc) / 7) + 1;
  }),
  SQRT: A((x) => (x === null ? null : Math.sqrt(num(x)))),
  POWER: A((x, y) => Math.pow(num(x), num(y))),
  ROUNDUP: A((x, d) => { if (x === null) return null; const f = Math.pow(10, num(d)); const v = num(x) * f; return (Math.sign(v) * Math.ceil(Math.abs(v) - 1e-9)) / f; }),
  ROUNDDOWN: A((x, d) => { if (x === null) return null; const f = Math.pow(10, num(d)); const v = num(x) * f; return (Math.sign(v) * Math.floor(Math.abs(v) + 1e-9)) / f; }),
  GENERATESERIES: A((a, b, passo) => { const out = []; const p = passo === undefined ? 1 : num(passo); for (let x = num(a); x <= num(b) + 1e-9; x += p) out.push({ Value: x }); return out; }),
  CONTAINSROW: (a, c) => {
    const vals = a.slice(1).map((e) => ev(e, c));
    return tbl(a[0], c).some((r) => { const rv = Object.values(r); return vals.every((v, i) => compare(rv[i], v) === 0); });
  },
  DISTINCT: (a, c) => { const seen = new Set(); return tbl(a[0], c).filter((r) => { const k = JSON.stringify(Object.values(r)); if (seen.has(k)) return false; seen.add(k); return true; }); },
  // GROUPBY( tabela, [col]..., "nome", <agregador>X( CURRENTGROUP(), expr ) ... )
  GROUPBY: (a, c) => {
    const rows = tbl(a[0], c);
    let i = 1;
    const cols = [];
    for (; i < a.length && a[i].k === 'col'; i++) cols.push(a[i]);
    const grupos = new Map();
    for (const r of rows) {
      const rc = inRow(c, r);
      const chave = cols.map((n) => ev(n, rc));
      const k = JSON.stringify(chave);
      if (!grupos.has(k)) grupos.set(k, { chave, linhas: [] });
      grupos.get(k).linhas.push(r);
    }
    const out = [];
    for (const g of grupos.values()) {
      const o = {};
      cols.forEach((n, j) => { o[n.name] = g.chave[j]; });
      c.rt.grupos.push(g.linhas);
      for (let j = i; j + 1 < a.length; j += 2) o[str(ev(a[j], c))] = ev(a[j + 1], c);
      c.rt.grupos.pop();
      out.push(o);
    }
    return out;
  },
  CURRENTGROUP: (a, c) => {
    if (!c.rt.grupos.length) throw new Error('CURRENTGROUP fora de GROUPBY');
    return c.rt.grupos[c.rt.grupos.length - 1];
  },
  COUNTX: (a, c) => { let n = 0; for (const r of tbl(a[0], c)) if (ev(a[1], inRow(c, r)) !== null) n++; return n === 0 ? null : n; },
  UTCNOW: () => CLOCK.utcNow,
  NOW: () => CLOCK.utcNow,
  TODAY: () => Math.floor(CLOCK.utcNow),
  UTCTODAY: () => Math.floor(CLOCK.utcNow),
  ROW: (a, c) => { const r = {}; for (let i = 0; i < a.length; i += 2) r[str(ev(a[i], c))] = ev(a[i + 1], c); return [r]; },
  UNION: (a, c) => {
    const ts = a.map((e) => tbl(e, c));
    const keys = Object.keys((ts.find((t) => t.length) || [{}])[0]);
    const out = [];
    for (const t of ts) for (const r of t) {
      const vals = Object.values(r);
      if (vals.length !== keys.length) throw new Error('UNION: tabelas com numero de colunas diferente');
      const o = {};
      keys.forEach((k, i) => { o[k] = vals[i]; });
      out.push(o);
    }
    return out;
  },
  DATATABLE: (a, c) => {
    const cols = [];
    let i = 0;
    for (; i + 1 < a.length && a[i].k !== 'tctor'; i += 2) cols.push(str(ev(a[i], c)));
    const rows = a[i];
    if (!rows || rows.k !== 'tctor') throw new Error('DATATABLE: faltou a lista de linhas');
    return rows.items.map((it) => {
      if (it.k !== 'tuple' || it.items.length !== cols.length) throw new Error('DATATABLE: linha com ' + (it.items ? it.items.length : 1) + ' valores, esperava ' + cols.length);
      const o = {};
      cols.forEach((k, j) => { o[k] = ev(it.items[j], c); });
      return o;
    });
  },
  ADDCOLUMNS: (a, c) => tbl(a[0], c).map((r) => {
    const o = Object.assign({}, r);
    const rc = inRow(c, r);
    for (let i = 1; i < a.length; i += 2) o[str(ev(a[i], c))] = ev(a[i + 1], rc);
    return o;
  }),
  SELECTCOLUMNS: (a, c) => tbl(a[0], c).map((r) => {
    const o = {};
    const rc = inRow(c, r);
    for (let i = 1; i < a.length; i += 2) o[str(ev(a[i], c))] = ev(a[i + 1], rc);
    return o;
  }),
  FILTER: (a, c) => tbl(a[0], c).filter((r) => truthy(ev(a[1], inRow(c, r)))),
  ISEMPTY: (a, c) => tbl(a[0], c).length === 0,
  CROSSJOIN: (a, c) => a.map((e) => tbl(e, c)).reduce((acc, t) => { const out = []; for (const x of acc) for (const y of t) out.push(Object.assign({}, x, y)); return out; }, [{}]),
  COUNTROWS: (a, c) => { const n = tbl(a[0], c).length; return n === 0 ? null : n; },
  SUMX: (a, c) => {
    let s = null;
    for (const r of tbl(a[0], c)) { const v = ev(a[1], inRow(c, r)); if (v !== null) s = (s === null ? 0 : s) + num(v); }
    return s;
  },
  AVERAGEX: (a, c) => {
    let s = 0;
    let n = 0;
    for (const r of tbl(a[0], c)) { const v = ev(a[1], inRow(c, r)); if (v !== null) { s += num(v); n++; } }
    return n ? s / n : null;
  },
  MAXX: (a, c) => {
    let m = null;
    for (const r of tbl(a[0], c)) { const v = ev(a[1], inRow(c, r)); if (v !== null && (m === null || compare(v, m) > 0)) m = v; }
    return m;
  },
  MINX: (a, c) => {
    let m = null;
    for (const r of tbl(a[0], c)) { const v = ev(a[1], inRow(c, r)); if (v !== null && (m === null || compare(v, m) < 0)) m = v; }
    return m;
  },
  TOPN: (a, c) => {
    const n = num(ev(a[0], c));
    const rows = sortRows(tbl(a[1], c), a, 2, c);
    return rows.slice(0, n);
  },
  CONCATENATEX: (a, c) => {
    const rows = sortRows(tbl(a[0], c), a, 3, c);
    const sep = a[2] ? str(ev(a[2], c)) : '';
    return rows.map((r) => str(ev(a[1], inRow(c, r)))).join(sep);
  },
});

function sortRows(rows, args, from, ctx) {
  const keys = [];
  for (let i = from; i < args.length; i += 2) {
    let dir = 1;
    if (args[i + 1]) { const s = ev(args[i + 1], ctx); dir = s && s.sym === 'DESC' ? -1 : 1; }
    keys.push({ e: args[i], dir });
  }
  if (!keys.length) return rows.slice();
  return rows
    .map((r, idx) => ({ r, idx, k: keys.map((k) => ev(k.e, inRow(ctx, r))) }))
    .sort((x, y) => {
      for (let i = 0; i < keys.length; i++) { const d = compare(x.k[i], y.k[i]) * keys[i].dir; if (d) return d; }
      return x.idx - y.idx;
    })
    .map((x) => x.r);
}

/** Remove o cabecalho "Nome da Medida =" e devolve so a expressao. */
function stripMeasureName(src) {
  const m = src.match(/^\s*[^\n=]*=[ \t]*\r?\n/);
  return m ? ' '.repeat(m[0].length - 1) + '\n' + src.slice(m[0].length) : src;
}

/**
 * Avalia a medida.
 * @param {string} file  caminho do .txt da medida
 * @param {object} mocks { nomeDaVAR: valor } para tudo que depende do modelo
 * @param {object} [opts] { utcNow: serial } relogio ficticio
 */
function evaluate(file, mocks, opts) {
  const raw = require('fs').readFileSync(file, 'utf8');
  const src = stripMeasureName(raw);
  const ast = parse(src);
  const chk = check(ast, src);
  if (chk.problems.length) throw new Error(file + ':\n  ' + chk.problems.join('\n  '));
  if (opts && opts.utcNow !== undefined) CLOCK = { utcNow: opts.utcNow };
  const rt = { mocks: mocks || {}, usedMocks: new Set(), stack: [], grupos: [], topVars: null, calculate: opts && opts.calculate };
  const html = ev(ast, { env: null, row: null, rt, top: true });
  const unusedMocks = Object.keys(rt.mocks).filter((k) => !rt.usedMocks.has(k));
  const notEvaluated = rt.topVars ? [...rt.topVars.values()].filter((s) => !s.done).map((s) => s.name) : [];
  return { html: str(html), funcs: chk.funcs, unusedMocks, notEvaluated, sourceChars: raw.length };
}

module.exports = { evaluate, parse, check, tokenize, serial, daxFormat, stripMeasureName };
