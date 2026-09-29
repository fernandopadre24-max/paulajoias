/* Configurações, backup e dados de exemplo */
import {
  exportarBackup, importarBackup, limparTudo, cfg, setCfg,
  salvarCliente, criarVenda, listarVendas, listarProdutos, listarClientes
} from '../db.js';
import { carregarCatalogo, CATALOGO } from '../catalogo.js';
import { toast, openSheet, openForm, confirmDialog, emptyState } from '../ui.js';
import { fmtMoney, esc, round2, hoje, addDays, download, soma } from '../utils.js';

export async function renderConfig(ctx) {
  const { root, navigate, setTopbar } = ctx;
  setTopbar({ title: 'Configurações', sub: 'Dados, backup e preferências' });

  const [empresa, telefone, uso] = await Promise.all([
    cfg('empresa', 'Paula · Bijuterias e Joias'),
    cfg('telefone', ''),
    estimarUso()
  ]);

  const [produtos, clientes, vendas] = await Promise.all([listarProdutos(), listarClientes(), listarVendas()]);

  root.innerHTML = `
    <div class="page">
      <div class="brand-hero">
        <h2>${esc(empresa)}</h2>
        <p>Controle de vendas, clientes, estoque e orçamentos — tudo salvo neste aparelho.</p>
      </div>

      <div class="kpi-grid cols-3 mt12">
        <div class="kpi"><div class="kpi-label">Produtos</div><div class="kpi-value sm">${produtos.length}</div></div>
        <div class="kpi gold"><div class="kpi-label">Clientes</div><div class="kpi-value sm">${clientes.length}</div></div>
        <div class="kpi ok"><div class="kpi-label">Vendas</div><div class="kpi-value sm">${vendas.length}</div></div>
      </div>

      <div class="section-title">Dados da empresa</div>
      <div class="menu-list">
        <button class="menu-item" data-empresa type="button">
          <span class="mi-ic">🏪</span>
          <div class="grow">
            <div>Nome e contato</div>
            <div class="tiny muted">${esc(empresa)}${telefone ? ` · ${esc(telefone)}` : ''}</div>
          </div>
          <span class="mi-arr">›</span>
        </button>
      </div>

      <div class="section-title">Backup e restore</div>
      <div class="menu-list">
        <button class="menu-item" data-export type="button">
          <span class="mi-ic">⬇️</span>
          <div class="grow">
            <div>Exportar backup completo</div>
            <div class="tiny muted">Arquivo .json com clientes, vendas, estoque e fotos</div>
          </div>
          <span class="mi-arr">›</span>
        </button>
        <button class="menu-item" data-import type="button">
          <span class="mi-ic">⬆️</span>
          <div class="grow">
            <div>Importar backup</div>
            <div class="tiny muted">Substitui os dados atuais pelos do arquivo</div>
          </div>
          <span class="mi-arr">›</span>
        </button>
        <input type="file" id="cfg-file" accept="application/json,.json" style="display:none">
      </div>

      <div class="section-title">Organizar dados</div>
      <div class="menu-list">
        <button class="menu-item" data-catalogo type="button">
          <span class="mi-ic">🛍️</span>
          <div class="grow">
            <div>Catálogo real de bijuterias</div>
            <div class="tiny muted">${CATALOGO.length} peças com custo, preço de venda, peso e estoque reais</div>
          </div>
          <span class="mi-arr">›</span>
        </button>
        <button class="menu-item" data-demo type="button">
          <span class="mi-ic">✨</span>
          <div class="grow">
            <div>Clientes e vendas de exemplo</div>
            <div class="tiny muted">Dados fictícios para testar os relatórios</div>
          </div>
          <span class="mi-arr">›</span>
        </button>
        <button class="menu-item danger" data-clear type="button">
          <span class="mi-ic">🗑</span>
          <div class="grow">
            <div>Apagar todos os dados</div>
            <div class="tiny muted">Remove definitivamente tudo deste aparelho</div>
          </div>
          <span class="mi-arr">›</span>
        </button>
      </div>

      <div class="section-title">Sobre</div>
      <div class="card card-pad small">
        <div class="spread"><span class="muted">Versão</span><b>1.0.0</b></div>
        <div class="spread mt8"><span class="muted">Armazenamento usado</span><b>${uso}</b></div>
        <div class="spread mt8"><span class="muted">Modo</span><b>Offline no aparelho</b></div>
        <p class="tiny muted mt12" style="margin-bottom:0">
          Os dados ficam salvos apenas neste celular (IndexedDB). Faça um backup periódico
          para não perder nada caso o navegador apague os dados do site.
        </p>
      </div>

      <button class="btn btn-primary btn-block mt16" data-voltar type="button">← Voltar ao PDV</button>
    </div>
  `;

  root.querySelector('[data-empresa]').onclick = async () => {
    openForm({
      title: 'Dados da empresa',
      fields: [
        { name: 'empresa', label: 'Nome da loja', required: true, placeholder: 'Ex.: Paula Joias' },
        { name: 'telefone', label: 'Telefone / WhatsApp', type: 'tel', placeholder: '(00) 00000-0000' },
        { name: 'rodape', label: 'Mensagem do recibo', placeholder: 'Ex.: Obrigado pela preferência!' }
      ],
      values: { empresa, telefone, rodape: await cfg('rodape', '') },
      submitLabel: 'Salvar',
      onSubmit: async (d) => {
        await setCfg('empresa', d.empresa.trim());
        await setCfg('telefone', d.telefone.trim());
        await setCfg('rodape', d.rodape.trim());
        toast('Dados atualizados', 'ok');
        renderConfig(ctx);
      }
    });
  };

  root.querySelector('[data-export]').onclick = async () => {
    try {
      const btn = root.querySelector('[data-export] .mi-ic');
      btn.textContent = '⏳';
      const dados = await exportarBackup();
      download(`backup-paula-${hoje()}.json`, JSON.stringify(dados), 'application/json');
      btn.textContent = '⬇️';
      toast('Backup gerado. Guarde o arquivo em local seguro.', 'ok');
    } catch (e) {
      toast(e.message || 'Erro ao exportar', 'err');
    }
  };

  const fileInput = root.querySelector('#cfg-file');
  root.querySelector('[data-import]').onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    try {
      const texto = await f.text();
      const dados = JSON.parse(texto);
      const ok = await confirmDialog('Importar este backup? Os dados atuais deste aparelho serão substituídos.', {
        danger: true, okLabel: 'Importar'
      });
      if (!ok) return;
      await importarBackup(dados, { limpar: true });
      toast('Backup importado com sucesso', 'ok');
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      toast(e.message || 'Arquivo inválido', 'err');
    } finally {
      fileInput.value = '';
    }
  };

  root.querySelector('[data-catalogo]').onclick = async () => {
    const ok = await confirmDialog(
      `Carregar o catálogo real (${CATALOGO.length} peças)? Os produtos atuais serão substituídos. Vendas e clientes são mantidos.`,
      { okLabel: 'Carregar catálogo' }
    );
    if (!ok) return;
    const n = await carregarCatalogo();
    toast(`${n} produtos reais carregados`, 'ok');
    renderConfig(ctx);
  };

  root.querySelector('[data-demo]').onclick = async () => {
    const ok = await confirmDialog('Carregar dados de exemplo? Eles serão adicionados aos dados atuais.', { okLabel: 'Carregar' });
    if (!ok) return;
    const n = await carregarDemo();
    toast(`${n} registros de exemplo criados`, 'ok');
    renderConfig(ctx);
  };

  root.querySelector('[data-clear]').onclick = async () => {
    const ok = await confirmDialog('Apagar TODOS os dados deste aparelho? Essa ação não pode ser desfeita (faça backup antes).', {
      danger: true, okLabel: 'Apagar tudo'
    });
    if (!ok) return;
    const ok2 = await confirmDialog('Tem certeza absoluta? Todos os clientes, vendas e produtos serão perdidos.', {
      danger: true, okLabel: 'Sim, apagar'
    });
    if (!ok2) return;
    await limparTudo();
    await setCfg('aceiteInicial', true);
    await setCfg('empresa', 'Paula · Bijuterias e Joias');
    toast('Dados apagados', 'ok');
    navigate('pdv');
  };

  root.querySelector('[data-voltar]').onclick = () => navigate('pdv');
}

