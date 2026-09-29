/* PDV — venda rápida */
import {
  buscarProduto, listarProdutos, criarVenda, cfg, buscarCliente, listarVendas, getProduto,
  pagamentosDaVenda
} from '../db.js';
import { toast, openSheet, openForm, emptyState, confirmDialog, bindSearch } from '../ui.js';
import { fmtMoney, esc, objUrl, toNumber, round2, hoje, norm, fmtDate, addDays, soma } from '../utils.js';
import { imprimirRecibo, compartilharRecibo } from '../print.js';
import { formProduto } from './estoque.js';

let cart = [];
let clienteSel = null;
let categoriaAtiva = 'todos';
let termoBusca = '';

const FORMAS = [
  { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { id: 'pix', label: 'Pix', icon: '⚡' },
  { id: 'debito', label: 'Débito', icon: '💳' },
  { id: 'credito', label: 'Crédito', icon: '💳' },
  { id: 'boleto', label: 'Boleto', icon: '📄' },
  { id: 'outro', label: 'Outro', icon: '🔄' }
];

export function cartCount() { return cart.reduce((a, i) => a + i.qtd, 0); }
export function cartTotal() { return round2(cart.reduce((a, i) => a + i.qtd * i.precoUnit, 0)); }

function emojiDe(p) {
  const c = norm(p.categoria + ' ' + p.material + ' ' + p.nome);
  if (/anel/.test(c)) return '💍';
  if (/corrente|colar|pingente/.test(c)) return '📿';
    if (/brincos?/.test(c)) return '✨';
  if (/pulseira/.test(c)) return '⏱️';
  if (/relogio/.test(c)) return '⌚';
  if (/alianza|casamento/.test(c)) return '💎';
  if (/dolar|moeda|corrente/.test(c)) return '🪙';
  if (/pierr|pedra|zirconia/.test(c)) return '🔷';
  return '💍';
}

function addToCart(p, qtd = 1) {
  const existente = cart.find((i) => i.produtoId === p.id);
  const disponivel = Number(p.estoque) || 0;
  if (existente) {
    if (existente.qtd + qtd > disponivel) {
      toast(`Estoque insuficiente: ${p.nome} (${disponivel} un.)`, 'err');
      return;
    }
    existente.qtd += qtd;
  } else {
    if (disponivel < qtd) {
      toast(`Sem estoque para ${p.nome}`, 'err');
      return;
    }
    cart.push({
      produtoId: p.id,
      codigo: p.codigo,
      nome: p.nome,
      categoria: p.categoria,
      qtd,
      precoUnit: Number(p.precoVenda) || 0,
      custoUnit: Number(p.precoCusto) || 0,
      estoque: disponivel
    });
  }
  toast(`${p.nome} adicionado`, 'ok');
  atualizarBarra();
}

function addItemAvulso() {
  openForm({
    title: 'Item avulso',
    intro: '<p class="small muted" style="margin-top:0">Para peças feitas na hora, encomendas ou itens sem cadastro.</p>',
    fields: [
      { name: 'nome', label: 'Descrição', required: true, placeholder: 'Ex.: Corrente ouro 18k com pingente' },
      { name: 'qtd', label: 'Quantidade', type: 'number', required: true },
      { name: 'precoUnit', label: 'Preço unitário', type: 'money', required: true },
      { name: 'custoUnit', label: 'Custo (opcional)', type: 'money' },
      { name: 'categoria', label: 'Categoria', placeholder: 'Ex.: Corrente' }
    ],
    values: { qtd: 1 },
    submitLabel: 'Adicionar',
    onSubmit: (d) => {
      if (d.qtd <= 0) throw new Error('Quantidade deve ser maior que zero.');
      cart.push({
        produtoId: null,
        codigo: '',
        nome: d.nome,
        categoria: d.categoria,
        qtd: d.qtd,
        precoUnit: round2(d.precoUnit),
        custoUnit: round2(d.custoUnit || 0),
        estoque: null
      });
      toast('Item avulso adicionado', 'ok');
      atualizarBarra();
      renderResultados();
    }
  });
}

/* ---------------- Render ---------------- */

export async function renderPDV(ctx) {
  const { root, navigate, setTopbar } = ctx;
  const empresa = await cfg('empresa', 'Bijuterias e Joias');
  setTopbar({
    title: 'PDV',
    sub: empresa,
    actions: [
      { icon: '🧾', label: 'Histórico de vendas', onClick: () => navigate('vendas') }
    ]
  });

  const [produtos, vendas] = await Promise.all([listarProdutos(), listarVendas()]);

  const repique = sessionStorage.getItem('pdvRepique');
  if (repique) {
    sessionStorage.removeItem('pdvRepique');
    try {
      for (const i of JSON.parse(repique)) {
        const p = i.produtoId ? await getProduto(i.produtoId) : null;
        cart.push({
          produtoId: i.produtoId || null,
          codigo: i.codigo || '',
          nome: i.nome,
          categoria: i.categoria || '',
          qtd: Number(i.qtd) || 1,
          precoUnit: round2(i.precoUnit),
          custoUnit: round2(i.custoUnit || 0),
          estoque: p ? (Number(p.estoque) || 0) : null
        });
      }
      if (cart.length) toast('Itens da venda anterior recarregados no PDV', 'ok');
    } catch { /* ignora repique inválido */ }
  }

  const cats = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const hj = vendas.filter((v) => v.data === hoje() && v.tipo === 'venda' && !v.cancelada);
  const fatHoje = round2(hj.reduce((a, v) => a + v.total, 0));

  root.innerHTML = `
    <div class="pdv-head">
      <div class="searchbar">
        <div class="searchbox">
          <span class="sic">🔎</span>
          <input id="pdv-q" type="search" placeholder="Buscar produto ou código" autocomplete="off" value="${esc(termoBusca)}">
          <button class="clear ${termoBusca ? '' : 'hide'}" id="pdv-clear" type="button">✕</button>
        </div>
        <button class="btn btn-gold btn-icon" id="pdv-scan" type="button" title="Ler código de barras">📷</button>
      </div>
      <div class="chips mt8" id="pdv-cats">
        <button class="chip ${categoriaAtiva === 'todos' ? 'active' : ''}" data-cat="todos" type="button">Todos</button>
        ${cats.map((c) => `<button class="chip ${categoriaAtiva === c ? 'active' : ''}" data-cat="${esc(c)}" type="button">${esc(c)}</button>`).join('')}
      </div>
      <div id="pdv-cliente" class="mt8"></div>
    </div>

    <div class="page tight">
      <div class="kpi-grid" id="pdv-kpi">
        <div class="kpi">
          <div class="kpi-label">Vendas hoje</div>
          <div class="kpi-value">${fmtMoney(fatHoje)}</div>
          <div class="kpi-hint">${hj.length} venda(s) · ${hj.reduce((a, v) => a + (v.itens?.length || 0), 0)} lançamento(s)</div>
        </div>
        <div class="kpi gold">
          <div class="kpi-label">No carrinho</div>
          <div class="kpi-value" id="pdv-kpi-cart">${fmtMoney(cartTotal())}</div>
          <div class="kpi-hint" id="pdv-kpi-qt">${cartCount()} item(ns)</div>
        </div>
      </div>
      <div id="pdv-results" class="mt12"></div>
    </div>

    <div id="pdv-cartbar"></div>
  `;

  const input = root.querySelector('#pdv-q');
  const clearBtn = root.querySelector('#pdv-clear');
  bindSearch(input, (v) => {
    termoBusca = v;
    clearBtn.classList.toggle('hide', !v);
    renderResultados();
  });
  clearBtn.onclick = () => {
    input.value = '';
    termoBusca = '';
    clearBtn.classList.add('hide');
    renderResultados();
    input.focus();
  };

  root.querySelectorAll('[data-cat]').forEach((b) => {
    b.onclick = () => {
      categoriaAtiva = b.dataset.cat;
      root.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('active', x.dataset.cat === categoriaAtiva));
      renderResultados();
    };
  });

  root.querySelector('#pdv-scan').onclick = () => scanBarcode(root);
  pintarClientePDV(root.querySelector('#pdv-cliente'));

  renderResultados();
  atualizarBarra();
}

