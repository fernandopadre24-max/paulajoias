/* Componentes de interface: toasts, sheets, diálogos, formulários */
import { esc, toNumber, fmtMoney, debounce } from './utils.js';

/* ---------------- Toast ---------------- */

export function toast(msg, type = 'ok') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'err' ? '⚠️' : type === 'info' ? 'ℹ️' : '✓';
  el.innerHTML = `<span>${icon}</span><span>${esc(msg)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 240);
  }, 2600);
}

/* ---------------- Sheet ---------------- */

const stack = [];

function syncScrollLock() {
  document.body.style.overflow = stack.length ? 'hidden' : '';
}

export function openSheet({ title = '', body = '', foot = '', center = false, onClose = null, dismissable = true }) {
  const root = document.getElementById('sheet-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const sheet = document.createElement('div');
  sheet.className = `sheet${center ? ' center' : ''}`;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.innerHTML = `
    ${center ? '' : '<div class="grabber"></div>'}
    <div class="sheet-head">
      <h2 class="sheet-title">${title}</h2>
      <button class="sheet-close" aria-label="Fechar" type="button">✕</button>
    </div>
    <div class="sheet-body">${body}</div>
    ${foot ? `<div class="sheet-foot">${foot}</div>` : ''}
  `;
  root.appendChild(backdrop);
  root.appendChild(sheet);
  syncScrollLock();

  let closed = false;
  const entry = { close };

  function close(silent = false) {
    if (closed) return;
    closed = true;
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    backdrop.classList.remove('show');
    sheet.classList.remove('show');
    setTimeout(() => {
      backdrop.remove();
      sheet.remove();
      syncScrollLock();
    }, 240);
    if (!silent && onClose) onClose();
  }

  backdrop.addEventListener('click', () => { if (dismissable) close(); });
  sheet.querySelector('.sheet-close').addEventListener('click', () => close());

  stack.push(entry);
  requestAnimationFrame(() => {
    backdrop.classList.add('show');
    sheet.classList.add('show');
  });

  return { close, sheet, backdrop, el: sheet };
}

export function closeSheet(silent = false) {
  const top = stack[stack.length - 1];
  if (top) top.close(silent);
}

export function closeAllSheets() {
  [...stack].reverse().forEach((s) => s.close(true));
}

export function confirmDialog(message, { okLabel = 'Confirmar', danger = false, title = 'Confirmação', extra = '' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const finish = (v) => {
      if (answered) return;
      answered = true;
      resolve(v);
    };
    const s = openSheet({
      title,
      center: true,
      dismissable: true,
      body: `<p style="margin:4px 0 8px;font-size:15px">${esc(message)}</p>${extra}`,
      foot: `
        <button class="btn btn-ghost" data-act="no" type="button">Cancelar</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="yes" type="button">${esc(okLabel)}</button>`,
      onClose: () => finish(false)
    });
    s.sheet.querySelector('[data-act="no"]').onclick = () => { s.close(); };
    s.sheet.querySelector('[data-act="yes"]').onclick = () => { s.close(true); finish(true); };
  });
}

/* ---------------- Formulário genérico ---------------- */

export function fieldHTML(f, valor = '') {
  const id = `f_${f.name}`;
  const v = valor === null || valor === undefined ? '' : valor;
  let control = '';
  const common = `id="${id}" name="${f.name}" ${f.required ? 'required' : ''} ${f.disabled ? 'disabled' : ''}`;
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';

  switch (f.type) {
    case 'textarea':
      control = `<textarea ${common} ${ph} rows="${f.rows || 3}">${esc(v)}</textarea>`;
      break;
    case 'select':
      control = `<select ${common}>
        ${(f.options || []).map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const lab = typeof o === 'string' ? o : o.label;
          return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`;
        }).join('')}
      </select>`;
      break;
    case 'switch':
      return `
        <div class="field">
          <div class="switch">
            <label for="${id}" style="font-weight:700;font-size:14.5px;margin:0;cursor:pointer">${f.label || ''}</label>
            <input type="checkbox" ${common} ${v === true || v === 'on' || v === 1 ? 'checked' : ''}>
            <span class="track"></span>
          </div>
          ${f.hint ? `<div class="tiny muted" style="margin-top:-6px">${esc(f.hint)}</div>` : ''}
        </div>`;
    case 'money':
    case 'number':
      control = `<div class="input-wrap ${f.type === 'money' ? 'has-prefix' : ''}">
        ${f.type === 'money' ? '<span class="prefix">R$</span>' : ''}
        <input type="text" inputmode="decimal" ${common} ${ph}
          value="${v === '' ? '' : (f.type === 'money' ? fmtMoney(v).replace('R$', '').trim() : esc(v))}">
      </div>`;
      break;
    case 'date':
      control = `<input type="date" ${common} value="${esc(v)}">`;
      break;
    case 'tel':
      control = `<input type="tel" inputmode="tel" ${common} ${ph} value="${esc(v)}">`;
      break;
    default:
      control = `<input type="text" ${common} ${ph} value="${esc(v)}" ${f.inputmode ? `inputmode="${f.inputmode}"` : ''}>`;
  }

  return `
    <div class="field" ${f.hide ? 'style="display:none"' : ''}>
      ${f.label ? `<label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>` : ''}
      ${control}
      ${f.hint ? `<div class="tiny muted" style="margin-top:4px">${esc(f.hint)}</div>` : ''}
    </div>`;
}

