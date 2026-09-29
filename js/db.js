/* Camada de dados — IndexedDB (tudo offline no aparelho) */
import { uid, round2, hoje, addDays, soma, objUrl, fmtMoney } from './utils.js';

const DB_NAME = 'paula-controle';
const DB_VERSION = 1;

let _db = null;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('clientes')) {
        const s = db.createObjectStore('clientes', { keyPath: 'id' });
        s.createIndex('nome', 'nome');
      }
      if (!db.objectStoreNames.contains('produtos')) {
        const s = db.createObjectStore('produtos', { keyPath: 'id' });
        s.createIndex('codigo', 'codigo');
        s.createIndex('nome', 'nome');
        s.createIndex('categoria', 'categoria');
      }
      if (!db.objectStoreNames.contains('vendas')) {
        const s = db.createObjectStore('vendas', { keyPath: 'id' });
        s.createIndex('data', 'data');
        s.createIndex('clienteId', 'clienteId');
        s.createIndex('tipo', 'tipo');
      }
      if (!db.objectStoreNames.contains('pagamentos')) {
        const s = db.createObjectStore('pagamentos', { keyPath: 'id' });
        s.createIndex('vendaId', 'vendaId');
        s.createIndex('data', 'data');
      }
      if (!db.objectStoreNames.contains('movimentos')) {
        const s = db.createObjectStore('movimentos', { keyPath: 'id' });
        s.createIndex('produtoId', 'produtoId');
        s.createIndex('data', 'data');
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'k' });
      }
    };
    r.onsuccess = () => {
      _db = r.result;
      resolve(_db);
    };
    r.onerror = () => reject(r.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

async function getAll(name) {
  return req((await store(name)).getAll());
}

async function getOne(name, id) {
  return req((await store(name)).get(id));
}

async function putOne(name, obj) {
  const s = await store(name, 'readwrite');
  await req(s.put(obj));
  return obj;
}

async function delOne(name, id) {
  const s = await store(name, 'readwrite');
  await req(s.delete(id));
}

async function byIndex(name, idx, value) {
  const s = await store(name);
  return req(s.index(idx).getAll(value));
}

/* ---------------- Config ---------------- */

export async function cfg(chave, padrao = null) {
  const r = await getOne('config', chave);
  return r ? r.v : padrao;
}

export async function setCfg(chave, valor) {
  return putOne('config', { k: chave, v: valor });
}

export async function proximoNumero() {
  const atual = (await cfg('seqVenda', 0)) || 0;
  const n = atual + 1;
  await setCfg('seqVenda', n);
  return n;
}

/* ---------------- Clientes ---------------- */

export const listarClientes = () => getAll('clientes');
export const getCliente = (id) => getOne('clientes', id);

export async function salvarCliente(c) {
  const obj = {
    id: c.id || uid('cli'),
    nome: (c.nome || '').trim(),
    telefone: (c.telefone || '').trim(),
    cpf: (c.cpf || '').trim(),
    endereco: (c.endereco || '').trim(),
    nascimento: c.nascimento || '',
    obs: (c.obs || '').trim(),
    ativo: c.ativo !== false,
    criadoEm: c.criadoEm || Date.now()
  };
  if (!obj.nome) throw new Error('Informe o nome do cliente.');
  return putOne('clientes', obj);
}

export const excluirCliente = (id) => delOne('clientes', id);

/* ---------------- Produtos / Estoque ---------------- */

export const listarProdutos = () => getAll('produtos');
export const getProduto = (id) => getOne('produtos', id);

export async function salvarProduto(p) {
  const obj = {
    id: p.id || uid('prd'),
    codigo: (p.codigo || '').trim(),
    nome: (p.nome || '').trim(),
    categoria: (p.categoria || '').trim(),
    material: (p.material || '').trim(),
    pedra: (p.pedra || '').trim(),
    peso: Number(p.peso) || 0,
    cor: (p.cor || '').trim(),
    precoCusto: Number(p.precoCusto) || 0,
    precoVenda: Number(p.precoVenda) || 0,
    estoque: Number(p.estoque) || 0,
    estoqueMinimo: Number(p.estoqueMinimo) || 0,
    fornecedor: (p.fornecedor || '').trim(),
    obs: (p.obs || '').trim(),
    foto: p.foto || null,
    ativo: p.ativo !== false,
    criadoEm: p.criadoEm || Date.now(),
    atualizadoEm: Date.now()
  };
  if (!obj.nome) throw new Error('Informe o nome do produto.');
  return putOne('produtos', obj);
}

export const excluirProduto = (id) => delOne('produtos', id);

/* Substitui todos os produtos (usado pelo catálogo real) */
export async function substituirProdutos(lista, { limpar = true } = {}) {
  const db = await openDB();
  const tx = db.transaction(['produtos', 'movimentos'], 'readwrite');
  const tarefa = txDone(tx);
  const ps = tx.objectStore('produtos');
  const pendentes = [];
  if (limpar) {
    pendentes.push(req(ps.clear()), req(tx.objectStore('movimentos').clear()));
  }
  for (const p of lista) pendentes.push(req(ps.put(p)));
  await Promise.all([tarefa, ...pendentes]);
  return lista.length;
}

export async function registrarMovimento({ produtoId, tipo, qtd, data, vendaId = null, obs = '' }) {
  const p = await getProduto(produtoId);
  if (!p) return null;
  let estoque = Number(p.estoque) || 0;
  if (tipo === 'entrada' || tipo === 'devolucao') estoque += Number(qtd);
  else if (tipo === 'saida' || tipo === 'venda') estoque -= Number(qtd);
  else if (tipo === 'ajuste') estoque = Number(qtd);
  p.estoque = Math.max(0, round2(estoque));
  p.atualizadoEm = Date.now();
  await putOne('produtos', p);
  const mov = {
    id: uid('mov'),
    produtoId,
    tipo,
    qtd: Number(qtd),
    estoqueApos: p.estoque,
    data: data || hoje(),
    vendaId,
    obs,
    criadoEm: Date.now()
  };
  await putOne('movimentos', mov);
  return mov;
}

export const listarMovimentos = (produtoId = null) =>
  produtoId ? byIndex('movimentos', 'produtoId', produtoId) : getAll('movimentos');

/* ---------------- Vendas ---------------- */

export const listarVendas = () => getAll('vendas');
export const getVenda = (id) => getOne('vendas', id);
export const listarPagamentos = () => getAll('pagamentos');
export const pagamentosDaVenda = (vendaId) => byIndex('pagamentos', 'vendaId', vendaId);

export async function criarVenda(dados) {
  const {
    tipo = 'venda',
    clienteId = null,
    clienteNome = '',
    itens = [],
    desconto = 0,
    formaPagamento = 'pix',
    parcelas = 1,
    obs = '',
    data = hoje(),
    receberAgora = false,
    valorRecebido = null
  } = dados;

  if (!itens.length) throw new Error('Adicione ao menos um item.');

  const numero = await proximoNumero();

  const db = await openDB();
  const tx = db.transaction(['vendas', 'produtos', 'pagamentos', 'movimentos'], 'readwrite');
  const vs = tx.objectStore('vendas');
  const ps = tx.objectStore('produtos');
  const pgs = tx.objectStore('pagamentos');
  const mvs = tx.objectStore('movimentos');

  // valida/ Baixa estoque (somente vendas)
  if (tipo === 'venda') {
    for (const it of itens) {
      if (!it.produtoId) continue;
      const p = await req(ps.get(it.produtoId));
      if (!p) throw new Error(`Produto não encontrado: ${it.nome}`);
      if ((Number(p.estoque) || 0) < it.qtd) {
        throw new Error(`Estoque insuficiente para "${p.nome}" (disponível: ${p.estoque}).`);
      }
    }
  }

  const subtotal = round2(soma(itens, (i) => i.qtd * i.precoUnit));
  const descontoVal = round2(Math.min(Number(desconto) || 0, subtotal));
  const total = round2(subtotal - descontoVal);

  const listaParcelas = [];
  const nParc = Math.max(1, Math.min(24, Number(parcelas) || 1));
  if (tipo === 'venda' && nParc > 1) {
    const base = round2(total / nParc);
    for (let i = 0; i < nParc; i++) {
      const valor = i === nParc - 1 ? round2(total - base * (nParc - 1)) : base;
      listaParcelas.push({ n: i + 1, valor, vencimento: addDays(data, 30 * i) });
    }
  } else if (tipo === 'venda') {
    listaParcelas.push({ n: 1, valor: total, vencimento: data });
  }

  const venda = {
    id: uid('ven'),
    numero,
    tipo,
    clienteId,
    clienteNome: clienteNome || 'Consumidor final',
    data,
    hora: new Date().toTimeString().slice(0, 5),
    itens: itens.map((i) => ({
      produtoId: i.produtoId || null,
      codigo: i.codigo || '',
      nome: i.nome,
      categoria: i.categoria || '',
      qtd: Number(i.qtd),
      precoUnit: round2(i.precoUnit),
      custoUnit: round2(i.custoUnit || 0)
    })),
    subtotal,
    desconto: descontoVal,
    total,
    formaPagamento,
    parcelas: listaParcelas,
    obs,
    status: 'pendente',
    cancelada: false,
    criadoEm: Date.now()
  };

  if (tipo === 'venda') {
    for (const it of venda.itens) {
      if (!it.produtoId) continue;
      const p = await req(ps.get(it.produtoId));
      p.estoque = round2((Number(p.estoque) || 0) - it.qtd);
      p.atualizadoEm = Date.now();
      await req(ps.put(p));
      await req(mvs.put({
        id: uid('mov'),
        produtoId: it.produtoId,
        tipo: 'venda',
        qtd: it.qtd,
        estoqueApos: p.estoque,
        data,
        vendaId: venda.id,
        obs: `Venda #${numero}`,
        criadoEm: Date.now()
      }));
    }

    if (receberAgora) {
      let restante = valorRecebido === null ? total : round2(valorRecebido);
      for (const par of listaParcelas) {
        if (restante <= 0.005) break;
        const v = round2(Math.min(restante, par.valor));
        restante = round2(restante - v);
        await req(pgs.put({
          id: uid('pag'),
          vendaId: venda.id,
          parcela: par.n,
          valor: v,
          data,
          forma: formaPagamento,
          obs: 'Recebido na venda',
          criadoEm: Date.now()
        }));
      }
    }
  }

  await req(vs.put(venda));
  await txDone(tx);
  return venda;
}

function txDone(tx) {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error('Operação cancelada'));
  });
}

