// JORNADA "SELEÇÃO MOSTRA ALÇAS" — escrita para SAIR VERMELHA hoje.
//
// O que a pessoa faz: seleciona uma sala e procura por onde pegar para
// redimensionar. Em qualquer editor de desenho (Excalidraw, e antes dele todos
// os outros) o objeto selecionado ganha, nos cantos, uma MARCA que não existe
// no resto da moldura — um quadradinho que diz "pegue aqui". É por ela que a
// pessoa sabe que dá para redimensionar, e onde.
//
// O que acontece hoje (achado 4 do passeio de 20/09/2026,
// `docs/passeio-2026-09-20.md`): "só contorno amarelo; o canto que redimensiona
// é invisível e se descobre por tentativa". O código até desenha alguma coisa
// no canto (`pixi/drawRoomHandles.ts:22`, quadrado de
// `HANDLE_VISUAL_RADIUS = 3.5` de raio, na MESMA cor do contorno,
// `pixi/constants.ts:2`), mas o contorno da seleção é uma linha dupla de ~6 px
// de faixa e o quadradinho cabe INTEIRO dentro dela: MEDIDO em 21/09/2026, dos
// 100 px que o canto ganha ao ser selecionado, 96 são as duas linhas do
// contorno se cruzando e só 4 são a alça. Na tela, o canto de uma sala
// selecionada é indistinguível de "as duas linhas se encontram aqui". A área de
// clique, essa sim, tem 24 px (`lib/roomOps.ts:49`) — ou seja, o alvo é grande
// e mudo: funciona para quem já sabe, e não existe para quem não sabe.
//
// O QUE ESTA JORNADA COBRA, em PIXEL:
//   a marca que aparece no CANTO ao selecionar tem de ser pelo menos DUAS VEZES
//   mais espessa que a linha do contorno na ARESTA. É a menor exigência que
//   ainda significa "aqui tem uma alça, e não mais um pedaço de moldura".
//
// COMO ELA MEDE SEM SE ENGANAR. Nada é medido numa foto só: tudo é a DIFERENÇA
// entre duas fotos do mesmo mapa, uma com nada selecionado e outra com a sala
// selecionada, com o ponteiro parado no MESMO canto vazio nas duas. Assim o
// que a régua conta é exatamente "o que a seleção acrescentou na tela", e não a
// parede, o chão ou a etiqueta do nome.
//
// A espessura perto do canto é lida a 4..10 px DE DISTÂNCIA do canto, andando
// pela aresta de cima. Por quê: em cima do canto passa também a linha vertical
// do contorno, que é longa e contaria como espessura sem ser alça nenhuma.
// Afastando alguns pixels, só sobra a linha horizontal — e a alça, se existir.
// A régua é relativa (o dobro do contorno, não "8 px"), então uma moldura mais
// grossa no futuro sobe a exigência junto, em vez de passar de graça.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** A sala desta jornada, em px do canvas (câmera 1:1, grade de 64 px). */
const SALA = { x1: 320, y1: 256, x2: 832, y2: 576 }
/** Canto de cima à esquerda — onde a alça deveria estar. */
const CANTO = { x: SALA.x1, y: SALA.y1 }
/** Um trecho da MESMA aresta de cima, longe de qualquer canto: a régua do contorno. */
const MEIO_DA_ARESTA = { x: 576, y: SALA.y1 }
/** Onde a pessoa clica para selecionar a sala: dentro dela, longe de canto e de aresta. */
const DENTRO_DA_SALA = { x: 576, y: 420 }
/** Canto vazio do canvas, fora da sala: onde o ponteiro fica parado nas duas fotos. */
const VAZIO = { x: 1150, y: 720 }
/** Até onde a régua procura a marca, andando pela aresta a partir do canto. */
const DISTANCIAS_DO_CANTO = [4, 5, 6, 7, 8, 9, 10]
/** Meia altura da varredura vertical. Cobre folgadamente contorno e alça. */
const ALCANCE_VERTICAL = 20
/** Quanto uma alça precisa ser mais espessa que o contorno para contar como alça. */
const QUANTAS_VEZES_O_CONTORNO = 2
/** Quanto a cor precisa mudar num pixel para contar como "a seleção desenhou aqui". */
const MUDANCA_DE_COR = 24
/** Botão parado antes de soltar: é o que separa um toque de pessoa de um clique instantâneo. */
const TOQUE_MS = 160
/** Folga para o Pixi terminar de pintar antes da foto. */
const PINTURA_MS = 600