function renderResultados() {
  const box = document.getElementById('pdv-results');
  if (!box) return;
  const t = norm(termoBusca);

  if (t) {
    buscarProduto(termoBusca).then((res) => {
      const filtrados = categoriaAtiva === 'todos' ? res : res.filter((p) => p.categoria === categoriaAtiva);
      box.innerHTML = `
        <div class="section-title">${filtrados.length} resultado(s)</div>
        ${filtrados.length ? `<div class="card list">${filtrados.map(rowProduto).join('')}</div>` : emptyState({
          emoji: '🔍',
          title: 'Nenhum produto encontrado',
          text: `Nada para "${termoBusca}".`,
          action: '<button class="btn btn-outline" data-avulso type="button">＋ Adicionar item avulso</button>'
        })}
        <button class="btn btn-ghost btn-block mt12" data-avulso type="button">＋ Item avulso (sem cadastro)</button>
      `;
      ligarResultados(box);
    });
    return;
  }

  listarProdutos().then((produtos) => {
    let lista = produtos.filter((p) => p.ativo !== false);
    if (categoriaAtiva !== 'todos') lista = lista.filter((p) => p.categoria === categoriaAtiva);
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const baixos = produtos.filter((p) => p.ativo !== false && (Number(p.estoque) || 0) <= (Number(p.estoqueMinimo) || 0) && (Number(p.estoqueMinimo) || 0) > 0);

    box.innerHTML = `
      ${baixos.length ? `
        <div class="alert alert-warn" style="margin-bottom:12px">
          <span>⚠️</span>
          <div><b>${baixos.length} produto(s) com estoque baixo</b><br>
          <span class="tiny">${baixos.slice(0, 3).map((p) => esc(p.nome)).join(', ')}${baixos.length > 3 ? '…' : ''}</span></div>
        </div>` : ''}
      <div class="section-title">Produtos (${lista.length})</div>
      ${lista.length ? `<div class="grid-prod">${lista.map(cardProduto).join('')}</div>` : emptyState({
        emoji: '💍',
        title: 'Nenhum produto cadastrado',
        text: 'Cadastre seu estoque para vender pelo PDV.',
        action: '<button class="btn btn-primary" data-novo type="button">Cadastrar produto</button>'
      })}
      <button class="btn btn-ghost btn-block mt12" data-avulso type="button">＋ Item avulso (sem cadastro)</button>
    `;
    ligarResultados(box);
  });
}