export async function registrarPagamento({ vendaId, valor, data = hoje(), forma = 'dinheiro', parcela = null, obs = '' }) {
  const venda = await getVenda(vendaId);
  if (!venda) throw new Error('Venda não encontrada.');
  const pags = await pagamentosDaVenda(vendaId);
  const pend = saldoVenda(venda, pags);
  const v = round2(valor);
  if (v <= 0) throw new Error('Informe um valor maior que zero.');
  if (v > pend + 0.005) throw new Error(`Valor acima do saldo devedor (${fmtMoney(pend)}).`);

  const abertas = parcelasEmAberto(venda, pags)
    .filter((p) => parcela === null || parcela === undefined || p.n === Number(parcela));
  if (!abertas.length) throw new Error('Não há parcelas em aberto selecionadas.');

  const criados = [];
  let restante = v;
  for (const p of abertas) {
    if (restante <= 0.005) break;
    const valorParc = round2(Math.min(restante, p.saldo));
    restante = round2(restante - valorParc);
    const pag = {
      id: uid('pag'),
      vendaId,
      parcela: p.n,
      valor: valorParc,
      data,
      forma,
      obs,
      criadoEm: Date.now()
    };
    await putOne('pagamentos', pag);
    criados.push(pag);
  }

  const totalPago = round2(soma(await pagamentosDaVenda(vendaId), (x) => x.valor));
  venda.status = venda.total - totalPago <= 0.005 ? 'pago' : totalPago > 0 ? 'parcial' : 'pendente';
  await putOne('vendas', venda);
  return criados;
}

