// A FOLHA DO JOGADOR NO CELULAR, robusta (fatia 19b do design consolidado).
//
// O QUE PROVA, no Chromium de verdade, a 390 x 844:
// 1. Abrir e fechar a folha 100 vezes não vaza memória, e o mapa sobrevive ao
//    contexto WebGL perdido no meio delas, com a folha aberta (o bug de 09/10,
//    `0d241876`: o Chrome do Android, apertado de GPU, soltava o contexto e o
//    mapa voltava branco). O Chromium do teste nunca solta o contexto sozinho:
//    a perda é forçada com `WEBGL_lose_context.loseContext()`, sem devolver,
//    como o Android. Depois dela o mapa volta num canvas NOVO, vivo, com a
//    ficha contada e desenhada, e não perde de novo. Antes e depois da perda,
//    nós do DOM, ouvintes e heap (contados pelo DevTools, depois de recolher o
//    lixo) voltam ao que eram ao fim de 50 voltas.
// 2. A câmera reenquadra ao girar o celular (pendência da fatia 10): o meio
//    da tela continua no meio, e a própria ficha não sai da tela.
// 3. O teclado do celular sobre o chat não cobre o campo de texto. O Chromium
//    do teste não tem teclado: a `visualViewport` é trocada por uma que o
//    teste encolhe, como o teclado faz no Android e no iPhone.
//
// COMO: `player.html` inteiro, com o mestre de verdade (`createHostSession`)
// atrás do WebSocket roteado, como task-player-resize.spec.ts.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { HostMessage } from '../src/net/protocol'
import type { MapData, Token } from '../src/types/map'

const EM_PE = { width: 390, height: 844 }
const DEITADO = { width: 844, height: 390 }
test.use({ trace: 'off', video: 'off', viewport: EM_PE, deviceScaleFactor: 1 })

const CODIGO = 'FOLHA1'
const CLIENTE = 'c1'
const GRADE = 50
/** A ficha da Ana no meio do mapa (600 x 500): o enquadramento de chegada a põe no meio da tela. */
const FICHA = { x: 300, y: 250 }
const COR_DA_FICHA = '#3cff00'
/** Metade das 100 voltas antes da perda do contexto, metade depois. */
const MEIAS_VOLTAS = 50
/** Voltas antes de contar: a primeira abertura carrega fonte, cria a fileira de abas e aquece o JIT (e o Pixi novo, depois da perda). */
const AQUECIMENTO = 5
const TECLADO_PX = 320

function ficha(id: string, name: string, p: { x: number; y: number }, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function mapaDoTeste(): MapData {
  const base = createEmptyMap('m-folha', 'Porto', 12, 10, GRADE)
  return { ...base, tokens: [ficha('tok-ana', 'Ana', FICHA, COR_DA_FICHA)] }
}

/** O que o teste manda direto ao jogador, como se fosse o mestre. */
type Mandar = (msg: HostMessage) => void

async function jogadorEntra(page: Page): Promise<Mandar> {
  const mapa = mapaDoTeste()
  const sessao = createHostSession({ code: CODIGO, visionRadius: 2000 })
  let socket: WebSocketRoute | null = null
  let playerId: string | null = null
  const despachar = (saidas: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of saidas) {
      if (clientId !== CLIENTE || socket === null) continue
      if (msg.type === 'welcome') playerId = msg.playerId
      socket.send(JSON.stringify(msg))
    }
  }
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      socket = ws
      ws.onMessage((bruto) => despachar(sessao.handleMessage(CLIENTE, typeof bruto === 'string' ? bruto : bruto.toString('utf8'), mapa).outbound))
    },
  )
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODIGO)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  if (playerId === null) throw new Error('o mestre não deu boas-vindas')
  despachar(sessao.assignToken(playerId, 'tok-ana').outbound)
  despachar(sessao.broadcast(mapa).outbound)
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.locator('[data-own-tokens]')).toHaveAttribute('data-own-tokens', 'tok-ana')
  return (msg) => despachar([{ clientId: CLIENTE, msg }])
}

