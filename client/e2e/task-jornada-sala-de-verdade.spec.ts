/*
 * Jornada "sala de verdade" — prova PELA TELA que o mestre consegue distinguir
 * uma sala da outra e que a Sala Circular é redonda.
 *
 * Nada aqui lê a store: os rótulos das salas são desenhados DENTRO do canvas
 * (pixi/drawRoomNames.ts), então a única forma honesta de julgar o que o
 * usuário vê é medir os pixels que o app pintou. A foto é decodificada pelo
 * próprio navegador (`createImageBitmap` + canvas 2D descartável), como nas
 * jornadas irmãs — o tsconfig dos e2e não expõe os tipos de Node, então não há
 * `Buffer` nem `node:zlib` aqui. O canvas só LÊ a imagem: nenhum estado do app
 * é tocado.
 *
 * As três afirmações usam `expect.soft` para que UMA rodada mostre os três
 * buracos de uma vez. Cada uma vem acompanhada de um CONTROLE POSITIVO duro:
 * sem ele, um vermelho poderia ser só cegueira da medição (recorte no lugar
 * errado, limiar inalcançável, campo de diferença sempre zero).
 *
 * Dores medidas (passeio cego de 17/09/2026):
 *  a) toda sala nasce com o mesmo nome fixo — drawingFactory.ts:53
 *     DEFAULT_ROOM_NAME = 'Sala', usado direto em :76,94 e :155,167, sem que
 *     nenhuma dessas funções receba as salas já existentes.
 *  b) o rótulo da mãe é ancorado no centróide do próprio polígono
 *     (drawRoomNames.ts:27-45) sem enxergar as filhas, então cai em cima da
 *     sala de dentro.
 *  c) a Sala Circular usa ROOM_CIRCLE_SIDES = 24 fixo (lib/roomCircle.ts), que
 *     não escala com o raio: num raio grande os lados retos aparecem.
 */
import { test, expect, type Page } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })

// ---------------------------------------------------------------------------
// Limiares. Todos calibrados contra o app rodando, com folga medida, e todos
// exercitados por um controle positivo mais abaixo.
// ---------------------------------------------------------------------------

/** Dois rótulos contam como "distintos" a partir de 0,4% do recorte trocado.
 *  Hoje salas diferentes dão recortes IDÊNTICOS (0 pixel). A diferença mais
 *  fraca que um conserto plausível produz — "Sala 1" vs "Sala 2", um único
 *  caractere — mede 1,89%, quase 5x este limiar. */
const LIMIAR_NOME = 0.004

/** Quanta tinta do rótulo da MÃE pode cair dentro da sala filha: 0,1% do
 *  recorte da filha (~60 pixels). Um rótulo que não invade dá exatamente 0.
 *  Hoje mede 0,30%. */
const LIMIAR_INVASAO = 0.001

/** Variação do raio desenhado ((máx - mín) / raio médio) que ainda conta como
 *  "redondo": 0,6%. Um polígono de N lados varia 1 - cos(pi/N); 24 lados dão
 *  0,86% de geometria (e 1,00% medidos, com a esquadria do contorno), 36 lados
 *  dariam ~0,47% e 48 lados ~0,27%. Ou seja: o limiar reprova os 24 de hoje e
 *  aprova qualquer contagem a partir de ~36. */
const LIMIAR_CIRCULO = 0.006

/** Diferença de canal (0..255) acima da qual o pixel conta como "mudou". */
const LIMIAR_TINTA = 24
/** Mesmo corte, mas para achar a silhueta de uma forma contra o fundo vazio. */
const LIMIAR_SILHUETA = 40

/** O que `page.screenshot()` devolve — `Buffer` não é tipo declarado no
 *  tsconfig dos e2e (sem @types/node), então o tipo vem da própria API. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

// ---------------------------------------------------------------------------
// Medições. Toda leitura de pixel acontece dentro do navegador; daqui só saem
// números.
// ---------------------------------------------------------------------------

/**
 * Fração do recorte em que as duas telas discordam, contando um pixel como
 * "mudou" quando algum canal R/G/B se afasta mais que `LIMIAR_TINTA`.
 */
