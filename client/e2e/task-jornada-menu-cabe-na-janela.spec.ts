// JORNADA DE USUÁRIO — "o menu que eu abri cabe na janela, e eu alcanço a
// última opção dele". Escrita para FALHAR hoje (vermelha) e provar a dor pela
// TELA.
//
// A DOR (medida em passeio de usuário, janela de 1280x800): a pessoa clica na
// setinha embaixo do ícone de Chão. O menu é tão alto que, só de abrir, a
// PÁGINA INTEIRA sobe — o cabeçalho "Labirinto" e a barra de ferramentas saem
// da janela. E mesmo assim o menu termina cortado: da seção LADOS DO POLÍGONO
// aparecem o título e o começo de "Triângulo"; Quadrado, Pentágono, Hexágono,
// Octógono, Decágono e Dodecágono ficam abaixo da borda. A roda do mouse sobre
// o mapa afasta o zoom em vez de rolar, e sobre o próprio menu não faz nada.
// Só o Tab alcança esses itens — quem usa o mouse não chega lá.
//
// A CAUSA, para quem for consertar (endereço, não palpite):
//  - `client/src/lib/toolVariants.ts:278-282` — o Chão empilha QUATRO grupos
//    (Forma, Tamanho do pincel, Operação, Lados do polígono) = 18 rádios, cada
//    um com rótulo e descrição. É o menu mais alto do app.
//  - `client/src/main.css:866-876` — `.lb-toolvariant-menu` é
//    `position: absolute; top: calc(100% + 6px)`, SEM `max-height` e SEM
//    `overflow`: ele cresce para baixo até onde precisar.
//  - `client/src/components/ToolVariantMenu.tsx:232-234` — ao montar, o
//    popover chama `rootRef.current?.focus()`. Como ele nasce fora da área
//    visível, o navegador faz scroll-into-view no ancestral rolável mais
//    próximo (`.lb-editor`, main.css:648-653) e arrasta JUNTO tudo que mora
//    nele: canvas, barra de ferramentas e o painel do cabeçalho.
//  - `client/src/pixi/PixiCanvas.tsx:4472-4485` — o `wheel` está registrado no
//    elemento do canvas com `preventDefault()`, e é zoom. Nenhum handler de
//    `wheel` existe no menu.
//
// O QUE ESTA JORNADA COBRA, com o menu de Chão aberto em 1280x800:
//  (a) o cabeçalho "Labirinto" e a barra de ferramentas continuam DENTRO da
//      janela;
//  (b) "Dodecágono" está alcançável e clicável — seja porque o menu rola, seja
//      porque ele cabe.
//
// REGRA DE PROVA DESTE ARQUIVO: tudo é lido do que está NA TELA — a caixa de
// cada elemento contra a janela, e o `aria-checked` que o usuário ouve/vê. O
// gesto de rolagem é roda de mouse de verdade (`page.mouse.wheel`), e o de
// escolha é clique de ponteiro. Nenhuma asserção toca `mapStore`, e nada de
// `scrollIntoViewIfNeeded` para fabricar o alcance que se está medindo.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** A janela do passeio onde a dor foi medida. Declarada aqui, e não herdada do
 *  `playwright.config.ts`, porque esta jornada é SOBRE o tamanho da janela: se
 *  alguém aumentar o padrão do projeto, o defeito se esconde sozinho. */
test.use({ viewport: { width: 1280, height: 800 } })

/** Rolagem de uma "página" de roda, para baixo — o gesto de quem quer ver o
 *  resto de um menu comprido. */
const ROLAGEM_DA_RODA = 400

/**
 * Está inteiramente dentro da janela? `toBeVisible()` do Playwright NÃO serve
 * aqui: ele aprova um elemento empurrado para fora da borda, porque só olha
 * caixa não-vazia e `visibility`. Quem responde "o usuário consegue ver isso"
 * é a caixa contra a viewport.
 */
async function dentroDaJanela(page: Page, alvo: Locator): Promise<boolean> {
  const janela = page.viewportSize()
  if (!janela) throw new Error('sem viewport declarada')
  const caixa = await alvo.boundingBox()
  if (!caixa) return false
  return caixa.x >= 0 && caixa.y >= 0 && caixa.x + caixa.width <= janela.width && caixa.y + caixa.height <= janela.height
}

function menuDeChao(page: Page): Locator {
  return page.getByRole('group', { name: 'Opções de Chão', exact: true })
}

/** Abre o menu pela setinha embaixo do ícone de Chão, o caminho do usuário.
 *  Idempotente: se o menu já está aberto, não clica de novo (um segundo
 *  clique na setinha fecharia). */
async function abrirMenuDeChao(page: Page): Promise<Locator> {
  const menu = menuDeChao(page)
  if (!(await menu.isVisible())) {
    await page.getByRole('button', { name: 'Opções de Chão', exact: true }).click()
  }
  await expect(menu).toBeVisible()
  return menu
}

