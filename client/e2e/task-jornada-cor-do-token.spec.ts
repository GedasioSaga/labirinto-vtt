// JORNADA DA COR DO TOKEN — escrita para SAIR VERMELHA hoje.
//
// A feature pedida (candidata 3 de `docs/features-candidatas-2026-09-21.md`):
// o mestre escolhe a COR de cada ficha no painel, para separar aliado de
// inimigo. Hoje a cor é constante em código — `pixi/drawTokens.ts:17` pinta
// todo disco com `0x5a8fd6` — e `Token` (`types/map.ts:314-344`) não tem campo
// de cor nenhum. Com oito fichas azuis idênticas, ninguém sabe quem é monstro
// no meio da luta.
//
// O QUE ESTA JORNADA COBRA, TUDO EM PIXEL DA TELA (nenhuma asserção lê a store;
// o `evaluate` só DECODIFICA a foto, nunca escreve no app):
//
//   PROVA 1 — escolher uma cor na ficha da esquerda muda o pixel do centro
//             DELA;
//   PROVA 2 — e NÃO muda o pixel da ficha da direita: a cor é de cada token, e
//             não do mapa inteiro;
//   PROVA 3 — escolher outra cor na ficha da direita muda o pixel dela;
//   PROVA 4 — AO MESMO TEMPO, com as duas na tela, os dois centros têm cores
//             diferentes entre si, e as duas continuam se destacando do fundo
//             (não adianta "diferente" porque uma sumiu).
//
// O CONTROLE POSITIVO é a dor de hoje medida: duas fichas colocadas pela
// interface aparecem nos dois lugares e saem com EXATAMENTE a mesma cor. Ele
// prova que o método (foto da tela, leitura de pixel, os dois pontos escolhidos)
// enxerga as duas peças e distingue peça de fundo — sem isso, "os pixels saíram
// diferentes" poderia ser a régua lendo fundo.
//
// COMO A JORNADA NÃO DITA A IMPLEMENTAÇÃO. `escolherCorDoToken` aceita três
// formas de controle, na ordem em que um mestre as encontraria: um botão/rádio
// com o nome da cor (ou do papel: aliado, inimigo), um seletor de cor do
// sistema (`input type=color`) e uma lista. Nenhuma delas existe hoje no painel
// do token (conferido em 21/09/2026: com uma ficha selecionada o painel só
// oferece Nome, Imagem do token, Rotação, Travar e Ocultar), e é aí que a
// jornada morde. O seletor de cor do CHÃO — o único `input type=color` da tela
// hoje, "Cor do chão" em `components/FloorStyleControls.tsx:57` — fica de fora
// de propósito: ele pinta o chão, não a peça.
//
// GEOMETRIA (px de tela = px de mundo, câmera 1:1 ao abrir; grade de 64 px;
// 32 + 64k é centro de célula). As duas fichas ficam em LINHAS E COLUNAS
// DIFERENTES: alinhadas, o arrasto da segunda acenderia a guia de alinhamento
// (`PixiCanvas.tsx:3794-3797`) e a foto teria tinta que não é peça.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Onde fica a ficha da esquerda (centro de célula). */
const ALIADO = { x: 480, y: 416 }
/** Onde fica a ficha da direita (centro de célula, outra linha e outra coluna). */
const INIMIGO = { x: 800, y: 544 }
/** Chão vazio, longe das duas, para saber qual é a cor do fundo. */
const FUNDO = { x: 900, y: 740 }
/** Onde a ficha nasce: o centro da vista (`App.tsx:criarToken`). */
const ONDE_A_FICHA_NASCE = { x: 640, y: 400 }
/** Canto vazio do canvas: clique que tira a seleção antes de fotografar. */
const VAZIO = { x: 1150, y: 720 }

/** Botão parado antes de soltar: é o que separa um arrasto de pessoa de um clique. */
const PAUSA_MS = 200
/** Folga para o Pixi terminar de pintar antes da foto. */
const PINTURA_MS = 400
/** Quanto duas cores precisam distar para contarem como "cores diferentes na tela". */
const CORES_DIFERENTES = 40

/** A cor que o mestre dá ao aliado, e como ela pode se chamar na interface. */
const COR_DO_ALIADO = { nome: /verde|aliado/i, rotulo: 'Verde', hex: '#20c040' }
/** A cor que o mestre dá ao inimigo. */
const COR_DO_INIMIGO = { nome: /vermelh[oa]|inimigo/i, rotulo: 'Vermelho', hex: '#e02020' }