export function readForm(sheetEl, fields) {
  const out = {};
  for (const f of fields) {
    const node = sheetEl.querySelector(`[name="${f.name}"]`);
    if (!node) continue;
    if (f.type === 'switch') out[f.name] = node.checked;
    else if (f.type === 'money') out[f.name] = roundMoney(toNumber(node.value));
    else if (f.type === 'number') out[f.name] = Number(node.value) || 0;
    else out[f.name] = node.value;
    if (f.required && (out[f.name] === '' || out[f.name] === null || out[f.name] === undefined)) {
      const e = new Error(`Preencha: ${f.label || f.name}`);
      e.__field = f.name;
      throw e;
    }
  }
  return out;
}

function roundMoney(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

export function openForm({ title, fields, values = {}, submitLabel = 'Salvar', onSubmit, danger = false, intro = '' }) {
  const s = openSheet({
    title,
    body: `${intro}${fields.map((f) => fieldHTML(f, values[f.name])).join('')}`,
    foot: `<button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block" data-act="save" type="button">${esc(submitLabel)}</button>`
  });

  // formatação money ao sair
  s.sheet.querySelectorAll('input[inputmode="decimal"]').forEach((inp) => {
    const f = fields.find((x) => x.name === inp.name);
    if (f && f.type === 'money') {
      inp.addEventListener('blur', () => {
        const n = toNumber(inp.value);
        inp.value = n ? fmtMoney(n).replace('R$', '').trim() : '';
      });
      if (toNumber(inp.value)) inp.value = fmtMoney(inp.value).replace('R$', '').trim();
    }
  });

  const btn = s.sheet.querySelector('[data-act="save"]');
  btn.addEventListener('click', async () => {
    let data;
    try {
      data = readForm(s.sheet, fields);
    } catch (e) {
      if (e.__field) {
        const n = s.sheet.querySelector(`[name="${e.__field}"]`);
        n?.focus();
        n?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      toast(e.message, 'err');
      return;
    }
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Salvando…';
    try {
      const r = await onSubmit(data, s);
      if (r !== false) s.close(true);
    } catch (e) {
      toast(e.message || 'Erro ao salvar', 'err');
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });
  return s;
}

/* ---------------- Busca em lista ---------------- */

export function bindSearch(inputEl, onSearch) {
  const fn = debounce((v) => onSearch(v), 180);
  inputEl.addEventListener('input', () => fn(inputEl.value));
  return {
    clear() {
      inputEl.value = '';
      onSearch('');
      inputEl.focus();
    }
  };
}

export function emptyState({ emoji = '✨', title, text = '', action = '' }) {
  return `
    <div class="empty">
      <span class="emoji">${emoji}</span>
      <h3>${esc(title)}</h3>
      ${text ? `<p>${esc(text)}</p>` : ''}
      ${action}
    </div>`;
}

export function badgeStatus(status) {
  const map = {
    pago: ['badge-ok', 'Pago'],
    parcial: ['badge-warn', 'Parcial'],
    pendente: ['badge-danger', 'A pagar'],
    cancelada: ['badge-mute', 'Cancelada'],
    orcamento: ['badge-info', 'Orçamento']
  };
  const [cls, lab] = map[status] || ['badge-mute', status];
  return `<span class="badge ${cls}">${lab}</span>`;
}
