/* Agregações para relatórios */
import { round2, soma, hoje, addDays, fmtDateShort } from './utils.js';
import { saldoVenda, pagoNaVenda } from './db.js';

export function periodoPreset(preset) {
  const hj = hoje();
  switch (preset) {
    case 'hoje': return { de: hj, ate: hj, label: 'Hoje' };
    case '7': return { de: addDays(hj, -6), ate: hj, label: 'Últimos 7 dias' };
    case '30': return { de: addDays(hj, -29), ate: hj, label: 'Últimos 30 dias' };
    case 'mes': {
      const d = new Date();
      const de = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      return { de, ate: hj, label: 'Este mês' };
    }
    case 'mespassado': {
      const d = new Date();
      const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const de = `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-01`;
      const ate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      return { de, ate, label: 'Mês passado' };
    }
    case 'ano': return { de: `${new Date().getFullYear()}-01-01`, ate: hj, label: 'Este ano' };
    default: return { de: '', ate: '', label: 'Todo o período' };
  }
}

export function filtrarPorPeriodo(vendas, { de, ate }) {
  return vendas.filter((v) => (!de || v.data >= de) && (!ate || v.data <= ate));
}

export function resumo(vendas, pagamentos) {
  const validas = vendas.filter((v) => v.tipo === 'venda' && !v.cancelada);
  const faturamento = round2(soma(validas, (v) => v.total));
  const recebido = round2(soma(validas, (v) => pagoNaVenda(v, pagamentos)));
  const aReceber = round2(Math.max(0, faturamento - recebido));
  const custo = round2(soma(validas, (v) => soma(v.itens || [], (i) => i.qtd * (i.custoUnit || 0))));
  const desconto = round2(soma(validas, (v) => v.desconto || 0));
  const lucro = round2(faturamento - custo - desconto);
  const itens = soma(validas, (v) => soma(v.itens || [], (i) => i.qtd));
  return {
    faturamento,
    recebido,
    aReceber,
    custo,
    desconto,
    lucro,
    pedidos: validas.length,
    ticket: validas.length ? round2(faturamento / validas.length) : 0,
    itens: Math.round(itens),
    orcamentos: vendas.filter((v) => v.tipo === 'orcamento' && !v.cancelada).length,
    canceladas: vendas.filter((v) => v.cancelada).length
  };
}

export function serieDiaria(vendas, { de, ate }) {
  const validas = vendas.filter((v) => v.tipo === 'venda' && !v.cancelada);
  const mapa = new Map();
  const start = de || (validas.map((v) => v.data).sort()[0] || hoje());
  const end = ate || hoje();
  let d = start;
  let guard = 0;
  while (d <= end && guard++ < 400) {
    mapa.set(d, 0);
    d = addDays(d, 1);
  }
  for (const v of validas) {
    if (mapa.has(v.data)) mapa.set(v.data, round2(mapa.get(v.data) + v.total));
    else mapa.set(v.data, round2((mapa.get(v.data) || 0) + v.total));
  }
  return [...mapa.entries()].map(([data, total]) => ({ data, total }));
}

export function serieMensal(vendas, meses = 6) {
  const validas = vendas.filter((v) => v.tipo === 'venda' && !v.cancelada);
  const saida = [];
  const d = new Date();
  for (let i = meses - 1; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const chave = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const total = round2(soma(validas.filter((v) => (v.data || '').startsWith(chave)), (v) => v.total));
    saida.push({
      chave,
      label: dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      total
    });
  }
  return saida;
}

export function topProdutos(vendas, n = 10) {
  const mapa = new Map();
  for (const v of vendas) {
    if (v.tipo !== 'venda' || v.cancelada) continue;
    for (const i of v.itens || []) {
      const k = i.produtoId || i.nome;
      const cur = mapa.get(k) || { nome: i.nome, codigo: i.codigo, qtd: 0, total: 0, lucro: 0 };
      cur.qtd += i.qtd;
      cur.total = round2(cur.total + i.qtd * i.precoUnit);
      cur.lucro = round2(cur.lucro + i.qtd * (i.precoUnit - (i.custoUnit || 0)));
      mapa.set(k, cur);
    }
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, n);
}

