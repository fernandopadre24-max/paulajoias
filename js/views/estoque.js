/* Estoque — cadastro de produtos com fotos e movimentações */
import {
  listarProdutos, salvarProduto, getProduto, excluirProduto, registrarMovimento,
  listarMovimentos, listarVendas
} from '../db.js';
import { toast, openSheet, openForm, confirmDialog, emptyState, bindSearch } from '../ui.js';
import { fmtMoney, esc, objUrl, baixarImagem, norm, round2, fmtDate, fmtDateTime } from '../utils.js';

const CATS_SUGERIDAS = ['Anel', 'Corrente', 'Brincos', 'Pulseira', 'Pingente', 'Relógio', 'Aliança', 'Conjunto', 'Acessório', 'Outro'];

export async function renderEstoque(ctx) {
  const { root, navigate, setTopbar } = ctx;
  setTopbar({
    title: 'Estoque',
    sub: 'Produtos, fotos e preços',
    actions: [{ icon: '📥', label: 'Movimentações', onClick: () => abrirMovimentosGlobais() }]
  });

  const produtos = await listarProdutos();
  const totalItens = produtos.reduce((a, p) => a + (Number(p.estoque) || 0), 0);
  const valorCusto = round2(produtos.reduce((a, p) => a + (Number(p.estoque) || 0) * (Number(p.precoCusto) || 0), 0));
  const valorVenda = round2(produtos.reduce((a, p) => a + (Number(p.estoque) || 0) * (Number(p.precoVenda) || 0), 0));
  const baixos = produtos.filter((p) => p.ativo !== false && (Number(p.estoque) || 0) <= (Number(p.estoqueMinimo) || 0) && (Number(p.estoqueMinimo) || 0) > 0);
  const cats = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  root.innerHTML = `
    <div class="pdv-head">
      <div class="searchbar">
        <div class="searchbox">
          <span class="sic">🔎</span>
          <input id="es-q" type="search" placeholder="Buscar produto, código, material…" autocomplete="off">
        </div>
        <button class="btn btn-primary btn-icon" id="es-new" type="button" title="Novo produto">＋</button>
      </div>
      <div class="chips mt8" id="es-cats">
        <button class="chip active" data-cat="todos" type="button">Todos</button>
        ${cats.map((c) => `<button class="chip" data-cat="${esc(c)}" type="button">${esc(c)}</button>`).join('')}
        <button class="chip gold" data-cat="__baixos" type="button">⚠️ Baixos (${baixos.length})</button>
      </div>
    </div>

    <div class="page tight">
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Peças em estoque</div><div class="kpi-value">${totalItens}</div><div class="kpi-hint">${produtos.length} produto(s) cadastrado(s)</div></div>
        <div class="kpi ok"><div class="kpi-label">Valor de venda</div><div class="kpi-value">${fmtMoney(valorVenda)}</div><div class="kpi-hint">se tudo sair pelo preço cheio</div></div>
        <div class="kpi gold"><div class="kpi-label">Custo investido</div><div class="kpi-value">${fmtMoney(valorCusto)}</div><div class="kpi-hint">potencial de lucro ${fmtMoney(valorVenda - valorCusto)}</div></div>
        <div class="kpi ${baixos.length ? 'warn' : ''}"><div class="kpi-label">Reposição</div><div class="kpi-value">${baixos.length}</div><div class="kpi-hint">${baixos.length ? 'produto(s) com estoque baixo' : 'tudo em dia'}</div></div>
      </div>
      <div id="es-lista" class="mt12"></div>
    </div>

    <button class="fab" id="es-fab" type="button" title="Novo produto">＋</button>
  `;

  let cat = 'todos';
  let termo = '';

  const pintar = async () => {
    const box = root.querySelector('#es-lista');
    let lista = await listarProdutos();
    if (cat === '__baixos') lista = lista.filter((p) => (Number(p.estoque) || 0) <= (Number(p.estoqueMinimo) || 0) && (Number(p.estoqueMinimo) || 0) > 0);
    else if (cat !== 'todos') lista = lista.filter((p) => p.categoria === cat);
    if (termo) {
      const t = norm(termo);
      lista = lista.filter((p) => norm(p.nome).includes(t) || norm(p.codigo).includes(t) || norm(p.categoria).includes(t) || norm(p.material).includes(t) || norm(p.pedra).includes(t));
    }
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    box.innerHTML = lista.length
      ? `<div class="grid-prod">${lista.map(card).join('')}</div>`
      : emptyState({
        emoji: '💍',
        title: termo || cat !== 'todos' ? 'Nada encontrado' : 'Estoque vazio',
        text: 'Cadastre sua primeira peça com foto, peso e preço.',
        action: '<button class="btn btn-primary" data-new type="button">Novo produto</button>'
      });

    box.querySelectorAll('[data-open]').forEach((el) => {
      el.onclick = () => navigate(`produto/${el.dataset.open}`);
    });
    box.querySelector('[data-new]')?.addEventListener('click', () => formProduto(null, pintar));
  };

  const input = root.querySelector('#es-q');
  bindSearch(input, (v) => { termo = v; pintar(); });

  root.querySelectorAll('[data-cat]').forEach((b) => {
    b.onclick = () => {
      cat = b.dataset.cat;
      root.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('active', x.dataset.cat === cat));
      pintar();
    };
  });

  root.querySelector('#es-new').onclick = () => formProduto(null, pintar);
  root.querySelector('#es-fab').onclick = () => formProduto(null, pintar);

  await pintar();
}