async function fracaoDiferente(page: Page, a: Foto, b: Foto): Promise<number> {
  return page.evaluate(
    async ({ aB64, bB64, limiar }) => {
      const lerPixels = async (b64: string) => {
        const blob = await (await fetch('data:image/png;base64,' + b64)).blob()
        // `colorSpaceConversion: 'none'` mantém os bytes como o PNG os traz:
        // sem isso, um perfil de cor embutido mudaria os valores lidos.
        const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none' })
        const canvas = document.createElement('canvas')
        canvas.width = bmp.width
        canvas.height = bmp.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('sem contexto 2d para ler a foto')
        ctx.drawImage(bmp, 0, 0)
        return ctx.getImageData(0, 0, bmp.width, bmp.height)
      }
      const A = await lerPixels(aB64)
      const B = await lerPixels(bB64)
      if (A.width !== B.width || A.height !== B.height) throw new Error('recortes de tamanhos diferentes')
      const total = A.width * A.height
      let mudaram = 0
      for (let i = 0; i < total; i++) {
        const j = i * 4
        const d = Math.max(
          Math.abs(A.data[j] - B.data[j]),
          Math.abs(A.data[j + 1] - B.data[j + 1]),
          Math.abs(A.data[j + 2] - B.data[j + 2]),
        )
        if (d > limiar) mudaram++
      }
      return mudaram / total
    },
    { aB64: a.toString('base64'), bB64: b.toString('base64'), limiar: LIMIAR_TINTA },
  )
}

interface Redondeza {
  variacao: number
  media: number
  min: number
  max: number
}

/**
 * Compara a tela vazia com a tela que tem a forma e mede, para cada ângulo, a
 * distância do centro de massa até a borda externa desenhada. A borda sai com
 * precisão sub-pixel (interpolação linear no degrau do antialiasing), senão a
 * quantização de 1 pixel esconderia a faceta.
 *
 * Devolve a variação relativa do raio: 0 = círculo perfeito.
 */
async function variacaoDoRaio(page: Page, vazio: Foto, comForma: Foto, nAngulos = 720): Promise<Redondeza> {
  return page.evaluate(
    async ({ vazioB64, formaB64, limiar, angulos }) => {
      const lerPixels = async (b64: string) => {
        const blob = await (await fetch('data:image/png;base64,' + b64)).blob()
        const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none' })
        const canvas = document.createElement('canvas')
        canvas.width = bmp.width
        canvas.height = bmp.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('sem contexto 2d para ler a foto')
        ctx.drawImage(bmp, 0, 0)
        return ctx.getImageData(0, 0, bmp.width, bmp.height)
      }
      const A = await lerPixels(vazioB64)
      const B = await lerPixels(formaB64)
      if (A.width !== B.width || A.height !== B.height) throw new Error('recortes de tamanhos diferentes')

      const largura = A.width
      const altura = A.height
      const campo = new Float32Array(largura * altura)
      for (let i = 0; i < largura * altura; i++) {
        const j = i * 4
        campo[i] = Math.max(
          Math.abs(A.data[j] - B.data[j]),
          Math.abs(A.data[j + 1] - B.data[j + 1]),
          Math.abs(A.data[j + 2] - B.data[j + 2]),
        )
      }

      let sx = 0
      let sy = 0
      let n = 0
      for (let y = 0; y < altura; y++) {
        for (let x = 0; x < largura; x++) {
          if (campo[y * largura + x] > limiar) {
            sx += x
            sy += y
            n++
          }
        }
      }
      if (n === 0) throw new Error('nada apareceu na tela entre as duas capturas')
      const cx = sx / n
      const cy = sy / n
      const rEstimado = Math.sqrt(n / Math.PI)

      const amostra = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= largura - 1 || y >= altura - 1) return 0
        const x0 = Math.floor(x)
        const y0 = Math.floor(y)
        const fx = x - x0
        const fy = y - y0
        const i = y0 * largura + x0
        const v00 = campo[i]
        const v10 = campo[i + 1]
        const v01 = campo[i + largura]
        const v11 = campo[i + largura + 1]
        return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
      }

      const passo = 0.2
      const raios: number[] = []
      for (let k = 0; k < angulos; k++) {
        const ang = (k * 2 * Math.PI) / angulos
        const dx = Math.cos(ang)
        const dy = Math.sin(ang)
        let achado = -1
        let anterior = 0
        for (let r = rEstimado * 1.2; r >= rEstimado * 0.8; r -= passo) {
          const v = amostra(cx + dx * r, cy + dy * r)
          if (v >= limiar) {
            const fracao = (limiar - anterior) / Math.max(1e-6, v - anterior)
            achado = r + passo - passo * fracao
            break
          }
          anterior = v
        }
        if (achado < 0) throw new Error('borda não encontrada no ângulo ' + k)
        raios.push(achado)
      }
      let max = raios[0]
      let min = raios[0]
      let soma = 0
      for (const r of raios) {
        if (r > max) max = r
        if (r < min) min = r
        soma += r
      }
      const media = soma / raios.length
      return { variacao: (max - min) / media, media, min, max }
    },
    {
      vazioB64: vazio.toString('base64'),
      formaB64: comForma.toString('base64'),
      limiar: LIMIAR_SILHUETA,
      angulos: nAngulos,
    },
  )
}

