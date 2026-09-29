/* Clientes — cadastro, histórico e saldos */
import {
  listarClientes, salvarCliente, excluirCliente, getCliente, resumoCliente,
  listarVendas, listarPagamentos, statusVenda, saldoVenda, pagoNaVenda,
  parcelasEmAberto, registrarPagamento, getVenda, cfg
} from '../db.js';
import { toast, openSheet, openForm, confirmDialog, emptyState, bindSearch, badgeStatus } from '../ui.js';
import { fmtMoney, esc, norm, iniciais, fmtDate, round2, hoje, toNumber } from '../utils.js';
import { LABELS_FORMA } from '../report.js';

export async function renderClientes(ctx) {
  const { root, navigate, setTopbar } = ctx;
  setTopbar({
    title: 'Clientes',
    sub: 'Cadastro e histórico',
    actions: [{ icon: '➕', label: 'Novo cliente', onClick: () => formCliente(null, () => renderClientes(ctx)) }]
  });

  const montarDividas = async () => {
    const [clientes, vendas, pags] = await Promise.all([listarClientes(), listarVendas(), listarPagamentos()]);
    return clientes.map((c) => {
      const minhas = vendas.filter((v) => v.clienteId === c.id && v.tipo === 'venda' && !v.cancelada);
      const divida = round2(minhas.reduce((a, v) => a + saldoVenda(v, pags), 0));
      const total = round2(minhas.reduce((a, v) => a + v.total, 0));
      const ultima = minhas.map((v) => v.data).sort().pop() || null;
      return { ...c, divida, total, compras: minhas.length, ultima };
    });
  };

  root.innerHTML = `
    <div class="pdv-head">
      <div class="searchbar">
        <div class="searchbox">
          <span class="sic">🔎</span>
          <input id="cl-q" type="search" placeholder="Buscar por nome, telefone ou CPF" autocomplete="off">
        </div>
        <button class="btn btn-primary btn-icon" id="cl-new" type="button" title="Novo cliente">＋</button>
      </div>
      <div class="chips mt8" id="cl-filtros">
        <button class="chip active" data-f="todos" type="button" id="cl-chip-todos">Todos</button>
        <button class="chip" data-f="devendo" type="button" id="cl-chip-devendo">Com saldo</button>
        <button class="chip" data-f="recentes" type="button">Recentes</button>
      </div>
    </div>

    <div class="page tight">
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">Clientes</div>
          <div class="kpi-value" id="cl-kpi-qtd">0</div>
          <div class="kpi-hint">cadastrados</div>
        </div>
        <div class="kpi warn">
          <div class="kpi-label">A receber</div>
          <div class="kpi-value" id="cl-kpi-receb">R$ 0,00</div>
          <div class="kpi-hint" id="cl-kpi-hint">0 cliente(s) com saldo</div>
        </div>
      </div>
      <div id="cl-lista" class="mt12"></div>
    </div>

    <button class="fab" id="cl-fab" type="button" title="Novo cliente">＋</button>
  `;

  let filtro = 'todos';
  let termo = '';

  const pintar = async () => {
    const box = root.querySelector('#cl-lista');
    const dividas = await montarDividas();

    root.querySelector('#cl-kpi-qtd').textContent = dividas.length;
    root.querySelector('#cl-kpi-receb').textContent = fmtMoney(dividas.reduce((a, c) => a + c.divida, 0));
    root.querySelector('#cl-kpi-hint').textContent = `${dividas.filter((c) => c.divida > 0).length} cliente(s) com saldo`;
    root.querySelector('#cl-chip-todos').textContent = `Todos (${dividas.length})`;
    root.querySelector('#cl-chip-devendo').textContent = `Com saldo (${dividas.filter((c) => c.divida > 0).length})`;

    let lista = [...dividas];
    if (filtro === 'devendo') lista = lista.filter((c) => c.divida > 0);
    if (filtro === 'recentes') {
      lista = lista.filter((c) => c.ultima).sort((a, b) => b.ultima.localeCompare(a.ultima)).slice(0, 20);
    } else {
      lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }
    if (termo) {
      const t = norm(termo);
      lista = lista.filter((c) => norm(c.nome).includes(t) || (c.telefone || '').includes(termo) || (c.cpf || '').includes(termo));
    }

    box.innerHTML = lista.length
      ? `<div class="card list">${lista.map(row).join('')}</div>`
      : emptyState({
        emoji: '👥',
        title: termo || filtro !== 'todos' ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda',
        text: 'Cadastre clientes para acompanhar compras e pagamentos.',
        action: '<button class="btn btn-primary" data-new type="button">Novo cliente</button>'
      });

    box.querySelectorAll('[data-open]').forEach((el) => { el.onclick = () => navigate(`cliente/${el.dataset.open}`); });
    box.querySelector('[data-new]')?.addEventListener('click', () => formCliente(null, pintar));
  };

  bindSearch(root.querySelector('#cl-q'), (v) => { termo = v; pintar(); });
  root.querySelectorAll('[data-f]').forEach((b) => {
    b.onclick = () => {
      filtro = b.dataset.f;
      root.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('active', x.dataset.f === filtro));
      pintar();
    };
  });
  root.querySelector('#cl-new').onclick = () => formCliente(null, pintar);
  root.querySelector('#cl-fab').onclick = () => formCliente(null, pintar);

  pintar();
}