export function topClientes(vendas, n = 10) {
  const mapa = new Map();
  for (const v of vendas) {
    if (v.tipo !== 'venda' || v.cancelada || !v.clienteId) continue;
    const cur = mapa.get(v.clienteId) || { id: v.clienteId, nome: v.clienteNome, compras: 0, total: 0 };
    cur.compras += 1;
    cur.total = round2(cur.total + v.total);
    mapa.set(v.clienteId, cur);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, n);
}

export function porForma(vendas, pagamentos) {
  const mapa = new Map();
  for (const p of pagamentos) {
    const v = vendas.find((x) => x.id === p.vendaId);
    if (!v || v.cancelada || v.tipo !== 'venda') continue;
    const k = p.forma || 'outro';
    mapa.set(k, round2((mapa.get(k) || 0) + p.valor));
  }
  return [...mapa.entries()]
    .map(([forma, total]) => ({ forma, total }))
    .sort((a, b) => b.total - a.total);
}

export function porCategoria(vendas) {
  const mapa = new Map();
  for (const v of vendas) {
    if (v.tipo !== 'venda' || v.cancelada) continue;
    for (const i of v.itens || []) {
      const k = i.categoria || i.produtoId;
      const cur = mapa.get(k) || { nome: i.categoria || 'Sem categoria', qtd: 0, total: 0 };
      cur.qtd += i.qtd;
      cur.total = round2(cur.total + i.qtd * i.precoUnit);
      mapa.set(k, cur);
    }
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export const LABELS_FORMA = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Cartão débito',
  credito: 'Cartão crédito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  combinar: 'A combinar',
  outro: 'Outro'
};

export function graficoBarras(dados, { gold = false, maxItens = 14 } = {}) {
  const lista = dados.length > maxItens
    ? dados.slice(Math.max(0, dados.length - maxItens))
    : dados;
  const max = Math.max(1, ...lista.map((d) => d.total));
  if (!lista.length) return '<p class="small muted text-center" style="padding:14px 0">Sem dados no período.</p>';
  return `<div class="bars">
    ${lista.map((d) => {
      const h = Math.max(4, Math.round((d.total / max) * 100));
      const compacto = d.total >= 1000 ? `${(d.total / 1000).toFixed(1)}k` : Math.round(d.total);
      return `
        <div class="bar-col">
          <span class="bar-val">${d.total > 0 ? compacto : ''}</span>
          <div class="bar-fill ${gold ? 'gold' : ''}" style="height:${h}%" title="${d.total}"></div>
          <span class="bar-lab">${d.label || fmtDateShort(d.data)}</span>
        </div>`;
    }).join('')}
  </div>`;
}

export function listaRanking(itens, { formato = 'total' } = {}) {
  if (!itens.length) return '<p class="small muted text-center" style="padding:14px 0">Sem dados no período.</p>';
  const max = Math.max(...itens.map((i) => i[formato] || 0), 1);
  return `<div class="rank">
    ${itens.map((it, idx) => `
      <div class="rank-row">
        <span class="rank-pos ${idx === 0 ? 'top' : ''}">${idx + 1}</span>
        <div class="grow">
          <div class="item-title" style="font-size:14.5px">${it.nome}</div>
          <div class="tiny muted">${it.qtd !== undefined ? `${it.qtd} un.` : `${it.compras || 0} compras`}${it.lucro ? ` · lucro ${it.lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}</div>
          <div class="hbar"><i style="width:${Math.max(3, Math.round(((it[formato] || 0) / max) * 100))}%"></i></div>
        </div>
        <div class="text-right nowrap">
          <div class="strong mono">${(it[formato] || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

export { saldoVenda };