export const excluirPagamento = (id) => delOne('pagamentos', id);

export async function cancelarVenda(vendaId, devolverEstoque = true) {
  const venda = await getVenda(vendaId);
  if (!venda) throw new Error('Venda não encontrada.');
  if (venda.cancelada) return venda;
  venda.cancelada = true;
  venda.status = 'cancelada';
  venda.canceladaEm = Date.now();
  if (devolverEstoque && venda.tipo === 'venda') {
    for (const it of venda.itens) {
      await registrarMovimento({
        produtoId: it.produtoId,
        tipo: 'devolucao',
        qtd: it.qtd,
        data: hoje(),
        vendaId,
        obs: `Cancelamento venda #${venda.numero}`
      });
    }
  }
  await putOne('vendas', venda);
  return venda;
}

export async function restaurarVenda(vendaId) {
  const venda = await getVenda(vendaId);
  if (!venda) throw new Error('Venda não encontrada.');
  venda.cancelada = false;
  venda.status = '';
  delete venda.canceladaEm;
  if (venda.tipo === 'venda') {
    for (const it of venda.itens) {
      await registrarMovimento({
        produtoId: it.produtoId,
        tipo: 'saida',
        qtd: it.qtd,
        data: hoje(),
        vendaId,
        obs: `Reativação venda #${venda.numero}`
      });
    }
  }
  await putOne('vendas', venda);
  return venda;
}

