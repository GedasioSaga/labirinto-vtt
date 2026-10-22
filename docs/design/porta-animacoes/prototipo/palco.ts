/**
 * O palco de uma porta: chão, paredes (o `drawWalls` REAL do app), a camada das
 * portas e, no cartão do telhado, o telhado e a camada `portasNoTelhado` por cima
 * dele, como em player/PlayerView.tsx: a mesma porta desenhada duas vezes, por
 * dois animadores, uma acima do telhado.
 */
import { Container, Graphics, Ticker, type Renderer } from 'pixi.js'
import { drawWalls } from '../../../../client/src/pixi/drawWalls'
import type { Wall } from '../../../../client/src/types/map'
import { createAnimadorDePortas, type AnimadorDePortas } from '../proposta/animadorDePortas'
import type { ParedeComPorta, PortaComCor } from '../proposta/drawDoors'

export type Orientacao = 'horizontal' | 'vertical'
export type Chao = 'escuro' | 'pedra' | 'grama'

export const CHAOS: Readonly<Record<Chao, { nome: string; cor: number }>> = {
  escuro: { nome: 'Escuro do app', cor: 0x2b2b2b },
  pedra: { nome: 'Pedra clara', cor: 0xdcd0b6 },
  grama: { nome: 'Grama', cor: 0x8cbf80 },
}

/** Uma célula do app (50 px de mundo): o vão da porta. */
export const VAO = 50
const MEIO_VAO = VAO / 2
const PAREDE_ATE = 260
export const LARGURA_CSS = 300
export const ALTURA_CSS = 180
/** Telhado: cobre o lado de cima da parede e passa dela pelo beiral (cobre a porta, como no app). */
const BEIRAL = 4
const COR_DA_TELHA = 0xb56e50
const COR_DA_JUNTA = 0x9a5a40
const COR_DO_BEIRAL = 0x7f4733

export interface EstadoDaPorta {
  aberta: boolean
  trancada: boolean
  animacao: string | null
  cor: number | undefined
}

