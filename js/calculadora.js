/* Calculadora moderna — abre no topbar e cola o resultado no campo aberto */
import { openSheet, toast } from './ui.js';
import { toNumber, round2, esc } from './utils.js';

let ultimoCampo = null;
document.addEventListener('focusin', (e) => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.type !== 'checkbox' && t.type !== 'radio' && t.type !== 'file') {
    ultimoCampo = t;
  }
}, true);

function campoValido(el) {
  if (!el || !document.contains(el)) return false;
  if (el.disabled || el.readOnly) return false;
  if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file' || el.type === 'date') return false;
  if (el.closest('[hidden]') || el.offsetParent === null) return false;
  return true;
}

function campoAlvo(preferido) {
  if (campoValido(preferido)) return preferido;
  if (campoValido(ultimoCampo)) return ultimoCampo;
  const sheets = [...document.querySelectorAll('#sheet-root .sheet')];
  const topo = sheets[sheets.length - 1];
  if (topo) {
    const cand = [...topo.querySelectorAll('input, textarea')].find((i) =>
      !i.disabled && i.type !== 'checkbox' && i.type !== 'radio' && i.type !== 'file'
      && (i.inputMode === 'decimal' || i.type === 'number' || i.type === 'text')
    );
    if (campoValido(cand)) return cand;
  }
  return null;
}

const toBR = (n) => {
  if (!isFinite(n)) return '0';
  let s = String(n);
  if (s.includes('e') || s.includes('E')) s = n.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
};
const num = (s) => toNumber(s);
const mostra = (n) => (isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 10 }) : '0');

function calc(a, o, b) {
  let r;
  if (o === '+') r = a + b;
  else if (o === '−') r = a - b;
  else if (o === '×') r = a * b;
  else if (o === '÷') {
    if (b === 0) { toast('Divisão por zero', 'err'); return null; }
    r = a / b;
  } else return null;
  if (!isFinite(r)) return null;
  return round2(r);
}