/** Conversa comprida na cena: o registro do chat cresce até o teto e empurra o campo para o pé da folha. */
function conversaComprida(): HostMessage {
  const falas = Array.from({ length: 12 }, (_, i) => ({
    id: `m${i}`,
    at: 1_000 + i,
    from: i % 2 === 0 ? 'Bia' : 'Bartolomeu',
    text: 'Vamos pelo cais, a porta dos fundos estava aberta da última vez que passamos por lá.',
    mentions: [],
  }))
  return { type: 'chat.history', channel: 'cena', messages: falas }
}

/** Roda NA PÁGINA antes dela: conta todo contexto WebGL perdido, de qualquer canvas. */
function contarContextosPerdidos(): void {
  Reflect.set(window, '__contextosPerdidos', 0)
  document.addEventListener(
    'webglcontextlost',
    () => Reflect.set(window, '__contextosPerdidos', Number(Reflect.get(window, '__contextosPerdidos')) + 1),
    true,
  )
}

interface EstadoDoMapa {
  /** Quantos canvas há na página: o morto que ficasse junto do novo daria 2. */
  canvases: number
  /** O carimbo do canvas do mapa (`null` = um canvas que o teste ainda não carimbou). */
  carimbo: string | null
  perdido: boolean
  /** Quantos `webglcontextlost` a página viu desde que abriu. */
  perdas: number
}

/** O canvas do mapa e o estado do contexto dele. `carimbar` marca o canvas, para saber depois se ainda é o mesmo. */
async function estadoDoMapa(page: Page, carimbar: string | null = null): Promise<EstadoDoMapa> {
  return page.evaluate((carimbo) => {
    const perdas = Number(Reflect.get(window, '__contextosPerdidos'))
    const canvas = document.querySelector('canvas')
    // Entre o Pixi morto sair e o novo montar, não há canvas: o `poll` espera.
    if (canvas === null) return { canvases: 0, carimbo: null, perdido: true, perdas }
    if (carimbo !== null) canvas.dataset.carimbo = carimbo
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    return { canvases: document.querySelectorAll('canvas').length, carimbo: canvas.dataset.carimbo ?? null, perdido: gl === null || gl.isContextLost(), perdas }
  }, carimbar)
}

/** Solta o contexto do mapa e não devolve: o que o Chrome do Android fazia, e o Chromium do teste nunca faz sozinho. */
async function perderOContexto(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (canvas === null) throw new Error('sem o canvas do mapa')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (gl === null) throw new Error('o canvas do mapa sem contexto WebGL')
    const perder = gl.getExtension('WEBGL_lose_context')
    if (perder === null) throw new Error('o contexto do mapa sem WEBGL_lose_context')
    perder.loseContext()
  })
}

interface Contas {
  nos: number
  ouvintes: number
  heapMb: number
}

async function contar(page: Page): Promise<Contas> {
  const devtools = await page.context().newCDPSession(page)
  // Duas passadas: a primeira solta o que a segunda recolhe (fechamentos que seguram fechamentos).
  await devtools.send('HeapProfiler.collectGarbage')
  await devtools.send('HeapProfiler.collectGarbage')
  const dom = await devtools.send('Memory.getDOMCounters')
  const heap = await devtools.send('Runtime.getHeapUsage')
  await devtools.detach()
  return { nos: dom.nodes, ouvintes: dom.jsEventListeners, heapMb: heap.usedSize / 1_048_576 }
}

async function abrirAFolha(page: Page): Promise<void> {
  await page.locator('.pp-bar > .pp-toggle').click()
  await expect(page.getByRole('complementary', { name: 'Painel do jogador' })).toBeVisible()
}

async function fecharAFolha(page: Page): Promise<void> {
  await page.locator('.pp-bar > .pp-toggle').click()
  await expect(page.getByRole('complementary', { name: 'Painel do jogador' })).toBeHidden()
}

async function voltas(page: Page, quantas: number): Promise<void> {
  for (let vez = 0; vez < quantas; vez++) {
    await abrirAFolha(page)
    await fecharAFolha(page)
  }
}

