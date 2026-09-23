import { test, type Page, type TestInfo } from '@playwright/test'

/** Mensagem que o Playwright devolve quando o Chromium descarta a promise do evaluate. */
const PROMISE_COLLECTED = 'Resulting promise was garbage collected'
const WARMUP_ATTEMPTS = 3

/**
 * TETO PRÓPRIO para ABRIR o editor, fora do orçamento do gesto.
 *
 * POR QUE EXISTE. O editor é servido pelo vite de desenvolvimento, SEM bundle:
 * o `goto('/')` baixa e compila centenas de módulos, e o primeiro `import()`
 * do aquecimento puxa mais uma leva. Com a máquina carregada (outras lanes
 * rodando Playwright ao mesmo tempo, CPU em 100%) isso custou, medido em
 * 22/09/2026 por passo (reporter de passos, 22 testes de 6 specs, 1 worker):
 * `Navigate` de 1,5 s a 30,4 s, `Evaluate` do aquecimento até 22,4 s, e o
 * beforeEach inteiro de 2,9 s a 41,5 s. Esse custo caía DENTRO dos 30 s do
 * teste (beforeEach conta no teto do teste), então jornada com gesto de 15 s
 * estourava tempo sem nada de errado no gesto: 9 de 22 vermelhos por timeout,
 * todos verdes sozinhos.
 *
 * O QUE ELE NÃO AFROUXA. Enquanto o editor abre, o relógio do teste ganha
 * `TETO_PARA_ABRIR_O_EDITOR_MS` a mais; assim que o canvas monta, o teto volta
 * a ser o do teste MAIS o tempo que a abertura gastou de verdade. O gesto e as
 * asserções continuam com o mesmo orçamento que tinham com a máquina ociosa, e
 * nenhuma asserção de tela mudou. Abertura que passa do teto próprio continua
 * vermelha (editor que não abre em 90 s é defeito, não carga).
 */
const TETO_PARA_ABRIR_O_EDITOR_MS = 90_000

/** O `TestInfo` do teste que está rodando, ou `null` fora de teste (global setup, script). */
function testeRodando(): TestInfo | null {
  try {
    return test.info()
  } catch {
    return null
  }
}

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
  const info = testeRodando()
  // `timeout` 0 = sem teto (modo debug): nada a somar.
  const tetoDoTeste = info && info.timeout > 0 ? info.timeout : 0
  const inicio = Date.now()
  if (info && tetoDoTeste > 0) info.setTimeout(tetoDoTeste + TETO_PARA_ABRIR_O_EDITOR_MS)

  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Mapas' }).click()
  // exact: o cartão "Criar Mapas" do menu também casaria com "Criar mapa" por substring.
  await page.getByRole('button', { name: 'Criar mapa', exact: true }).click()
  await page.waitForSelector('canvas')
  await warmUpStoreImports(page)

  // Devolve só o que a abertura gastou: o resto do teste roda no teto de sempre.
  if (info && tetoDoTeste > 0) info.setTimeout(tetoDoTeste + (Date.now() - inicio))
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
