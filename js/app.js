/* App shell: roteamento, topbar, tabbar, service worker */
import { openDB, cfg, setCfg, contasAReceber } from './db.js';
import { toast, closeAllSheets } from './ui.js';
import { esc } from './utils.js';
import { abrirCalculadora } from './calculadora.js';
import { abrirCalendario } from './calendario.js';
import { iconeTema, rotuloTema, temaAplicado, alternarTema, aplicarTema, lerTemaSalvo } from './tema.js';

import { renderPDV } from './views/pdv.js';
import { renderVendas, renderVendaDetalhe } from './views/vendas.js';
import { renderEstoque, renderProdutoDetalhe } from './views/estoque.js';
import { renderClientes, renderClienteDetalhe } from './views/clientes.js';
import { renderRelatorios } from './views/relatorios.js';
import { renderConfig } from './views/config.js';

const viewEl = document.getElementById('view');
const topbarEl = document.getElementById('topbar');
const tabbarEl = document.getElementById('tabbar');

const TABS = [
  { id: 'pdv', label: 'PDV', icon: '🛒' },
  { id: 'vendas', label: 'Vendas', icon: '🧾' },
  { id: 'estoque', label: 'Estoque', icon: '💍' },
  { id: 'clientes', label: 'Clientes', icon: '👥' },
  { id: 'relatorios', label: 'Relatórios', icon: '📊' }
];

const state = {
  route: 'pdv',
  params: [],
  topbar: { title: 'Paula Controle', sub: '', actions: [] },
  dots: {},
  boasVindas: false
};