async function estimarUso() {
  try {
    if (navigator.storage?.estimate) {
      const { usage } = await navigator.storage.estimate();
      if (!usage) return '—';
      if (usage < 1024 * 1024) return `${Math.round(usage / 1024)} KB`;
      return `${(usage / (1024 * 1024)).toFixed(1)} MB`;
    }
  } catch { /* ignora */ }
  return '—';
}

/* ---------------- Dados de exemplo ---------------- */

export async function carregarDemo() {
  let criados = 0;

  /* usa o catálogo real como base (carrega se ainda não houver produtos) */
  let produtos = await listarProdutos();
  if (!produtos.length) {
    criados += await carregarCatalogo();
    produtos = await listarProdutos();
  }

  const nomes = [
    ['Maria Aparecida Souza', '(11) 98888-1234'],
    ['Joana Beatriz Lima', '(11) 97777-5678'],
    ['Rosana Ferreira', '(11) 96666-4321'],
    ['Carla Menezes', '(11) 95555-8765'],
    ['Patrícia Gomes', '(11) 94444-3210'],
    ['Sandra Oliveira', '(11) 93333-7654']
  ];
  const clientes = [];
  for (const [nome, telefone] of nomes) {
    const c = await salvarCliente({ nome, telefone, endereco: 'São Paulo - SP', obs: '' });
    clientes.push(c);
    criados++;
  }

  const formas = ['pix', 'dinheiro', 'credito', 'debito'];
  const disponivel = new Map(produtos.map((p) => [p.id, p.estoque]));
  for (let i = 0; i < 16; i++) {
    const data = addDays(hoje(), -Math.floor(Math.random() * 45));
    const nItens = 1 + Math.floor(Math.random() * 3);
    const itens = [];
    for (let j = 0; j < nItens; j++) {
      const opcoes = produtos.filter((p) => (disponivel.get(p.id) || 0) > 0);
      if (!opcoes.length) break;
      const p = opcoes[Math.floor(Math.random() * opcoes.length)];
      const maxQ = Math.min(2, disponivel.get(p.id));
      const qtd = 1 + Math.floor(Math.random() * maxQ);
      disponivel.set(p.id, disponivel.get(p.id) - qtd);
      itens.push({
        produtoId: p.id,
        codigo: p.codigo,
        nome: p.nome,
        categoria: p.categoria,
        qtd,
        precoUnit: p.precoVenda,
        custoUnit: p.precoCusto
      });
    }
    if (!itens.length) continue;
    const cliente = Math.random() > 0.35 ? clientes[Math.floor(Math.random() * clientes.length)] : null;
    const forma = formas[Math.floor(Math.random() * formas.length)];
    const parcelas = forma === 'credito' ? 2 + Math.floor(Math.random() * 4) : 1;
    try {
      await criarVenda({
        tipo: 'venda',
        clienteId: cliente?.id || null,
        clienteNome: cliente?.nome || 'Consumidor final',
        itens,
        desconto: Math.random() > 0.75 ? round2(10 + Math.random() * 40) : 0,
        formaPagamento: forma,
        parcelas,
        data,
        receberAgora: true,
        obs: ''
      });
      criados++;
    } catch {
      /* ignora falha pontual (ex.: estoque) */
    }
  }

  return criados;
}
