/* Vendas e Orçamentos */
import {
  listarVendas, listarPagamentos, getVenda, statusVenda, saldoVenda, pagoNaVenda,
  cancelarVenda, restaurarVenda, excluirVenda, atualizarVenda, registrarPagamento,
  parcelasEmAberto, criarVenda, converterEmVenda, buscarCliente, listarClientes,
  buscarProduto, excluirPagamento, getProduto
} from '../db.js';
import { toast, openSheet, openForm, confirmDialog, emptyState, bindSearch, badgeStatus } from '../ui.js';
import { fmtMoney, esc, round2, hoje, fmtDate, toNumber, norm, addDays, soma, objUrl } from '../utils.js';
import { imprimirRecibo, compartilharRecibo } from '../print.js';
import { LABELS_FORMA, periodoPreset, filtrarPorPeriodo, resumo } from '../report.js';
import { escolherCliente } from './pdv.js';

let aba = 'vendas';
let periodo = '30';
let termo = '';
let statusFiltro = 'todos';

export async function renderVendas(ctx) {
  const { root, navigate, setTopbar } = ctx;
  const novoLabel = aba === 'orcamentos' ? '📋' : '🛒';
  setTopbar({
    title: aba === 'orcamentos' ? 'Orçamentos' : 'Vendas',
    sub: 'Controle de pagamentos',
    actions: [
      { icon: novoLabel, label: 'Nova venda/orçamento', onClick: () => (aba === 'orcamentos' ? novoOrcamento(() => renderVendas(ctx)) : navigate('pdv')) }
    ]
  });

  const p = periodoPreset(periodo);
  const [todas, pags] = await Promise.all([listarVendas(), listarPagamentos()]);
  const doPeriodo = filtrarPorPeriodo(todas, p);
  const r = resumo(doPeriodo, pags);

  root.innerHTML = `
    <div class="pdv-head">
      <div class="segmented" id="vd-tabs">
        <button class="${aba === 'vendas' ? 'active' : ''}" data-aba="vendas" type="button">Vendas</button>
        <button class="${aba === 'orcamentos' ? 'active' : ''}" data-aba="orcamentos" type="button">Orçamentos</button>
      </div>
      <div class="searchbox mt8">
        <span class="sic">🔎</span>
        <input id="vd-q" type="search" placeholder="Buscar por cliente, nº ou item" autocomplete="off" value="${esc(termo)}">
      </div>
      <div class="chips mt8">
        ${['hoje', '7', '30', 'mes', 'mespassado', 'ano', 'tudo'].map((k) => `
          <button class="chip ${periodo === k ? 'active' : ''}" data-per="${k}" type="button">${periodoPreset(k).label}</button>
        `).join('')}
      </div>
      ${aba === 'vendas' ? `
        <div class="chips mt8">
          ${[['todos', 'Todos'], ['aberto', 'A receber'], ['pago', 'Pagos'], ['cancelada', 'Canceladas']].map(([k, l]) => `
            <button class="chip gold ${statusFiltro === k ? 'active' : ''}" data-st="${k}" type="button">${l}</button>
          `).join('')}
        </div>` : ''}
    </div>

    <div class="page tight">
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">Faturado</div>
          <div class="kpi-value">${fmtMoney(r.faturamento)}</div>
          <div class="kpi-hint">${r.pedidos} venda(s) · ticket ${fmtMoney(r.ticket)}</div>
        </div>
        <div class="kpi ${r.aReceber > 0 ? 'warn' : 'ok'}">
          <div class="kpi-label">A receber</div>
          <div class="kpi-value">${fmtMoney(r.aReceber)}</div>
          <div class="kpi-hint">recebido: ${fmtMoney(r.recebido)}</div>
        </div>
      </div>
      <div id="vd-lista" class="mt12"></div>
    </div>

    ${aba === 'vendas' ? '<button class="fab gold" id="vd-fab" type="button" title="Nova venda">🛒</button>' : ''}
  `;

  const pintar = () => {
    const box = root.querySelector('#vd-lista');
    let lista = doPeriodo.filter((v) => (aba === 'orcamentos' ? v.tipo === 'orcamento' : v.tipo === 'venda'));
    if (aba === 'vendas' && statusFiltro === 'cancelada') lista = lista.filter((v) => v.cancelada);
    else if (aba === 'vendas') {
      lista = lista.filter((v) => !v.cancelada);
      if (statusFiltro === 'pago') lista = lista.filter((v) => statusVenda(v, pags) === 'pago');
      if (statusFiltro === 'aberto') lista = lista.filter((v) => statusVenda(v, pags) !== 'pago');
    }
    if (termo) {
      const t = norm(termo);
      lista = lista.filter((v) =>
        norm(v.clienteNome).includes(t) ||
        String(v.numero).includes(termo) ||
        (v.itens || []).some((i) => norm(i.nome).includes(t) || norm(i.codigo).includes(t))
      );
    }
    lista.sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.criadoEm || 0) - (a.criadoEm || 0));

    box.innerHTML = lista.length
      ? `<div class="card list">${lista.map((v) => rowVenda(v, pags)).join('')}</div>
         <div class="small muted text-center mt12">${lista.length} registro(s) · ${fmtMoney(soma(lista.filter((v) => !v.cancelada), (v) => v.total))}</div>`
      : emptyState({
        emoji: aba === 'orcamentos' ? '📋' : '🧾',
        title: aba === 'orcamentos' ? 'Nenhum orçamento' : 'Nenhuma venda no período',
        text: 'Ajuste os filtros ou lance uma nova venda.',
        action: `<button class="btn btn-primary" data-novo type="button">${aba === 'orcamentos' ? 'Novo orçamento' : 'Ir para o PDV'}</button>`
      });

    box.querySelectorAll('[data-open]').forEach((el) => { el.onclick = () => navigate(`venda/${el.dataset.open}`); });
    box.querySelector('[data-novo]')?.addEventListener('click', () => {
      if (aba === 'orcamentos') novoOrcamento(() => renderVendas(ctx));
      else navigate('pdv');
    });
  };

  root.querySelectorAll('[data-aba]').forEach((b) => {
    b.onclick = () => { aba = b.dataset.aba; renderVendas(ctx); };
  });
  root.querySelectorAll('[data-per]').forEach((b) => {
    b.onclick = () => { periodo = b.dataset.per; renderVendas(ctx); };
  });
  root.querySelectorAll('[data-st]').forEach((b) => {
    b.onclick = () => { statusFiltro = b.dataset.st; renderVendas(ctx); };
  });
  bindSearch(root.querySelector('#vd-q'), (v) => { termo = v; pintar(); });
  root.querySelector('#vd-fab')?.addEventListener('click', () => navigate('pdv'));

  pintar();
}