function row(c) {
  return `
    <button class="item" data-open="${c.id}" type="button">
      <div class="thumb avatar">${esc(iniciais(c.nome))}</div>
      <div class="item-main">
        <div class="item-title">${esc(c.nome)}</div>
        <div class="item-sub">${esc(c.telefone || 'sem telefone')}${c.compras ? ` · ${c.compras} compra(s)` : ''}</div>
      </div>
      <div class="item-right">
        ${c.divida > 0
          ? `<div class="strong mono danger-text nowrap">${fmtMoney(c.divida)}</div><span class="badge badge-danger" style="margin-top:3px">A pagar</span>`
          : c.total > 0
            ? `<div class="strong mono ok-text nowrap">${fmtMoney(c.total)}</div><span class="badge badge-ok" style="margin-top:3px">Em dia</span>`
            : '<span class="badge badge-mute">Novo</span>'}
      </div>
    </button>`;
}

/* ---------------- Formulário ---------------- */

export function formCliente(cliente, onSaved) {
  return openForm({
    title: cliente ? 'Editar cliente' : 'Novo cliente',
    fields: [
      { name: 'nome', label: 'Nome completo', required: true, placeholder: 'Ex.: Maria da Silva' },
      { name: 'telefone', label: 'Telefone / WhatsApp', type: 'tel', placeholder: '(00) 00000-0000' },
      { name: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
      { name: 'nascimento', label: 'Aniversário', type: 'date' },
      { name: 'endereco', label: 'Endereço', placeholder: 'Rua, bairro, cidade' },
      { name: 'obs', label: 'Observações', type: 'textarea', rows: 2, placeholder: 'Referências, preferências…' },
      { name: 'ativo', label: 'Cliente ativo', type: 'switch' }
    ],
    values: cliente
      ? { ...cliente, ativo: cliente.ativo !== false }
      : { nome: '', telefone: '', cpf: '', nascimento: '', endereco: '', obs: '', ativo: true },
    submitLabel: 'Salvar cliente',
    onSubmit: async (d) => {
      const salvo = await salvarCliente({ ...(cliente || {}), ...d });
      toast(cliente ? 'Cliente atualizado' : 'Cliente cadastrado', 'ok');
      if (onSaved) onSaved(salvo);
    }
  });
}

/* ---------------- Detalhe ---------------- */

export async function renderClienteDetalhe(ctx) {
  const { root, params, navigate, setTopbar } = ctx;
  const id = params[0];
  const c = await getCliente(id);

  if (!c) {
    root.innerHTML = `<div class="page">${emptyState({ emoji: '🔍', title: 'Cliente não encontrado', action: '<button class="btn btn-primary" data-back type="button">Voltar</button>' })}</div>`;
    root.querySelector('[data-back]').onclick = () => navigate('clientes');
    return;
  }

  setTopbar({
    title: c.nome,
    sub: c.telefone || 'Cliente',
    actions: [
      { icon: '✏️', label: 'Editar', onClick: () => formCliente(c, () => renderClienteDetalhe(ctx)) },
      { icon: '🗑', label: 'Excluir', onClick: () => apagar(c, navigate) }
    ]
  });

  const [resumo, vendas, pags, todosClientes] = await Promise.all([
    resumoCliente(c.id), listarVendas(), listarPagamentos(), listarClientes()
  ]);
  const minhas = vendas
    .filter((v) => v.clienteId === c.id && !v.cancelada)
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  const telefone = (c.telefone || '').replace(/\D/g, '');
  const aniversario = c.nascimento ? c.nascimento.slice(5) : '';
  const hj = hoje().slice(5);

  root.innerHTML = `
    <div class="page">
      <div class="card card-pad">
        <div class="row-flex">
          <div class="thumb lg avatar" style="font-size:22px">${esc(iniciais(c.nome))}</div>
          <div class="grow">
            <div class="item-title" style="font-size:17px">${esc(c.nome)}</div>
            <div class="small muted">${esc(c.telefone || 'sem telefone')}</div>
            <div class="tiny muted">${esc(c.cpf || '')}${c.endereco ? ` · ${esc(c.endereco)}` : ''}</div>
          </div>
        </div>
        <div class="row-flex mt12" style="gap:8px">
          ${telefone ? `<a class="btn btn-sm btn-ok grow" href="tel:+55${telefone}" style="text-decoration:none">📞 Ligar</a>` : ''}
          ${telefone ? `<a class="btn btn-sm btn-primary grow" target="_blank" rel="noopener" href="https://wa.me/55${telefone}?text=${encodeURIComponent(`Olá, ${c.nome.split(' ')[0]}! Aqui é da ${await cfg('empresa', 'nossa loja')}.`)}" style="text-decoration:none">💬 WhatsApp</a>` : ''}
          <button class="btn btn-sm btn-gold grow" data-receber type="button" ${resumo.divida > 0 ? '' : 'disabled'}>💰 Receber</button>
        </div>
        ${aniversario === hj ? '<div class="alert alert-info mt12"><span>🎂</span><div><b>Parabéns!</b> Aniversário hoje.</div></div>' : ''}
      </div>

      <div class="kpi-grid mt12">
        <div class="kpi">
          <div class="kpi-label">Compras</div>
          <div class="kpi-value sm">${resumo.compras}</div>
          <div class="kpi-hint">${fmtMoney(resumo.totalComprado)} no total</div>
        </div>
        <div class="kpi ${resumo.divida > 0 ? 'warn' : 'ok'}">
          <div class="kpi-label">${resumo.divida > 0 ? 'Saldo devedor' : 'Situação'}</div>
          <div class="kpi-value sm">${resumo.divida > 0 ? fmtMoney(resumo.divida) : 'Em dia'}</div>
          <div class="kpi-hint">${resumo.divida > 0 ? `Pago: ${fmtMoney(resumo.pago)}` : 'Sem pendências'}</div>
        </div>
      </div>

      <div class="section-title">Histórico de compras (${minhas.length})</div>
      <div class="card list">
        ${minhas.length ? minhas.map((v) => {
          const st = statusVenda(v, pags);
          const pago = pagoNaVenda(v, pags);
          return `
            <button class="item" data-venda="${v.id}" type="button">
              <div class="thumb sm" style="background:${st === 'pago' ? 'var(--ok-soft)' : st === 'orcamento' ? 'var(--info-soft)' : 'var(--warn-soft)'}">
                ${st === 'pago' ? '✓' : st === 'orcamento' ? '📋' : '⏳'}
              </div>
              <div class="item-main">
                <div class="item-title">${v.tipo === 'orcamento' ? 'Orçamento' : 'Venda'} #${v.numero}</div>
                <div class="item-sub">${fmtDate(v.data)} · ${v.itens.length} item(ns) · pago ${fmtMoney(pago)}</div>
              </div>
              <div class="item-right">
                <div class="strong mono nowrap">${fmtMoney(v.total)}</div>
                <div style="margin-top:3px">${badgeStatus(st)}</div>
              </div>
            </button>`;
        }).join('') : '<div class="card-pad small muted text-center">Nenhuma compra registrada.</div>'}
      </div>

      ${c.obs ? `<div class="section-title">Observações</div><div class="card card-pad small">${esc(c.obs)}</div>` : ''}

      <button class="btn btn-primary btn-block mt16" data-nova-venda type="button">🛒 Nova venda para este cliente</button>
    </div>
  `;

  root.querySelectorAll('[data-venda]').forEach((b) => { b.onclick = () => navigate(`venda/${b.dataset.venda}`); });
  root.querySelector('[data-nova-venda]').onclick = async () => {
    const { prepararVendaPara } = await import('./pdv.js');
    prepararVendaPara(c);
    navigate('pdv');
  };
  root.querySelector('[data-receber]')?.addEventListener('click', () => receberDeCliente(c, minhas, pags, () => renderClienteDetalhe(ctx)));
}

async function receberDeCliente(c, vendas, pags, onDone) {
  const pendentes = vendas
    .filter((v) => v.tipo === 'venda' && !v.cancelada && saldoVenda(v, pags) > 0)
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  if (!pendentes.length) {
    toast('Nenhum saldo em aberto para este cliente.', 'info');
    return;
  }

  const totalDivida = round2(pendentes.reduce((a, v) => a + saldoVenda(v, pags), 0));

  const s = openSheet({
    title: 'Receber pagamento',
    body: `
      <div class="alert alert-warn" style="margin-bottom:12px">
        <span>💰</span><div>Saldo total de <b>${esc(c.nome)}</b>: <b>${fmtMoney(totalDivida)}</b></div>
      </div>
      <div class="card list" style="max-height:200px;overflow:auto;margin-bottom:12px">
        ${pendentes.map((v) => `
          <button class="item" data-pg="${v.id}" type="button">
            <div class="item-main">
              <div class="item-title">Venda #${v.numero}</div>
              <div class="item-sub">${fmtDate(v.data)} · ${v.itens.length} item(ns)</div>
            </div>
            <div class="item-right">
              <div class="strong mono danger-text">${fmtMoney(saldoVenda(v, pags))}</div>
              <div class="tiny muted">de ${fmtMoney(v.total)}</div>
            </div>
          </button>`).join('')}
      </div>
      <div class="field">
        <label>Valor recebido</label>
        <div class="input-wrap has-prefix">
          <span class="prefix">R$</span>
          <input type="text" inputmode="decimal" id="rc-valor" value="${fmtMoney(totalDivida).replace('R$', '').trim()}">
        </div>
      </div>
      <div class="field">
        <label>Forma</label>
        <select id="rc-forma">
          ${Object.entries(LABELS_FORMA).map(([k, v]) => `<option value="${k}" ${k === 'dinheiro' ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Data</label>
        <input type="date" id="rc-data" value="${hoje()}">
      </div>`,
    foot: '<button class="btn btn-ok btn-block" data-ok type="button">Registrar recebimento</button>'
  });

  let vendaSelecionada = null;
  s.sheet.querySelectorAll('[data-pg]').forEach((b) => {
    b.onclick = () => {
      vendaSelecionada = vendas.find((v) => v.id === b.dataset.pg);
      s.sheet.querySelectorAll('[data-pg]').forEach((x) => x.classList.toggle('active', x === b));
      s.sheet.querySelectorAll('[data-pg]').forEach((x) => { x.style.background = ''; });
      b.style.background = 'var(--plum-soft)';
      const sal = saldoVenda(vendaSelecionada, pags);
      s.sheet.querySelector('#rc-valor').value = fmtMoney(sal).replace('R$', '').trim();
    };
  });

  s.sheet.querySelector('[data-ok]').onclick = async () => {
    const val = round2(toNumber(s.sheet.querySelector('#rc-valor').value));
    const forma = s.sheet.querySelector('#rc-forma').value;
    const data = s.sheet.querySelector('#rc-data').value || hoje();
    try {
      if (vendaSelecionada) {
        await registrarPagamento({ vendaId: vendaSelecionada.id, valor: val, forma, data });
      } else {
        let restante = val;
        for (const v of pendentes) {
          if (restante <= 0.005) break;
          const sal = saldoVenda(v, pags);
          const parte = round2(Math.min(restante, sal));
          restante = round2(restante - parte);
          await registrarPagamento({ vendaId: v.id, valor: parte, forma, data });
        }
      }
      toast('Recebimento registrado', 'ok');
      s.close(true);
      if (onDone) onDone();
    } catch (e) {
      toast(e.message || 'Erro ao registrar', 'err');
    }
  };
}

async function apagar(c, navigate) {
  const ok = await confirmDialog(`Excluir o cliente "${c.nome}"? O histórico de compras continua guardado.`, { danger: true, okLabel: 'Excluir' });
  if (!ok) return;
  await excluirCliente(c.id);
  toast('Cliente excluído', 'ok');
  navigate('clientes');
}
