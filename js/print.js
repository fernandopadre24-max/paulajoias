/* Impressão e compartilhamento de recibos */
import { fmtMoney, fmtDate, esc, hoje } from './utils.js';
import { cfg, pagamentosDaVenda, pagoNaVenda, statusVenda } from './db.js';
import { LABELS_FORMA } from './report.js';

async function cabecalho() {
  const empresa = (await cfg('empresa', 'Paula · Bijuterias e Joias')) || 'Paula · Bijuterias e Joias';
  const fone = (await cfg('telefone', '')) || '';
  const rodape = (await cfg('rodape', '')) || '';
  return { empresa, fone, rodape };
}

function linha(k, v) {
  return `<tr><td>${esc(k)}</td><td class="pr">${esc(v)}</td></tr>`;
}

export async function montarRecibo(venda, pags = null) {
  const { empresa, fone, rodape } = await cabecalho();
  const pagsDa = pags || (await pagamentosDaVenda(venda.id));
  const pago = pagoNaVenda(venda, pagsDa);
  const status = statusVenda(venda, pagsDa);
  const itens = (venda.itens || []).map((i) => `
    <tr>
      <td>${i.qtd}x ${esc(i.nome)}</td>
      <td class="pr">${fmtMoney(i.qtd * i.precoUnit)}</td>
    </tr>`).join('');

  const parcelas = (venda.parcelas || []).length > 1
    ? `<tr><td>Parcelamento</td><td class="pr">${venda.parcelas.length}x de ${fmtMoney(venda.total / venda.parcelas.length)}</td></tr>`
    : '';

  return `
    <h1>${esc(empresa)}</h1>
    <div class="pc">${fone ? esc(fone) + '<br>' : ''}Comprovante de venda</div>
    <hr>
    <table>
      ${linha('Venda', `#${venda.numero}`)}
      ${linha('Data', `${fmtDate(venda.data)} ${venda.hora || ''}`)}
      ${linha('Cliente', venda.clienteNome || 'Consumidor final')}
    </table>
    <hr>
    <table>${itens}</table>
    <hr>
    <table>
      ${linha('Subtotal', fmtMoney(venda.subtotal))}
      ${venda.desconto ? linha('Desconto', `- ${fmtMoney(venda.desconto)}`) : ''}
      ${parcelas}
      <tr class="tot"><td>TOTAL</td><td class="pr tot">${fmtMoney(venda.total)}</td></tr>
      ${linha('Forma', LABELS_FORMA[venda.formaPagamento] || venda.formaPagamento || '—')}
      ${pago > 0 ? linha('Pago', fmtMoney(pago)) : ''}
      ${status !== 'pago' && status !== 'orcamento' ? linha('Pendente', fmtMoney(venda.total - pago)) : ''}
    </table>
    <hr>
    <div class="pc">${rodape ? `${esc(rodape)}<br>` : ''}Obrigado pela preferência!<br>Volte sempre ✨</div>`;
}

export async function imprimirRecibo(venda) {
  const html = await montarRecibo(venda);
  let area = document.querySelector('.print-area');
  if (!area) {
    area = document.createElement('div');
    area.className = 'print-area';
    document.body.appendChild(area);
  }
  area.innerHTML = html;
  window.print();
}

export async function compartilharRecibo(venda) {
  const { empresa } = await cabecalho();
  const texto = [
    `${empresa}`,
    `Venda #${venda.numero} — ${fmtDate(venda.data)}`,
    `Cliente: ${venda.clienteNome || 'Consumidor final'}`,
    '',
    ...(venda.itens || []).map((i) => `${i.qtd}x ${i.nome} — ${fmtMoney(i.qtd * i.precoUnit)}`),
    '',
    `TOTAL: ${fmtMoney(venda.total)}`,
    `Forma: ${LABELS_FORMA[venda.formaPagamento] || venda.formaPagamento}`,
    '',
    'Obrigado pela preferência!'
  ].join('\n');

  if (navigator.share) {
    try {
      await navigator.share({ title: `Venda #${venda.numero}`, text: texto });
      return true;
    } catch {
      /* cancelado */
    }
  }
  await navigator.clipboard?.writeText(texto);
  return false;
}