function rowProduto(p) {
  const sem = (Number(p.estoque) || 0) <= 0;
  return `
    <button class="item" data-add="${p.id}" type="button">
      <div class="thumb">${p.foto ? `<img src="${objUrl(p.foto)}" alt="">` : emojiDe(p)}</div>
      <div class="item-main">
        <div class="item-title">${esc(p.nome)}</div>
        <div class="item-sub">${esc(p.codigo || 's/ código')}${p.categoria ? ` · ${esc(p.categoria)}` : ''} · estoque ${p.estoque}</div>
      </div>
      <div class="item-right">
        <div class="strong mono">${fmtMoney(p.precoVenda)}</div>
        ${sem ? '<span class="badge badge-danger" style="margin-top:4px">Esgotado</span>' : ''}
      </div>
    </button>`;
}

function cardProduto(p) {
  const estoque = Number(p.estoque) || 0;
  const minimo = Number(p.estoqueMinimo) || 0;
  const sem = estoque <= 0;
  const baixo = !sem && minimo > 0 && estoque <= minimo;
  return `
    <div class="prod-card" data-add="${p.id}">
      <div class="prod-img">
        ${p.foto ? `<img src="${objUrl(p.foto)}" alt="${esc(p.nome)}">` : emojiDe(p)}
        ${sem ? '<span class="prod-tag low">Esgotado</span>' : baixo ? `<span class="prod-tag low">Últimas ${estoque}</span>` : ''}
      </div>
      <div class="prod-body">
        <div class="prod-name">${esc(p.nome)}</div>
        <div class="prod-meta">${esc(p.codigo || p.categoria || '')}</div>
        <div class="prod-price">${fmtMoney(p.precoVenda)}</div>
      </div>
    </div>`;
}

function ligarResultados(box) {
  box.querySelectorAll('[data-add]').forEach((el) => {
    el.onclick = async () => {
      const p = await import('../db.js').then((m) => m.getProduto(el.dataset.add));
      if (p) addToCart(p);
      renderResultados();
    };
  });
  box.querySelectorAll('[data-avulso]').forEach((el) => { el.onclick = addItemAvulso; });
  const novo = box.querySelector('[data-novo]');
  if (novo) novo.onclick = () => formProduto(null, () => renderResultados());
}

