/* Calendário do mês — vendas realizadas e parcelas a vencer */
import { openSheet } from './ui.js';
import { listarVendas, contasAReceber } from './db.js';
import { navigate } from './app.js';
import { hoje, fmtMoney, esc, round2 } from './utils.js';

const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (s) => { const [a, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d); };
const soma = (arr) => round2(arr.reduce((t, x) => t + (Number(x) || 0), 0));

async function carregar() {
  const [vendas, contas] = await Promise.all([listarVendas(), contasAReceber()]);
  const vendasDia = new Map();
  for (const v of vendas) {
    if (v.tipo !== 'venda' || v.cancelada) continue;
    const k = String(v.data).slice(0, 10);
    const cur = vendasDia.get(k) || { n: 0, total: 0, itens: [] };
    cur.n += 1;
    cur.total = round2(cur.total + (Number(v.total) || 0));
    cur.itens.push(v);
    vendasDia.set(k, cur);
  }
  const vencDia = new Map();
  for (const c of contas) {
    if (!c.vencimento) continue;
    const k = String(c.vencimento).slice(0, 10);
    const cur = vencDia.get(k) || [];
    cur.push(c);
    vencDia.set(k, cur);
  }
  return { vendasDia, vencDia };
}

function linhaVenda(v) {
  return `
    <button class="cal-row" type="button" data-venda="${esc(v.id)}">
      <div class="cr-main">
        <div class="cr-t">🧾 Venda #${esc(String(v.numero ?? ''))} · ${esc(v.clienteNome || 'Consumidor final')}</div>
        <div class="cr-s">${esc(v.formaPagamento || '')}${v.hora ? ` · ${esc(v.hora)}` : ''}</div>
      </div>
      <div class="cr-v">${fmtMoney(v.total)}</div>
    </button>`;
}

function linhaConta(c) {
  const atrasa = c.atrasada;
  return `
    <button class="cal-row" type="button" data-venda="${esc(c.venda?.id || '')}">
      <div class="cr-main">
        <div class="cr-t">📌 ${esc(c.venda?.clienteNome || 'Cliente')} · ${c.parcela}/${c.totalParcelas}</div>
        <div class="cr-s">Venda #${esc(String(c.venda?.numero ?? ''))} · vence ${atrasa ? '⚠️ atrasada' : 'em dia'}</div>
      </div>
      <div class="cr-v">${fmtMoney(c.valor)}</div>
    </button>`;
}

export async function abrirCalendario() {
  const base = new Date();
  let ano = base.getFullYear();
  let mes = base.getMonth();
  let sel = hoje();
  let dados = null;

  const s = openSheet({
    title: '📅 Calendário',
    body: '<div class="cal" data-cal><div class="cal-none">Carregando…</div></div>'
  });
  const box = s.sheet.querySelector('[data-cal]');

  box.addEventListener('click', (e) => {
    const dia = e.target.closest('[data-dia]');
    if (dia?.dataset.dia) {
      sel = dia.dataset.dia;
      pintar();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'prev') { mes -= 1; if (mes < 0) { mes = 11; ano -= 1; } pintar(); }
      else if (a === 'next') { mes += 1; if (mes > 11) { mes = 0; ano += 1; } pintar(); }
      else if (a === 'hoje') { const h = new Date(); ano = h.getFullYear(); mes = h.getMonth(); sel = hoje(); pintar(); }
      return;
    }
    const row = e.target.closest('[data-venda]');
    if (row?.dataset.venda) {
      s.close();
      navigate(`venda/${row.dataset.venda}`);
    }
  });

  function pintar() {
    const hojeISO = hoje();
    const primeiro = new Date(ano, mes, 1);
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const vazios = primeiro.getDay();

    let grid = '';
    for (let i = 0; i < vazios; i++) grid += '<div class="cal-day blank" aria-hidden="true"></div>';
    for (let d = 1; d <= diasNoMes; d++) {
      const key = iso(new Date(ano, mes, d));
      const vd = dados?.vendasDia.get(key);
      const ct = dados?.vencDia.get(key);
      const dots = [
        vd ? '<span class="dot v"></span>' : '',
        ct && ct.some((c) => c.atrasada) ? '<span class="dot late"></span>' : '',
        ct && ct.some((c) => !c.atrasada) ? '<span class="dot t"></span>' : ''
      ].join('');
      grid += `<button class="cal-day${key === hojeISO ? ' today' : ''}${key === sel ? ' sel' : ''}" type="button" data-dia="${key}">
        <span>${d}</span><span class="dots">${dots}</span>
      </button>`;
    }

    const vd = dados?.vendasDia.get(sel);
    const ct = dados?.vencDia.get(sel) || [];
    const totalVenc = soma(ct.map((c) => c.valor));

    box.innerHTML = `
      <div class="cal-head">
        <button class="cal-nav" type="button" data-act="prev" aria-label="Mês anterior">‹</button>
        <div class="cal-mes">${MES[mes].charAt(0).toUpperCase() + MES[mes].slice(1)} de ${ano}</div>
        <button class="cal-nav" type="button" data-act="next" aria-label="Próximo mês">›</button>
        <button class="cal-hoje" type="button" data-act="hoje">Hoje</button>
      </div>
      <div class="cal-dow">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${grid}</div>
      <div class="cal-legend">
        <span><i class="v"></i>Vendas</span>
        <span><i class="t"></i>A vencer</span>
        <span><i class="late"></i>Vencidas</span>
      </div>
      <div class="cal-sec"><h4>${sel.split('-').reverse().join('/')}</h4></div>
      <div class="cal-sec">
        <h4>Vendas do dia</h4>
        <span class="cnt">${vd ? `${vd.n} · ${fmtMoney(vd.total)}` : '0'}</span>
      </div>
      ${vd && vd.itens.length ? vd.itens.map(linhaVenda).join('') : '<div class="cal-none">Nenhuma venda neste dia</div>'}
      <div class="cal-sec">
        <h4>Parcelas do dia</h4>
        <span class="cnt">${ct.length ? `${ct.length} · ${fmtMoney(totalVenc)}` : '0'}</span>
      </div>
      ${ct.length ? ct.map(linhaConta).join('') : '<div class="cal-none">Nenhuma parcela com vencimento neste dia</div>'}
    `;
  }

  pintar();
  dados = await carregar();
  pintar();
  return s;
}