/** Uma folha que vazasse por volta deixaria 50 cópias: dezenas de nós e ouvintes. A folga é o ruído do ticker do mapa. */
function semVazamento(de: Contas, ate: Contas, trecho: string): void {
  expect(ate.nos - de.nos, `nós do DOM, ${trecho}`).toBeLessThanOrEqual(20)
  expect(ate.ouvintes - de.ouvintes, `ouvintes, ${trecho}`).toBeLessThanOrEqual(5)
  expect(ate.heapMb - de.heapMb, `heap (MB), ${trecho}`).toBeLessThanOrEqual(2)
}

test('abrir e fechar a folha 100 vezes, com o contexto WebGL perdido no meio: o mapa volta e nada vaza', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(contarContextosPerdidos)
  await jogadorEntra(page)
  expect(await estadoDoMapa(page, 'primeiro')).toEqual({ canvases: 1, carimbo: 'primeiro', perdido: false, perdas: 0 })

  await voltas(page, AQUECIMENTO)
  const antes = await contar(page)
  await voltas(page, MEIAS_VOLTAS)
  const meio = await contar(page)
  expect(await estadoDoMapa(page), 'abrir e fechar não solta o contexto').toEqual({ canvases: 1, carimbo: 'primeiro', perdido: false, perdas: 0 })

  // O bug de 09/10: a folha aberta por cima do mapa, e o navegador solta o contexto.
  await abrirAFolha(page)
  await perderOContexto(page)
  await expect.poll(async () => (await estadoDoMapa(page)).perdas).toBe(1)
  await fecharAFolha(page)
  // O canvas carimbado morreu com o contexto: o mapa volta num novo, sozinho na página e vivo.
  await expect.poll(() => estadoDoMapa(page), { message: 'o mapa num canvas novo e vivo' }).toEqual({ canvases: 1, carimbo: null, perdido: false, perdas: 1 })
  await expect(page.locator('[data-tokens-count]')).toHaveAttribute('data-tokens-count', '1')
  await expect.poll(() => fichaNaTela(page), { message: 'a ficha desenhada no mapa novo' }).not.toBeNull()
  expect(await estadoDoMapa(page, 'segundo')).toEqual({ canvases: 1, carimbo: 'segundo', perdido: false, perdas: 1 })

  await voltas(page, AQUECIMENTO)
  const retomada = await contar(page)
  await voltas(page, MEIAS_VOLTAS)
  const depois = await contar(page)
  test.info().annotations.push({ type: 'contas', description: JSON.stringify({ antes, meio, retomada, depois }) })

  expect(await estadoDoMapa(page), 'o mapa novo segura as outras 50 voltas').toEqual({ canvases: 1, carimbo: 'segundo', perdido: false, perdas: 1 })
  semVazamento(antes, meio, '50 voltas antes da perda')
  semVazamento(retomada, depois, '50 voltas depois da volta do mapa')
  // De ponta a ponta, com a troca no meio: o Pixi morto não fica na memória nem com ouvintes na página.
  semVazamento(antes, depois, '100 voltas e a troca do Pixi')
})

/** Centro, em px da tela, dos pixels da cor da ficha (`null` = ela não está na tela). */
async function fichaNaTela(page: Page): Promise<{ x: number; y: number } | null> {
  await page.waitForTimeout(250)
  const foto = await page.screenshot()
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const tela = document.createElement('canvas')
    tela.width = bmp.width
    tela.height = bmp.height
    const ctx = tela.getContext('2d')
    if (ctx === null) throw new Error('sem contexto 2d')
    ctx.drawImage(bmp, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
    let sx = 0
    let sy = 0
    let n = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (data[i + 1] > 200 && data[i] > 20 && data[i] < 120 && data[i + 2] < 60) {
          sx += x
          sy += y
          n++
        }
      }
    }
    return n < 40 ? null : { x: sx / n, y: sy / n }
  }, foto.toString('base64'))
}

