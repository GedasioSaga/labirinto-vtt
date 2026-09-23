// Jornada do PORTÃO: "a barra sempre tem uma frase na tela — e o portão estava
// contando essa frase como o app tendo RESPONDIDO."
//
// POR QUE ESTE ARQUIVO EXISTE. A dica fixa da barra de ferramentas
// (`src/components/Toolbar.tsx:380`) é um `<p class="lb-hint" role="status">`
// que mostra `TOOL_HINTS[activeTool]` e está na tela desde que o editor abre.
// O caminho alternativo de `task-jornada-token-no-lugar.spec.ts` ("se a peça
// não nasceu, o app tem de DIZER por quê") procurava um aviso com
//
//     page.locator('[role="alert"], [role="status"], .lb-toast')
//
// e essa dica casava com o `[role="status"]`. Ou seja: o ramo que existe para
// pegar o app CALADO saía verde justamente porque a barra tem mobília — em
// qualquer mapa, com qualquer gesto, sem nenhuma peça e sem nenhum aviso.
// Asserção que não morde não é asserção, é decoração.
//
// O QUE ESTA JORNADA PROVA, tudo com ponteiro de verdade e tudo lido da tela:
//  1. depois de um gesto comum (escolher uma ferramenta na barra), a régua
//     ANTIGA acha um `role="status"` — e o que ela acha é a dica fixa da barra,
//     conferido pela classe do próprio elemento casado;
//  2. a régua NOVA (`.lb-toast, [role="alert"], [role="alertdialog"]`, a mesma
//     de `task-jornada-gestos-centrais.spec.ts:83-91`) não acha nada nessa
//     mesma tela — ou seja, ela morde onde a antiga passava;
//  3. a dica TROCA quando a ferramenta troca: ela acompanha a barra, não
//     responde ao usuário. É mobília, e mobília não é resposta.
//
// NENHUM ENDEREÇO ESCRITO À MÃO: a página vem do `baseURL` do
// playwright.config deste checkout, pelo helper `enterEditor`.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** A régua que estava em uso e deixava o app calado passar por app falante. */
const REGUA_ANTIGA = '[role="alert"], [role="status"], .lb-toast'
/** A régua honesta: só aviso de verdade (toast e alerta), nunca a mobília da barra. */
const REGUA_NOVA = '.lb-toast, [role="alert"], [role="alertdialog"]'
/** A dica fixa da barra, o elemento que a régua antiga confundia com resposta. */
const DICA_DA_BARRA = '.lb-hint'

interface Ponto {
  x: number
  y: number
}

/** Centro do botão da barra, para o ponteiro ter para onde ir. */
async function centroDoBotao(page: Page, nome: string): Promise<Ponto> {
  const caixa = await page.getByRole('button', { name: nome, exact: true }).boundingBox()
  if (!caixa) throw new Error(`o botão "${nome}" não está na barra`)
  return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }
}

/**
 * Gesto de pessoa escolhendo uma ferramenta: o ponteiro CAMINHA até o botão,
 * pausa em cima dele, aperta, pausa, e só então solta. Nada de `click()`
 * instantâneo, nada de `setState`.
 */
async function escolherFerramenta(page: Page, nome: string): Promise<void> {
  const alvo = await centroDoBotao(page, nome)
  await page.mouse.move(alvo.x - 60, alvo.y + 40)
  await page.waitForTimeout(80)
  await page.mouse.move(alvo.x, alvo.y, { steps: 8 })
  await page.waitForTimeout(150)
  await page.mouse.down()
  await page.waitForTimeout(90)
  await page.mouse.up()
  await page.waitForTimeout(150)
}

/** Textos VISÍVEIS casados por uma régua, do jeito que a asserção os lê. */
async function textosVisiveis(page: Page, regua: string): Promise<string[]> {
  const candidatos = page.locator(regua)
  const total = await candidatos.count()
  const textos: string[] = []
  for (let i = 0; i < total; i += 1) {
    const alvo = candidatos.nth(i)
    if (!(await alvo.isVisible())) continue
    const texto = (await alvo.innerText()).trim()
    if (texto.length > 0) textos.push(texto)
  }
  return textos
}