function rowVenda(v, pags) {
  const st = v.cancelada ? 'cancelada' : statusVenda(v, pags);
  const saldo = saldoVenda(v, pags);
  const pago = pagoNaVenda(v, pags);
  const itensTxt = (v.itens || []).slice(0, 2).map((i) => i.nome).join(', ') + ((v.itens?.length || 0) > 2 ? ` +${v.itens.length - 2}` : '');
  return `
    <button class="item" data-open="${v.id}" type="button">
      <div class="thumb sm" style="background:${st === 'pago' ? 'var(--ok-soft)' : st === 'orcamento' ? 'var(--info-soft)' : st === 'cancelada' ? '#efeaf3' : 'var(--warn-soft)'}">
        ${st === 'pago' ? '✓' : st === 'orcamento' ? '📋' : st === 'cancelada' ? '✕' : '⏳'}
      </div>
      <div class="item-main">
        <div class="item-title">${v.tipo === 'orcamento' ? 'Orçamento' : 'Venda'} #${v.numero} · ${esc(v.clienteNome)}</div>
        <div class="item-sub">${fmtDate(v.data)}${v.hora ? ` ${v.hora}` : ''} · ${esc(itensTxt || 'sem itens')}</div>
        <div style="margin-top:4px">${badgeStatus(st)}${saldo > 0 && !v.cancelada ? ` <span class="badge badge-warn">saldo ${fmtMoney(saldo)}</span>` : ''}</div>
      </div>
      <div class="item-right">
        <div class="strong mono nowrap" style="${v.cancelada ? 'text-decoration:line-through;color:var(--muted)' : ''}">${fmtMoney(v.total)}</div>
        ${st !== 'orcamento' && !v.cancelada ? `<div class="tiny muted">pago ${fmtMoney(pago)}</div>` : ''}
      </div>
    </button>`;
}