/** Rótulos de seletor de cor que NÃO são a cor da peça — estes já existem hoje. */
const COR_QUE_NAO_E_DO_TOKEN = /ch[ãa]o|contorno|fundo|grade|parede|linha|texto|borda/i

type Cor = [number, number, number]

interface Ponto {
  x: number
  y: number
}

/** O tipo da foto vem da própria API: o tsconfig dos e2e não carrega os tipos do Node. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

const distanciaCor = (a: Cor, b: Cor): number =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))

const emTexto = (cor: Cor): string => cor.join(',')

/**
 * Lê pixels da FOTO da tela — o que o usuário vê —, decodificando o PNG no
 * próprio navegador num canvas 2D descartável. Só LEITURA: nada do app é
 * tocado (mesmo helper de `task-jornada-saida-sem-parede.spec.ts`).
 */
async function amostrar(page: Page, foto: Foto, pontos: Ponto[]): Promise<Cor[]> {
  return page.evaluate(
    async ({ b64, pontos }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      return pontos.map((p) => {
        const cx = Math.min(width - 1, Math.max(0, Math.round(p.x)))
        const cy = Math.min(height - 1, Math.max(0, Math.round(p.y)))
        const i = (cy * width + cx) * 4
        return [data[i], data[i + 1], data[i + 2]] as [number, number, number]
      })
    },
    { b64: foto.toString('base64'), pontos },
  )
}

/** As cores dos pontos pedidos, agora, numa foto só. */
async function coresNaTela(page: Page, pontos: Ponto[]): Promise<Cor[]> {
  return amostrar(page, await page.screenshot(), pontos)
}

/** Escolhe uma ferramenta na barra do mestre. */
async function ferramenta(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: nome, exact: true }).click()
}

/** Caixa do `<canvas>` do editor (os painéis flutuam por cima dele). */
async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

/** Todo nome acessível de controle na tela — só para a falha dizer o que EXISTE hoje. */
async function nomesDeControleNaTela(page: Page): Promise<string[]> {
  return page
    .locator('button, [role="radio"], [role="menuitemradio"], [role="checkbox"], [role="tab"], select, option')
    .evaluateAll((elementos) =>
      elementos
        .map((elemento) => elemento.getAttribute('aria-label') ?? elemento.textContent?.trim() ?? '')
        .filter((nome) => nome !== ''),
    )
}

/**
 * Todo seletor de cor do sistema na tela, com o rótulo que a pessoa lê ao lado
 * dele. Leitura pura do DOM — nada é alterado.
 */
async function seletoresDeCorNaTela(page: Page): Promise<{ id: string; rotulo: string }[]> {
  return page.locator('input[type="color"]').evaluateAll((entradas) =>
    entradas.map((entrada) => {
      const id = entrada.getAttribute('id') ?? ''
      const marcado = id === '' ? null : document.querySelector(`label[for="${id}"]`)
      const pai = entrada.closest('label')
      const rotulo = (marcado?.textContent ?? pai?.textContent ?? entrada.getAttribute('aria-label') ?? '').trim()
      return { id, rotulo }
    }),
  )
}

/**
 * Coloca a ficha pelo caminho do painel ("Adicionar token"), que é o único
 * caminho de interface hoje — a ferramenta Token está escondida por
 * `FEATURES.tokenTool`. A peça nasce no CENTRO DA VISTA.
 */
async function colocarFicha(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: 'Adicionar token' }).click()
  const campo = page.getByLabel('Nome do novo token')
  await campo.click()
  await campo.pressSequentially(nome, { delay: 15 })
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Apagar token selecionado' }),
    'a ficha não entrou no mapa: o painel não mostra nada de token selecionado',
  ).toBeVisible({ timeout: 5000 })
}

/**
 * Arrasto de pessoa: pega, espera o "pegar" registrar, caminha em passos, PARA
 * em cima do destino e só então solta.
 */
