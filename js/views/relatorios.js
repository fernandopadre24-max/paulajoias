/* Relatórios e indicadores */
import {
  listarVendas, listarPagamentos, listarProdutos, listarClientes,
  contasAReceber, registrarPagamento, cfg
} from '../db.js';
import { toast, openSheet, openForm, emptyState, bindSearch } from '../ui.js';
import { fmtMoney, esc, round2, hoje, fmtDate, toNumber, download, toCSV, soma, addDays } from '../utils.js';
import {
  periodoPreset, filtrarPorPeriodo, resumo, serieDiaria, serieMensal,
  topProdutos, topClientes, porForma, porCategoria, graficoBarras, listaRanking, LABELS_FORMA
} from '../report.js';

let preset = 'mes';
let de = '';
let ate = '';

export async function renderRelatorios(ctx) {
  const { root, setTopbar } = ctx;
  setTopbar({
    title: 'Relatórios',
    sub: periodoPreset(preset).label,
    actions: [{ icon: '📤', label: 'Exportar dados', onClick: () => abrirExportacao() }]
  });

  const p = de || ate ? { de, ate, label: 'Período customizado' } : periodoPreset(preset);

  const [vendas, pags, produtos, clientes, abertas] = await Promise.all([
    listarVendas(), listarPagamentos(), listarProdutos(), listarClientes(), contasAReceber()
  ]);

  const doPeriodo = filtrarPorPeriodo(vendas, p);
  const r = resumo(doPeriodo, pags);
  const vencidas = abertas.filter((a) => a.atrasada);

  root.innerHTML = `
    <div class="pdv-head">
      <div class="chips" id="rp-chips">
        ${['hoje', '7', '30', 'mes', 'mespassado', 'ano', 'tudo'].map((k) => `
          <button class="chip ${preset === k && !(de || ate) ? 'active' : ''}" data-per="${k}" type="button">${periodoPreset(k).label}</button>
        `).join('')}
        <button class="chip ${de || ate ? 'active' : ''}" data-per="custom" type="button">📅 Personalizar</button>
      </div>
      ${de || ate ? `<div class="tiny muted mt8">Período: ${fmtDate(de || '…')} até ${fmtDate(ate || '…')}</div>` : ''}
    </div>

    <div class="page tight">
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">Faturamento</div>
          <div class="kpi-value">${fmtMoney(r.faturamento)}</div>
          <div class="kpi-hint">${r.pedidos} venda(s) · ${r.itens} peça(s)</div>
        </div>
        <div class="kpi ok">
          <div class="kpi-label">Recebido</div>
          <div class="kpi-value">${fmtMoney(r.recebido)}</div>
          <div class="kpi-hint">ticket médio ${fmtMoney(r.ticket)}</div>
        </div>
        <div class="kpi warn">
          <div class="kpi-label">A receber</div>
          <div class="kpi-value">${fmtMoney(r.aReceber)}</div>
          <div class="kpi-hint">${vencidas.length} vencida(s) de ${abertas.length}</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-label">Lucro estimado</div>
          <div class="kpi-value">${fmtMoney(r.lucro)}</div>
          <div class="kpi-hint">custo ${fmtMoney(r.custo)} · desc. ${fmtMoney(r.desconto)}</div>
        </div>
      </div>

      <div class="section-title">Vendas por dia</div>
      <div class="card card-pad">
        ${graficoBarras(serieDiaria(doPeriodo, p).map((d) => ({ ...d, label: fmtDate(d.data).slice(0, 5) })))}
      </div>

      <div class="section-title">Últimos 6 meses</div>
      <div class="card card-pad">
        ${graficoBarras(serieMensal(vendas, 6).map((m) => ({ label: m.label, total: m.total })), { gold: true })}
      </div>

      <div class="section-title">Contas a receber (${abertas.length})</div>
      <div class="card list">
        ${abertas.length ? abertas.slice(0, 20).map((a) => `
          <button class="item" data-aberta="${a.venda.id}" type="button">
            <div class="thumb sm" style="background:${a.atrasada ? 'var(--danger-soft)' : 'var(--warn-soft)'}">${a.atrasada ? '⚠️' : '⏳'}</div>
            <div class="item-main">
              <div class="item-title">${esc(a.venda.clienteNome)}</div>
              <div class="item-sub">Venda #${a.venda.numero} · ${a.parcela}/${a.totalParcelas} · venc. ${fmtDate(a.vencimento)}</div>
            </div>
            <div class="item-right">
              <div class="strong mono ${a.atrasada ? 'danger-text' : ''}">${fmtMoney(a.saldo)}</div>
              <div class="tiny ${a.atrasada ? 'danger-text' : 'muted'}">${a.atrasada ? 'vencida' : 'em dia'}</div>
            </div>
          </button>`).join('') : '<div class="card-pad small ok-text text-center">Nenhuma conta em aberto. 🎉</div>'}
      </div>

      <div class="section-title">Top produtos</div>
      <div class="card">${listaRanking(topProdutos(doPeriodo, 8))}</div>

      <div class="section-title">Top clientes</div>
      <div class="card">${listaRanking(topClientes(doPeriodo, 8))}</div>

      <div class="section-title">Formas de pagamento</div>
      <div class="card card-pad">
        ${(() => {
          const formas = porForma(doPeriodo, pags);
          const total = Math.max(1, soma(formas, (f) => f.total));
          return formas.length ? formas.map((f) => `
            <div style="margin-bottom:11px">
              <div class="spread small"><b>${LABELS_FORMA[f.forma] || f.forma}</b><span class="mono">${fmtMoney(f.total)}</span></div>
              <div class="hbar"><i style="width:${Math.round((f.total / total) * 100)}%"></i></div>
            </div>`).join('') : '<p class="small muted text-center">Sem recebimentos no período.</p>';
        })()}
      </div>

      <div class="section-title">Categorias mais vendidas</div>
      <div class="card">
        ${listaRanking(porCategoria(doPeriodo).slice(0, 6).map((c) => ({ nome: c.nome, qtd: c.qtd, total: c.total })))}
      </div>

      <div class="row-flex mt16" style="gap:8px">
        <button class="btn btn-outline grow" data-csv-vendas type="button">⬇ CSV vendas</button>
        <button class="btn btn-outline grow" data-csv-clientes type="button">⬇ CSV clientes</button>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-per]').forEach((b) => {
    b.onclick = async () => {
      if (b.dataset.per === 'custom') {
        const r2 = await formularioPeriodo();
        if (!r2) return;
        de = r2.de;
        ate = r2.ate;
      } else {
        preset = b.dataset.per;
        de = '';
        ate = '';
      }
      renderRelatorios(ctx);
    };
  });

  root.querySelectorAll('[data-aberta]').forEach((b) => {
    b.onclick = () => ctx.navigate(`venda/${b.dataset.aberta}`);
  });

  root.querySelector('[data-csv-vendas]').onclick = () => exportarVendasCSV(doPeriodo, pags);
  root.querySelector('[data-csv-clientes]').onclick = () => exportarClientesCSV();
}

function formularioPeriodo() {
  return new Promise((resolve) => {
    let ok = false;
    const s = openSheet({
      title: 'Período personalizado',
      body: `
        <div class="field"><label>De</label><input type="date" id="pr-de" value="${de || addDays(hoje(), -30)}"></div>
        <div class="field"><label>Até</label><input type="date" id="pr-ate" value="${ate || hoje()}"></div>`,
      foot: `<button class="btn btn-ghost" data-no type="button">Cancelar</button>
             <button class="btn btn-primary" data-yes type="button">Aplicar</button>`,
      onClose: () => { if (!ok) resolve(null); }
    });
    s.sheet.querySelector('[data-no]').onclick = () => s.close();
    s.sheet.querySelector('[data-yes]').onclick = () => {
      const d = s.sheet.querySelector('#pr-de').value;
      const a = s.sheet.querySelector('#pr-ate').value;
      if (!d || !a) { toast('Informe as duas datas', 'err'); return; }
      ok = true;
      s.close(true);
      resolve({ de: d, ate: a });
    };
  });
}

function exportarVendasCSV(vendas, pags) {
  const linhas = vendas.map((v) => ({
    Numero: v.numero,
    Tipo: v.tipo === 'orcamento' ? 'Orçamento' : 'Venda',
    Data: fmtDate(v.data),
    Cliente: v.clienteNome,
   'Itens': (v.itens || []).map((i) => `${i.qtd}x ${i.nome}`).join(' | '),
    Subtotal: v.subtotal,
    Desconto: v.desconto,
    Total: v.total,
    Pago: pagoDe(v, pags),
    Status: v.cancelada ? 'Cancelada' : v.total - pagoDe(v, pags) <= 0.005 ? 'Pago' : 'Pendente',
    Forma: LABELS_FORMA[v.formaPagamento] || v.formaPagamento,
    Obs: v.obs || ''
  }));
  download(`vendas-${hoje()}.csv`, toCSV(linhas), 'text/csv;charset=utf-8');
  toast('CSV de vendas gerado', 'ok');
}

function pagoDe(v, pags) {
  return round2(soma(pags.filter((p) => p.vendaId === v.id), (p) => p.valor));
}

async function exportarClientesCSV() {
  const [clientes, vendas, pags] = await Promise.all([listarClientes(), listarVendas(), listarPagamentos()]);
  const linhas = clientes.map((c) => {
    const minhas = vendas.filter((v) => v.clienteId === c.id && v.tipo === 'venda' && !v.cancelada);
    const total = round2(soma(minhas, (v) => v.total));
    const pago = round2(soma(minhas, (v) => pagoDe(v, pags)));
    return {
      Nome: c.nome,
      Telefone: c.telefone,
      CPF: c.cpf,
      Endereco: c.endereco,
      Compras: minhas.length,
      TotalComprado: total,
      Pago: pago,
      Saldo: round2(total - pago),
      Observacoes: c.obs || ''
    };
  });
  download(`clientes-${hoje()}.csv`, toCSV(linhas), 'text/csv;charset=utf-8');
  toast('CSV de clientes gerado', 'ok');
}

async function abrirExportacao() {
  const produtos = await listarProdutos();
  const linhas = produtos.map((p) => ({
    Codigo: p.codigo,
    Nome: p.nome,
    Categoria: p.categoria,
    Material: p.material,
    Pedra: p.pedra,
    Peso: p.peso,
    Estoque: p.estoque,
    Custo: p.precoCusto,
    PrecoVenda: p.precoVenda,
    Fornecedor: p.fornecedor,
    Ativo: p.ativo === false ? 'Não' : 'Sim'
  }));

  const s = openSheet({
    title: 'Exportar dados',
    body: `
      <div class="menu-list">
        <button class="menu-item" data-csv-estoque type="button">
          <span class="mi-ic">💍</span> Estoque em CSV (${produtos.length}) <span class="mi-arr">⬇</span>
        </button>
        <button class="menu-item" data-csv-vendas type="button">
          <span class="mi-ic">🧾</span> Vendas em CSV <span class="mi-arr">⬇</span>
        </button>
        <button class="menu-item" data-csv-clientes type="button">
          <span class="mi-ic">👥</span> Clientes em CSV <span class="mi-arr">⬇</span>
        </button>
      </div>
      <p class="small muted mt12">Os CSVs abrem no Excel e no Google Planilhas. Para guardar tudo (com fotos e histórico), use o backup em Configurações.</p>`,
    foot: '<button class="btn btn-ghost btn-block" data-close type="button">Fechar</button>'
  });

  s.sheet.querySelector('[data-close]').onclick = () => s.close(true);
  s.sheet.querySelector('[data-csv-estoque]').onclick = () => {
    download(`estoque-${hoje()}.csv`, toCSV(linhas), 'text/csv;charset=utf-8');
    toast('CSV de estoque gerado', 'ok');
  };
  s.sheet.querySelector('[data-csv-vendas]').onclick = async () => {
    exportarVendasCSV(await listarVendas(), await listarPagamentos());
  };
  s.sheet.querySelector('[data-csv-clientes]').onclick = async () => {
    await exportarClientesCSV();
  };
}