/* ---------------- Novo orçamento ---------------- */

export async function novoOrcamento(onSaved) {
  const clientes = await buscarCliente('');
  let cliente = null;
  let itens = [];
  let desconto = 0;

  const s = openSheet({
    title: 'Novo orçamento',
    body: `
      <div class="card card-pad" style="margin-bottom:12px">
        <div class="spread" style="cursor:pointer" id="oc-cliente">
          <div class="row-flex">
            <div class="thumb sm avatar">👤</div>
            <div>
              <div class="item-title" style="font-size:14.5px" id="oc-cliente-nome">Consumidor final</div>
              <div class="item-sub">Toque para escolher o cliente</div>
            </div>
          </div>
          <span class="muted">›</span>
        </div>
      </div>

      <div class="searchbox">
        <span class="sic">🔎</span>
        <input type="search" id="oc-q" placeholder="Buscar produto para incluir" autocomplete="off">
      </div>
      <div class="card list mt8" id="oc-achados" style="max-height:190px;overflow:auto"></div>

      <div class="section-title">Itens do orçamento</div>
      <div class="card list" id="oc-itens"></div>

      <div class="card card-pad mt12">
        <div class="field-row">
          <div class="field">
            <label>Desconto</label>
            <div class="input-wrap has-prefix">
              <span class="prefix">R$</span>
              <input type="text" inputmode="decimal" id="oc-desconto" value="0,00">
            </div>
          </div>
          <div class="field">
            <label>Validade</label>
            <select id="oc-validade">
              <option value="7">7 dias</option>
              <option value="15" selected>15 dias</option>
              <option value="30">30 dias</option>
            </select>
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label>Observações</label>
          <textarea id="oc-obs" rows="2" placeholder="Condições, prazo de entrega, gravação…"></textarea>
        </div>
      </div>

      <div class="card card-pad mt12 totals" id="oc-totals"></div>
    `,
    foot: '<button class="btn btn-primary btn-block" data-save type="button">Salvar orçamento</button>'
  });

  const $ = (sel) => s.sheet.querySelector(sel);

  const pintarTotais = () => {
    const sub = round2(soma(itens, (i) => i.qtd * i.precoUnit));
    desconto = Math.min(toNumber($('#oc-desconto').value), sub);
    const total = round2(sub - desconto);
    $('#oc-totals').innerHTML = `
      <div class="t-line"><span>Subtotal</span><span>${fmtMoney(sub)}</span></div>
      <div class="t-line"><span>Desconto</span><span>${desconto ? `- ${fmtMoney(desconto)}` : '—'}</span></div>
      <div class="t-line total"><span>Total</span><span>${fmtMoney(total)}</span></div>`;
  };

  const pintarItens = () => {
    const box = $('#oc-itens');
    if (!itens.length) {
      box.innerHTML = '<div class="card-pad small muted text-center">Nenhum item. Busque acima para adicionar.</div>';
      pintarTotais();
      return;
    }
    box.innerHTML = itens.map((i, idx) => `
      <div class="cart-item">
        <div class="grow" style="min-width:0">
          <div class="ci-name">${esc(i.nome)}</div>
          <input type="text" inputmode="decimal" data-preco="${idx}" value="${fmtMoney(i.precoUnit).replace('R$', '').trim()}"
            style="width:92px;padding:5px 8px;font-size:13px;margin-top:4px">
        </div>
        <div class="qty-mini">
          <button data-q="${idx}" data-d="-" type="button">−</button>
          <span>${i.qtd}</span>
          <button data-q="${idx}" data-d="+" type="button">＋</button>
        </div>
        <div class="ci-total nowrap" style="min-width:72px;text-align:right">${fmtMoney(i.qtd * i.precoUnit)}</div>
        <button class="sheet-close" data-del="${idx}" type="button">✕</button>
      </div>`).join('');

    box.querySelectorAll('[data-q]').forEach((b) => {
      b.onclick = () => {
        const it = itens[Number(b.dataset.q)];
        if (b.dataset.d === '+') it.qtd++;
        else { it.qtd--; if (it.qtd <= 0) itens.splice(Number(b.dataset.q), 1); }
        pintarItens();
      };
    });
    box.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = () => { itens.splice(Number(b.dataset.del), 1); pintarItens(); };
    });
    box.querySelectorAll('[data-preco]').forEach((inp) => {
      inp.onchange = () => {
        itens[Number(inp.dataset.preco)].precoUnit = round2(toNumber(inp.value));
        pintarItens();
      };
    });
    pintarTotais();
  };

  $('#oc-desconto').addEventListener('input', pintarTotais);

  $('#oc-cliente').onclick = async () => {
    const sel = await escolherCliente(clientes);
    if (sel !== undefined) {
      cliente = sel;
      $('#oc-cliente-nome').textContent = sel ? sel.nome : 'Consumidor final';
      $('#oc-cliente .avatar').textContent = sel ? sel.nome.slice(0, 1).toUpperCase() : '👤';
    }
  };

  const achados = $('#oc-achados');
  const buscar = async (q) => {
    if (!q.trim()) { achados.innerHTML = ''; return; }
    const res = await buscarProduto(q);
    achados.innerHTML = res.length
      ? res.slice(0, 8).map((p) => `
          <button class="item" data-add="${p.id}" type="button">
            <div class="thumb sm">${p.foto ? `<img src="${objUrl(p.foto)}" alt="">` : '💍'}</div>
            <div class="item-main">
              <div class="item-title">${esc(p.nome)}</div>
              <div class="item-sub">${esc(p.codigo || p.categoria || '')} · estoque ${p.estoque}</div>
            </div>
            <div class="strong mono">${fmtMoney(p.precoVenda)}</div>
          </button>`).join('')
      : '<div class="card-pad small muted text-center">Nenhum produto</div>';
    achados.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = async () => {
        const p = await getProduto(b.dataset.add);
        if (!p) return;
        const ex = itens.find((i) => i.produtoId === p.id);
        if (ex) ex.qtd++;
        else itens.push({
          produtoId: p.id, codigo: p.codigo, nome: p.nome, categoria: p.categoria,
          qtd: 1, precoUnit: Number(p.precoVenda) || 0, custoUnit: Number(p.precoCusto) || 0
        });
        pintarItens();
        $('#oc-q').value = '';
        achados.innerHTML = '';
        $('#oc-q').focus();
      };
    });
  };
  bindSearch($('#oc-q'), buscar);

  pintarItens();

  s.sheet.querySelector('[data-save]').onclick = async () => {
    const btn = s.sheet.querySelector('[data-save]');
    if (!itens.length) { toast('Adicione ao menos um item.', 'err'); return; }
    btn.disabled = true;
    btn.innerHTML = 'Salvando…';
    try {
      const validade = Number($('#oc-validade').value) || 15;
      await criarVenda({
        tipo: 'orcamento',
        clienteId: cliente?.id || null,
        clienteNome: cliente?.nome || 'Consumidor final',
        itens,
        desconto,
        formaPagamento: 'combinar',
        parcelas: 1,
        obs: `${$('#oc-obs').value.trim()}${$('#oc-obs').value.trim() ? ' · ' : ''}Válido até ${fmtDate(addDays(hoje(), validade))}`,
        data: hoje(),
        receberAgora: false
      });
      toast('Orçamento salvo', 'ok');
      s.close(true);
      if (onSaved) onSaved();
    } catch (e) {
      toast(e.message || 'Erro ao salvar', 'err');
      btn.disabled = false;
      btn.innerHTML = 'Salvar orçamento';
    }
  };
}