export async function excluirVenda(vendaId) {
  const venda = await getVenda(vendaId);
  if (!venda) return;
  if (!venda.cancelada && venda.tipo === 'venda') throw new Error('Cancele a venda antes de excluir.');
  const pgs = await pagamentosDaVenda(vendaId);
  for (const p of pgs) await delOne('pagamentos', p.id);
  await delOne('vendas', vendaId);
}

export async function atualizarVenda(vendaId, patch) {
  const venda = await getVenda(vendaId);
  if (!venda) throw new Error('Venda não encontrada.');
  const nova = { ...venda, ...patch, atualizadoEm: Date.now() };
  await putOne('vendas', nova);
  return nova;
}

export async function converterEmVenda(vendaId) {
  const venda = await getVenda(vendaId);
  if (!venda || venda.tipo !== 'orcamento') throw new Error('Orçamento não encontrado.');
  return criarVenda({
    ...venda,
    tipo: 'venda',
    itens: venda.itens,
    parcelas: (venda.parcelas && venda.parcelas.length) || 1,
    receberAgora: false
  }).then(async (nova) => {
    await excluirVenda(vendaId);
    return nova;
  });
}

/* ---------------- Derivações ---------------- */

export function pagoNaVenda(venda, pags) {
  return round2(soma(pags.filter((p) => p.vendaId === venda.id), (p) => p.valor));
}

export function saldoVenda(venda, pags) {
  if (!venda || venda.cancelada || venda.tipo === 'orcamento') return 0;
  const pag = pagoNaVenda(venda, pags || []);
  return round2(Math.max(0, venda.total - pag));
}

export function statusVenda(venda, pags) {
  if (venda.cancelada) return 'cancelada';
  if (venda.tipo === 'orcamento') return 'orcamento';
  const pag = pagoNaVenda(venda, pags || []);
  if (venda.total - pag <= 0.005) return 'pago';
  if (pag > 0) return 'parcial';
  return 'pendente';
}

export function parcelasEmAberto(venda, pags) {
  const lista = venda.parcelas?.length ? venda.parcelas : [{ n: 1, valor: venda.total, vencimento: venda.data }];
  const minhas = pags.filter((p) => p.vendaId === venda.id);
  return lista.map((p) => {
    const pago = round2(soma(minhas.filter((x) => (Number(x.parcela) || 1) === p.n), (x) => x.valor));
    return { ...p, pago: round2(pago), saldo: round2(Math.max(0, p.valor - pago)) };
  }).filter((p) => p.saldo > 0.005);
}

export async function resumoCliente(clienteId) {
  const vendas = (await listarVendas()).filter((v) => v.clienteId === clienteId && v.tipo === 'venda' && !v.cancelada);
  const pags = await listarPagamentos();
  const total = round2(soma(vendas, (v) => v.total));
  const pago = round2(soma(vendas, (v) => pagoNaVenda(v, pags)));
  return {
    compras: vendas.length,
    totalComprado: total,
    pago,
    divida: round2(Math.max(0, total - pago)),
    ultima: vendas.map((v) => v.data).sort().pop() || null
  };
}

export async function contasAReceber() {
  const vendas = (await listarVendas()).filter((v) => v.tipo === 'venda' && !v.cancelada);
  const pags = await listarPagamentos();
  const saida = [];
  for (const v of vendas) {
    const abertas = parcelasEmAberto(v, pags);
    for (const p of abertas) {
      saida.push({
        venda: v,
        parcela: p.n,
        totalParcelas: v.parcelas?.length || 1,
        valor: p.valor,
        saldo: p.saldo,
        vencimento: p.vencimento,
        atrasada: p.vencimento < hoje()
      });
    }
  }
  return saida.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
}

/* ---------------- Estatísticas ---------------- */