/* ---------------- Barra do carrinho ---------------- */

function atualizarBarra() {
  const box = document.getElementById('pdv-cartbar');
  const kpi = document.getElementById('pdv-kpi-cart');
  const kpiQ = document.getElementById('pdv-kpi-qt');
  if (kpi) kpi.textContent = fmtMoney(cartTotal());
  if (kpiQ) kpiQ.textContent = `${cartCount()} item(ns)`;
  if (!box) return;

  if (!cart.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `
    <button class="cart-bar" id="pdv-open-cart" type="button">
      <div>
        <div class="cb-label">${cartCount()} item(ns) · ver carrinho</div>
        <div class="cb-total">${fmtMoney(cartTotal())}</div>
      </div>
      <span class="cb-go">Finalizar →</span>
    </button>`;
  box.querySelector('#pdv-open-cart').onclick = openCarrinho;
}

function openCarrinho() {
  const s = openSheet({
    title: `Carrinho (${cartCount()})`,
    body: `
      <div class="card list" id="cart-items">${cart.map(itemCarrinho).join('')}</div>
      <div class="card card-pad mt12 totals">
        <div class="t-line"><span>Subtotal</span><b>${fmtMoney(cartTotal())}</b></div>
        <div class="t-line total"><span>Total</span><span>${fmtMoney(cartTotal())}</span></div>
      </div>
      ${cart.length ? '<button class="btn btn-danger btn-block mt12" id="cart-clear" type="button">🗑 Limpar carrinho</button>' : ''}
    `,
    foot: `
      <button class="btn btn-ghost" id="cart-add" type="button">＋ Item</button>
      <button class="btn btn-primary" id="cart-next" type="button" ${cart.length ? '' : 'disabled'}>Pagamento →</button>`
  });

  rebindSimple(s);
}

function refreshCart(s) {
  s.sheet.querySelector('#cart-items').innerHTML = cart.map(itemCarrinho).join('');
  const totals = s.sheet.querySelector('.totals');
  if (totals) totals.innerHTML = `
    <div class="t-line"><span>Subtotal</span><b>${fmtMoney(cartTotal())}</b></div>
    <div class="t-line total"><span>Total</span><span>${fmtMoney(cartTotal())}</span></div>`;
  if (!cart.length) { s.close(true); atualizarBarra(); renderResultados(); return; }
  atualizarBarra();
  renderResultados();
  rebindSimple(s);
}

function rebindSimple(s) {
  const root = s.sheet;
  root.querySelectorAll('[data-q]').forEach((b) => {
    b.onclick = () => {
      const it = cart.find((x) => (x.produtoId || x.nome) === b.dataset.q);
      if (!it) return;
      if (b.dataset.d === '+') {
        if (it.estoque !== null && it.qtd >= it.estoque) { toast('Estoque insuficiente', 'err'); return; }
        it.qtd++;
      } else {
        it.qtd--;
        if (it.qtd <= 0) cart = cart.filter((x) => x !== it);
      }
      refreshCart(s);
    };
  });
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      cart = cart.filter((x) => (x.produtoId || x.nome) !== b.dataset.del);
      refreshCart(s);
    };
  });
  root.querySelector('#cart-clear')?.addEventListener('click', async () => {
    if (await confirmDialog('Limpar todo o carrinho?', { danger: true, okLabel: 'Limpar' })) {
      cart = [];
      s.close();
      atualizarBarra();
      renderResultados();
    }
  });
  root.querySelector('#cart-add').onclick = () => { s.close(true); document.getElementById('pdv-q')?.focus(); };
  const next = root.querySelector('#cart-next');
  if (next) next.onclick = () => { s.close(true); openPagamento(); };
}

function itemCarrinho(it) {
  const key = it.produtoId || it.nome;
  return `
    <div class="cart-item">
      <div class="grow" style="min-width:0">
        <div class="ci-name">${esc(it.nome)}</div>
        <div class="ci-price">${fmtMoney(it.precoUnit)} un.${it.estoque !== null ? ` · estoque ${it.estoque}` : ''}</div>
      </div>
      <div class="qty-mini">
        <button data-q="${esc(key)}" data-d="-" type="button">−</button>
        <span>${it.qtd}</span>
        <button data-q="${esc(key)}" data-d="+" type="button">＋</button>
      </div>
      <div class="ci-total nowrap" style="min-width:74px;text-align:right">${fmtMoney(it.qtd * it.precoUnit)}</div>
      <button class="sheet-close" data-del="${esc(key)}" type="button" aria-label="Remover">✕</button>
    </div>`;
}

