// Jornada de usuário: "abri um portão grande demais, troquei para porta
// normal no painel — a parede tem de voltar onde o vão encolheu".
//
// Hoje `setWallDoorKind` (src/lib/mapFactory.ts:672) redimensiona só o
// pedaço-porta e deixa os pedaços sólidos irmãos da mesma aresta onde estavam:
// trocar Portão (vão 96) por Normal (vão 32) abre duas faixas de 32px SEM
// PAREDE NENHUMA na aresta da sala. O mestre não pediu passagem ali.
//
// As duas provas são no que aparece na TELA:
//  1. o pixel do canvas em cima da faixa que voltou a ser parede tem de ficar
//     da cor da parede (mesma da parte sólida da mesma aresta), não da cor do
//     que está atrás;
//  2. um token arrastado pelo ponteiro por essa faixa não pode terminar do
//     outro lado — o pixel do destino, fora da sala, continua como estava.
//
// Geometria escolhida (tudo em px de mundo = px do canvas, câmera 1:1 como nos
// demais specs, e longe do painel da esquerda, que cobre o canvas até x~240):
// sala de (320,256) a (832,576); a aresta de cima vai de x=320 a x=832. Portão
// criado no clique em x=576 ocupa 528..624. Virando Normal, a porta fica em
// 560..592 e as faixas 528..560 e 592..624 ficam abertas. x=544 é o meio da
// primeira faixa — e também centro de célula da grade de 64px, então o token
// arrastado para lá cai exatamente em cima dela.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

const ARESTA_Y = 256
/** Meio da faixa que o vão menor devolveu para a parede (528..560). */
const X_BURACO = 544
/** Trecho que continua sólido em qualquer tipo de porta — a calibração da cor. */
const X_SOLIDO = 400
/** Dentro da sala, longe da porta — a cor do "fundo" com que a parede contrasta. */
const Y_DENTRO = 320

/** O que `locator.screenshot()` devolve — `Buffer` não é tipo declarado no
 *  tsconfig dos e2e (sem @types/node), então o tipo vem da própria API. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>

interface Amostra {
  /** Maior luminância de uma janela 7x7 em volta do ponto: a linha da parede tem
   *  1-3px de tela e pode cair meio pixel para qualquer lado (pixelAlign.ts). */
  luz: number
  /** Cor do pixel central, para comparar duas fotos do mesmo ponto. */
  rgb: [number, number, number]
}

/**
 * Lê pixels da FOTO do canvas (o que o usuário vê), decodificando o PNG com o
 * próprio decodificador do navegador num canvas 2D descartável — nenhum estado
 * do app é lido ou tocado.
 */
async function amostrar(page: Page, foto: Foto, larguraCss: number, pontos: { x: number; y: number }[]): Promise<Amostra[]> {
  return page.evaluate(
    async ({ b64, larguraCss, pontos }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escala = bmp.width / larguraCss
      const em = (x: number, y: number): [number, number, number] => {
        const cx = Math.min(width - 1, Math.max(0, Math.round(x)))
        const cy = Math.min(height - 1, Math.max(0, Math.round(y)))
        const i = (cy * width + cx) * 4
        return [data[i], data[i + 1], data[i + 2]]
      }
      return pontos.map((p) => {
        const px = p.x * escala
        const py = p.y * escala
        let luz = 0
        for (let dy = -3; dy <= 3; dy += 1) {
          for (let dx = -3; dx <= 3; dx += 1) {
            const [r, g, b] = em(px + dx, py + dy)
            luz = Math.max(luz, 0.299 * r + 0.587 * g + 0.114 * b)
          }
        }
        return { luz: Math.round(luz), rgb: em(px, py) }
      })
    },
    { b64: foto.toString('base64'), larguraCss, pontos },
  )
}

async function fotoDoCanvas(page: Page): Promise<{ foto: Foto; largura: number }> {
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { foto: await canvas.screenshot(), largura: box.width }
}

const distanciaCor = (a: [number, number, number], b: [number, number, number]): number =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))

async function ferramenta(page: Page, nome: string) {
  await page.getByRole('button', { name: nome, exact: true }).click()
}

/**
 * Sala + porta pelas ferramentas da barra, com ponteiro de verdade, e a troca
 * de tipo pelo painel. Devolve a bounding box do canvas.
 */
async function salaComPortaoTrocadoParaNormal(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // Desenha a sala arrastando, como o mestre faz.
  await ferramenta(page, 'Sala')
  await page.mouse.move(box.x + 320, box.y + 256)
  await page.mouse.down()
  await page.mouse.move(box.x + 832, box.y + 576, { steps: 8 })
  await page.mouse.up()
  // O campo de nome nasce em cima da Sala e rouba o foco: Esc mantém o padrão.
  await page.getByRole('textbox', { name: 'Nome da sala no mapa' }).press('Escape')

  // Porta do tipo Portão, clicando em cima da aresta de cima.
  await ferramenta(page, 'Porta')
  await page.getByRole('radio', { name: 'Portão', exact: true }).click()
  await page.mouse.click(box.x + 576, box.y + ARESTA_Y)

  // Seleciona a porta recém-criada e troca o tipo NO PAINEL.
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(box.x + 576, box.y + ARESTA_Y)
  const portao = page.getByRole('radio', { name: 'Portão', exact: true })
  await expect(portao).toBeChecked()
  const normal = page.getByRole('radio', { name: 'Normal', exact: true })
  await normal.click()
  await expect(normal).toBeChecked()

  // Tira a seleção (clique no vazio) para nenhum realce entrar nas amostras.
  await page.mouse.click(box.x + 1100, box.y + 700)
  return box
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  // Mapa limpo e sem grade, como os demais specs fazem: a foto do canvas tem de
  // ter só o que a jornada desenhou, senão a linha da grade entra na amostra.
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.loadMap(mapFactory.createEmptyMap('map_e2e_porta_buraco', 'E2E Porta sem buraco', 30, 20, 64))
    store.setActiveTool('select')
  })
})