/** Onde a linha da parede fica no canvas: a porta abre para a normal (baixo na horizontal, esquerda na vertical), então sobra espaço desse lado. */
export function centroNoCanvas(orientacao: Orientacao): { x: number; y: number } {
  return orientacao === 'horizontal' ? { x: LARGURA_CSS / 2, y: 50 } : { x: 190, y: ALTURA_CSS / 2 }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

export function paredesAoLado(orientacao: Orientacao): Wall[] {
  return orientacao === 'horizontal'
    ? [parede('esq', -PAREDE_ATE, 0, -MEIO_VAO, 0), parede('dir', MEIO_VAO, 0, PAREDE_ATE, 0)]
    : [parede('cima', 0, -PAREDE_ATE, 0, -MEIO_VAO), parede('baixo', 0, MEIO_VAO, 0, PAREDE_ATE)]
}

export function paredeDaPorta(orientacao: Orientacao, estado: EstadoDaPorta, id = 'porta', dx = 0, dy = 0): ParedeComPorta {
  const door: PortaComCor = {
    open: estado.aberta,
    locked: estado.trancada,
    kind: 'normal',
    ...(estado.animacao === null ? {} : { animacao: estado.animacao }),
    ...(estado.cor === undefined ? {} : { cor: estado.cor }),
  }
  const [x1, y1, x2, y2] = orientacao === 'horizontal' ? [-MEIO_VAO, 0, MEIO_VAO, 0] : [0, -MEIO_VAO, 0, MEIO_VAO]
  return { id, x1: x1 + dx, y1: y1 + dy, x2: x2 + dx, y2: y2 + dy, blocksLight: !estado.aberta, blocksMove: !estado.aberta, door }
}

export interface Cena {
  raiz: Container
  mundo: Container
  chao: Graphics
  paredes: Graphics
  portas: Graphics
  telhado: Graphics | null
  portasNoTelhado: Graphics | null
  /** Relógio de quadros dos animadores: um Ticker de verdade, parado; quem chama `update` é o laço da página. */
  ticker: Ticker
  animador: AnimadorDePortas
  animadorDoTelhado: AnimadorDePortas | null
}

export function criarCena(comTelhado: boolean, agora: () => number, reduzido: () => boolean): Cena {
  const raiz = new Container()
  const mundo = new Container()
  const chao = new Graphics()
  const paredes = new Graphics()
  const portas = new Graphics()
  raiz.addChild(chao, mundo)
  mundo.addChild(paredes, portas)
  const telhado = comTelhado ? new Graphics() : null
  const portasNoTelhado = comTelhado ? new Graphics() : null
  if (telhado !== null && portasNoTelhado !== null) mundo.addChild(telhado, portasNoTelhado)
  const ticker = new Ticker()
  ticker.autoStart = false
  const movimento = { ticker, reducedMotion: reduzido, now: agora }
  return {
    raiz,
    mundo,
    chao,
    paredes,
    portas,
    telhado,
    portasNoTelhado,
    ticker,
    animador: createAnimadorDePortas(movimento),
    animadorDoTelhado: comTelhado ? createAnimadorDePortas(movimento) : null,
  }
}

/** Chão, câmera, paredes e telhado: tudo o que não anima. */
export function montarFundo(cena: Cena, orientacao: Orientacao, zoom: number, chao: Chao, resolucao: number): void {
  const centro = centroNoCanvas(orientacao)
  cena.chao.clear()
  cena.chao.rect(0, 0, LARGURA_CSS, ALTURA_CSS).fill({ color: CHAOS[chao].cor })
  cena.mundo.position.set(centro.x, centro.y)
  cena.mundo.scale.set(zoom)
  drawWalls(cena.paredes, paredesAoLado(orientacao), null, zoom, resolucao)
  if (cena.telhado !== null) desenharTelhado(cena.telhado, orientacao, zoom)
}

/** Telhado simulado (telha chapada com fiadas), do lado de dentro da parede, passando dela pelo beiral. */
function desenharTelhado(g: Graphics, orientacao: Orientacao, zoom: number): void {
  g.clear()
  const px = 1 / zoom
  const fundo = orientacao === 'horizontal' ? { x: -PAREDE_ATE, y: -PAREDE_ATE, w: 2 * PAREDE_ATE, h: PAREDE_ATE + BEIRAL } : { x: -BEIRAL, y: -PAREDE_ATE, w: PAREDE_ATE + BEIRAL, h: 2 * PAREDE_ATE }
  g.rect(fundo.x, fundo.y, fundo.w, fundo.h).fill({ color: COR_DA_TELHA })
  for (let d = 9; d < PAREDE_ATE; d += 9) {
    if (orientacao === 'horizontal') g.moveTo(-PAREDE_ATE, BEIRAL - d).lineTo(PAREDE_ATE, BEIRAL - d)
    else g.moveTo(-BEIRAL + d, -PAREDE_ATE).lineTo(-BEIRAL + d, PAREDE_ATE)
  }
  g.stroke({ width: px, color: COR_DA_JUNTA })
  if (orientacao === 'horizontal') g.moveTo(-PAREDE_ATE, BEIRAL).lineTo(PAREDE_ATE, BEIRAL)
  else g.moveTo(-BEIRAL, -PAREDE_ATE).lineTo(-BEIRAL, PAREDE_ATE)
  g.stroke({ width: 1.5 * px, color: COR_DO_BEIRAL })
}

/** Manda o estado da porta aos animadores (o de baixo e, se houver, o de cima do telhado). Troca de `aberta` = anima. */
export function desenharPortas(cena: Cena, parede: ParedeComPorta, zoom: number, resolucao: number): void {
  cena.animador.desenhar(cena.portas, [parede], null, zoom, resolucao)
  if (cena.animadorDoTelhado !== null && cena.portasNoTelhado !== null) cena.animadorDoTelhado.desenhar(cena.portasNoTelhado, [parede], null, zoom, resolucao)
}

/** Pinta a cena no renderer compartilhado e copia para o canvas do cartão. */
export function pintarNoCanvas(renderer: Renderer, cena: Cena, destino: CanvasRenderingContext2D): void {
  renderer.render({ container: cena.raiz })
  destino.clearRect(0, 0, destino.canvas.width, destino.canvas.height)
  destino.drawImage(renderer.canvas as HTMLCanvasElement, 0, 0, destino.canvas.width, destino.canvas.height)
}
