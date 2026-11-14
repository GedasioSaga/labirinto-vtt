import type { TipoDeAura } from '../../lib/auras'
import { canvasDoAtlas, colunaDaCor, plantaDoAtlas } from './atlasDaAura'
import { ATRAS, criarSaida, FRENTE, poseDaAura, sementeDaAura, SOMA, estadoDaAura, type CamadaDaAura } from './estadoDaAura'

/**
 * AURA DA FICHA — a miniatura de cada aura para os menus ("Aura ›"): a vista
 * "mini" da página de prova (`docs/design/auras/prova/pagina.js`), pintada do
 * mesmo jeito, em canvas 2D: o chão do menu, a aura atrás, uma ficha de
 * exemplo (busto em silhueta na moldura de latão) e a aura da frente. Parada
 * no quadro mais cheio do laço (`poseDaAura`); sob o mouse ou o foco, anda
 * (`animarMiniaturaDaAura`), como o menu da prova.
 */

/** O desenho da prova é de 48 px do CSS: o lado pedido escala tudo junto (tela densa = mais pixels, o mesmo desenho). */
const LADO_DO_DESENHO = 48
/** A ficha de exemplo da vista "mini": raio 13 px, centro um pouco abaixo do meio (as chamas sobem). */
const RAIO_DA_FICHA = 13
const CENTRO_X = LADO_DO_DESENHO / 2
const CENTRO_Y = Math.round(LADO_DO_DESENHO * 0.56)
/** O chão "menu" da prova. */
const COR_DO_CHAO = '#212127'

/** Um quadro por vez: a pintura é síncrona, a saída é reaproveitada. */
const saida = criarSaida()