test('1. trocar Portão por Normal: a parede aparece de volta onde o vão encolheu', async ({ page }) => {
  await salaComPortaoTrocadoParaNormal(page)

  const { foto, largura } = await fotoDoCanvas(page)
  const [solido, buraco, dentro] = await amostrar(page, foto, largura, [
    { x: X_SOLIDO, y: ARESTA_Y },
    { x: X_BURACO, y: ARESTA_Y },
    { x: X_BURACO, y: Y_DENTRO },
  ])

  const leitura = `parede sólida=${solido.luz}, faixa em x=${X_BURACO}=${buraco.luz}, dentro da sala=${dentro.luz}`
  // Calibração: a foto precisa distinguir parede de fundo, senão o teste passaria à toa.
  expect(solido.luz - dentro.luz, `a foto não distingue parede de fundo (${leitura})`).toBeGreaterThan(30)
  // A prova: o pixel em cima da faixa 528..560 tem de ser parede, como em x=400.
  expect(buraco.luz, `buraco de parede na tela em x=${X_BURACO}, y=${ARESTA_Y} (${leitura})`).toBeGreaterThan(
    dentro.luz + (solido.luz - dentro.luz) * 0.6,
  )
})

test('2. depois da troca, o token arrastado não atravessa a aresta onde não há porta', async ({ page }) => {
  const box = await salaComPortaoTrocadoParaNormal(page)

  // Token de cenário: a ferramenta Token está escondida por feature flag
  // (FEATURES.tokenTool), então ele entra pela store — o GESTO sob teste é o
  // arrasto abaixo, não a criação.
  await page.evaluate(async () => {
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.addToken({ id: 'tk_jornada', characterId: null, name: 'Pé', x: 544, y: 288, size: 1, image: null })
    store.setSelection([])
  })

  const alvo = { x: X_BURACO, y: 224 } // uma célula ACIMA da aresta: fora da sala

  // Arrasto de verdade, feito por uma função só: pega o token onde ele está,
  // leva até o destino e faz pausa antes de soltar.
  const arrastar = async (de: { x: number; y: number }, para: { x: number; y: number }) => {
    await page.mouse.move(box.x + de.x, box.y + de.y)
    await page.mouse.down()
    await page.mouse.move(box.x + para.x, box.y + para.y, { steps: 12 })
    await page.waitForTimeout(150)
    await page.mouse.up()
    await page.waitForTimeout(150)
  }

  // ---------------------------------------------------------------------
  // CONTROLE POSITIVO — sem ele este teste passa com o app MORTO.
  // A asserção da dor é um TETO ("a cor do destino não mudou"). Se o arrasto
  // nunca pegar o token — que é exatamente a dor 2 medida em dois passeios
  // cegos, "arrastar token com Selecionar não move o token" — nada na tela
  // muda, o delta é 0 e o teto aprova. O teste diria "a parede segurou o
  // token" quando na verdade o ponteiro não moveu token nenhum.
  // Então primeiro o MESMO gesto tem de mover o token para um destino LIVRE,
  // dentro da sala, longe da aresta. Se este piso falhar, o que está quebrado
  // é o arrasto, e a leitura do teto abaixo não significa nada.
  // ---------------------------------------------------------------------
  const livre = { x: X_BURACO, y: 416 } // ainda dentro da sala (256..576), sem parede no caminho
  const antesDoControle = await fotoDoCanvas(page)
  const [livreAntes] = await amostrar(page, antesDoControle.foto, antesDoControle.largura, [livre])

  await arrastar({ x: 544, y: 288 }, livre)

  const depoisDoControle = await fotoDoCanvas(page)
  const [livreDepois] = await amostrar(page, depoisDoControle.foto, depoisDoControle.largura, [livre])
  const deltaControle = distanciaCor(livreAntes.rgb, livreDepois.rgb)
  expect(
    deltaControle,
    `CONTROLE POSITIVO: o arrasto não moveu o token nem para um destino livre dentro da sala (x=${livre.x}, y=${livre.y}): a cor ficou em ${livreAntes.rgb.join(',')}. Sem este piso, o teto abaixo aprovaria um app que simplesmente não arrasta.`,
  ).toBeGreaterThan(24)

  // ---------------------------------------------------------------------
  // A DOR — agora que o arrasto está provado, o mesmo gesto atravessando a
  // faixa que voltou a ser parede não pode depositar o token do lado de fora.
  // ---------------------------------------------------------------------
  const antes = await fotoDoCanvas(page)
  const [destinoAntes] = await amostrar(page, antes.foto, antes.largura, [alvo])

  await arrastar(livre, alvo)

  const depois = await fotoDoCanvas(page)
  const [destinoDepois] = await amostrar(page, depois.foto, depois.largura, [alvo])

  const delta = distanciaCor(destinoAntes.rgb, destinoDepois.rgb)
  expect(
    delta,
    `o token apareceu do lado de fora da sala em x=${alvo.x}, y=${alvo.y}: a cor mudou de ${destinoAntes.rgb.join(',')} para ${destinoDepois.rgb.join(',')}`,
  ).toBeLessThan(24)
})