/** Roda de mouse de verdade, com o ponteiro parado sobre o menu. */
async function rodarARodaSobre(page: Page, alvo: Locator): Promise<void> {
  const caixa = await alvo.boundingBox()
  if (!caixa) throw new Error('alvo da roda sem caixa na tela')
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + Math.min(caixa.height, 700) / 2)
  await page.mouse.wheel(0, ROLAGEM_DA_RODA)
  await page.waitForTimeout(200)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('com o menu de Chão aberto em 1280x800, o cabeçalho e a barra continuam na janela e Dodecágono é alcançável e clicável', async ({
  page,
}) => {
  const menu = await abrirMenuDeChao(page)

  const cabecalho = page.getByRole('heading', { name: 'Labirinto', exact: true })
  const barra = page.getByRole('toolbar', { name: 'Ferramentas do mapa', exact: true })
  // Primeira opção do primeiro grupo do MESMO menu. É o CONTROLE POSITIVO da
  // medida: se nem ela estiver dentro da janela, o problema é a régua, não o
  // menu — e aí nenhum dos outros números abaixo significa nada.
  const primeiraOpcao = menu.getByRole('radio', { name: 'Retângulo', exact: true })
  const dodecagono = menu.getByRole('radio', { name: 'Dodecágono', exact: true })

  const medidaAoAbrir = {
    cabecalho: await dentroDaJanela(page, cabecalho),
    barra: await dentroDaJanela(page, barra),
    primeiraOpcao: await dentroDaJanela(page, primeiraOpcao),
    dodecagono: await dentroDaJanela(page, dodecagono),
  }

  // O gesto de quem quer ver o resto: roda de mouse, com o ponteiro em cima do
  // próprio menu.
  await rodarARodaSobre(page, menu)
  const dodecagonoDepoisDaRoda = await dentroDaJanela(page, dodecagono)

  // "Clicável": tentar de verdade. O `try` não é para engolir defeito — é para
  // um clique que não alcança virar `false` medido em vez de estourar o teste
  // inteiro com um erro de infraestrutura, que diria menos do que esta linha.
  const oCliqueFoiAceito = await dodecagono.click({ timeout: 4000 }).then(
    () => true,
    () => false,
  )

  // Escolher fecha o popover (ToolVariantMenu.tsx, `onPicked`), então a única
  // forma de ver o que ficou escolhido é reabrir e ler o estado do rádio.
  const menuDeNovo = await abrirMenuDeChao(page)
  const dodecagonoFicouEscolhido =
    (await menuDeNovo.getByRole('radio', { name: 'Dodecágono', exact: true }).getAttribute('aria-checked')) === 'true'

  expect({
    cabecalhoNaJanelaComOMenuAberto: medidaAoAbrir.cabecalho,
    barraDeFerramentasNaJanelaComOMenuAberto: medidaAoAbrir.barra,
    primeiraOpcaoDoMenuNaJanela: medidaAoAbrir.primeiraOpcao,
    dodecagonoNaJanelaAoAbrir: medidaAoAbrir.dodecagono,
    dodecagonoNaJanelaDepoisDaRodaDoMouse: dodecagonoDepoisDaRoda,
    dodecagonoAceitouOClique: oCliqueFoiAceito,
    dodecagonoFicouEscolhido,
  }).toEqual({
    cabecalhoNaJanelaComOMenuAberto: true,
    barraDeFerramentasNaJanelaComOMenuAberto: true,
    primeiraOpcaoDoMenuNaJanela: true,
    dodecagonoNaJanelaAoAbrir: true,
    dodecagonoNaJanelaDepoisDaRodaDoMouse: true,
    dodecagonoAceitouOClique: true,
    dodecagonoFicouEscolhido: true,
  })
})

// CONTROLE POSITIVO isolado — uma opção do MESMO menu que hoje está dentro da
// janela ("Elipse", segunda do primeiro grupo). Passa hoje: prova que a
// setinha abre, que o rádio marca e que os seletores desta jornada estão
// certos. Sem ele, o vermelho do teste acima poderia ser menu que não abriu,
// nome acessível trocado ou popover que nunca renderizou.
test('controle positivo: uma opção visível do mesmo menu de Chão é alcançável e fica escolhida', async ({ page }) => {
  const menu = await abrirMenuDeChao(page)
  const elipse = menu.getByRole('radio', { name: 'Elipse', exact: true })

  const elipseNaJanela = await dentroDaJanela(page, elipse)
  await elipse.click()

  const menuDeNovo = await abrirMenuDeChao(page)
  const escolhida = await menuDeNovo.getByRole('radio', { name: 'Elipse', exact: true }).getAttribute('aria-checked')

  expect({ elipseNaJanela, escolhida }).toEqual({ elipseNaJanela: true, escolhida: 'true' })
})