function card(p) {
  const estoque = Number(p.estoque) || 0;
  const minimo = Number(p.estoqueMinimo) || 0;
  const sem = estoque <= 0;
  const baixo = !sem && minimo > 0 && estoque <= minimo;
  return `
    <div class="prod-card" data-open="${p.id}">
      <div class="prod-img">
        ${p.foto ? `<img src="${objUrl(p.foto)}" alt="${esc(p.nome)}">` : '💍'}
        ${sem ? '<span class="prod-tag low">Esgotado</span>' : baixo ? `<span class="prod-tag low">Estoque ${estoque}</span>` : `<span class="prod-tag">${estoque} un.</span>`}
      </div>
      <div class="prod-body">
        <div class="prod-name">${esc(p.nome)}</div>
        <div class="prod-meta">${esc(p.codigo || p.categoria || '')}</div>
        <div class="prod-price">${fmtMoney(p.precoVenda)}</div>
      </div>
    </div>`;
}

/* ---------------- Formulário de produto ---------------- */

export function formProduto(produtoId, onSaved) {
  const p = produtoId && typeof produtoId === 'object' ? produtoId : null;
  let foto = p?.foto || null;

  const fields = [
    { name: 'nome', label: 'Nome da peça', required: true, placeholder: 'Ex.: Anel zircônia 18k' },
    { name: 'codigo', label: 'Código / SKU', placeholder: 'Ex.: AN-042' },
    {
      name: 'categoria', label: 'Categoria', type: 'select',
      options: [...new Set([...CATS_SUGERIDAS, p?.categoria].filter(Boolean))].map((c) => ({ value: c, label: c }))
    },
    { name: 'material', label: 'Metal / material', placeholder: 'Ex.: Ouro 18k, prata 925, banho dourado' },
    { name: 'pedra', label: 'Pedra', placeholder: 'Ex.: Zircônia, cristal, pérola' },
    { name: 'cor', label: 'Cor', placeholder: 'Ex.: Dourado' },
    { name: 'peso', label: 'Peso (g)', type: 'number', hint: 'Peso aproximado da peça' },
    { name: 'precoCusto', label: 'Preço de custo', type: 'money' },
    { name: 'precoVenda', label: 'Preço de venda', type: 'money', required: true },
    { name: 'estoque', label: 'Quantidade em estoque', type: 'number', required: true },
    { name: 'estoqueMinimo', label: 'Estoque mínimo (alerta)', type: 'number' },
    { name: 'fornecedor', label: 'Fornecedor', placeholder: 'Onde você comprou' },
    { name: 'obs', label: 'Observações', type: 'textarea', rows: 2, placeholder: 'Medidas, detalhes, garantia…' },
    { name: 'ativo', label: 'Produto ativo (visível no PDV)', type: 'switch' }
  ];

  const values = p
    ? { ...p, ativo: p.ativo !== false }
    : { nome: '', codigo: '', categoria: 'Anel', material: '', pedra: '', cor: '', peso: '', precoCusto: '', precoVenda: '', estoque: 1, estoqueMinimo: 1, fornecedor: '', obs: '', ativo: true };

  const s = openForm({
    title: p ? 'Editar produto' : 'Novo produto',
    fields,
    values,
    submitLabel: 'Salvar produto',
    intro: `
      <div class="field">
        <label>Foto da peça</label>
        <div class="photo-preview" id="fp-foto">
          ${foto ? `<img src="${objUrl(foto)}" alt=""><span class="swap">Trocar</span>` : '<div><span class="cam">📸</span>Toque para adicionar foto</div>'}
        </div>
        <input type="file" id="fp-file" accept="image/*" capture="environment" style="display:none">
      </div>`,
    onSubmit: async (d) => {
      const salvo = await salvarProduto({
        ...(p || {}),
        ...d,
        foto
      });
      toast(p ? 'Produto atualizado' : 'Produto cadastrado', 'ok');
      if (onSaved) onSaved(salvo);
    }
  });

  const preview = s.sheet.querySelector('#fp-foto');
  const file = s.sheet.querySelector('#fp-file');
  preview.onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      foto = await baixarImagem(f, 900);
      preview.innerHTML = `<img src="${objUrl(foto)}" alt=""><span class="swap">Trocar</span>`;
    } catch {
      toast('Não foi possível ler a imagem', 'err');
    }
  };

  return s;
}

