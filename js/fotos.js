/* Geração de fotos ilustrativas para produtos sem foto real */
export function fotoProduto(emoji, cor1, cor2, tamanho = 480) {
  return new Promise((resolve) => {
    try {
      const c = document.createElement('canvas');
      c.width = tamanho;
      c.height = tamanho;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, tamanho, tamanho);
      g.addColorStop(0, cor1);
      g.addColorStop(1, cor2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tamanho, tamanho);

      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tamanho * 0.25, tamanho * 0.23, tamanho * 0.31, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tamanho * 0.85, tamanho * 0.88, tamanho * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.font = `${Math.round(tamanho * 0.5)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, tamanho / 2, tamanho * 0.52);

      c.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    } catch {
      resolve(null);
    }
  });
}

export const CORES = [
  ['#f6d365', '#fda085'],
  ['#a1c4fd', '#c2e9fb'],
  ['#fbc2eb', '#a6c1ee'],
  ['#84fab0', '#8fd3f4'],
  ['#fccb90', '#d57eeb'],
  ['#e0c3fc', '#8ec5fc'],
  ['#f093fb', '#f5576c'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#30cfd0', '#330867'],
  ['#ff9a9e', '#fecfef'],
  ['#4facfe', '#00f2fe']
];

export const EMOJI_CATEGORIA = {
  anel: '💍',
  corrente: '📿',
  brincos: '✨',
  pulseira: '⏱️',
  pingente: '💎',
  conjuto: '🎁',
  conjunto: '🎁',
  relgio: '⌚',
  relógio: '⌚',
  acessrio: '🎀',
  acessório: '🎀'
};

export function emojiPorCategoria(categoria) {
  const chave = String(categoria || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return EMOJI_CATEGORIA[chave] || '💍';
}