/** O tipo da foto vem da própria API: o tsconfig dos e2e não carrega os tipos do Node. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>

interface Caixa {
  x: number
  y: number
  width: number
  height: number
}

async function caixaDoCanvas(page: Page): Promise<Caixa> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

function barraDeFerramentas(page: Page) {
  return page.getByRole('toolbar', { name: 'Ferramentas do mapa' })
}

async function ferramenta(page: Page, nome: string): Promise<void> {
  await barraDeFerramentas(page).getByRole('button', { name: nome, exact: true }).click()
}

/** Toque de pessoa: desce, fica parado um instante, sobe. */
async function tocarComoPessoa(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

async function fotoDoCanvas(page: Page): Promise<{ foto: Foto; largura: number }> {
  const canvas = page.locator('canvas')
  const caixa = await canvas.boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return { foto: await canvas.screenshot(), largura: caixa.width }
}

/**
 * Quantos pixels de uma coluna vertical MUDARAM entre duas fotos do canvas.
 *
 * Lê os pixels das FOTOS — o que o usuário vê —, decodificando os dois PNG no
 * próprio navegador em canvas 2D descartáveis. Só LEITURA: nada do app é
 * tocado (mesmo helper de `task-jornada-saida-sem-parede.spec.ts`).
 */
async function espessuraQueMudou(
  page: Page,
  antes: Foto,
  depois: Foto,
  larguraCss: number,
  colunas: number[],
  centroY: number,
): Promise<number[]> {
  return page.evaluate(
    async ({ a64, d64, larguraCss, colunas, centroY, alcance, limiar }) => {
      const ler = async (b64: string) => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
        const bmp = await createImageBitmap(blob)
        const lona = document.createElement('canvas')
        lona.width = bmp.width
        lona.height = bmp.height
        const ctx = lona.getContext('2d')
        if (!ctx) throw new Error('sem contexto 2d para ler a foto')
        ctx.drawImage(bmp, 0, 0)
        return { imagem: ctx.getImageData(0, 0, bmp.width, bmp.height), largura: bmp.width }
      }
      const A = await ler(a64)
      const D = await ler(d64)
      const escala = A.largura / larguraCss
      return colunas.map((x) => {
        let mudaram = 0
        for (let dy = -alcance; dy <= alcance; dy += 1) {
          const px = Math.round(x * escala)
          const py = Math.round((centroY + dy) * escala)
          const i = (py * A.largura + px) * 4
          const j = (py * D.largura + px) * 4
          const dist = Math.max(
            Math.abs(A.imagem.data[i] - D.imagem.data[j]),
            Math.abs(A.imagem.data[i + 1] - D.imagem.data[j + 1]),
            Math.abs(A.imagem.data[i + 2] - D.imagem.data[j + 2]),
          )
          if (dist > limiar) mudaram += 1
        }
        return mudaram
      })
    },
    {
      a64: antes.toString('base64'),
      d64: depois.toString('base64'),
      larguraCss,
      colunas,
      centroY,
      alcance: ALCANCE_VERTICAL,
      limiar: MUDANCA_DE_COR,
    },
  )
}

