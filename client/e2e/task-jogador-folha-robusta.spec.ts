// A FOLHA DO JOGADOR NO CELULAR, robusta (fatia 19b do design consolidado).
//
// O QUE PROVA, no Chromium de verdade, a 390 x 844:
// 1. Abrir e fechar a folha 100 vezes não perde o contexto WebGL do mapa (o
//    bug de 09/10, `0d241876`: o Chrome do Android soltava o contexto e o mapa
//    voltava branco) nem vaza memória: o canvas é o mesmo do começo, nenhum
//    `webglcontextlost`, e nós do DOM, ouvintes e heap (contados pelo
//    DevTools, depois de recolher o lixo) voltam ao que eram.
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
const VOLTAS = 100
/** Voltas antes de contar: a primeira abertura carrega fonte, cria a fileira de abas e aquece o JIT. */
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

/** O canvas do mapa e o estado do contexto dele. `marcar` carimba o canvas, para saber depois se é o mesmo. */
async function contextoDoMapa(page: Page, marcar: boolean): Promise<{ mesmoCanvas: boolean; perdido: boolean; perdas: number }> {
  return page.evaluate((carimbar) => {
    const canvas = document.querySelector('canvas')
    if (canvas === null) throw new Error('sem o canvas do mapa')
    if (carimbar) canvas.dataset.carimbo = 'primeiro'
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    return { mesmoCanvas: canvas.dataset.carimbo === 'primeiro', perdido: gl === null || gl.isContextLost(), perdas: Number(Reflect.get(window, '__contextosPerdidos')) }
  }, marcar)
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

async function abrirEFechar(page: Page): Promise<void> {
  const painel = page.locator('.pp-bar > .pp-toggle')
  const folha = page.getByRole('complementary', { name: 'Painel do jogador' })
  await painel.click()
  await expect(folha).toBeVisible()
  await painel.click()
  await expect(folha).toBeHidden()
}

test('abrir e fechar a folha 100 vezes: o mapa continua com o mesmo contexto WebGL e nada vaza', async ({ page }) => {
  test.setTimeout(180_000)
  await page.addInitScript(contarContextosPerdidos)
  await jogadorEntra(page)
  expect(await contextoDoMapa(page, true)).toEqual({ mesmoCanvas: true, perdido: false, perdas: 0 })

  for (let vez = 0; vez < AQUECIMENTO; vez++) await abrirEFechar(page)
  const antes = await contar(page)
  for (let vez = 0; vez < VOLTAS; vez++) await abrirEFechar(page)
  const depois = await contar(page)
  test.info().annotations.push({ type: 'contas', description: JSON.stringify({ antes, depois }) })

  expect(await contextoDoMapa(page, false)).toEqual({ mesmoCanvas: true, perdido: false, perdas: 0 })
  // Uma folha que vazasse por volta deixaria 100 cópias: centenas de nós e ouvintes. A folga é o ruído do ticker do mapa.
  expect(depois.nos - antes.nos, 'nós do DOM depois de 100 voltas').toBeLessThanOrEqual(20)
  expect(depois.ouvintes - antes.ouvintes, 'ouvintes depois de 100 voltas').toBeLessThanOrEqual(5)
  expect(depois.heapMb - antes.heapMb, 'heap (MB) depois de 100 voltas').toBeLessThanOrEqual(2)
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
