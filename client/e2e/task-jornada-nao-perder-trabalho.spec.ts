/**
 * Jornada: "eu não perco o que desenhei".
 *
 * O mestre desenha uma sala, NÃO salva, e manda abrir outro mapa — pelo botão
 * "Abrir..." da barra ou por Ctrl+O. Hoje o app atende na hora: `handleOpen`
 * (App.tsx:836) e o atalho Ctrl+O (App.tsx:880) vão direto ao seletor de
 * arquivo e, quando o usuário escolhe um mapa, `loadMap` troca o conteúdo sem
 * uma palavra. O aviso de trabalho não salvo existe só ao FECHAR a janela
 * (App.tsx:434, `onCloseRequested`) — quem abre outro mapa pela porta da
 * frente perde tudo calado.
 *
 * O que estes testes exigem: antes de descartar, o app PERGUNTA, e a pergunta
 * aparece na tela. Enquanto ela não for respondida, o seletor de arquivo não
 * pode ter sido aberto.
 *
 * Disco de mentira: `helpers/tauriFsStub.ts` (o mesmo de
 * `task-fluxo-consertos.spec.ts`), que registra cada invoke em
 * `window.__invokes` — é assim que se vê se o seletor de arquivo foi aberto.
 */
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'

/** Palavras que qualquer versão razoável da pergunta tem de conter. */
const TEXTO_DA_PERGUNTA = /não salv/i

async function invokesRegistrados(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window as unknown as { __invokes: string[] }).__invokes])
}

/**
 * Trabalho de verdade, com gesto de verdade: escolhe a ferramenta Sala,
 * arrasta o retângulo com pausa antes de soltar e batiza a sala no campo que
 * aparece sobre ela. Nada é injetado na store.
 */
async function desenharSalaSemSalvar(page: Page): Promise<void> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.getByRole('button', { name: 'Sala', exact: true }).click()
  await page.mouse.move(box.x + 380, box.y + 300)
  await page.mouse.down()
  await page.mouse.move(box.x + 480, box.y + 360, { steps: 8 })
  await page.mouse.move(box.x + 620, box.y + 440, { steps: 8 })
  // Pausa antes de soltar: é onde o usuário confere o retângulo.
  await page.waitForTimeout(150)
  await page.mouse.up()

  const nome = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  await expect(nome).toBeVisible()
  await page.keyboard.type('Cripta')
  await page.keyboard.press('Enter')
  await expect(nome).toHaveCount(0)

  // Tira o foco de qualquer campo — em INPUT o app devolve Ctrl+O ao browser.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.evaluate(() => {
    ;(window as unknown as { __invokes: string[] }).__invokes.length = 0
  })
}

test.beforeEach(async ({ page }) => {
  await installTauriFsStub(page)
  await enterEditor(page)
})

test('Ctrl+O com sala desenhada e não salva pergunta antes de descartar', async ({ page }) => {
  await desenharSalaSemSalvar(page)

  await page.keyboard.press('Control+o')

  await expect(
    page.getByText(TEXTO_DA_PERGUNTA).first(),
    'Ctrl+O descartou o desenho sem perguntar nada ao usuário',
  ).toBeVisible()
  expect(
    await invokesRegistrados(page),
    'o app foi direto ao seletor de arquivo antes de perguntar sobre o trabalho não salvo',
  ).not.toContain('plugin:dialog|open')
})

test('a pergunta do Ctrl+O oferece uma saída para não perder o desenho', async ({ page }) => {
  await desenharSalaSemSalvar(page)

  await page.keyboard.press('Control+o')

  await expect(
    // "Salvar" de propósito fora do padrão: a barra do editor já tem um botão
    // com esse nome, e ele passaria sem que pergunta nenhuma existisse.
    page.getByRole('button', { name: /cancelar|continuar editando|manter/i }).first(),
    'a pergunta não dá ao usuário nenhum botão para manter o que ele desenhou',
  ).toBeVisible()
})

test('o botão "Abrir..." da barra pergunta antes de descartar a sala não salva', async ({ page }) => {
  await desenharSalaSemSalvar(page)

  await page.getByRole('button', { name: 'Abrir...' }).click()

  await expect(
    page.getByText(TEXTO_DA_PERGUNTA).first(),
    'o botão "Abrir..." descartou o desenho sem perguntar nada ao usuário',
  ).toBeVisible()
  expect(
    await invokesRegistrados(page),
    'o app foi direto ao seletor de arquivo antes de perguntar sobre o trabalho não salvo',
  ).not.toContain('plugin:dialog|open')
})