/* ---------------- Detalhe do produto ---------------- */

export async function renderProdutoDetalhe(ctx) {
  const { root, params, navigate, setTopbar } = ctx;
  const id = params[0];
  const p = await getProduto(id);

  if (!p) {
    root.innerHTML = `<div class="page">${emptyState({ emoji: '🔍', title: 'Produto não encontrado', action: `<button class="btn btn-primary" data-back type="button">Voltar</button>` })}</div>`;
    root.querySelector('[data-back]').onclick = () => navigate('estoque');
    return;
  }

  setTopbar({
    title: p.nome,
    sub: p.codigo || p.categoria || 'Produto',
    actions: [
      { icon: '✏️', label: 'Editar', onClick: () => { formProduto(p, () => renderProdutoDetalhe(ctx)); } },
      { icon: '🗑', label: 'Excluir', onClick: () => apagar(p, navigate) }
    ]
  });

  const [vendas, movs] = await Promise.all([listarVendas(), listarMovimentos(p.id)]);
  const usos = vendas.filter((v) => !v.cancelada && (v.itens || []).some((i) => i.produtoId === p.id));
  const vendidos = usos.reduce((a, v) => a + (v.itens.filter((i) => i.produtoId === p.id).reduce((x, i) => x + i.qtd, 0)), 0);
  const faturado = round2(usos.reduce((a, v) => a + v.itens.filter((i) => i.produtoId === p.id).reduce((x, i) => x + i.qtd * i.precoUnit, 0), 0));
  const margem = round2((Number(p.precoVenda) || 0) - (Number(p.precoCusto) || 0));
  const margemPct = Number(p.precoVenda) > 0 ? Math.round((margem / Number(p.precoVenda)) * 100) : 0;

  root.innerHTML = `
    <div class="page">
      <div class="card">
        <div class="prod-img" style="aspect-ratio:16/11;border-radius:0">
          ${p.foto ? `<img src="${objUrl(p.foto)}" alt="${esc(p.nome)}">` : '💍'}
        </div>
        <div class="card-pad">
          <div class="spread">
            <div>
              <div class="item-title" style="font-size:18px">${esc(p.nome)}</div>
              <div class="tiny muted">${esc(p.codigo || 's/ código')}</div>
            </div>
            <div class="text-right">
              <div class="kpi-value" style="color:var(--plum)">${fmtMoney(p.precoVenda)}</div>
              <span class="badge ${(Number(p.estoque) || 0) > 0 ? 'badge-ok' : 'badge-danger'}">${p.estoque} em estoque</span>
            </div>
          </div>
        </div>
      </div>

      <div class="kpi-grid mt12">
        <div class="kpi ok">
          <div class="kpi-label">Vendidos</div>
          <div class="kpi-value sm">${vendidos} un.</div>
          <div class="kpi-hint">${fmtMoney(faturado)} faturados</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-label">Margem</div>
          <div class="kpi-value sm">${fmtMoney(margem)}</div>
          <div class="kpi-hint">${margemPct}% sobre venda</div>
        </div>
      </div>

      <div class="section-title">Ficha técnica</div>
      <div class="card dl">
        ${dlRow('Categoria', p.categoria || '—')}
        ${dlRow('Metal / material', p.material || '—')}
        ${dlRow('Pedra', p.pedra || '—')}
        ${dlRow('Cor', p.cor || '—')}
        ${dlRow('Peso', p.peso ? `${p.peso} g` : '—')}
        ${dlRow('Custo', fmtMoney(p.precoCusto))}
        ${dlRow('Preço de venda', fmtMoney(p.precoVenda))}
        ${dlRow('Estoque mínimo', p.estoqueMinimo || 0)}
        ${dlRow('Fornecedor', p.fornecedor || '—')}
        ${p.obs ? dlRow('Obs.', p.obs) : ''}
        ${dlRow('Cadastrado em', fmtDate(new Date(p.criadoEm).toISOString().slice(0, 10)))}
      </div>

      <div class="section-title">Ações de estoque</div>
      <div class="card menu-list">
        <button class="menu-item" data-entrada type="button">
          <span class="mi-ic">📥</span> Entrada de estoque <span class="mi-arr">›</span>
        </button>
        <button class="menu-item" data-ajuste type="button">
          <span class="mi-ic">🔁</span> Ajustar quantidade <span class="mi-arr">›</span>
        </button>
        <button class="menu-item" data-saida type="button">
          <span class="mi-ic">📤</span> Saída manual <span class="mi-arr">›</span>
        </button>
      </div>

      <div class="section-title">Vendas deste produto (${usos.length})</div>
      <div class="card list">
        ${usos.length ? usos.slice(0, 15).map((v) => {
          const item = v.itens.find((i) => i.produtoId === p.id);
          return `
            <button class="item" data-venda="${v.id}" type="button">
              <div class="item-main">
                <div class="item-title">Venda #${v.numero}</div>
                <div class="item-sub">${fmtDate(v.data)} · ${item.qtd} un. · ${esc(v.clienteNome)}</div>
              </div>
              <div class="item-right strong mono">${fmtMoney(item.qtd * item.precoUnit)}</div>
            </button>`;
        }).join('') : '<div class="card-pad small muted text-center">Nenhuma venda registrada ainda.</div>'}
      </div>

      <div class="section-title">Movimentações (${movs.length})</div>
      <div class="card timeline">
        ${movs.length ? movs.slice(0, 20).map((m, i, arr) => `
          <div class="tl-item">
            <div class="tl-rail">
              <span class="tl-dot ${m.tipo === 'entrada' || m.tipo === 'devolucao' ? 'ok' : m.tipo === 'venda' ? '' : 'warn'}"></span>
              ${i < arr.length - 1 ? '<span class="tl-line"></span>' : ''}
            </div>
            <div class="tl-body">
              <div class="spread">
                <b class="small">${rotuloMov(m.tipo)}</b>
                <span class="small mono ${m.tipo === 'entrada' || m.tipo === 'devolucao' ? 'ok-text' : 'danger-text'}">${m.tipo === 'ajuste' ? `= ${m.qtd}` : m.tipo === 'entrada' || m.tipo === 'devolucao' ? `+${m.qtd}` : `-${m.qtd}`}</span>
              </div>
              <div class="tiny muted">${fmtDateTime(m.criadoEm)} · estoque: ${m.estoqueApos}${m.obs ? ` · ${esc(m.obs)}` : ''}</div>
            </div>
          </div>`).join('') : '<div class="card-pad small muted text-center">Sem movimentações.</div>'}
      </div>
    </div>
  `;

  const movForm = (tipo) => {
    openForm({
      title: tipo === 'entrada' ? 'Entrada de estoque' : tipo === 'ajuste' ? 'Ajustar quantidade' : 'Saída manual',
      intro: `<div class="alert alert-info" style="margin-bottom:12px"><span>ℹ️</span><div>Estoque atual de <b>${esc(p.nome)}</b>: <b>${p.estoque}</b> un.</div></div>`,
      fields: [
        {
          name: 'qtd', label: tipo === 'ajuste' ? 'Nova quantidade total' : 'Quantidade', type: 'number',
          required: true, hint: tipo === 'ajuste' ? 'Informe o total que existe fisicamente.' : ''
        },
        { name: 'obs', label: 'Observação', placeholder: 'Ex.: lote do fornecedor, perda, venda avulsa' },
        { name: 'data', label: 'Data', type: 'date', required: true }
      ],
      values: { qtd: tipo === 'ajuste' ? p.estoque : 1, data: new Date().toISOString().slice(0, 10) },
      submitLabel: 'Confirmar',
      onSubmit: async (d) => {
        if (tipo !== 'ajuste' && d.qtd <= 0) throw new Error('Informe uma quantidade maior que zero.');
        await registrarMovimento({ produtoId: p.id, tipo, qtd: d.qtd, data: d.data, obs: d.obs });
        toast('Estoque atualizado', 'ok');
        renderProdutoDetalhe(ctx);
      }
    });
  };

  root.querySelector('[data-entrada]').onclick = () => movForm('entrada');
  root.querySelector('[data-ajuste]').onclick = () => movForm('ajuste');
  root.querySelector('[data-saida]').onclick = () => movForm('saida');
  root.querySelectorAll('[data-venda]').forEach((b) => { b.onclick = () => navigate(`venda/${b.dataset.venda}`); });
}

