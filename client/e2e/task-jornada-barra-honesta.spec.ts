import { expect, test, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/**
 * Porta e endereço vêm do `playwright.config.ts` deste worktree
 * (`http://localhost:1437` — o vite de `C:\dev\labirinto-consertos`).
 * Esta spec NÃO fixa porta nenhuma: um contorno de porta dentro do teste é
 * exatamente o jeito de acabar julgando o app de outro projeto sem perceber.
 */
test.use({ trace: 'off', video: 'off' })

/**
 * Jornada: a barra de ferramentas não pode mentir sobre o que acabou de
 * acontecer.
 *
 * DOR (achada em passeio cego): com "Selecionar" ativa, o usuário abre
 * "Opções de Parede" e escolhe "Interna". O menu fecha, a preferência da
 * próxima parede muda — e a barra continua exatamente igual: mesmo botão
 * pressionado, mesmo texto de ajuda, palavra por palavra. Da cadeira do
 * usuário, escolher "Interna" e não escolher nada produzem a MESMA tela.
 *
 * O QUE ESTA JORNADA **NÃO** EXIGE — contrato de projeto, intencional
 * (`src/components/ToolVariantMenu.tsx:16-23`): `doorKind`, `wallKind`,
 * `regionFillPattern` e `polygonSides` editam a preferência da PRÓXIMA
 * entidade e NÃO trocam a ferramenta ativa; só `drawShape` troca ferramenta
 * (`src/App.tsx:1210`). Então aqui nada cobra `aria-pressed` mudando de
 * "Selecionar" para "Parede" depois de escolher a variante. O que se cobra é
 * bem mais barato e é o defeito que sobra: uma ação que MUDOU alguma coisa
 * precisa deixar algum rastro na tela.
 *
 * A AFIRMAÇÃO VERIFICÁVEL (asserção 2), e por que ela é justa: a barra mostra
 * `TOOL_HINTS[activeTool]` (`src/components/Toolbar.tsx:213`), um texto que
 * descreve SÓ a ferramenta ativa. Depois de uma escolha que mudou a
 * preferência, esse texto continua sendo, caractere por caractere, o mesmo
 * texto de antes. Um texto que não distingue "escolhi Interna" de "não
 * escolhi nada" está afirmando ao usuário que nada mudou — e nesse ponto ele
 * está errado. Não se exige redação nenhuma: exige-se que o texto visível
 * deixe de ser idêntico ao texto que descrevia só a ferramenta ativa.
 *
 * ESCOPO DA OBSERVAÇÃO: tudo é lido da TELA, da região da barra
 * (`.lb-toolbar-dock` = os botões + o balão de dica). Nenhuma asserção toca
 * store. A região é a barra porque é lá que o usuário está olhando quando
 * clica na setinha — é a barra que precisa responder ao clique que ela mesma
 * recebeu.
 *
 * DOIS COMPARADORES INDEPENDENTES, para o vermelho não ser cegueira do teste:
 *  - texto: `innerText` visível de `.lb-toolbar-dock` (os botões são só de
 *    ícone, então o texto visível ali é o balão de dica);
 *  - pixel: screenshot de `.lb-toolbar` (só a fileira de botões, sem o balão)
 *    — pega marca nova em botão, selo, destaque, qualquer confirmação gráfica.
 * O primeiro teste do arquivo é o CONTROLE POSITIVO: prova que os dois
 * comparadores enxergam mudança quando ela existe de verdade (trocar a
 * ferramenta ativa). Ele passa hoje. Se um dia ele ficar vermelho, o segundo
 * teste perdeu o valor e os dois precisam ser relidos juntos.
 */

/** Cópia literal de `TOOL_HINTS.select` (src/components/labels.ts:74) — é o
 *  texto que o usuário lê, e o ponto da jornada é ele não poder sobreviver
 *  intacto a uma escolha que mudou o estado. Duplicado de propósito: se a
 *  redação mudar, esta jornada deve ser relida, não auto-corrigida. */
const DICA_QUE_DESCREVE_SO_A_FERRAMENTA_SELECIONAR =
  'Clique para selecionar. Arraste o corpo do item para mover, os cantos/pontas para redimensionar. ' +
  'Shift+arraste numa área vazia para selecionar vários itens de uma vez e movê-los juntos.'

/** Ponto longe da barra (barra fica no topo) e sem clique: tira o ponteiro de
 *  cima de qualquer botão para hover não virar diferença de pixel falsa. */
const PONTO_NEUTRO = { x: 640, y: 740 }

interface LeituraDaBarra {
  texto: string
  /** PNG cru da fileira de botões. `Uint8Array`, não `Buffer`: o tsconfig do
   *  e2e não carrega os tipos do Node, e um `Buffer` aqui não compila. */
  pixel: Uint8Array
}

/** Comparação byte a byte — mesmo tamanho e mesmo conteúdo. */
function mesmoPixel(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Hover e foco mudam pixel sem mudar significado. O popover devolve o foco à
 * setinha ao fechar (`Toolbar.tsx:236`), e o ponteiro fica onde o último
 * clique caiu — se isso entrasse na comparação, a jornada ficaria verde por
 * anel de foco, não por confirmação da escolha. Então antes de CADA leitura a
 * tela é levada ao mesmo estado neutro.
 */
async function neutralizarHoverEFoco(page: Page): Promise<void> {
  await page.mouse.move(PONTO_NEUTRO.x, PONTO_NEUTRO.y)
  await page.evaluate(() => {
    const ativo = document.activeElement
    if (ativo instanceof HTMLElement) ativo.blur()
  })
}

/** Screenshot só quando dois disparos seguidos saem idênticos — evita ler a
 *  barra no meio de uma transição e chamar isso de "mudança". */
async function pixelEstavelDaBarra(page: Page): Promise<Uint8Array> {
  const barra = page.locator('.lb-toolbar')
  let anterior: Uint8Array = await barra.screenshot()
  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    await page.waitForTimeout(80)
    const atual: Uint8Array = await barra.screenshot()
    if (mesmoPixel(atual, anterior)) return atual
    anterior = atual
  }
  throw new Error('A barra não parou de mudar de pixel — leitura instável, não dá para comparar.')
}

async function lerBarra(page: Page): Promise<LeituraDaBarra> {
  await neutralizarHoverEFoco(page)
  await expect(page.locator('.lb-hint')).toBeVisible()
  const bruto = await page.locator('.lb-toolbar-dock').innerText()
  return { texto: bruto.replace(/\s+/g, ' ').trim(), pixel: await pixelEstavelDaBarra(page) }
}

function barraDeFerramentas(page: Page) {
  return page.getByRole('toolbar', { name: 'Ferramentas do mapa' })
}

test('controle positivo: quando algo muda de verdade na barra, os dois comparadores enxergam', async ({ page }) => {
  await enterEditor(page)
  const barra = barraDeFerramentas(page)
  await expect(barra.getByRole('button', { name: 'Selecionar', exact: true })).toHaveAttribute('aria-pressed', 'true')

  const antes = await lerBarra(page)

  // Mudança inegável e visível: outra ferramenta passa a ser a ativa.
  await barra.getByRole('button', { name: 'Parede', exact: true }).click()
  await expect(barra.getByRole('button', { name: 'Parede', exact: true })).toHaveAttribute('aria-pressed', 'true')

  const depois = await lerBarra(page)

  expect(
    depois.texto,
    'Comparador de TEXTO cego: trocar a ferramenta ativa mudou a tela e ele não viu.',
  ).not.toBe(antes.texto)
  expect(
    mesmoPixel(depois.pixel, antes.pixel),
    'Comparador de PIXEL cego: o botão pressionado mudou de lugar na barra e ele não viu.',
  ).toBe(false)
})

test('com Selecionar ativa, escolher "Interna" em Opções de Parede deixa rastro na barra', async ({ page }) => {
  await enterEditor(page)
  const barra = barraDeFerramentas(page)
  await expect(barra.getByRole('button', { name: 'Selecionar', exact: true })).toHaveAttribute('aria-pressed', 'true')

  const antes = await lerBarra(page)
  expect(antes.texto, 'Precondição: a barra começa mostrando a dica da ferramenta Selecionar.').toContain(
    DICA_QUE_DESCREVE_SO_A_FERRAMENTA_SELECIONAR,
  )

  // Gesto real do usuário: setinha da Parede, opção "Interna".
  await barra.getByRole('button', { name: 'Opções de Parede', exact: true }).click()
  const menu = page.getByRole('group', { name: 'Opções de Parede' })
  await expect(menu).toBeVisible()
  await menu.getByRole('radio', { name: 'Interna', exact: true }).click()
  await expect(menu, 'Escolher a opção fecha o popover.').toHaveCount(0)

  const depois = await lerBarra(page)

  // A escolha PEGOU — provado pela tela, reabrindo o mesmo menu: o rádio
  // "Interna" agora aparece marcado. Sem isto, a jornada poderia ficar
  // vermelha por um clique que não fez nada, e aí ela estaria cobrando rastro
  // de um evento que nunca houve.
  await barra.getByRole('button', { name: 'Opções de Parede', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Opções de Parede' }).getByRole('radio', { name: 'Interna', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('group', { name: 'Opções de Parede' })).toHaveCount(0)

  // 1) A tela reconhece a escolha: algo visível na barra precisa ser diferente
  //    de antes — texto novo, marca no botão, selo, o que o design decidir.
  const textoMudou = depois.texto !== antes.texto
  const pixelMudou = !mesmoPixel(depois.pixel, antes.pixel)
  expect.soft(
    textoMudou || pixelMudou,
    'A barra não reconheceu a escolha: depois de escolher "Interna", o texto visível é o mesmo ' +
      `(texto igual: ${String(!textoMudou)}) e a fileira de botões é pixel por pixel a mesma ` +
      `(pixel igual: ${String(!pixelMudou)}). Escolher "Interna" e não escolher nada produzem a mesma tela. ` +
      `Texto lido depois da escolha: "${depois.texto}"`,
  ).toBe(true)

  // 2) A barra não passa a mentir: o texto visível não pode continuar sendo,
  //    palavra por palavra, o que descrevia só a ferramenta ativa como se nada
  //    tivesse acontecido.
  expect.soft(
    depois.texto,
    'A barra mente: depois de mudar a preferência da próxima parede, o texto de ajuda continua ' +
      'sendo, caractere por caractere, a descrição da ferramenta Selecionar — nada ali distingue ' +
      'uma tela onde o usuário escolheu "Interna" de uma onde ele não escolheu nada.',
  ).not.toBe(DICA_QUE_DESCREVE_SO_A_FERRAMENTA_SELECIONAR)
})