export function navigate(path) {
  const clean = String(path).replace(/^#\/?/, '');
  const target = `#/${clean}`;
  if (location.hash === target) route();
  else location.hash = target;
}

export function setTopbar({ title, sub = '', actions = null }) {
  state.topbar = { title, sub, actions: actions === null ? state.topbar.actions : actions };
  renderTopbar();
}

export function renderTopbar() {
  const { title, sub, actions } = state.topbar;
  const rota = state.route;
  const mostrarGear = rota !== 'config';
  topbarEl.hidden = false;
  topbarEl.innerHTML = `
    <div class="grow" style="min-width:0">
      <h1 class="tb-title">${esc(title)}${sub ? `<span class="tb-sub">${esc(sub)}</span>` : ''}</h1>
    </div>
    ${(actions || []).map((a, i) => `
      <button class="tb-btn${a.ghost ? ' ghost' : ''}" data-action="${i}" type="button" title="${esc(a.label || '')}" aria-label="${esc(a.label || '')}">${a.icon}</button>
    `).join('')}
    <button class="tb-btn sm" data-calc type="button" title="Calculadora" aria-label="Calculadora">🧮</button>
    <button class="tb-btn sm" data-cal type="button" title="Calendário" aria-label="Calendário">📅</button>
    <button class="tb-btn sm" data-tema type="button" title="${esc(rotuloTema())}" aria-label="${esc(rotuloTema())}">${iconeTema()}</button>
    ${mostrarGear ? '<button class="tb-btn" data-gear type="button" aria-label="Configurações">⚙️</button>' : ''}
  `;
  topbarEl.querySelectorAll('[data-action]').forEach((b) => {
    b.addEventListener('click', () => {
      const a = state.topbar.actions[Number(b.dataset.action)];
      if (a?.onClick) a.onClick();
    });
  });
  topbarEl.querySelector('[data-gear]')?.addEventListener('click', () => navigate('config'));
  topbarEl.querySelector('[data-calc]')?.addEventListener('click', () => abrirCalculadora());
  topbarEl.querySelector('[data-cal]')?.addEventListener('click', () => abrirCalendario());
  topbarEl.querySelector('[data-tema]')?.addEventListener('click', (e) => {
    alternarTema();
    const b = e.currentTarget;
    b.textContent = iconeTema();
    b.title = rotuloTema();
    b.setAttribute('aria-label', rotuloTema());
    toast(temaAplicado(), 'info');
  });
}

function renderTabbar() {
  const rota = state.route;
  tabbarEl.innerHTML = TABS.map((t) => `
    <button class="tab ${rota === t.id || (rota === 'venda' && t.id === 'vendas') || (rota === 'produto' && t.id === 'estoque') || (rota === 'cliente' && t.id === 'clientes') ? 'active' : ''}"
            data-tab="${t.id}" type="button">
      <span class="ic">${t.icon}</span>
      <span>${t.label}</span>
      ${state.dots[t.id] ? '<span class="dot"></span>' : ''}
    </button>
  `).join('');
  tabbarEl.querySelectorAll('[data-tab]').forEach((b) => {
    b.addEventListener('click', () => navigate(b.dataset.tab));
  });
}

const ROUTES = {
  pdv: renderPDV,
  vendas: renderVendas,
  venda: renderVendaDetalhe,
  estoque: renderEstoque,
  produto: renderProdutoDetalhe,
  clientes: renderClientes,
  cliente: renderClienteDetalhe,
  relatorios: renderRelatorios,
  config: renderConfig
};

let ultimoDots = 0;
async function atualizarDots(forcar = false) {
  const agora = Date.now();
  if (!forcar && agora - ultimoDots < 15000) return;
  ultimoDots = agora;
  try {
    const abertas = await contasAReceber();
    const atrasadas = abertas.filter((c) => c.atrasada);
    state.dots = { vendas: atrasadas.length > 0 };
    renderTabbar();
  } catch {
    /* ignora */
  }
}

async function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  const name = parts[0] || 'pdv';
  const fn = ROUTES[name] || renderPDV;
  const rootName = ROUTES[name] ? name : 'pdv';

  state.route = rootName;
  state.params = parts.slice(1);
  viewEl.style.opacity = '0';
  closeAllSheets();

  renderTabbar();

  try {
    await fn({
      root: viewEl,
      params: state.params,
      navigate,
      setTopbar,
      refresh: route
    });
  } catch (e) {
    console.error(e);
    viewEl.innerHTML = `
      <div class="page">
        <div class="card card-pad text-center">
          <div style="font-size:40px">😵</div>
          <h3 class="mt8">Algo deu errado</h3>
          <p class="small muted">${esc(e.message || 'Erro inesperado')}</p>
          <button class="btn btn-primary btn-block mt12" data-retry type="button">Tentar novamente</button>
        </div>
      </div>`;
    viewEl.querySelector('[data-retry]').onclick = route;
    toast('Erro ao carregar a tela', 'err');
  }

  viewEl.style.opacity = '1';
  viewEl.scrollTop = 0;
  window.scrollTo(0, 0);
  renderTopbar();
  atualizarDots();
}

async function boot() {
  try {
    aplicarTema(lerTemaSalvo());
    await openDB();

    const aceite = await cfg('aceiteInicial', false);
    if (!aceite) {
      await setCfg('aceiteInicial', true);
      await setCfg('empresa', 'Paula · Bijuterias e Joias');
      await setCfg('moedaBRL', true);
    }

    window.addEventListener('hashchange', route);
    await route();

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    if (!state.boasVindas) {
      state.boasVindas = true;
      const vendasHoje = (await cfg('ultimaVisita', '')) !== new Date().toDateString();
      if (vendasHoje) await setCfg('ultimaVisita', new Date().toDateString());
    }
  } catch (e) {
    console.error(e);
    viewEl.innerHTML = `
      <div class="page">
        <div class="card card-pad text-center">
          <div style="font-size:40px">🔒</div>
          <h3 class="mt8">Banco de dados indisponível</h3>
          <p class="small muted">${esc(e.message || 'Este app precisa de armazenamento local (IndexedDB) habilitado.')}</p>
        </div>
      </div>`;
    topbarEl.hidden = false;
    state.topbar = { title: 'Erro de armazenamento', sub: '', actions: [] };
    renderTopbar();
  }
}

boot();