async function apagar(p, navigate) {
  const ok = await confirmDialog(`Excluir "${p.nome}" do cadastro? O histórico de vendas continua guardado.`, {
    danger: true, okLabel: 'Excluir'
  });
  if (!ok) return;
  await excluirProduto(p.id);
  toast('Produto excluído', 'ok');
  navigate('estoque');
}

function dlRow(k, v) {
  return `<div class="dl-row"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
}

function rotuloMov(t) {
  return {
    entrada: 'Entrada',
    saida: 'Saída manual',
    venda: 'Venda',
    devolucao: 'Devolução',
    ajuste: 'Ajuste'
  }[t] || t;
}

/* ---------------- Movimentações globais ---------------- */

async function abrirMovimentosGlobais() {
  const [movs, produtos] = await Promise.all([listarMovimentos(), listarProdutos()]);
  const mapa = Object.fromEntries(produtos.map((p) => [p.id, p]));
  movs.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  openSheet({
    title: 'Movimentações de estoque',
    body: movs.length
      ? `<div class="card timeline">${movs.slice(0, 60).map((m, i, arr) => {
          const p = mapa[m.produtoId];
          return `
            <div class="tl-item">
              <div class="tl-rail">
                <span class="tl-dot ${m.tipo === 'entrada' || m.tipo === 'devolucao' ? 'ok' : m.tipo === 'venda' ? '' : 'warn'}"></span>
                ${i < arr.length - 1 ? '<span class="tl-line"></span>' : ''}
              </div>
              <div class="tl-body">
                <div class="spread">
                  <b class="small">${esc(p?.nome || 'Produto removido')}</b>
                  <span class="small mono">${m.tipo === 'ajuste' ? `= ${m.qtd}` : m.tipo === 'entrada' || m.tipo === 'devolucao' ? `+${m.qtd}` : `-${m.qtd}`}</span>
                </div>
                <div class="tiny muted">${fmtDateTime(m.criadoEm)} · ${rotuloMov(m.tipo)}${m.obs ? ` · ${esc(m.obs)}` : ''}</div>
              </div>
            </div>`;
        }).join('')}</div>`
      : emptyState({ emoji: '📦', title: 'Sem movimentações' })
  });
}
