// JORNADA DO PINO QUE NÃO SAI — escrita para SAIR VERMELHA antes do conserto.
//
// Pedido do usuário, nas palavras dele: "e o pino, eu consigo colocar, não
// consigo tirar".
//
// O que estava acontecendo: o pino de ponto de interesse vive fora de
// `selection` (tem estado próprio, `selectedPinId`, em `src/stores/mapStore.ts`),
// e `removeSelected` — o que Delete e Backspace chamam — só olha `selection`.
// O pino só saía por "Excluir ponto de interesse", no fim do painel lateral.
// Quem não achou o botão ficou com o pino cravado no mapa.
//
// COMO ELA PROVA. Gesto de ponteiro e de teclado de verdade, e asserção no
// PIXEL do canvas: fotografa o recorte ao redor do ponto antes de cravar,
// depois de cravar e depois do Delete. Com o pino apagado, a terceira foto
// volta a ser igual à primeira.
//
// CONTROLE NEGATIVO: a tela parada não muda sozinha (duas fotos iguais antes
// do gesto), senão "mudou depois do clique" não provaria nada.
// CONTROLE POSITIVO: a segunda foto É diferente da primeira — o pino de fato
// apareceu. Sem isso, um mapa que nunca desenhou nada passaria no teste.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Folga para o Pixi terminar de pintar antes de fotografar (mesmo valor das jornadas irmãs). */
const PINTURA_MS = 400
/** Botão parado antes de soltar: toque de dedo humano. */
const TOQUE_MS = 120
/** Nome de pino: a barra pode chamar de "Pino" ou "Ponto de interesse"; os dois servem. */
const NOME_DA_FERRAMENTA = /pino|ponto de interesse/i

async function tocarComoPessoa(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/** Todo nome acessível de controle na tela — só para a mensagem de falha ajudar quem implementa. */
async function nomesDeControleNaTela(page: Page): Promise<string[]> {
  return page
    .locator('button, [role="radio"], [role="menuitemradio"], [role="checkbox"], [role="tab"]')
    .evaluateAll((elementos) =>
      elementos.map((elemento) => elemento.getAttribute('aria-label') ?? elemento.textContent?.trim() ?? '').filter((nome) => nome !== ''),
    )
}

async function controlePorNome(page: Page, nome: RegExp, oQueEra: string): Promise<Locator> {
  const alvo = page
    .getByRole('button', { name: nome })
    .or(page.getByRole('radio', { name: nome }))
    .or(page.getByRole('menuitemradio', { name: nome }))
    .or(page.getByRole('checkbox', { name: nome }))
    .or(page.getByRole('tab', { name: nome }))
  const quantos = await alvo.count()
  if (quantos === 0) {
    const existentes = await nomesDeControleNaTela(page)
    expect(quantos, `${oQueEra}: nenhum controle com nome ${String(nome)} na tela. O que a tela oferece hoje: ${existentes.join(' | ')}`).toBeGreaterThan(0)
  }
  return alvo.first()
}

async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

function recorteAoRedor(ponto: { x: number; y: number }): { x: number; y: number; width: number; height: number } {
  return { x: ponto.x - 40, y: ponto.y - 40, width: 80, height: 80 }
}

/** Quantos pinos o mapa guarda. LEITURA da store, nunca escrita. */
async function quantosPinos(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const mapa = mod.useMapStore.getState().map as { pins?: unknown[] }
    return mapa.pins?.length ?? 0
  })
}

for (const tecla of ['Delete', 'Backspace']) {
  test(`o mestre crava um pino e ${tecla} tira o pino do mapa`, async ({ page }) => {
    test.setTimeout(90_000)
    const erros: string[] = []
    page.on('pageerror', (e) => erros.push(e.message))

    await enterEditor(page)
    const ferramenta = await controlePorNome(page, NOME_DA_FERRAMENTA, 'ferramenta de pino na barra do mestre')
    await ferramenta.click()

    const caixa = await caixaDoCanvas(page)
    const alvo = { x: caixa.x + 560, y: caixa.y + 360 }

    await page.waitForTimeout(PINTURA_MS)
    const semPino = await page.screenshot({ clip: recorteAoRedor(alvo) })
    await page.waitForTimeout(PINTURA_MS)
    const aindaSemPino = await page.screenshot({ clip: recorteAoRedor(alvo) })
    expect(semPino.equals(aindaSemPino), 'a tela do mestre muda sozinha parada: nenhuma foto antes/depois provaria o gesto').toBe(true)

    await tocarComoPessoa(page, alvo.x, alvo.y)
    await page.waitForTimeout(PINTURA_MS)
    const comPino = await page.screenshot({ clip: recorteAoRedor(alvo) })
    expect(comPino.equals(semPino), 'controle positivo: o clique com a ferramenta de Pino não desenhou nada onde o mestre clicou').toBe(false)
    expect(await quantosPinos(page), 'o mapa deveria ter um pino depois do clique').toBe(1)

    await page.keyboard.press(tecla)
    await page.waitForTimeout(PINTURA_MS)

    expect(await quantosPinos(page), `${tecla} não tirou o pino do mapa: ele continua lá depois da tecla`).toBe(0)
    const depoisDeApagar = await page.screenshot({ clip: recorteAoRedor(alvo) })
    expect(depoisDeApagar.equals(semPino), `${tecla} deixou desenho no lugar do pino: a tela não voltou ao que era antes do clique`).toBe(true)

    expect(erros, 'a tela do mestre jogou erro ao apagar o pino').toEqual([])
  })
}

// O outro lado da mesma moeda. O pino tem estado de seleção próprio, que
// `setSelection` preserva de propósito: Esc largava a seleção comum e deixava o
// pino selecionado calado. Minutos depois, um Delete que o mestre achava que
// não tinha alvo apagava o pino. "Deixa pra lá" tem de valer para ele também.
test('depois de Esc, Delete não apaga o pino que o mestre largou', async ({ page }) => {
  test.setTimeout(90_000)
  await enterEditor(page)
  const ferramenta = await controlePorNome(page, NOME_DA_FERRAMENTA, 'ferramenta de pino na barra do mestre')
  await ferramenta.click()

  const caixa = await caixaDoCanvas(page)
  const alvo = { x: caixa.x + 560, y: caixa.y + 360 }
  await tocarComoPessoa(page, alvo.x, alvo.y)
  await page.waitForTimeout(PINTURA_MS)
  expect(await quantosPinos(page), 'controle positivo: o clique precisa ter criado o pino').toBe(1)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(PINTURA_MS)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(PINTURA_MS)

  expect(await quantosPinos(page), 'Esc largou o pino na tela, mas ele continuou selecionado por baixo e o Delete seguinte o apagou').toBe(1)
})
