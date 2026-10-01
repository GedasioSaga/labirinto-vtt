// CONFERÊNCIA guias-4e5 (01/10/2026), achado medido: escolher uma forma no menu
// "Opções de Desenho" rolava o DIV.lb-editor em 5 px (scrollTop = 5). O editor
// inteiro subia e aparecia uma faixa preta embaixo, dali em diante.
//
// O `.lb-editor` tem `overflow: hidden`, mas ainda rola por foco e por
// `scrollIntoView`. Os 5 px que sobravam para rolar eram a linha de texto do
// `<canvas>` do Pixi: inline, ele reservava embaixo o espaço das letras que
// descem, e o contêiner de 100% de altura deixava essa sobra vazar.
//
// COMO PROVA. O editor sem sobra para rolar (a altura dele é a da janela), e
// três formas escolhidas pelo menu de verdade sem mexer na rolagem.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

const FORMAS = ['Linha', 'Retângulo', 'Círculo'] as const

/** O foco do menu e a troca de ferramenta assentam em poucos quadros. */
const ASSENTAR_MS = 300

async function rolagemDoEditor(page: Page): Promise<{ scrollTop: number; sobra: number }> {
  return page.evaluate(() => {
    const editor = document.querySelector('.lb-editor')
    if (!(editor instanceof HTMLElement)) throw new Error('sem .lb-editor')
    return { scrollTop: editor.scrollTop, sobra: editor.scrollHeight - editor.clientHeight }
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('o editor não tem sobra para rolar: a altura do conteúdo é a da janela', async ({ page }) => {
  expect(await rolagemDoEditor(page)).toEqual({ scrollTop: 0, sobra: 0 })
})

test('escolher formas no menu Opções de Desenho não rola o editor', async ({ page }) => {
  for (const forma of FORMAS) {
    await page.getByRole('button', { name: 'Opções de Desenho', exact: true }).click()
    await page.getByRole('group', { name: 'Opções de Desenho' }).getByRole('radio', { name: forma, exact: true }).click()
    await page.waitForTimeout(ASSENTAR_MS)
    expect((await rolagemDoEditor(page)).scrollTop, `depois de escolher ${forma}`).toBe(0)
  }
})