/** Desenha a sala arrastando, como o mestre faz, e tira o campo de nome da frente. */
async function desenharSala(page: Page, caixa: Caixa): Promise<void> {
  await ferramenta(page, 'Sala')
  await page.mouse.move(caixa.x + SALA.x1, caixa.y + SALA.y1)
  await page.mouse.down()
  await page.mouse.move(caixa.x + SALA.x2, caixa.y + SALA.y2, { steps: 10 })
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
  const nome = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  await expect(nome, 'a Sala não foi criada: o campo de nome dela nem apareceu').toBeVisible({ timeout: 5000 })
  await nome.press('Escape')
  await page.waitForTimeout(PINTURA_MS)
}

/** Deixa a ferramenta Selecionar na mão, nada selecionado e o ponteiro parado no vazio. */
async function semSelecao(page: Page, caixa: Caixa): Promise<void> {
  await ferramenta(page, 'Selecionar')
  await tocarComoPessoa(page, caixa.x + VAZIO.x, caixa.y + VAZIO.y)
  await expect(
    page.getByRole('button', { name: 'Apagar região selecionada' }),
    'clicar no vazio não limpou a seleção: as duas fotos não partiriam do mesmo estado',
  ).toHaveCount(0)
}

/** Seleciona a sala e leva o ponteiro de volta ao MESMO canto vazio da outra foto. */
async function selecionarSala(page: Page, caixa: Caixa): Promise<void> {
  await tocarComoPessoa(page, caixa.x + DENTRO_DA_SALA.x, caixa.y + DENTRO_DA_SALA.y)
  await expect(
    page.getByRole('button', { name: 'Apagar região selecionada' }),
    `clicar dentro da sala em (${DENTRO_DA_SALA.x}, ${DENTRO_DA_SALA.y}) não selecionou nada`,
  ).toBeVisible({ timeout: 5000 })
  await page.mouse.move(caixa.x + VAZIO.x, caixa.y + VAZIO.y, { steps: 8 })
  await page.waitForTimeout(PINTURA_MS)
}

test('CONTROLE POSITIVO: a sala se desenha, selecionar deixa marca visível na aresta, e parada a tela não muda', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  expect(
    Math.min(caixa.width, caixa.height),
    `o canvas veio ${Math.round(caixa.width)}x${Math.round(caixa.height)}: a sala desta jornada (até 832x576) não cabe nele`,
  ).toBeGreaterThan(600)

  await desenharSala(page, caixa)
  await semSelecao(page, caixa)

  // Controle NEGATIVO: parada, a tela não muda. Sem isto, "mudou tanto" não
  // provaria nada — bastaria o canvas tremer. Insiste antes de reprovar: logo
  // depois do editor abrir, o Pixi ainda pode estar assentando a primeira
  // pintura, e reprovar nesse instante seria medir a partida e não o app.
  const TENTATIVAS = 8
  const colunasDeRuido = [MEIO_DA_ARESTA.x, CANTO.x + 6]
  const { foto: primeira, largura } = await fotoDoCanvas(page)
  let anterior = primeira
  let ruido: number[] = []
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
    await page.waitForTimeout(PINTURA_MS)
    const { foto: atual } = await fotoDoCanvas(page)
    ruido = await espessuraQueMudou(page, anterior, atual, largura, colunasDeRuido, MEIO_DA_ARESTA.y)
    anterior = atual
    if (Math.max(...ruido) === 0) break
  }
  expect(
    Math.max(...ruido),
    `a tela do editor muda sozinha parada (${ruido.join(' / ')} px em ${TENTATIVAS} leituras seguidas): ` +
      'nenhuma medida de "o que a seleção acrescentou" seria confiável',
  ).toBe(0)
  const segunda = anterior

  await selecionarSala(page, caixa)
  const { foto: comSelecao } = await fotoDoCanvas(page)

  const [naAresta] = await espessuraQueMudou(page, segunda, comSelecao, largura, [MEIO_DA_ARESTA.x], MEIO_DA_ARESTA.y)
  expect(
    naAresta,
    `selecionar a sala não desenhou nada em cima da aresta, em x=${MEIO_DA_ARESTA.x}: ` +
      'sem contorno visível não há régua com que comparar a alça do canto',
  ).toBeGreaterThan(0)

  expect(erros, 'o editor jogou erro ao desenhar ou selecionar a sala').toEqual([])
})