test('girar o celular: o meio da tela continua no meio, e a ficha não sai da tela', async ({ page }) => {
  test.setTimeout(90_000)
  await jogadorEntra(page)
  await expect.poll(() => fichaNaTela(page)).not.toBeNull()
  const emPe = await fichaNaTela(page)
  if (emPe === null) throw new Error('a ficha não apareceu')
  // A chegada põe a ficha (meio do mapa) no meio da tela.
  expect(Math.abs(emPe.x - EM_PE.width / 2)).toBeLessThanOrEqual(3)
  expect(Math.abs(emPe.y - EM_PE.height / 2)).toBeLessThanOrEqual(3)

  // Deitar: sem reenquadrar, a ficha ficava em (195, 422), fora da tela de 390 de altura.
  await page.setViewportSize(DEITADO)
  await expect
    .poll(async () => {
      const p = await fichaNaTela(page)
      return p !== null && Math.abs(p.x - DEITADO.width / 2) <= 3 && Math.abs(p.y - DEITADO.height / 2) <= 3
    })
    .toBe(true)

  // De pé de novo: volta ao meio, no mesmo lugar de antes.
  await page.setViewportSize(EM_PE)
  await expect
    .poll(async () => {
      const p = await fichaNaTela(page)
      return p !== null && Math.abs(p.x - emPe.x) <= 3 && Math.abs(p.y - emPe.y) <= 3
    })
    .toBe(true)
})

/**
 * Roda NA PÁGINA antes dela: a vista visível de mentira. `__teclado(px)`
 * encolhe a vista como o teclado do celular encolhe (a janela do layout não muda).
 */
function vistaVisivelDeTeste(): void {
  const vista = Object.assign(new EventTarget(), { width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 })
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vista })
  Reflect.set(window, '__teclado', (altura: number) => {
    vista.width = innerWidth
    vista.height = innerHeight - altura
    vista.dispatchEvent(new Event('resize'))
  })
}

test('o teclado do celular sobre o chat não cobre o campo de texto', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(vistaVisivelDeTeste)
  const mandar = await jogadorEntra(page)
  mandar(conversaComprida())
  await page.locator('.pp-bar > .pp-toggle').click()
  await page.getByRole('tab', { name: 'Chat' }).click()
  await expect(page.locator('.pc-msg')).toHaveCount(12)
  const campo = page.locator('textarea.pc-input')
  await campo.click()
  await expect(campo).toBeFocused()
  const semTeclado = await campo.boundingBox()
  if (semTeclado === null) throw new Error('o campo do chat não tem caixa')
  // O caso que importa: sem o desconto, o teclado cobriria o campo.
  expect(semTeclado.y + semTeclado.height, 'o campo, sem teclado, mora abaixo de onde o teclado chega').toBeGreaterThan(EM_PE.height - TECLADO_PX)

  await page.evaluate((px) => {
    const abrir: unknown = Reflect.get(window, '__teclado')
    if (typeof abrir !== 'function') throw new Error('sem a vista de teste')
    abrir(px)
  }, TECLADO_PX)

  const limite = EM_PE.height - TECLADO_PX
  await expect
    .poll(async () => {
      const caixa = await campo.boundingBox()
      return caixa !== null && caixa.y >= 0 && caixa.y + caixa.height <= limite
    }, { message: `o campo inteiro acima do teclado (topo do teclado em ${limite} px; sem ele o campo ia até ${Math.round(semTeclado.y + semTeclado.height)})` })
    .toBe(true)
  const enviar = await page.getByRole('button', { name: 'Enviar' }).boundingBox()
  expect(enviar !== null && enviar.y + enviar.height <= limite, 'o Enviar também acima do teclado').toBe(true)
  // O foco não saiu do campo: quem digitava continua digitando.
  await expect(campo).toBeFocused()

  // Fechar o teclado devolve a folha inteira.
  await page.evaluate(() => {
    const abrir: unknown = Reflect.get(window, '__teclado')
    if (typeof abrir === 'function') abrir(0)
  })
  await expect.poll(() => page.locator('.pp-panel').evaluate((el) => getComputedStyle(el).getPropertyValue('--pp-teclado').trim())).toBe('0px')
})