// ---------------------------------------------------------------------------
// Gestos. Só ponteiro, teclado e botões visíveis — nada de store nem de evento
// sintético.
// ---------------------------------------------------------------------------

async function abrirEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Mapas' }).click()
  await page.getByRole('button', { name: 'Criar mapa', exact: true }).click()
  await page.waitForSelector('canvas')
  await page.waitForTimeout(700)
}

async function ferramenta(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: nome, exact: true }).click()
  await page.waitForTimeout(250)
}

/** Arrasta de um canto ao outro, com pausa antes de soltar. */
async function arrastar(page: Page, x1: number, y1: number, x2: number, y2: number): Promise<void> {
  await page.mouse.move(x1, y1)
  await page.mouse.down()
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 5 })
  await page.mouse.move(x2, y2, { steps: 5 })
  await page.waitForTimeout(120)
  await page.mouse.up()
}

/** Ferramenta Sala + arrasto + Enter confirmando o nome que o app sugere. */
async function desenharSala(page: Page, x1: number, y1: number, x2: number, y2: number): Promise<void> {
  await ferramenta(page, 'Sala')
  await arrastar(page, x1, y1, x2, y2)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(250)
}

/** Tira a seleção para que nenhum destaque amarelo entre nas medições. */
async function limparSelecao(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(350)
}

/** Seleciona a sala que está sob o ponto e troca o nome pelo painel. */
async function renomearSalaEm(page: Page, x: number, y: number, nome: string): Promise<void> {
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(x, y)
  await expect(page.locator('#lb-room-name')).toBeVisible()
  await page.locator('#lb-room-name').fill(nome)
  await page.locator('#lb-room-name').press('Enter')
  await page.waitForTimeout(300)
  await limparSelecao(page)
}

// ---------------------------------------------------------------------------
// Geometria das cenas (coordenadas de tela; a câmera nasce em 1:1 e o canvas
// ocupa a janela inteira, então o que eu aponto é o que é desenhado).
// ---------------------------------------------------------------------------

/** Três salas iguais, lado a lado, deslocadas por múltiplos da grade (64) para
 *  que o fundo dentro dos três recortes seja idêntico — assim a única coisa
 *  que pode diferenciar os recortes é o texto do rótulo. */
const SALAS_LADO_A_LADO = [
  { x1: 384, y1: 200, x2: 576, y2: 328 },
  { x1: 640, y1: 200, x2: 832, y2: 328 },
  { x1: 896, y1: 200, x2: 1088, y2: 328 },
]
const CENTROS_X = [480, 736, 992]
const CENTRO_Y = 264
const RECORTE_ROTULO = { largura: 140, altura: 48 }
const recorteRotulo = (cx: number) => ({
  x: cx - RECORTE_ROTULO.largura / 2,
  y: CENTRO_Y - RECORTE_ROTULO.altura / 2,
  width: RECORTE_ROTULO.largura,
  height: RECORTE_ROTULO.altura,
})