export function abrirCalculadora({ alvo = null, titulo = 'Calculadora' } = {}) {
  const destino = campoAlvo(alvo);

  let atual = '0';
  let acc = null;
  let op = null;
  let novo = true;
  let ultimoExpr = '';

  const s = openSheet({
    title: titulo,
    center: true,
    body: `
      <div class="calc">
        <div class="calc-screen">
          <div class="calc-expr" data-calc-expr></div>
          <div class="calc-val" data-calc-val>0</div>
        </div>
        <div class="calc-pad">
          <button class="ck fn" data-k="AC" type="button">AC</button>
          <button class="ck fn" data-k="back" type="button">⌫</button>
          <button class="ck fn" data-k="%" type="button">%</button>
          <button class="ck op" data-k="÷" type="button">÷</button>
          <button class="ck" data-k="7" type="button">7</button>
          <button class="ck" data-k="8" type="button">8</button>
          <button class="ck" data-k="9" type="button">9</button>
          <button class="ck op" data-k="×" type="button">×</button>
          <button class="ck" data-k="4" type="button">4</button>
          <button class="ck" data-k="5" type="button">5</button>
          <button class="ck" data-k="6" type="button">6</button>
          <button class="ck op" data-k="−" type="button">−</button>
          <button class="ck" data-k="1" type="button">1</button>
          <button class="ck" data-k="2" type="button">2</button>
          <button class="ck" data-k="3" type="button">3</button>
          <button class="ck op" data-k="+" type="button">+</button>
          <button class="ck fn" data-k="±" type="button">±</button>
          <button class="ck" data-k="0" type="button">0</button>
          <button class="ck" data-k="," type="button">,</button>
          <button class="ck eq" data-k="=" type="button">=</button>
        </div>
        <div class="calc-hint">${destino
          ? `Resultado vai em: <b>${esc(destino.placeholder || destino.id || destino.name || 'campo aberto')}</b>`
          : 'Abra um campo de valor/desconto e o resultado é colado nele.'}</div>
      </div>`,
    foot: `
      <button class="btn btn-ghost" data-calc-copy type="button">Copiar</button>
      <button class="btn btn-primary" data-calc-use type="button" ${destino ? '' : 'disabled'}>Usar resultado</button>`,
    onClose: () => document.removeEventListener('keydown', onKey)
  });

  const valEl = s.sheet.querySelector('[data-calc-val]');
  const exprEl = s.sheet.querySelector('[data-calc-expr]');
  const btnUse = s.sheet.querySelector('[data-calc-use]');

  function pintar() {
    valEl.textContent = atual;
    valEl.classList.toggle('small', atual.length > 12);
    let expr = '';
    if (op && acc !== null) expr = `${mostra(acc)} ${op}${novo ? '' : ` ${atual}`}`;
    else expr = ultimoExpr;
    exprEl.textContent = expr;
    s.sheet.querySelectorAll('.ck.op').forEach((b) => b.classList.toggle('on', b.dataset.k === op && novo));
  }

  function digito(d) {
    if (novo) {
      atual = d === ',' ? '0,' : d;
      novo = false;
      return;
    }
    if (d === ',') {
      if (atual.includes(',')) return;
      atual += ',';
      return;
    }
    if (atual.replace('-', '').replace(',', '').length >= 12) return;
    atual = atual === '0' ? d : atual + d;
  }

  function defineOp(o) {
    if (op !== null && acc !== null && !novo) {
      const r = calc(acc, op, num(atual));
      if (r === null) return;
      acc = r;
      atual = toBR(r);
    } else if (acc === null) {
      acc = num(atual);
    }
    op = o;
    novo = true;
  }

  function igual() {
    if (op === null || acc === null) return;
    const b = num(atual);
    const r = calc(acc, op, b);
    if (r === null) return;
    ultimoExpr = `${mostra(acc)} ${op} ${mostra(b)} =`;
    atual = toBR(r);
    acc = null;
    op = null;
    novo = true;
  }

  function percentual() {
    let v = num(atual);
    if ((op === '+' || op === '−') && acc !== null && !novo) v = (acc * v) / 100;
    else v = v / 100;
    atual = toBR(v);
    novo = true;
  }

  function executar(k) {
    if (/^[0-9]$/.test(k)) digito(k);
    else if (k === ',') digito(',');
    else if (k === '+' || k === '−' || k === '×' || k === '÷') defineOp(k);
    else if (k === '=') igual();
    else if (k === '%') percentual();
    else if (k === 'AC') { atual = '0'; acc = null; op = null; novo = true; ultimoExpr = ''; }
    else if (k === 'back') {
      if (novo) return;
      atual = atual.length > 1 ? atual.slice(0, -1) : '0';
      if (atual === '-' ) atual = '0';
    } else if (k === '±') {
      atual = atual.startsWith('-') ? atual.slice(1) : (atual === '0' ? '0' : `-${atual}`);
    }
    pintar();
  }

  s.sheet.querySelectorAll('.ck').forEach((b) => b.addEventListener('click', () => executar(b.dataset.k)));

  function valorTexto() {
    const n = round2(num(atual));
    return { n, txt: destino && destino.type === 'number' ? String(n) : toBR(n) };
  }

  s.sheet.querySelector('[data-calc-use]')?.addEventListener('click', () => {
    if (!destino) return;
    const { txt } = valorTexto();
    destino.value = txt;
    destino.dispatchEvent(new Event('input', { bubbles: true }));
    destino.dispatchEvent(new Event('change', { bubbles: true }));
    toast('Resultado aplicado', 'ok');
    s.close();
  });

  s.sheet.querySelector('[data-calc-copy]')?.addEventListener('click', async () => {
    const { txt } = valorTexto();
    try {
      await navigator.clipboard.writeText(txt);
      toast('Resultado copiado', 'ok');
    } catch {
      toast('Não foi possível copiar', 'err');
    }
  });

  function onKey(e) {
    if (!document.contains(s.sheet)) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (e.key === 'Escape') { s.close(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let k = null;
    if (/^[0-9]$/.test(e.key)) k = e.key;
    else if (e.key === '.' || e.key === ',') k = ',';
    else if (e.key === '+') k = '+';
    else if (e.key === '-') k = '−';
    else if (e.key === '*' || e.key.toLowerCase() === 'x') k = '×';
    else if (e.key === '/') k = '÷';
    else if (e.key === '%') k = '%';
    else if (e.key === 'Enter' || e.key === '=') k = '=';
    else if (e.key === 'Backspace') k = 'back';
    else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') k = 'AC';
    if (!k) return;
    e.preventDefault();
    executar(k);
  }
  document.addEventListener('keydown', onKey);

  pintar();
  return s;
}

/* Atalho: qualquer botão [data-calc-open="id-do-campo"] abre a calculadora nele */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-calc-open]');
  if (!b) return;
  e.preventDefault();
  const id = b.dataset.calcOpen;
  abrirCalculadora({ alvo: id ? document.getElementById(id) : null });
});