/** Tira o ponteiro de cima da barra: o CSS esconde a dica enquanto o cursor
 *  está sobre um ícone que não é o ativo (`main.css:785`), e a pessoa também
 *  leva a mão para o mapa depois de escolher a ferramenta. */
async function levarPonteiroParaOMapa(page: Page): Promise<void> {
  const canvas = await page.locator('canvas').first().boundingBox()
  if (!canvas) throw new Error('sem canvas na tela')
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2, { steps: 10 })
  await page.waitForTimeout(200)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('a dica fixa da barra não conta como o app ter falado', async ({ page }) => {
  // --- Gesto 1: a pessoa escolhe Parede na barra ------------------------------
  await escolherFerramenta(page, 'Parede')
  await expect(
    page.getByRole('button', { name: 'Parede', exact: true }),
    'o botão Parede não ficou apertado — o gesto não pegou, e nada do que vem depois seria sobre a barra',
  ).toHaveAttribute('aria-pressed', 'true')
  await levarPonteiroParaOMapa(page)

  // Controle positivo: a dica fixa ESTÁ na tela e tem texto. Sem isto, o zero
  // da régua nova lá embaixo só diria "a tela está vazia".
  const dica = page.locator(DICA_DA_BARRA)
  await expect(dica, 'a dica fixa da barra sumiu — sem ela esta jornada não tem o que comparar').toBeVisible()
  const dicaParede = (await dica.innerText()).trim()
  expect(dicaParede.length, 'a dica fixa da barra está vazia').toBeGreaterThan(0)

  // 1. A régua ANTIGA acha alguma coisa nesta tela...
  const achadosAntiga = await textosVisiveis(page, REGUA_ANTIGA)
  expect(
    achadosAntiga.length,
    `a régua antiga (${REGUA_ANTIGA}) não achou nada — sem isso não dá para mostrar o que ela confundia`,
  ).toBeGreaterThan(0)
  // ...e o que ela acha é a mobília da barra, não uma resposta do app.
  expect(
    achadosAntiga.includes(dicaParede),
    `a régua antiga casou ${JSON.stringify(achadosAntiga)}, e a dica fixa da barra é ${JSON.stringify(dicaParede)}`,
  ).toBe(true)
  await expect(
    page.locator(REGUA_ANTIGA).first(),
    'o primeiro casamento da régua antiga deveria ser o próprio balão da barra',
  ).toHaveClass(/lb-hint/)

  // 2. A régua NOVA, na MESMA tela, não acha nada: o app não falou nada, e
  //    agora a asserção diz isso em vez de aprovar o silêncio.
  const achadosNova = await textosVisiveis(page, REGUA_NOVA)
  expect(
    achadosNova,
    `a régua nova (${REGUA_NOVA}) casou algo numa tela em que o app não disse nada: ${JSON.stringify(achadosNova)}`,
  ).toEqual([])

  // --- Gesto 2: a pessoa troca para Porta ------------------------------------
  await escolherFerramenta(page, 'Porta')
  await expect(
    page.getByRole('button', { name: 'Porta', exact: true }),
    'o botão Porta não ficou apertado — o segundo gesto não pegou',
  ).toHaveAttribute('aria-pressed', 'true')
  await levarPonteiroParaOMapa(page)

  // 3. A dica trocou junto com a ferramenta: ela descreve a barra, não responde
  //    a nenhum pedido da pessoa. É por isso que ela não pode valer como aviso.
  const dicaPorta = (await dica.innerText()).trim()
  expect(
    dicaPorta,
    `a dica não mudou ao trocar de ferramenta (${JSON.stringify(dicaParede)}) — ou a barra não reagiu, ou esta jornada leu o elemento errado`,
  ).not.toBe(dicaParede)
  expect(dicaPorta.length, 'a dica da ferramenta Porta está vazia').toBeGreaterThan(0)

  // E a régua nova continua calada, porque o app continua sem ter dito nada.
  expect(
    await textosVisiveis(page, REGUA_NOVA),
    'a régua nova casou algo depois de trocar de ferramenta — trocar de ferramenta não é aviso',
  ).toEqual([])
})