function pintarCamada(ctx: CanvasRenderingContext2D, tipo: TipoDeAura, atlas: HTMLCanvasElement, camada: CamadaDaAura, k: number): void {
  const { linhas } = plantaDoAtlas(tipo)
  const e = CENTRO_X * k
  const f = CENTRO_Y * k
  let mistura = -1
  for (let i = 0; i < saida.n; i += 1) {
    const it = saida.itens[i]
    if (it.camada !== camada) continue
    if (it.mistura !== mistura) {
      mistura = it.mistura
      ctx.globalCompositeOperation = mistura === SOMA ? 'lighter' : 'source-over'
    }
    const linha = linhas[it.pincel]
    const col = colunaDaCor(linha, it.cor)
    const c = Math.cos(it.rot) * k
    const sn = Math.sin(it.rot) * k
    ctx.setTransform(c, sn, -sn, c, e + k * it.x, f + k * it.y)
    ctx.globalAlpha = it.alfa
    ctx.drawImage(atlas, col * (linha.forma.w + 2) + 1, linha.y + 1, linha.forma.w, linha.forma.h, -it.w / 2, -it.h / 2, it.w, it.h)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

/** A ficha de exemplo da prova (`fichaDe`): busto genérico na moldura de latão do app (4 px a 100%). */
function pintarFichaDeExemplo(ctx: CanvasRenderingContext2D, R: number, k: number): void {
  ctx.setTransform(k, 0, 0, k, CENTRO_X * k, CENTRO_Y * k)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  const moldura = (R * 4) / 30
  const Rf = R - moldura
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, Rf, 0, Math.PI * 2)
  ctx.clip()
  const fundo = ctx.createRadialGradient(-0.28 * Rf, -0.38 * Rf, 0.05 * Rf, 0, 0, Rf * 1.15)
  fundo.addColorStop(0, '#a9b4bb')
  fundo.addColorStop(0.55, '#6f7b85')
  fundo.addColorStop(1, '#434d57')
  ctx.fillStyle = fundo
  ctx.fillRect(-Rf, -Rf, 2 * Rf, 2 * Rf)
  ctx.fillStyle = '#2a3039'
  ctx.beginPath()
  ctx.ellipse(0, Rf * 1.02, Rf * 0.86, Rf * 0.6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(-Rf * 0.13, Rf * 0.1, Rf * 0.26, Rf * 0.42)
  ctx.beginPath()
  ctx.arc(0, -Rf * 0.12, Rf * 0.34, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(196, 210, 220, 0.4)'
  ctx.lineWidth = Math.max(0.6, Rf * 0.045)
  ctx.beginPath()
  ctx.arc(0, -Rf * 0.12, Rf * 0.31, -Math.PI * 0.95, -Math.PI * 0.55)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(0, Rf * 1.02, Rf * 0.83, Rf * 0.57, 0, -Math.PI * 0.93, -Math.PI * 0.68)
  ctx.stroke()
  ctx.restore()
  // moldura
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.arc(0, 0, Rf, 0, Math.PI * 2, true)
  ctx.fillStyle = '#e0a44a'
  ctx.fill()
  ctx.lineWidth = Math.max(0.6, R * 0.028)
  ctx.strokeStyle = '#6b4a1a'
  ctx.beginPath()
  ctx.arc(0, 0, R - ctx.lineWidth / 2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#8f6726'
  ctx.beginPath()
  ctx.arc(0, 0, Rf + ctx.lineWidth / 2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(250, 214, 150, 0.75)'
  ctx.lineWidth = Math.max(0.6, R * 0.035)
  ctx.beginPath()
  ctx.arc(0, 0, R - moldura / 2, -Math.PI * 0.92, -Math.PI * 0.6)
  ctx.stroke()
}

/** O quadro `t` da miniatura num canvas de `lado` px (o lado já multiplicado pela densidade da tela). */
export function pintarMiniaturaDaAura(ctx: CanvasRenderingContext2D, tipo: TipoDeAura, lado: number, t: number): void {
  const k = lado / LADO_DO_DESENHO
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = COR_DO_CHAO
  ctx.fillRect(0, 0, lado, lado)
  const atlas = canvasDoAtlas(tipo)
  estadoDaAura(tipo, t, RAIO_DA_FICHA, sementeDaAura(tipo), saida)
  if (atlas !== null) pintarCamada(ctx, tipo, atlas, ATRAS, k)
  pintarFichaDeExemplo(ctx, RAIO_DA_FICHA, k)
  if (atlas !== null) pintarCamada(ctx, tipo, atlas, FRENTE, k)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

function poseDaMiniatura(tipo: TipoDeAura): number {
  return poseDaAura(tipo, sementeDaAura(tipo))
}

/** Por tipo e lado: 9 auras vezes os poucos tamanhos de menu que existem. */
const prontas = new Map<string, HTMLCanvasElement>()

/**
 * A miniatura da aura `tipo` num quadrado de `lado` px (do canvas, não do CSS:
 * quem quer nitidez em tela densa pede o lado já multiplicado), no quadro
 * parado. O MESMO canvas a cada pedido igual: quem mostra copia com
 * `drawImage`, não o põe na página. Sem contexto 2D (ambiente sem canvas),
 * devolve o canvas em branco.
 */
export function miniaturaDaAura(tipo: TipoDeAura, lado: number): HTMLCanvasElement {
  const tamanho = Math.max(1, Math.round(lado))
  const chave = `${tipo}:${tamanho}`
  const pronta = prontas.get(chave)
  if (pronta !== undefined) return pronta
  const canvas = document.createElement('canvas')
  canvas.width = tamanho
  canvas.height = tamanho
  const ctx = canvas.getContext('2d')
  if (ctx !== null) pintarMiniaturaDaAura(ctx, tipo, tamanho, poseDaMiniatura(tipo))
  prontas.set(chave, canvas)
  return canvas
}

/** As miniaturas que já estão sendo preparadas, por lado. */
const aquecendo = new Set<number>()

/** O mais que uma miniatura espera por uma folga do navegador (ms). */
const ESPERA_MAXIMA_DA_FOLGA = 500

/**
 * Prepara as miniaturas de todas as auras no `lado` pedido, uma por folga do
 * navegador (cada uma conta o laço inteiro para achar o quadro parado e assa o
 * atlas: dezenas de ms somadas). Chamar quando o menu do token abre: o submenu
 * "Aura ›" já acha tudo pronto, sem engasgar na primeira abertura. A que ainda
 * não ficou pronta quando o submenu abre é feita na hora, como antes. Sem
 * `requestIdleCallback` (ambiente de teste, navegador sem ele), não prepara
 * nada: cada miniatura sai na hora em que o submenu a pede.
 */
export function aquecerMiniaturasDaAura(tipos: readonly TipoDeAura[], lado: number): void {
  if (typeof window.requestIdleCallback !== 'function') return
  const tamanho = Math.max(1, Math.round(lado))
  if (aquecendo.has(tamanho)) return
  aquecendo.add(tamanho)
  const fila = [...tipos]
  const proxima = (): void => {
    const tipo = fila.shift()
    if (tipo === undefined) return
    miniaturaDaAura(tipo, tamanho)
    window.requestIdleCallback(proxima, { timeout: ESPERA_MAXIMA_DA_FOLGA })
  }
  window.requestIdleCallback(proxima, { timeout: ESPERA_MAXIMA_DA_FOLGA })
}

function prefereMenosMovimento(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

const NADA_A_PARAR = (): void => {}

/**
 * A miniatura andando dentro de `canvas` (o da tela, não o guardado), a partir
 * do quadro parado, como o menu da prova sob o mouse. Devolve quem para: volta
 * ao quadro parado. "Reduzir movimento" ligado: não anda (a parada já é ela).
 */
export function animarMiniaturaDaAura(canvas: HTMLCanvasElement, tipo: TipoDeAura): () => void {
  const ctx = canvas.getContext('2d')
  if (ctx === null || prefereMenosMovimento()) return NADA_A_PARAR
  const pose = poseDaMiniatura(tipo)
  const desde = performance.now()
  let pedido = 0
  const quadro = (agora: number): void => {
    // Menu fechado sem quem pare: a miniatura sai da página e o laço morre sozinho.
    if (!canvas.isConnected) {
      pedido = 0
      return
    }
    pintarMiniaturaDaAura(ctx, tipo, canvas.width, pose + Math.max(0, agora - desde) / 1000)
    pedido = requestAnimationFrame(quadro)
  }
  pedido = requestAnimationFrame(quadro)
  return () => {
    if (pedido !== 0) cancelAnimationFrame(pedido)
    pedido = 0
    pintarMiniaturaDaAura(ctx, tipo, canvas.width, pose)
  }
}