/* ---------------- Detalhe da venda ---------------- */

export async function renderVendaDetalhe(ctx) {
  const { root, params, navigate, setTopbar } = ctx;
  const id = params[0];
  const v = await getVenda(id);

  if (!v) {
    root.innerHTML = `<div class="page">${emptyState({ emoji: '🔍', title: 'Registro não encontrado', action: '<button class="btn btn-primary" data-back type="button">Voltar</button>' })}</div>`;
    root.querySelector('[data-back]').onclick = () => navigate('vendas');
    return;
  }

  const pags = (await listarPagamentos()).filter((p) => p.vendaId === v.id).sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
  const st = statusVenda(v, pags);
  const saldo = saldoVenda(v, pags);
  const pago = pagoNaVenda(v, pags);
  const abertas = parcelasEmAberto(v, pags);

  setTopbar({
    title: `${v.tipo === 'orcamento' ? 'Orçamento' : 'Venda'} #${v.numero}`,
    sub: `${fmtDate(v.data)} · ${v.clienteNome}`,
    actions: [
      { icon: '🖨️', label: 'Imprimir recibo', onClick: () => imprimirRecibo(v) },
      { icon: '📤', label: 'Compartilhar', onClick: async () => { const ok = await compartilharRecibo(v); toast(ok ? 'Compartilhado' : 'Copiado', 'ok'); } },
      { icon: '🗑', label: 'Excluir', onClick: () => apagar(v, navigate) }
    ]
  });

  const margem = round2(soma(v.itens || [], (i) => i.qtd * (i.precoUnit - (i.custoUnit || 0))) - (v.desconto || 0));

  root.innerHTML = `
    <div class="page">
      <div class="card card-pad">
        <div class="spread">
          <div>
            <div class="tiny muted">TOTAL</div>
            <div class="kpi-value" style="font-size:28px;color:var(--plum)">${fmtMoney(v.total)}</div>
            <div style="margin-top:5px">${badgeStatus(st)}</div>
          </div>
          <div class="text-right">
            <div class="small"><b>Pago:</b> ${fmtMoney(pago)}</div>
            ${saldo > 0 ? `<div class="small danger-text"><b>Pendente:</b> ${fmtMoney(saldo)}</div>` : '<div class="small ok-text">Quitação completa</div>'}
          </div>
        </div>
        ${v.cancelada ? '<div class="alert alert-danger mt12"><span>⚠️</span><div>Esta venda foi <b>cancelada</b>.</div></div>' : ''}
      </div>

      <div class="section-title">Itens</div>
      <div class="card list">
        ${(v.itens || []).map((i) => `
          <div class="item" style="cursor:default">
            <div class="item-main">
              <div class="item-title">${i.qtd}x ${esc(i.nome)}</div>
              <div class="item-sub">${esc(i.codigo || 's/ código')} · ${fmtMoney(i.precoUnit)} un.</div>
            </div>
            <div class="item-right strong mono">${fmtMoney(i.qtd * i.precoUnit)}</div>
          </div>`).join('')}
      </div>

      <div class="card card-pad mt12 totals">
        <div class="t-line"><span>Subtotal</span><span>${fmtMoney(v.subtotal)}</span></div>
        <div class="t-line"><span>Desconto</span><span>${v.desconto ? `- ${fmtMoney(v.desconto)}` : '—'}</span></div>
        <div class="t-line"><span>Forma</span><span>${LABELS_FORMA[v.formaPagamento] || '—'}</span></div>
        <div class="t-line total"><span>Total</span><span>${fmtMoney(v.total)}</span></div>
      </div>

      ${v.obs ? `<div class="section-title">Observações</div><div class="card card-pad small">${esc(v.obs)}</div>` : ''}

      ${(v.parcelas || []).length ? `
        <div class="section-title">Parcelamento</div>
        <div class="card list">
          ${v.parcelas.map((par) => {
            const pagoParc = round2(soma(pags.filter((p) => (Number(p.parcela) || 1) === par.n), (p) => p.valor));
            const sal = round2(Math.max(0, par.valor - pagoParc));
            const vencida = sal > 0 && par.vencimento < hoje();
            return `
              <div class="item" style="cursor:default">
                <div class="item-main">
                  <div class="item-title">${par.n}ª parcela</div>
                  <div class="item-sub">venc. ${fmtDate(par.vencimento)}${vencida ? ' · vencida' : ''}</div>
                </div>
                <div class="item-right">
                  <div class="strong mono">${fmtMoney(par.valor)}</div>
                  ${sal <= 0 ? '<span class="badge badge-ok">paga</span>' : `<span class="badge ${vencida ? 'badge-danger' : 'badge-warn'}">falta ${fmtMoney(sal)}</span>`}
                </div>
              </div>`;
          }).join('')}
        </div>` : ''}

      ${pags.length ? `
        <div class="section-title">Recebimentos (${pags.length})</div>
        <div class="card timeline">
          ${pags.map((p, i) => `
            <div class="tl-item">
              <div class="tl-rail">
                <span class="tl-dot ok"></span>
                ${i < pags.length - 1 ? '<span class="tl-line"></span>' : ''}
              </div>
              <div class="tl-body">
                <div class="spread">
                  <b class="small">${fmtMoney(p.valor)}</b>
                  <button class="btn btn-sm btn-ghost" data-delpg="${p.id}" type="button">✕</button>
                </div>
                <div class="tiny muted">${fmtDate(p.data)} · ${LABELS_FORMA[p.forma] || p.forma || '—'}${p.obs ? ` · ${esc(p.obs)}` : ''}</div>
              </div>
            </div>`).join('')}
        </div>` : ''}

      ${st !== 'orcamento' && !v.cancelada && saldo > 0 ? `
        <div class="section-title">Ações</div>
        <button class="btn btn-ok btn-block" data-receber type="button">💰 Registrar pagamento${abertas.length ? ` (${abertas.length} em aberto)` : ''}</button>` : ''}

      ${st === 'orcamento' ? `
        <div class="section-title">Ações do orçamento</div>
        <button class="btn btn-primary btn-block" data-converter type="button">✅ Converter em venda</button>
        <button class="btn btn-ghost btn-block mt8" data-editar-orc type="button">✏️ Editar dados</button>` : ''}

      ${!v.cancelada && st !== 'orcamento' ? `
        <button class="btn btn-primary btn-block mt12" data-repetir type="button">🔁 Vender novamente (recarrega o PDV)</button>
        <button class="btn btn-danger btn-block mt8" data-cancelar type="button">⛔ Cancelar venda</button>` : ''}

      ${v.cancelada ? `
        <button class="btn btn-ok btn-block mt12" data-restaurar type="button">♻️ Restaurar venda</button>` : ''}
    </div>
  `;

  root.querySelector('[data-receber]')?.addEventListener('click', () => formPagamento(v, () => renderVendaDetalhe(ctx)));
  root.querySelector('[data-repetir]')?.addEventListener('click', async () => {
    const { prepararVendaPara } = await import('./pdv.js');
    const clientes = await listarClientes();
    prepararVendaPara(clientes.find((c) => c.id === v.clienteId) || null);
    sessionStorage.setItem('pdvRepique', JSON.stringify(v.itens));
    navigate('pdv');
    toast('Itens prontos no PDV', 'ok');
  });
  root.querySelector('[data-cancelar]')?.addEventListener('click', async () => {
    const ok = await confirmDialog(`Cancelar a venda #${v.numero}? O estoque será devolvido.`, { danger: true, okLabel: 'Cancelar venda' });
    if (!ok) return;
    await cancelarVenda(v.id);
    toast('Venda cancelada e estoque devolvido', 'ok');
    renderVendaDetalhe(ctx);
  });
  root.querySelector('[data-restaurar]')?.addEventListener('click', async () => {
    await restaurarVenda(v.id);
    toast('Venda restaurada', 'ok');
    renderVendaDetalhe(ctx);
  });
  root.querySelector('[data-converter]')?.addEventListener('click', async () => {
    const ok = await confirmDialog('Converter este orçamento em venda? O estoque será baixado.', { okLabel: 'Converter' });
    if (!ok) return;
    try {
      const nova = await converterEmVenda(v.id);
      toast(`Venda #${nova.numero} criada`, 'ok');
      navigate(`venda/${nova.id}`);
    } catch (e) {
      toast(e.message || 'Erro ao converter', 'err');
    }
  });
  root.querySelector('[data-editar-orc]')?.addEventListener('click', () => {
    openForm({
      title: 'Editar orçamento',
      fields: [
        { name: 'desconto', label: 'Desconto', type: 'money' },
        { name: 'obs', label: 'Observações', type: 'textarea', rows: 3 }
      ],
      values: { desconto: v.desconto, obs: v.obs },
      onSubmit: async (d) => {
        const subtotal = round2(soma(v.itens, (i) => i.qtd * i.precoUnit));
        await atualizarVenda(v.id, {
          desconto: Math.min(round2(d.desconto), subtotal),
          total: round2(subtotal - Math.min(round2(d.desconto), subtotal)),
          obs: d.obs
        });
        toast('Orçamento atualizado', 'ok');
        renderVendaDetalhe(ctx);
      }
    });
  });
  root.querySelectorAll('[data-delpg]').forEach((b) => {
    b.onclick = async () => {
      const ok = await confirmDialog('Excluir este recebimento?', { danger: true, okLabel: 'Excluir' });
      if (!ok) return;
      await excluirPagamento(b.dataset.delpg);
      toast('Recebimento excluído', 'ok');
      renderVendaDetalhe(ctx);
    };
  });
}