async function arrastarComoPessoa(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.move((de.x + para.x) / 2, (de.y + para.y) / 2, { steps: 8 })
  await page.mouse.move(para.x, para.y, { steps: 8 })
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

/** Tira a seleção para que nenhum realce entre nas amostras de cor. */
async function limparSelecao(page: Page): Promise<void> {
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(VAZIO.x, VAZIO.y)
  await page.waitForTimeout(PINTURA_MS)
}

/** Clica na ficha para abrir o painel dela. */
async function selecionarFicha(page: Page, onde: Ponto): Promise<void> {
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(onde.x, onde.y)
  await expect(
    page.getByRole('button', { name: 'Apagar token selecionado' }),
    `clicar em (${onde.x}, ${onde.y}) não selecionou ficha nenhuma: o painel do token não abriu`,
  ).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(PINTURA_MS)
}

/**
 * Dá uma cor à ficha SELECIONADA, pelo painel, sem ditar a forma do controle:
 *
 *   1. um botão/rádio com o nome da cor ou do papel ("Verde", "Aliado"…);
 *   2. um seletor de cor do sistema (`input type=color`) que não seja o do
 *      chão nem o do contorno — os únicos que já existem;
 *   3. uma lista com o nome da cor.
 *
 * O caminho 2 usa `fill`, que é como o Playwright aciona um seletor de cor do
 * sistema: a caixa nativa do Windows não se abre num teste, e `fill` produz o
 * mesmo `input`/`change` que a pessoa produz ao escolher lá dentro. Não é
 * estado injetado — é o valor do campo do formulário, que continua sendo lido
 * pelo app pelo caminho normal.
 *
 * Nenhum dos três existe hoje: a falha lista o que a tela oferece.
 */
async function escolherCorDoToken(
  page: Page,
  cor: { nome: RegExp; rotulo: string; hex: string },
  oQueEra: string,
): Promise<void> {
  const porNome: Locator = page
    .getByRole('button', { name: cor.nome })
    .or(page.getByRole('radio', { name: cor.nome }))
    .or(page.getByRole('menuitemradio', { name: cor.nome }))
    .or(page.getByRole('checkbox', { name: cor.nome }))
    .or(page.getByRole('tab', { name: cor.nome }))
  if ((await porNome.count()) > 0) {
    await porNome.first().click()
    await page.waitForTimeout(PINTURA_MS)
    return
  }

  const seletores = await seletoresDeCorNaTela(page)
  const doToken = seletores.filter((s) => s.id !== '' && !COR_QUE_NAO_E_DO_TOKEN.test(s.rotulo))
  if (doToken.length > 0) {
    await page.locator(`#${doToken[0].id}`).fill(cor.hex)
    await page.waitForTimeout(PINTURA_MS)
    return
  }

  const lista = page.getByRole('combobox', { name: /cor/i })
  const listaDoToken = (await lista.count()) > 0 ? lista.first() : null
  if (listaDoToken) {
    await listaDoToken.selectOption({ label: cor.rotulo })
    await page.waitForTimeout(PINTURA_MS)
    return
  }

  const controles = await nomesDeControleNaTela(page)
  expect(
    0,
    `${oQueEra}: com a ficha selecionada não há como escolher a cor dela. ` +
      `Nenhum controle com nome ${String(cor.nome)}; seletores de cor na tela: ` +
      `${seletores.map((s) => `${s.rotulo || '(sem rótulo)'}#${s.id}`).join(' | ') || '(nenhum)'}. ` +
      `O que a tela oferece hoje: ${controles.join(' | ')}`,
  ).toBeGreaterThan(0)
}

/** Põe as duas fichas no mapa, cada uma no seu lugar, pelo caminho da interface. */
async function colocarAsDuasFichas(page: Page): Promise<void> {
  await ferramenta(page, 'Selecionar')
  await colocarFicha(page, 'Al')
  await arrastarComoPessoa(page, ONDE_A_FICHA_NASCE, ALIADO)
  await colocarFicha(page, 'In')
  await arrastarComoPessoa(page, ONDE_A_FICHA_NASCE, INIMIGO)
  await limparSelecao(page)
}

test('CONTROLE POSITIVO: as duas fichas aparecem nos dois lugares e hoje nascem com a MESMA cor', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  expect(
    Math.min(caixa.width, caixa.height),
    `o canvas veio ${Math.round(caixa.width)}x${Math.round(caixa.height)}: os pontos desta jornada (até x=1150, y=740) não cabem nele`,
  ).toBeGreaterThan(600)

  await colocarAsDuasFichas(page)

  const [aliado, inimigo, fundo] = await coresNaTela(page, [ALIADO, INIMIGO, FUNDO])
  const leitura = `aliado=${emTexto(aliado)}, inimigo=${emTexto(inimigo)}, fundo=${emTexto(fundo)}`
  expect(
    distanciaCor(aliado, fundo),
    `não há ficha desenhada em (${ALIADO.x}, ${ALIADO.y}): a régua leu a mesma cor do chão (${leitura})`,
  ).toBeGreaterThan(CORES_DIFERENTES)
  expect(
    distanciaCor(inimigo, fundo),
    `não há ficha desenhada em (${INIMIGO.x}, ${INIMIGO.y}): a régua leu a mesma cor do chão (${leitura})`,
  ).toBeGreaterThan(CORES_DIFERENTES)
  // A dor, medida: as duas peças são indistinguíveis uma da outra.
  expect(
    distanciaCor(aliado, inimigo),
    `as duas fichas já saem com cores diferentes sem ninguém escolher nada (${leitura}): a dor desta feature não é mais esta`,
  ).toBeLessThan(CORES_DIFERENTES)

  expect(erros, 'o editor jogou erro ao colocar as duas fichas').toEqual([])
})

