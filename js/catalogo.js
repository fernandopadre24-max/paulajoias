/* Catálogo real de bijuterias — preços de custo e venda praticados no varejo */
import { uid } from './utils.js';
import { substituirProdutos } from './db.js';
import { fotoProduto, CORES, emojiPorCategoria } from './fotos.js';

const F1 = 'Atacado Beira Rio';
const F2 = 'Importadora Central';
const F3 = 'Bijuterias Vitória';
const F4 = 'Atacado Ouro Preto';

export const CATALOGO = [
  /* ---------------- Anéis ---------------- */
  { nome: 'Anel zircônia 4mm banho dourado', codigo: 'AN-001', categoria: 'Anel', material: 'Banho dourado', pedra: 'Zircônia', cor: 'Dourado', peso: 2.5, precoCusto: 9.9, precoVenda: 27.9, estoque: 12, estoqueMinimo: 3, fornecedor: F1 },
  { nome: 'Anel aliança lisa banho dourado', codigo: 'AN-002', categoria: 'Anel', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 3.1, precoCusto: 11.5, precoVenda: 32.9, estoque: 15, estoqueMinimo: 3, fornecedor: F1 },
  { nome: 'Anel aliança banho ródio', codigo: 'AN-003', categoria: 'Anel', material: 'Banho ródio', pedra: '—', cor: 'Prata', peso: 3, precoCusto: 11.5, precoVenda: 32.9, estoque: 10, estoqueMinimo: 3, fornecedor: F1 },
  { nome: 'Anel argola cruzado dourado', codigo: 'AN-004', categoria: 'Anel', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 3.8, precoCusto: 13, precoVenda: 36.9, estoque: 9, estoqueMinimo: 2, fornecedor: F2 },
  { nome: 'Anel folha com pedra colorida', codigo: 'AN-005', categoria: 'Anel', material: 'Banho dourado', pedra: 'Cristal', cor: 'Dourado', peso: 4.2, precoCusto: 14.9, precoVenda: 39.9, estoque: 8, estoqueMinimo: 2, fornecedor: F2 },
  { nome: 'Anel solitário dupla zircônia', codigo: 'AN-006', categoria: 'Anel', material: 'Banho dourado', pedra: 'Zircônia', cor: 'Dourado', peso: 4.6, precoCusto: 16, precoVenda: 44.9, estoque: 7, estoqueMinimo: 2, fornecedor: F3 },
  { nome: 'Kit 3 anéis finos dourados', codigo: 'AN-007', categoria: 'Anel', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 5.4, precoCusto: 18, precoVenda: 49.9, estoque: 6, estoqueMinimo: 2, fornecedor: F3 },

  /* ---------------- Correntes ---------------- */
  { nome: 'Corrente folha de ouro 1mm 45cm', codigo: 'CO-001', categoria: 'Corrente', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 2.6, precoCusto: 21, precoVenda: 59.9, estoque: 10, estoqueMinimo: 3, fornecedor: F1 },
  { nome: 'Corrente veneziana 0,8mm 50cm', codigo: 'CO-002', categoria: 'Corrente', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 2.9, precoCusto: 18.5, precoVenda: 52.9, estoque: 12, estoqueMinimo: 3, fornecedor: F1 },
  { nome: 'Corrente gourmet 1,2mm 50cm', codigo: 'CO-003', categoria: 'Corrente', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 4.5, precoCusto: 27, precoVenda: 74.9, estoque: 8, estoqueMinimo: 2, fornecedor: F2 },
  { nome: 'Corrente cubana 3mm 60cm', codigo: 'CO-004', categoria: 'Corrente', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 8.4, precoCusto: 34, precoVenda: 94.9, estoque: 6, estoqueMinimo: 2, fornecedor: F2 },
  { nome: 'Corrente malha italiana 1,1mm 50cm', codigo: 'CO-005', categoria: 'Corrente', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 5.2, precoCusto: 30, precoVenda: 84.9, estoque: 7, estoqueMinimo: 2, fornecedor: F3 },
  { nome: 'Corrente moeda dourada 45cm', codigo: 'CO-006', categoria: 'Corrente', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 4.8, precoCusto: 23, precoVenda: 64.9, estoque: 9, estoqueMinimo: 2, fornecedor: F3 },
  { nome: 'Corrente banho ródio fina 40cm', codigo: 'CO-007', categoria: 'Corrente', material: 'Banho ródio', pedra: '—', cor: 'Prata', peso: 2.1, precoCusto: 15, precoVenda: 42.9, estoque: 11, estoqueMinimo: 3, fornecedor: F1 },
  { nome: 'Corrente folha grossa 55cm banho 18k', codigo: 'CO-008', categoria: 'Corrente', material: 'Banho dourado 18k', pedra: '—', cor: 'Dourado', peso: 9.6, precoCusto: 38, precoVenda: 109.9, estoque: 2, estoqueMinimo: 3, fornecedor: F4 },
  { nome: 'Corrente banho rosé 45cm', codigo: 'CO-009', categoria: 'Corrente', material: 'Banho rosé', pedra: '—', cor: 'Rosé', peso: 2.7, precoCusto: 19.5, precoVenda: 54.9, estoque: 8, estoqueMinimo: 2, fornecedor: F4 },

  /* ---------------- Brincos ---------------- */
  { nome: 'Brincos argola 12mm dourados', codigo: 'BR-001', categoria: 'Brincos', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 2, precoCusto: 7, precoVenda: 19.9, estoque: 20, estoqueMinimo: 5, fornecedor: F1 },
  { nome: 'Brincos argola 30mm dourados', codigo: 'BR-002', categoria: 'Brincos', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 4.4, precoCusto: 12.5, precoVenda: 34.9, estoque: 12, estoqueMinimo: 4, fornecedor: F1 },
  { nome: 'Brincos gota de cristal', codigo: 'BR-003', categoria: 'Brincos', material: 'Banho dourado', pedra: 'Cristal', cor: 'Dourado', peso: 3.2, precoCusto: 9.5, precoVenda: 26.9, estoque: 14, estoqueMinimo: 4, fornecedor: F2 },
  { nome: 'Brincos estrela com zircônia', codigo: 'BR-004', categoria: 'Brincos', material: 'Banho dourado', pedra: 'Zircônia', cor: 'Dourado', peso: 2.8, precoCusto: 11, precoVenda: 31.9, estoque: 10, estoqueMinimo: 3, fornecedor: F2 },
  { nome: 'Brincos coração banho ouro', codigo: 'BR-005', categoria: 'Brincos', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 2.4, precoCusto: 8.5, precoVenda: 24.9, estoque: 16, estoqueMinimo: 4, fornecedor: F3 },
  { nome: 'Brincos aro duplo prata', codigo: 'BR-006', categoria: 'Brincos', material: 'Banho ródio', pedra: '—', cor: 'Prata', peso: 3.6, precoCusto: 10, precoVenda: 29.9, estoque: 9, estoqueMinimo: 3, fornecedor: F3 },
  { nome: 'Brincos argola rosé', codigo: 'BR-007', categoria: 'Brincos', material: 'Banho rosé', pedra: '—', cor: 'Rosé', peso: 2.2, precoCusto: 8, precoVenda: 23.9, estoque: 13, estoqueMinimo: 4, fornecedor: F4 },
  { nome: 'Brincos pendente cruz', codigo: 'BR-008', categoria: 'Brincos', material: 'Banho dourado', pedra: 'Zircônia', cor: 'Dourado', peso: 3, precoCusto: 9, precoVenda: 27.9, estoque: 8, estoqueMinimo: 3, fornecedor: F4 },

  /* ---------------- Pulseiras ---------------- */
  { nome: 'Pulseira corrente fina 18cm', codigo: 'PU-001', categoria: 'Pulseira', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 2.4, precoCusto: 12, precoVenda: 34.9, estoque: 14, estoqueMinimo: 4, fornecedor: F1 },
  { nome: 'Pulseira elos cubanos dourada', codigo: 'PU-002', categoria: 'Pulseira', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 6.5, precoCusto: 19, precoVenda: 52.9, estoque: 9, estoqueMinimo: 3, fornecedor: F2 },
  { nome: 'Pulseira miss angola', codigo: 'PU-003', categoria: 'Pulseira', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 5.8, precoCusto: 17, precoVenda: 47.9, estoque: 10, estoqueMinimo: 3, fornecedor: F2 },
  { nome: 'Pulseira balangandã com pingentes', codigo: 'PU-004', categoria: 'Pulseira', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 12.4, precoCusto: 33, precoVenda: 94.9, estoque: 5, estoqueMinimo: 2, fornecedor: F3 },
  { nome: 'Pulseira fita com presilha', codigo: 'PU-005', categoria: 'Pulseira', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 1.8, precoCusto: 8.5, precoVenda: 24.9, estoque: 12, estoqueMinimo: 4, fornecedor: F3 },
  { nome: 'Pulseira aço inox feminina', codigo: 'PU-006', categoria: 'Pulseira', material: 'Aço inox', pedra: '—', cor: 'Prata', peso: 7.2, precoCusto: 22, precoVenda: 59.9, estoque: 8, estoqueMinimo: 2, fornecedor: F4 },
  { nome: 'Pulseira miçangas de cristal', codigo: 'PU-007', categoria: 'Pulseira', material: 'Banho dourado', pedra: 'Cristal', cor: 'Dourado', peso: 8.1, precoCusto: 14, precoVenda: 39.9, estoque: 1, estoqueMinimo: 2, fornecedor: F4 },
  { nome: 'Pulseira banho ródio folha', codigo: 'PU-008', categoria: 'Pulseira', material: 'Banho ródio', pedra: '—', cor: 'Prata', peso: 4.6, precoCusto: 16.5, precoVenda: 46.9, estoque: 7, estoqueMinimo: 2, fornecedor: F1 },

  /* ---------------- Pingentes e conjuntos ---------------- */
  { nome: 'Pingente coração liso', codigo: 'PI-001', categoria: 'Pingente', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 3.4, precoCusto: 8, precoVenda: 23.9, estoque: 15, estoqueMinimo: 4, fornecedor: F1 },
  { nome: 'Pingente cruz com zircônias', codigo: 'PI-002', categoria: 'Pingente', material: 'Banho dourado', pedra: 'Zircônia', cor: 'Dourado', peso: 4.7, precoCusto: 15, precoVenda: 42.9, estoque: 8, estoqueMinimo: 2, fornecedor: F2 },
  { nome: 'Pingente nome (com gravação)', codigo: 'PI-003', categoria: 'Pingente', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 5.2, precoCusto: 14, precoVenda: 45, estoque: 6, estoqueMinimo: 2, fornecedor: F3, obs: 'Preço base até 7 letras; cobrar adicional por letra extra.' },
  { nome: 'Pingente chave dourada', codigo: 'PI-004', categoria: 'Pingente', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 3.9, precoCusto: 11, precoVenda: 32.9, estoque: 9, estoqueMinimo: 3, fornecedor: F3 },
  { nome: 'Pingente ampulheta', codigo: 'PI-005', categoria: 'Pingente', material: 'Banho dourado', pedra: 'Vidro', cor: 'Dourado', peso: 4.1, precoCusto: 10.5, precoVenda: 30.9, estoque: 7, estoqueMinimo: 2, fornecedor: F4 },
  { nome: 'Conjunto colar + brinco coração', codigo: 'CJ-001', categoria: 'Conjunto', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 9.8, precoCusto: 24, precoVenda: 69.9, estoque: 6, estoqueMinimo: 2, fornecedor: F2 },
  { nome: 'Conjunto corrente + pingente estrela', codigo: 'CJ-002', categoria: 'Conjunto', material: 'Banho dourado', pedra: 'Zircônia', cor: 'Dourado', peso: 10.6, precoCusto: 26, precoVenda: 74.9, estoque: 2, estoqueMinimo: 3, fornecedor: F2 },

  /* ---------------- Relógios ---------------- */
  { nome: 'Relógio feminino dourado', codigo: 'RE-001', categoria: 'Relógio', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 48, precoCusto: 56, precoVenda: 149.9, estoque: 6, estoqueMinimo: 2, fornecedor: F4 },
  { nome: 'Relógio feminino prata', codigo: 'RE-002', categoria: 'Relógio', material: 'Aço inox', pedra: '—', cor: 'Prata', peso: 52, precoCusto: 58, precoVenda: 159.9, estoque: 5, estoqueMinimo: 2, fornecedor: F4 },
  { nome: 'Relógio masculino aço inox', codigo: 'RE-003', categoria: 'Relógio', material: 'Aço inox', pedra: '—', cor: 'Prata', peso: 86, precoCusto: 64, precoVenda: 179.9, estoque: 5, estoqueMinimo: 2, fornecedor: F4 },

  /* ---------------- Acessórios ---------------- */
  { nome: 'Tornozeleira corrente fina', codigo: 'AC-001', categoria: 'Acessório', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 3.6, precoCusto: 8, precoVenda: 24.9, estoque: 12, estoqueMinimo: 4, fornecedor: F1 },
  { nome: 'Broche borboleta', codigo: 'AC-002', categoria: 'Acessório', material: 'Banho dourado', pedra: 'Zircônia', cor: 'Dourado', peso: 6.2, precoCusto: 7.5, precoVenda: 22.9, estoque: 10, estoqueMinimo: 3, fornecedor: F3 },
  { nome: 'Fivela de cinto dourada', codigo: 'AC-003', categoria: 'Acessório', material: 'Banho dourado', pedra: '—', cor: 'Dourado', peso: 24, precoCusto: 13, precoVenda: 37.9, estoque: 7, estoqueMinimo: 2, fornecedor: F3 },
  { nome: 'Brinco argola triangulo orelha', codigo: 'AC-004', categoria: 'Acessório', material: 'Banho ródio', pedra: '—', cor: 'Prata', peso: 1.9, precoCusto: 6.5, precoVenda: 19.9, estoque: 15, estoqueMinimo: 4, fornecedor: F1 },
  { nome: 'Presilha de cabelo banho dourado', codigo: 'AC-005', categoria: 'Acessório', material: 'Banho dourado', pedra: 'Cristal', cor: 'Dourado', peso: 5.5, precoCusto: 9, precoVenda: 26.9, estoque: 11, estoqueMinimo: 3, fornecedor: F2 }
];

export async function carregarCatalogo({ limpar = true } = {}) {
  const agora = Date.now();
  const produtos = [];
  for (let i = 0; i < CATALOGO.length; i++) {
    const c = CATALOGO[i];
    const [cor1, cor2] = CORES[i % CORES.length];
    produtos.push({
      id: uid('prd'),
      nome: c.nome,
      codigo: c.codigo,
      categoria: c.categoria,
      material: c.material,
      pedra: c.pedra,
      cor: c.cor,
      peso: c.peso,
      precoCusto: c.precoCusto,
      precoVenda: c.precoVenda,
      estoque: c.estoque,
      estoqueMinimo: c.estoqueMinimo,
      fornecedor: c.fornecedor,
      obs: c.obs || '',
      foto: await fotoProduto(emojiPorCategoria(c.categoria), cor1, cor2),
      ativo: true,
      criadoEm: agora + i,
      atualizadoEm: agora
    });
  }
  await substituirProdutos(produtos, { limpar });
  return produtos.length;
}