function formPagamento(v, onDone) {
  return openForm({
    title: `Receber · Venda #${v.numero}`,
    intro: `<div class="alert alert-info" style="margin-bottom:12px"><span>ℹ️</span><div>Total <b>${fmtMoney(v.total)}</b></div></div>`,
    fields: [
      { name: 'valor', label: 'Valor recebido', type: 'money', required: true },
      {
        name: 'forma', label: 'Forma', type: 'select',
        options: Object.entries(LABELS_FORMA).map(([value, label]) => ({ value, label }))
      },
      { name: 'data', label: 'Data do pagamento', type: 'date', required: true },
      { name: 'obs', label: 'Observação', placeholder: 'Ex.: pagamento da 1ª parcela' }
    ],
    values: { valor: '', forma: 'dinheiro', data: hoje(), obs: '' },
    submitLabel: 'Registrar',
    onSubmit: async (d) => {
      await registrarPagamento({
        vendaId: v.id,
        valor: round2(d.valor),
        forma: d.forma,
        data: d.data,
        obs: d.obs
      });
      toast('Pagamento registrado', 'ok');
      if (onDone) onDone();
    }
  });
}

async function apagar(v, navigate) {
  const ok = await confirmDialog(
    v.cancelada
      ? `Excluir definitivamente o registro #${v.numero}?`
      : `Excluir a venda #${v.numero}? É necessário cancelá-la antes.`,
    { danger: true, okLabel: 'Excluir' }
  );
  if (!ok) return;
  try {
    await excluirVenda(v.id);
    toast('Registro excluído', 'ok');
    navigate('vendas');
  } catch (e) {
    toast(e.message, 'err');
  }
}