const MAE = { x1: 384, y1: 192, x2: 896, y2: 640 }
const FILHA = { x1: 384, y1: 192, x2: 640, y2: 448 }
/** Só o miolo da filha, 6 px para dentro das paredes, para não medir o contorno. */
const RECORTE_FILHA = { x: FILHA.x1 + 6, y: FILHA.y1 + 6, width: FILHA.x2 - FILHA.x1 - 12, height: FILHA.y2 - FILHA.y1 - 12 }
/** Ponto dentro da mãe e fora da filha. */
const PONTO_MAE = { x: 800, y: 580 }
/** Ponto dentro da filha e longe do rótulo dela. */
const PONTO_FILHA = { x: 450, y: 240 }

const CIRCULO = { cx: 670, cy: 470, raio: 280 }
/** Moldura com 20 px de folga em volta da sala redonda. A folga também mantém
 *  o recorte longe da barra de dica do topo, que muda de texto conforme a
 *  ferramenta e contaminaria a silhueta. */
const RECORTE_CIRCULO = {
  x: CIRCULO.cx - CIRCULO.raio - 20,
  y: CIRCULO.cy - CIRCULO.raio - 20,
  width: (CIRCULO.raio + 20) * 2,
  height: (CIRCULO.raio + 20) * 2,
}

async function desenharDoCentro(page: Page): Promise<void> {
  await arrastar(page, CIRCULO.cx, CIRCULO.cy, CIRCULO.cx + CIRCULO.raio, CIRCULO.cy)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
}

// ---------------------------------------------------------------------------

