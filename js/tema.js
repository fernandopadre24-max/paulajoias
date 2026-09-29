/* Tema claro/escuro — preferência local, aplicada antes do primeiro paint */
const CHAVE = 'paula-tema';
const META_PADRAO = { light: '#3a1844', dark: '#14101c' };

export function temaAtual() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function aplicarTema(tema) {
  const t = tema === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(CHAVE, t); } catch { /* ignora */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', META_PADRAO[t]);
  return t;
}

export function lerTemaSalvo() {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === 'dark' || v === 'light') return v;
  } catch { /* ignora */ }
  return 'light';
}

export function alternarTema() {
  return aplicarTema(temaAtual() === 'dark' ? 'light' : 'dark');
}

export const iconeTema = () => (temaAtual() === 'dark' ? '☀️' : '🌙');
export const rotuloTema = () => (temaAtual() === 'dark' ? 'Tema claro' : 'Tema escuro');
export const temaAplicado = () => (temaAtual() === 'dark' ? 'Tema escuro ativado' : 'Tema claro ativado');