test('a sala selecionada mostra no canto uma marca mais espessa que a linha do contorno', async ({ page }) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  await desenharSala(page, caixa)
  await semSelecao(page, caixa)

  // A foto de partida só serve depois que a tela parou: duas leituras seguidas
  // sem nenhuma diferença nas colunas que esta jornada mede. Tremor do Pixi
  // entrando na conta de "o que a seleção acrescentou" falsearia a medida.
  const colunasMedidas = [MEIO_DA_ARESTA.x, ...DISTANCIAS_DO_CANTO.map((dx) => CANTO.x + dx)]
  const { foto: primeira, largura } = await fotoDoCanvas(page)
  let semNada = primeira
  let tremor: number[] = []
  for (let tentativa = 1; tentativa <= 8; tentativa += 1) {
    await page.waitForTimeout(PINTURA_MS)
    const { foto: atual } = await fotoDoCanvas(page)
    tremor = await espessuraQueMudou(page, semNada, atual, largura, colunasMedidas, CANTO.y)
    semNada = atual
    if (Math.max(...tremor) === 0) break
  }
  expect(
    Math.max(...tremor),
    `a tela do editor muda sozinha parada (${tremor.join(' / ')} px): a medida do que a seleção acrescenta não seria confiável`,
  ).toBe(0)

  await selecionarSala(page, caixa)
  const { foto: comSelecao } = await fotoDoCanvas(page)

  // ---------------------------------------------------------------------
  // A RÉGUA — a espessura do contorno, longe de qualquer canto.
  // ---------------------------------------------------------------------
  const [contorno] = await espessuraQueMudou(page, semNada, comSelecao, largura, [MEIO_DA_ARESTA.x], MEIO_DA_ARESTA.y)
  expect(
    contorno,
    `selecionar a sala não desenhou nada em cima da aresta, em x=${MEIO_DA_ARESTA.x}: ` +
      'a régua desta jornada não existe, e qualquer veredito sobre o canto seria chute',
  ).toBeGreaterThan(0)

  // ---------------------------------------------------------------------
  // A MARCA DO CANTO — a mais espessa que a seleção acrescenta a 4..10 px do
  // canto, andando pela aresta de cima.
  // ---------------------------------------------------------------------
  const colunas = DISTANCIAS_DO_CANTO.map((dx) => CANTO.x + dx)
  const perfil = await espessuraQueMudou(page, semNada, comSelecao, largura, colunas, CANTO.y)
  const marca = Math.max(...perfil)
  const leitura = DISTANCIAS_DO_CANTO.map((dx, i) => `${dx}px:${perfil[i]}`).join(' ')

  expect(
    marca,
    `no canto (${CANTO.x}, ${CANTO.y}) a sala selecionada não ganha marca nenhuma além da própria moldura: ` +
      `a ${DISTANCIAS_DO_CANTO[0]}..${DISTANCIAS_DO_CANTO[DISTANCIAS_DO_CANTO.length - 1]} px do canto a seleção acrescenta ${leitura}, ` +
      `e no meio da aresta (x=${MEIO_DA_ARESTA.x}) ela acrescenta ${contorno} px. ` +
      `Alça de verdade pediria pelo menos ${QUANTAS_VEZES_O_CONTORNO}x o contorno (${QUANTAS_VEZES_O_CONTORNO * contorno} px): ` +
      'do jeito que está, o canto é só o lugar onde as duas linhas da moldura se cruzam, e quem não sabe que dá para redimensionar não descobre olhando.',
  ).toBeGreaterThanOrEqual(QUANTAS_VEZES_O_CONTORNO * contorno)

  expect(erros, 'o editor jogou erro ao selecionar a sala').toEqual([])
})
