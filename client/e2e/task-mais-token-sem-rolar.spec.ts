// "+ TOKEN" À MÃO SEM ROLAR (pedido painel-acervo, correção depois da
// conferência de 01/10/2026). Com um token selecionado, a ficha dele enche a
// coluna, e o único "Adicionar token" morava no título do Acervo, no pé dela:
// a conferência o mediu em y=2156, com o corpo visível só até y=681. E, criado
// o token, o foco caía no body. Agora o "+ Token" mora no cabeçalho do painel,
// fora do corpo que rola.
//
// Prova no navegador de verdade o que o jsdom não mede (lá não há layout nem
// rolagem): o botão está inteiro na janela e na frente de tudo sem rolar nada,
// com a coluna no topo e rolada até o Acervo; o campo que ele abre aparece
// abaixo da faixa grudada, e não atrás dela; e o foco volta para o botão
// depois de criar.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

async function mapaVazio(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_mais_token', 'E2E Mais token', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function nomesDosTokens(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.tokens.map((token) => token.name)
  })
}

function rolagemDaColuna(page: Page): Promise<number> {
  return page.locator('.lb-inspector__body').evaluate((corpo) => corpo.scrollTop)
}

/**
 * O centro do elemento é dele na tela: nada desenhado por cima (a faixa
 * grudada no topo do corpo, um balão). `toBeInViewport` não vê isso — ele mede
 * só o recorte pela janela e pelas caixas que rolam.
 */
function naFrente(alvo: Locator): Promise<boolean> {
  return alvo.evaluate((elemento) => {
    const caixa = elemento.getBoundingClientRect()
    const topo = document.elementFromPoint(caixa.left + caixa.width / 2, caixa.top + caixa.height / 2)
    return topo !== null && elemento.contains(topo)
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await mapaVazio(page)
})

test('com a ficha de um token aberta, o "+ Token" está na tela sem rolar, e criar devolve o foco a ele', async ({ page }) => {
  const maisToken = page.getByRole('button', { name: 'Adicionar token' })
  const campo = page.getByRole('textbox', { name: 'Nome do novo token' })
  const nomeNaFicha = page.locator('#lb-token-name')

  // Sem nada selecionado: abrir, aceitar o nome sugerido com Enter.
  await maisToken.click()
  await expect(campo).toBeFocused()
  await campo.press('Enter')
  await expect.poll(() => nomesDosTokens(page)).toEqual(['Token 1'])
  await expect(nomeNaFicha).toHaveValue('Token 1')
  // O campo saiu e a faixa vazia deu lugar à do token: o foco não cai no body.
  await expect(maisToken).toBeFocused()
  // A ficha aberta passa da altura da janela, e o botão continua inteiro à vista.
  await expect(maisToken).toBeInViewport({ ratio: 1 })
  expect(await naFrente(maisToken)).toBe(true)

  // A coluna rolada até o Acervo, no pé dela, com a roda do mouse.
  await page.locator('.lb-inspector__body').hover()
  await page.mouse.wheel(0, 5000)
  await expect(page.getByRole('heading', { name: 'Acervo de tokens', exact: true })).toBeInViewport()
  await expect.poll(() => rolagemDaColuna(page)).toBeGreaterThan(0)
  await expect(maisToken).toBeInViewport({ ratio: 1 })
  expect(await naFrente(maisToken)).toBe(true)

  // Criar o segundo dali: o campo nasce no topo do corpo e vem para a vista,
  // abaixo da faixa do token (não escondido atrás dela).
  await maisToken.click()
  await expect(campo).toBeFocused()
  await expect(campo).toHaveValue('Token 2')
  await expect(campo).toBeInViewport({ ratio: 1 })
  expect(await naFrente(campo)).toBe(true)
  await campo.press('Enter')
  await expect.poll(() => nomesDosTokens(page)).toEqual(['Token 1', 'Token 2'])
  // A ficha do token novo nasce no topo da coluna: a coluna volta para lá.
  await expect(nomeNaFicha).toHaveValue('Token 2')
  await expect.poll(() => rolagemDaColuna(page)).toBe(0)
  await expect(maisToken).toBeFocused()
})