test('o mestre distingue uma sala da outra na tela, o rótulo da mãe não cobre a filha e a Sala Circular é redonda', async ({ page }) => {
  test.setTimeout(150_000)

  // =========================================================================
  // 1. NOMES DISTINTOS — três salas desenhadas com o ponteiro têm de dar três
  //    rótulos diferentes na tela.
  // =========================================================================
  await abrirEditor(page)
  for (const s of SALAS_LADO_A_LADO) await desenharSala(page, s.x1, s.y1, s.x2, s.y2)
  await limparSelecao(page)

  const rotulos: Foto[] = []
  for (const cx of CENTROS_X) rotulos.push(await page.screenshot({ clip: recorteRotulo(cx) }))

  const pares: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
  ]
  for (const [i, j] of pares) {
    const diferenca = await fracaoDiferente(page, rotulos[i], rotulos[j])
    expect
      .soft(diferenca, 'rótulos das salas ' + (i + 1) + ' e ' + (j + 1) + ' precisam ser distinguíveis na tela')
      .toBeGreaterThan(LIMIAR_NOME)
  }

  // CONTROLE POSITIVO do LIMIAR_NOME: com nomes que diferem por UM caractere
  // — a diferença mais fraca que um conserto plausível produziria — o mesmo
  // recorte, no mesmo lugar, tem de passar do limiar. Sem isto, o vermelho
  // acima poderia ser recorte no lugar errado.
  await renomearSalaEm(page, SALAS_LADO_A_LADO[0].x1 + 36, SALAS_LADO_A_LADO[0].y1 + 100, 'Sala 1')
  await renomearSalaEm(page, SALAS_LADO_A_LADO[1].x1 + 36, SALAS_LADO_A_LADO[1].y1 + 100, 'Sala 2')
  const rotulo1Renomeado = await page.screenshot({ clip: recorteRotulo(CENTROS_X[0]) })
  const rotulo2Renomeado = await page.screenshot({ clip: recorteRotulo(CENTROS_X[1]) })
  expect(
    await fracaoDiferente(page, rotulo1Renomeado, rotulo2Renomeado),
    'controle: "Sala 1" e "Sala 2" têm de passar do LIMIAR_NOME — se falhar, a medição é que está cega',
  ).toBeGreaterThan(LIMIAR_NOME)

  // =========================================================================
  // 2. O RÓTULO DA MÃE NÃO PODE CAIR DENTRO DA FILHA.
  //    Referência sem o rótulo: apagando o nome da mãe pelo painel, o app
  //    deixa de desenhá-lo. O que sobra de diferença dentro do miolo da filha
  //    é exatamente a tinta do rótulo da mãe que estava invadindo.
  // =========================================================================
  await abrirEditor(page)
  await desenharSala(page, MAE.x1, MAE.y1, MAE.x2, MAE.y2)
  await desenharSala(page, FILHA.x1, FILHA.y1, FILHA.x2, FILHA.y2)
  await limparSelecao(page)

  const filhaComRotuloDaMae = await page.screenshot({ clip: RECORTE_FILHA })
  await renomearSalaEm(page, PONTO_MAE.x, PONTO_MAE.y, '')
  const filhaSemRotuloDaMae = await page.screenshot({ clip: RECORTE_FILHA })

  const invasao = await fracaoDiferente(page, filhaComRotuloDaMae, filhaSemRotuloDaMae)
  expect
    .soft(invasao, 'o rótulo da sala de fora está pintando por cima da sala de dentro')
    .toBeLessThanOrEqual(LIMIAR_INVASAO)

  // CONTROLE POSITIVO do LIMIAR_INVASAO: tinta de rótulo comprovadamente
  // dentro da filha (o nome da PRÓPRIA filha, que mora no miolo dela e
  // continua lá depois de qualquer conserto na mãe) tem de estourar o limiar
  // com folga. Sem isto, um recorte no lugar errado daria verde de graça.
  await renomearSalaEm(page, PONTO_FILHA.x, PONTO_FILHA.y, 'Quarto dos Fundos')
  const filhaComNomeComprido = await page.screenshot({ clip: RECORTE_FILHA })
  expect(
    await fracaoDiferente(page, filhaComNomeComprido, filhaSemRotuloDaMae),
    'controle: tinta de rótulo dentro da filha tem de estourar o LIMIAR_INVASAO',
  ).toBeGreaterThan(LIMIAR_INVASAO * 4)

  // =========================================================================
  // 3. A SALA CIRCULAR TEM DE SER REDONDA.
  //    A referência é capturada com a ferramenta JÁ ativa, para que a barra de
  //    dica do topo seja a mesma nas duas fotos e não entre na silhueta.
  // =========================================================================
  await abrirEditor(page)
  await ferramenta(page, 'Sala Circular')
  const telaVazia = await page.screenshot({ clip: RECORTE_CIRCULO })
  await desenharDoCentro(page)
  await limparSelecao(page)
  const telaComCirculo = await page.screenshot({ clip: RECORTE_CIRCULO })

  const redonda = await variacaoDoRaio(page, telaVazia, telaComCirculo)
  expect
    .soft(
      redonda.variacao,
      'contorno da Sala Circular oscila ' +
        (redonda.variacao * 100).toFixed(2) +
        '% do raio (mín ' +
        redonda.min.toFixed(1) +
        ' px, máx ' +
        redonda.max.toFixed(1) +
        ' px): os lados retos aparecem',
    )
    .toBeLessThanOrEqual(LIMIAR_CIRCULO)

  // CONTROLE POSITIVO do LIMIAR_CIRCULO: um Polígono Regular de 12 lados — o
  // mais redondo que essa ferramenta oferece — desenhado com o mesmo gesto e
  // medido pela mesma régua tem de ser reprovado com folga. Isso prova que a
  // régua enxerga faceta de verdade, e não que qualquer número passa.
  await abrirEditor(page)
  await ferramenta(page, 'Polígono Regular')
  await page.locator('#lb-polygon-sides').fill('12')
  await expect(page.locator('#lb-polygon-sides')).toHaveValue('12')
  await page.waitForTimeout(300)
  const telaVaziaPoligono = await page.screenshot({ clip: RECORTE_CIRCULO })
  await desenharDoCentro(page)
  await limparSelecao(page)
  const telaComPoligono = await page.screenshot({ clip: RECORTE_CIRCULO })

  const doze = await variacaoDoRaio(page, telaVaziaPoligono, telaComPoligono)
  expect(
    doze.variacao,
    'controle: um polígono de 12 lados tem de estourar o LIMIAR_CIRCULO — se não estourar, a régua está cega',
  ).toBeGreaterThan(LIMIAR_CIRCULO * 2)
})
