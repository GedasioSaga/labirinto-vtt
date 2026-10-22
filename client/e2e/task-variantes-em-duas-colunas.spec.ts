// FATIA 20 — as opções do menu de variantes em GRADE DE DUAS COLUNAS
// (`.lb-toolvariant-menu__options`, main.css), e não mais a lista de uma
// coluna com descrição. A medida é do navegador: as colunas que o CSS
// calculou e onde cada opção caiu na tela. Nada vem da store.
//
// O que fica provado, por grupo com duas opções ou mais:
//   - o grid calculado tem exatamente 2 trilhas;
//   - a 1ª e a 2ª opção estão lado a lado (mesmo topo, a 2ª à direita);
//   - a 3ª, quando existe, abre a linha seguinte embaixo da 1ª (mesma esquerda).
// Com a grade em 1 coluna (a régua foi vista vermelha assim) as três falham.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Folga de arredondamento de subpixel entre duas caixas da mesma linha. */
const FOLGA_PX = 1

interface MedidaDoGrupo {
  rotulo: string
  trilhas: number
  opcoes: { x: number; y: number }[]
}

/** O menu ABERTO: o que acabou de fechar ainda sai por 120 ms (`ComSaida`), com `gr-sai`. */
function menuDe(page: Page, ferramenta: string): Locator {
  return page.locator(`[role="group"][aria-label="Opções de ${ferramenta}"]:not(.gr-sai)`)
}

async function abrirMenu(page: Page, ferramenta: string): Promise<Locator> {
  await page.getByRole('button', { name: `Opções de ${ferramenta}`, exact: true }).click()
  const menu = menuDe(page, ferramenta)
  await expect(menu).toBeVisible()
  return menu
}

/** As colunas calculadas e a posição de cada opção, grupo por grupo. */
async function medirGrupos(menu: Locator): Promise<MedidaDoGrupo[]> {
  return menu.evaluate((raiz) =>
    Array.from(raiz.querySelectorAll<HTMLElement>('.lb-toolvariant-menu__options')).map((grade) => {
      const trilhas = getComputedStyle(grade).gridTemplateColumns.split(' ').filter((parte) => parte.trim() !== '').length
      const rotulo = grade.getAttribute('aria-label') ?? ''
      const opcoes = Array.from(grade.querySelectorAll<HTMLElement>('.lb-toolvariant-menu__option')).map((opcao) => {
        const caixa = opcao.getBoundingClientRect()
        return { x: caixa.left, y: caixa.top }
      })
      return { rotulo, trilhas, opcoes }
    }),
  )
}

function conferirDuasColunas(grupos: MedidaDoGrupo[]): void {
  const comVarias = grupos.filter((grupo) => grupo.opcoes.length >= 2)
  expect(comVarias.length, 'o menu não tem nenhum grupo com duas opções para medir').toBeGreaterThan(0)
  for (const { rotulo, trilhas, opcoes } of comVarias) {
    expect(trilhas, `"${rotulo}": o grid calculado não tem 2 colunas`).toBe(2)
    const [primeira, segunda, terceira] = opcoes
    expect(Math.abs(segunda.y - primeira.y), `"${rotulo}": a 2ª opção não está na linha da 1ª`).toBeLessThanOrEqual(FOLGA_PX)
    expect(segunda.x, `"${rotulo}": a 2ª opção não está à direita da 1ª`).toBeGreaterThan(primeira.x + FOLGA_PX)
    if (terceira !== undefined) {
      expect(terceira.y, `"${rotulo}": a 3ª opção não abriu a linha de baixo`).toBeGreaterThan(primeira.y + FOLGA_PX)
      expect(Math.abs(terceira.x - primeira.x), `"${rotulo}": a 3ª opção não começa na coluna da 1ª`).toBeLessThanOrEqual(FOLGA_PX)
    }
  }
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('menu de Chão: cada grupo de opções em duas colunas, lado a lado e linha por linha', async ({ page }) => {
  const menu = await abrirMenu(page, 'Chão')
  conferirDuasColunas(await medirGrupos(menu))
})

test('menu de Parede: as opções também em duas colunas', async ({ page }) => {
  const menu = await abrirMenu(page, 'Parede')
  conferirDuasColunas(await medirGrupos(menu))
})