export async function indicadores() {
  const [vendas, pags, produtos, clientes] = await Promise.all([
    listarVendas(), listarPagamentos(), listarProdutos(), listarClientes()
  ]);
  const vVenda = vendas.filter((v) => v.tipo === 'venda' && !v.cancelada);
  const aReceber = round2(soma(vVenda, (v) => saldoVenda(v, pags)));
  const estoqueBaixo = produtos.filter((p) => p.ativo !== false && (Number(p.estoque) || 0) <= (Number(p.estoqueMinimo) || 0) && (Number(p.estoqueMinimo) || 0) > 0);
  const semEstoque = produtos.filter((p) => p.ativo !== false && (Number(p.estoque) || 0) <= 0);
  return {
    clientes: clientes.length,
    produtos: produtos.length,
    vendas: vVenda.length,
    aReceber,
    estoqueBaixo,
    semEstoque,
    pedidos: (await listarVendas()).filter((v) => v.tipo === 'orcamento').length
  };
}

/* ---------------- Busca ---------------- */

export async function buscarProduto(termo) {
  const t = termo.trim().toLowerCase();
  if (!t) return [];
  const todos = await listarProdutos();
  return todos
    .filter((p) => p.ativo !== false)
    .filter((p) =>
      (p.nome || '').toLowerCase().includes(t) ||
      (p.codigo || '').toLowerCase() === t ||
      (p.codigo || '').toLowerCase().includes(t) ||
      (p.categoria || '').toLowerCase().includes(t) ||
      (p.material || '').toLowerCase().includes(t)
    )
    .sort((a, b) => {
      const ea = (a.codigo || '').toLowerCase() === t ? 0 : 1;
      const eb = (b.codigo || '').toLowerCase() === t ? 0 : 1;
      return ea - eb || a.nome.localeCompare(b.nome, 'pt-BR');
    });
}

export async function buscarCliente(termo) {
  const t = termo.trim().toLowerCase();
  const todos = await listarClientes();
  if (!t) return todos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return todos.filter((c) =>
    (c.nome || '').toLowerCase().includes(t) ||
    (c.telefone || '').includes(t) ||
    (c.cpf || '').includes(t)
  );
}

/* ---------------- Backup ---------------- */

async function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

async function dataURLToBlob(durl) {
  const res = await fetch(durl);
  return res.blob();
}

export async function exportarBackup() {
  const [clientes, produtos, vendas, pagamentos, movimentos, config] = await Promise.all([
    getAll('clientes'), getAll('produtos'), getAll('vendas'),
    getAll('pagamentos'), getAll('movimentos'), getAll('config')
  ]);
  const prods = [];
  for (const p of produtos) {
    const clone = { ...p };
    if (clone.foto instanceof Blob) clone.foto = await blobToDataURL(clone.foto);
    clone.__fotoTipo = clone.foto ? 'dataurl' : null;
    prods.push(clone);
  }
  return {
    app: 'paula-controle',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    clientes, produtos: prods, vendas, pagamentos, movimentos, config
  };
}

export async function importarBackup(dados, { limpar = true } = {}) {
  if (!dados || dados.app !== 'paula-controle') throw new Error('Arquivo de backup inválido.');
  const db = await openDB();
  const nomes = ['clientes', 'produtos', 'vendas', 'pagamentos', 'movimentos', 'config'];
  const tx = db.transaction(nomes, 'readwrite');
  if (limpar) for (const n of nomes) tx.objectStore(n).clear();
  const prods = [];
  for (const p of dados.produtos || []) {
    const clone = { ...p };
    if (typeof clone.foto === 'string' && clone.foto.startsWith('data:')) clone.foto = await dataURLToBlob(clone.foto);
    prods.push(clone);
  }
  for (const c of dados.clientes || []) tx.objectStore('clientes').put(c);
  for (const p of prods) tx.objectStore('produtos').put(p);
  for (const v of dados.vendas || []) tx.objectStore('vendas').put(v);
  for (const p of dados.pagamentos || []) tx.objectStore('pagamentos').put(p);
  for (const m of dados.movimentos || []) tx.objectStore('movimentos').put(m);
  for (const c of dados.config || []) tx.objectStore('config').put(c);
  await txDone(tx);
}

export async function limparTudo() {
  const db = await openDB();
  const nomes = ['clientes', 'produtos', 'vendas', 'pagamentos', 'movimentos', 'config'];
  const tx = db.transaction(nomes, 'readwrite');
  for (const n of nomes) tx.objectStore(n).clear();
  await txDone(tx);
}

export { objUrl };
