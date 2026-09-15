import type { Page } from '@playwright/test'

/** Mensagem que o Playwright devolve quando o Chromium descarta a promise do evaluate. */
const PROMISE_COLLECTED = 'Resulting promise was garbage collected'
const WARMUP_ATTEMPTS = 3

/**
 * Navega da raiz até o editor pelo caminho do menu inicial: menu →
 * "Criar Mapas" → formulário → "Criar mapa" → espera o `<canvas>` do Pixi
 * montar. O seletor de tipo ("Dungeon Map") está escondido por
 * `FEATURES.otherMapTypes` (lib/features.ts): "Criar Mapas" abre o formulário
 * direto. Ao religar a flag, o clique em "Dungeon Map" volta para cá.
 *
 * Substitui o antigo `page.getByRole('button', { name: 'Criar mapa' }).click()`
 * direto na raiz — o menu novo tirou esse botão da página inicial, então os
 * 19 specs que abriam o editor assim quebravam sem este helper.
 */
export async function enterEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Mapas' }).click()
  // exact: o cartão "Criar Mapas" do menu também casaria com "Criar mapa" por substring.
  await page.getByRole('button', { name: 'Criar mapa', exact: true }).click()
  await page.waitForSelector('canvas')
  await warmUpStoreImports(page)
}

/**
 * Faz o primeiro `import()` dos módulos que os specs usam no page.evaluate.
 *
 * Com 4 workers, o PRIMEIRO evaluate com `import()` logo depois do canvas
 * montar às vezes volta "Resulting promise was garbage collected" em ~50 ms,
 * sem navegação nem erro de página no trace (suíte de 14/09/2026: 3 falhas,
 * todas no resetMap do beforeEach, specs diferentes; isoladas passam). É o
 * Chromium soltando a promise, não o app: nenhuma asserção chega a rodar.
 * Aqui só importa, sem mexer em estado, então repetir é seguro. Qualquer
 * outro erro, ou a mesma falha nas 3 tentativas, sobe normalmente.
 */
async function warmUpStoreImports(page: Page): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.evaluate(async () => {
        await import('/src/lib/mapFactory.ts')
        await import('/src/stores/mapStore.ts')
      })
      return
    } catch (error) {
      const collected = error instanceof Error && error.message.includes(PROMISE_COLLECTED)
      if (!collected || attempt >= WARMUP_ATTEMPTS) throw error
    }
  }
}