test('o mestre dá uma cor a cada ficha no painel e as duas aparecem com cores diferentes ao mesmo tempo', async ({ page }) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  await colocarAsDuasFichas(page)

  const [aliadoAntes, inimigoAntes, fundo] = await coresNaTela(page, [ALIADO, INIMIGO, FUNDO])
  // Calibração: as duas peças estão desenhadas e a régua as distingue do chão.
  expect(
    Math.min(distanciaCor(aliadoAntes, fundo), distanciaCor(inimigoAntes, fundo)),
    `uma das fichas não está desenhada antes de escolher cor: aliado=${emTexto(aliadoAntes)}, inimigo=${emTexto(inimigoAntes)}, fundo=${emTexto(fundo)}`,
  ).toBeGreaterThan(CORES_DIFERENTES)

  // ------------------------------------------------------------------
  // PROVA 1 — a cor escolhida na ficha da esquerda muda o disco DELA.
  // ------------------------------------------------------------------
  await selecionarFicha(page, ALIADO)
  await escolherCorDoToken(page, COR_DO_ALIADO, 'cor da ficha aliada, no painel do token')
  await limparSelecao(page)

  const [aliadoDepois, inimigoNoMeio] = await coresNaTela(page, [ALIADO, INIMIGO])
  expect(
    distanciaCor(aliadoAntes, aliadoDepois),
    `escolher ${COR_DO_ALIADO.rotulo} não mudou nada em (${ALIADO.x}, ${ALIADO.y}): a ficha continua ${emTexto(aliadoAntes)}`,
  ).toBeGreaterThan(CORES_DIFERENTES)

  // ------------------------------------------------------------------
  // PROVA 2 — e não encostou na outra ficha. A cor é de CADA token.
  // ------------------------------------------------------------------
  expect(
    distanciaCor(inimigoAntes, inimigoNoMeio),
    `pintar a ficha da esquerda também pintou a da direita, em (${INIMIGO.x}, ${INIMIGO.y}): ${emTexto(inimigoAntes)} virou ${emTexto(inimigoNoMeio)}`,
  ).toBeLessThan(CORES_DIFERENTES)

  // ------------------------------------------------------------------
  // PROVA 3 — a outra ficha recebe a outra cor.
  // ------------------------------------------------------------------
  await selecionarFicha(page, INIMIGO)
  await escolherCorDoToken(page, COR_DO_INIMIGO, 'cor da ficha inimiga, no painel do token')
  await limparSelecao(page)

  const [aliadoFinal, inimigoFinal, fundoFinal] = await coresNaTela(page, [ALIADO, INIMIGO, FUNDO])
  const leitura = `aliado=${emTexto(aliadoFinal)}, inimigo=${emTexto(inimigoFinal)}, fundo=${emTexto(fundoFinal)}`
  expect(
    distanciaCor(inimigoNoMeio, inimigoFinal),
    `escolher ${COR_DO_INIMIGO.rotulo} não mudou nada em (${INIMIGO.x}, ${INIMIGO.y}) (${leitura})`,
  ).toBeGreaterThan(CORES_DIFERENTES)

  // ------------------------------------------------------------------
  // PROVA 4 — as duas na tela, ao mesmo tempo, com cores diferentes e as duas
  // ainda visíveis contra o chão.
  // ------------------------------------------------------------------
  expect(
    Math.min(distanciaCor(aliadoFinal, fundoFinal), distanciaCor(inimigoFinal, fundoFinal)),
    `uma das fichas sumiu no chão depois de receber cor (${leitura})`,
  ).toBeGreaterThan(CORES_DIFERENTES)
  expect(
    distanciaCor(aliadoFinal, inimigoFinal),
    `as duas fichas continuam com a mesma cor na tela depois de o mestre escolher ${COR_DO_ALIADO.rotulo} e ${COR_DO_INIMIGO.rotulo} (${leitura})`,
  ).toBeGreaterThan(CORES_DIFERENTES)

  expect(erros, 'o editor jogou erro ao escolher a cor das fichas').toEqual([])
})