/* ---------------- Pagamento ---------------- */

async function openPagamento() {
  if (!cart.length) return;
  const clientes = await buscarCliente('');
  let forma = 'pix';
  let parcelas = 1;
  let desconto = 0;
  let receberAgora = true;
  let valorManual = false;
  let valorRecebido = cartTotal();

  const subtotal = cartTotal();

  const body = `
    <div class="card card-pad" style="margin-bottom:12px">
      <div class="spread" style="cursor:pointer" id="pg-cliente">
        <div class="row-flex">
          <div class="thumb sm avatar">${clienteSel ? esc(clienteSel.nome.slice(0, 1).toUpperCase()) : '👤'}</div>
          <div>
            <div class="item-title" style="font-size:14.5px" id="pg-cliente-nome">${clienteSel ? esc(clienteSel.nome) : 'Consumidor final'}</div>
            <div class="item-sub">Toque para trocar o cliente</div>
          </div>
        </div>
        <span class="muted">›</span>
      </div>
    </div>

    <div class="card list" style="max-height:150px;overflow:auto">
      ${cart.map((i) => `
        <div class="cart-item">
          <div class="grow" style="min-width:0">
            <div class="ci-name">${i.qtd}x ${esc(i.nome)}</div>
          </div>
          <div class="ci-total">${fmtMoney(i.qtd * i.precoUnit)}</div>
        </div>`).join('')}
    </div>

    <div class="card card-pad mt12">
      <div class="field-row">
        <div class="field">
          <label>Desconto</label>
          <div class="row-flex">
            <div class="input-wrap has-prefix grow">
              <span class="prefix">R$</span>
              <input type="text" inputmode="decimal" id="pg-desconto" value="0,00">
            </div>
            <button class="btn btn-outline btn-icon" data-calc-open="pg-desconto" type="button" title="Calculadora" aria-label="Abrir calculadora">🧮</button>
          </div>
        </div>
        <div class="field">
          <label>Parcelas</label>
          <select id="pg-parcelas">
            ${Array.from({ length: 12 }, (_, i) => i + 1).map((n) => `<option value="${n}" ${n === 1 ? 'selected' : ''}>${n}x${n > 1 ? ` de ${fmtMoney(subtotal / n)}` : ''}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="field" style="margin-bottom:6px">
        <label>Forma de pagamento</label>
        <div class="pay-grid" id="pg-formas">
          ${FORMAS.map((f) => `
            <button class="pay-opt ${f.id === forma ? 'active' : ''}" data-forma="${f.id}" type="button">
              <span class="pi">${f.icon}</span>${f.label}
            </button>`).join('')}
        </div>
      </div>

      <div class="divider"></div>

      <div class="switch">
        <label for="pg-receber" id="pg-receber-label" style="font-weight:700;font-size:14.5px;margin:0">Receber agora</label>
        <input type="checkbox" id="pg-receber" ${receberAgora ? 'checked' : ''}>
        <span class="track"></span>
      </div>

      <div class="field mt8" id="pg-valor-wrap">
        <label id="pg-valor-label">Valor recebido</label>
        <div class="row-flex">
          <div class="input-wrap has-prefix grow">
            <span class="prefix">R$</span>
            <input type="text" inputmode="decimal" id="pg-valor" value="${fmtMoney(valorRecebido).replace('R$', '').trim()}">
          </div>
          <button class="btn btn-outline btn-icon" data-calc-open="pg-valor" type="button" title="Calculadora" aria-label="Abrir calculadora">🧮</button>
        </div>
        <div class="tiny muted" id="pg-troco"></div>
      </div>
      <div class="tiny" id="pg-plano" style="margin-top:6px"></div>

      <div class="field">
        <label>Observação</label>
        <textarea id="pg-obs" rows="2" placeholder="Ex.: presente, ajuste do cinto, gravação…"></textarea>
      </div>
    </div>

    <div class="card card-pad mt12 totals" id="pg-totals"></div>
  `;

  const s = openSheet({
    title: 'Finalizar venda',
    body,
    foot: `<button class="btn btn-primary btn-block" id="pg-finish" type="button">Confirmar venda</button>`
  });

  const $ = (sel) => s.sheet.querySelector(sel);

  /* mesmas contas do banco: parcela base arredondada, a última ajusta o resto */
  function planoParcelas(total) {
    const base = round2(total / parcelas);
    return Array.from({ length: parcelas }, (_, i) => (i === parcelas - 1 ? round2(total - base * (parcelas - 1)) : base));
  }

  function totais() {
    const desc = Math.min(toNumber($('#pg-desconto').value), subtotal);
    const total = round2(subtotal - desc);
    const base = parcelas > 1 ? round2(total / parcelas) : total;

    if (receberAgora && !valorManual) {
      /* parcelado: recebe só a 1ª parcela (entrada); à vista: o total */
      valorRecebido = base;
      $('#pg-valor').value = fmtMoney(base).replace('R$', '').trim();
    }

    $('#pg-totals').innerHTML = `
      <div class="t-line"><span>Subtotal</span><span>${fmtMoney(subtotal)}</span></div>
      <div class="t-line"><span>Desconto</span><span>${desc ? `- ${fmtMoney(desc)}` : '—'}</span></div>
      ${parcelas > 1 ? `<div class="t-line"><span>${parcelas}x de</span><span>${fmtMoney(total / parcelas)}</span></div>` : ''}
      <div class="t-line total"><span>Total</span><span>${fmtMoney(total)}</span></div>`;

    $('#pg-receber-label').textContent = parcelas > 1 ? 'Receber entrada (1ª parcela)' : 'Receber agora';
    $('#pg-valor-label').textContent = parcelas > 1 ? 'Valor recebido agora (entrada)' : 'Valor recebido';

    if (parcelas > 1) {
      const recebido = receberAgora ? Math.min(toNumber($('#pg-valor').value), total) : 0;
      let rest = recebido;
      let quitadas = 0;
      for (const v of planoParcelas(total)) {
        if (rest <= 0.005) break;
        const pago = round2(Math.min(rest, v));
        rest = round2(rest - pago);
        if (pago >= v - 0.005) quitadas++;
        else break;
      }
      const emAberto = round2(total - recebido);
      const prox = quitadas + 1;
      $('#pg-plano').innerHTML = recebido > 0
        ? `✅ <b>Entrada de ${fmtMoney(recebido)}</b> paga hoje${quitadas > 1 ? ` (${quitadas} parcelas quitadas)` : ''}<br>⏳ Restante <b>${fmtMoney(emAberto)}</b> em ${parcelas - quitadas} parcela(s) · ${prox}ª vence ${fmtDate(addDays(hoje(), 30 * quitadas))}`
        : `⏳ <b>${fmtMoney(total)}</b> em aberto · ${parcelas}x de ${fmtMoney(base)} · 1ª vence ${fmtDate(hoje())}`;
      $('#pg-plano').className = 'tiny muted';
    } else {
      $('#pg-plano').innerHTML = '';
    }

    const recebido = toNumber($('#pg-valor').value);
    if (forma === 'dinheiro' && receberAgora) {
      const troco = round2(recebido - total);
      $('#pg-troco').innerHTML = troco > 0 ? `<b class="ok-text">Troco: ${fmtMoney(troco)}</b>` : troco < 0 ? `<b class="warn-text">Falta: ${fmtMoney(-troco)}</b>` : '';
    } else {
      $('#pg-troco').innerHTML = '';
    }
    $('#pg-valor-wrap').style.display = receberAgora ? '' : 'none';
    return total;
  }

  $('#pg-desconto').addEventListener('input', totais);
  $('#pg-valor').addEventListener('input', () => {
    valorManual = true;
    totais();
  });
  $('#pg-receber').addEventListener('change', (e) => {
    receberAgora = e.target.checked;
    if (receberAgora) valorManual = false;
    totais();
  });

  s.sheet.querySelectorAll('[data-forma]').forEach((b) => {
    b.onclick = () => {
      forma = b.dataset.forma;
      s.sheet.querySelectorAll('[data-forma]').forEach((x) => x.classList.toggle('active', x.dataset.forma === forma));
      if (forma === 'credito' && parcelas === 1) {
        parcelas = 3;
        $('#pg-parcelas').value = '3';
      }
      if (forma !== 'credito' && parcelas > 1 && forma !== 'boleto') {
        parcelas = 1;
        $('#pg-parcelas').value = '1';
      }
      if (forma === 'pix' || forma === 'debito' || forma === 'dinheiro') {
        receberAgora = true;
        $('#pg-receber').checked = true;
      }
      valorManual = false;
      totais();
    };
  });

  $('#pg-parcelas').onchange = (e) => {
    parcelas = Number(e.target.value) || 1;
    valorManual = false;
    totais();
  };

  $('#pg-cliente').onclick = async () => {
    const sel = await escolherCliente(clientes);
    if (sel !== undefined) {
      clienteSel = sel;
      $('#pg-cliente-nome').textContent = sel ? sel.nome : 'Consumidor final';
      $('#pg-cliente .avatar').textContent = sel ? sel.nome.slice(0, 1).toUpperCase() : '👤';
    }
  };

  totais();

  $('#pg-finish').onclick = async () => {
    const btn = $('#pg-finish');
    const total = totais();
    const desc = Math.min(toNumber($('#pg-desconto').value), subtotal);
    const recebido = toNumber($('#pg-valor').value);
    btn.disabled = true;
    btn.innerHTML = 'Processando…';
    try {
      const venda = await criarVenda({
        tipo: 'venda',
        clienteId: clienteSel?.id || null,
        clienteNome: clienteSel?.nome || 'Consumidor final',
        itens: cart,
        desconto: desc,
        formaPagamento: forma,
        parcelas,
        obs: $('#pg-obs').value.trim(),
        data: hoje(),
        receberAgora,
        valorRecebido: receberAgora ? recebido : 0
      });
      cart = [];
      clienteSel = null;
      s.close(true);
      atualizarBarra();
      renderResultados();
      sucesso(venda, total);
    } catch (e) {
      toast(e.message || 'Erro ao registrar venda', 'err');
      btn.disabled = false;
      btn.innerHTML = 'Confirmar venda';
    }
  };
}

export function escolherCliente(clientes) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (v) => { if (!resolved) { resolved = true; resolve(v); } };
    const s = openSheet({
      title: 'Escolher cliente',
      body: `
        <div class="searchbox" style="margin-bottom:10px">
          <span class="sic">🔎</span>
          <input type="search" id="cli-q" placeholder="Buscar cliente" autocomplete="off">
        </div>
        <div class="card list" id="cli-lista"></div>
        <button class="btn btn-ghost btn-block mt12" id="cli-none" type="button">Consumidor final (sem cliente)</button>`,
      onClose: () => finish(undefined)
    });

    const lista = s.sheet.querySelector('#cli-lista');
    const pintar = (termo = '') => {
      const t = norm(termo);
      const filtrados = clientes.filter((c) => !t || norm(c.nome).includes(t) || (c.telefone || '').includes(t));
      lista.innerHTML = filtrados.length
        ? filtrados.slice(0, 40).map((c) => `
            <button class="item" data-cli="${c.id}" type="button">
              <div class="thumb sm avatar">${esc(c.nome.slice(0, 1).toUpperCase())}</div>
              <div class="item-main">
                <div class="item-title">${esc(c.nome)}</div>
                <div class="item-sub">${esc(c.telefone || 'sem telefone')}</div>
              </div>
            </button>`).join('')
        : '<div class="card-pad small muted text-center">Nenhum cliente</div>';
      lista.querySelectorAll('[data-cli]').forEach((b) => {
        b.onclick = () => {
          const c = clientes.find((x) => x.id === b.dataset.cli);
          s.close(true);
          finish(c);
        };
      });
    };
    pintar();
    s.sheet.querySelector('#cli-q').addEventListener('input', (e) => pintar(e.target.value));
    s.sheet.querySelector('#cli-none').onclick = () => { s.close(true); finish(null); };
  });
}

function sucesso(venda, totalRecebido) {
  const s = openSheet({
    title: 'Venda concluída ✓',
    center: true,
    body: `
      <div class="text-center" style="padding:6px 0 2px">
        <div style="font-size:52px">🎉</div>
        <div class="kpi-value" style="font-size:27px;margin-top:4px">${fmtMoney(venda.total)}</div>
        <div class="small muted">Venda #${venda.numero} · ${venda.itens.length} item(ns)</div>
        <div class="tiny muted mt8">${esc(venda.clienteNome)}</div>
        <div class="tiny" id="sucesso-plano"></div>
      </div>`,
    foot: `
      <button class="btn btn-ghost btn-icon" data-rec type="button" title="Recibo">🖨️</button>
      <button class="btn btn-ghost btn-icon" data-share type="button" title="Compartilhar">📤</button>
      <button class="btn btn-primary" data-new type="button">Nova venda</button>`
  });
  pagamentosDaVenda(venda.id).then((pags) => {
    const pago = round2(soma(pags, (p) => p.valor));
    const restante = round2(Math.max(0, venda.total - pago));
    const el = s.sheet.querySelector('#sucesso-plano');
    if (!el) return;
    el.innerHTML = restante > 0.005
      ? `<div class="ok-text mt8"><b>Entrada de ${fmtMoney(pago)} recebida</b></div>
         <div class="warn-text">Restante ${fmtMoney(restante)} em aberto nas datas de vencimento</div>`
      : `<div class="ok-text mt8"><b>Total recebido</b></div>`;
  });
  s.sheet.querySelector('[data-new]').onclick = () => { s.close(true); document.getElementById('pdv-q')?.focus(); };
  s.sheet.querySelector('[data-rec]').onclick = () => imprimirRecibo(venda);
  s.sheet.querySelector('[data-share]').onclick = async () => {
    const ok = await compartilharRecibo(venda);
    toast(ok ? 'Recibo compartilhado' : 'Recibo copiado', 'ok');
  };
}

/* ---------------- Código de barras ---------------- */

async function scanBarcode(root) {
  if (!('BarcodeDetector' in window)) {
    toast('Leitura de câmera não suportada aqui — digite o código na busca.', 'info');
    root.querySelector('#pdv-q')?.focus();
    return;
  }
  let parar = () => {};
  const s = openSheet({
    title: 'Ler código de barras',
    onClose: () => parar(),
    body: `
      <video id="scan-video" autoplay playsinline muted style="width:100%;border-radius:14px;background:#000;max-height:50vh;object-fit:cover"></video>
      <p class="small muted text-center mt8">Aponte a câmera para o código do produto.</p>`,
    foot: '<button class="btn btn-ghost btn-block" data-cancel type="button">Cancelar</button>'
  });
  const video = s.sheet.querySelector('#scan-video');
  let stream = null;
  let timer = null;

  parar = () => {
    if (timer) clearInterval(timer);
    if (stream) stream.getTracks().forEach((t) => t.stop());
  };
  s.sheet.querySelector('[data-cancel]').onclick = () => s.close();

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    await video.play();
    const detector = new window.BarcodeDetector();
    timer = setInterval(async () => {
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          const codigo = codes[0].rawValue;
          parar();
          s.close(true);
          const achados = await buscarProduto(codigo);
          if (achados.length) {
            addToCart(achados[0]);
            renderResultados();
          } else {
            termoBusca = codigo;
            const inp = document.getElementById('pdv-q');
            if (inp) inp.value = codigo;
            renderResultados();
            toast('Código não encontrado no estoque', 'err');
          }
        }
      } catch { /* segue */ }
    }, 400);
  } catch (e) {
    parar();
    s.close(true);
    toast('Não foi possível acessar a câmera', 'err');
  }
}

export function limparPDV() {
  cart = [];
  clienteSel = null;
}

export function prepararVendaPara(c) {
  clienteSel = c || null;
}

export function selecionarCliente(c) {
  clienteSel = c;
  const box = document.getElementById('pdv-cliente');
  if (box) pintarClientePDV(box);
  if (c) toast(`Cliente selecionado: ${c.nome}`, 'info');
}

function pintarClientePDV(box) {
  if (!clienteSel) {
    box.innerHTML = '';
    return;
  }
  const c = clienteSel;
  box.innerHTML = `
    <div class="alert alert-info" style="margin-bottom:0">
      <span>👤</span>
      <div class="grow"><b>${esc(c.nome)}</b><div class="tiny">${esc(c.telefone || '')}</div></div>
      <button class="sheet-close" data-clear-cli type="button">✕</button>
    </div>`;
  box.querySelector('[data-clear-cli]').onclick = () => selecionarCliente(null);
}
