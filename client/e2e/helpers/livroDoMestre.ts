import type { Locator, Page } from '@playwright/test'

/*
 * O LIVRO DO MESTRE (fatia 2 do design consolidado): a coluna da esquerda virou
 * um livro com quatro páginas (Ficha, Cena, Aventura, Acervo) atrás dos
 * marcadores da lombada, e a antiga barra "Ações do mapa" virou o topo dele,
 * com Abrir, Importar/Exportar, Imagem de fundo e "Voltar ao início" no menu
 * Arquivo. Estes atalhos dão às jornadas o caminho novo sem mudar o que elas
 * provam.
 */

export type PaginaDoLivro = 'Ficha' | 'Cena' | 'Aventura' | 'Acervo'

/** O livro inteiro: lombada, topo e a página aberta. */
export function livroDoMestre(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Livro do mestre' })
}

/** Abre a página pelo marcador da lombada (clicar na que já está aberta não muda nada). */
export async function abrirPaginaDoLivro(page: Page, pagina: PaginaDoLivro): Promise<void> {
  await livroDoMestre(page).getByRole('tab', { name: pagina, exact: true }).click()
}

/** Abre o menu Arquivo do topo do livro e escolhe o item ("Voltar ao início", "Abrir…"). */
export async function escolherNoArquivo(page: Page, item: string): Promise<void> {
  await livroDoMestre(page).getByRole('button', { name: 'Arquivo', exact: true }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

/**
 * Abre a ficha recolhível "No mapa" da ficha do token (fatia 9: nasce fechada,
 * como no protótipo), onde moram Trava, Tamanho, Cor e Imagem. A escolha fica
 * lembrada, então chamar com ela já aberta não faz nada.
 */
export async function abrirNoMapa(page: Page): Promise<void> {
  const cabecalho = page.getByRole('button', { name: /^No mapa/ })
  if ((await cabecalho.getAttribute('aria-expanded')) !== 'true') await cabecalho.click()
}
