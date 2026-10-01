/**
 * FANTASMA DO ENDIREITAR — pedido 5 de 30/09/2026 (PEDIDOS.md), fatia 4: a
 * posição de ANTES da linha endireitada apaga em `ENDIREITAR_FANTASMA_MS`,
 * enquanto a linha nova já está no lugar. Só visual: a geometria muda de uma
 * vez, como o endireitar a deixou, e o histórico não ganha nem perde passo.
 *
 * POR QUE ANIMA (skill emil-kowalski-ui-craft): o gesto é de teclado, e
 * movimento depois de tecla costuma só atrasar. Aqui nada espera: a linha já
 * está reta no mesmo quadro; o fantasma é eco, não trajeto. Ele explica de
 * onde a linha saiu, o que o salto seco não diz quando ela gira em volta do
 * meio. Por ser saída, apaga com ease-out, abaixo de 300 ms; com
 * `prefers-reduced-motion` ele não aparece e a linha só muda.
 *
 * COMO SABE QUE ENDIREITOU: a store não avisa (`stores/mapStore.ts` →
 * `endireitarSelecionados` é um `withHistory` como outro qualquer), e esta
 * fatia não mexe nela. `tracosDoEndireitar` compara um estado da store com o
 * seguinte: primeiro um filtro barato (passo novo de desfazer, mesma seleção,
 * só paredes soltas e Linhas/Caminhos mudaram, e tortos viraram retos) e, no
 * passo que passa por ele, a PROVA — o endireitar (`lib/endireitar.ts`) refeito
 * sobre o mapa de antes, só com os itens que mudaram, tem de dar a mesma
 * geometria. É a prova que separa o endireitar do arrasto de ponta: cada
 * pointermove do arrasto é um passo de desfazer, e a guia pode deixar a linha
 * em pé no meio dele — reta, mas com a outra ponta parada, não o meio.
 */
import type { Graphics, Ticker } from 'pixi.js'
import { endireitarNoMapa, jaEstaReta } from '../lib/endireitar'
import type { SelectionItem, SelectionSet } from '../lib/selectionModel'
import type { Drawing, DrawingPoint, MapData, Wall } from '../types/map'
import { drawStraightenGhost, type GhostStroke } from './drawStraightenGhost'

/** Quanto o fantasma leva para sumir. Pedido: "~150 ms". */
export const ENDIREITAR_FANTASMA_MS = 150

/** Opacidade com que o fantasma nasce: a metade, para não competir com a linha nova. */
export const ENDIREITAR_FANTASMA_ALPHA = 0.5

/** Nome (`Container.label`) do Graphics do fantasma — é por ele que o teste o acha. */
export const ENDIREITAR_FANTASMA_LABEL = 'fantasma-do-endireitar'

/**
 * Folga, em px de mundo, entre a geometria refeita na prova e a da store. O
 * refazer é a mesma conta sobre o mesmo mapa, mas a parede com porta pode ser
 * percorrida a partir de outro pedaço (ordem de soma diferente, erro na casa
 * de 1e-12). O arrasto de ponta que a prova recusa erra por pixels inteiros.
 */
const FOLGA_DA_PROVA = 1e-6

/** O pedaço da store que a detecção compara entre um estado e o seguinte. */
export interface PassoDaStore {
  readonly map: MapData
  readonly past: readonly MapData[]
  readonly future: readonly MapData[]
  readonly selection: SelectionSet
}

// ─────────────────────────────────────────────────────────────
// Detecção
// ─────────────────────────────────────────────────────────────

/** O que a varredura das listas juntou: quem mudou, onde estava, e se algum estava torto. */
interface Varredura {
  /** Os itens que mudaram, na forma de seleção — é com eles que a prova refaz o endireitar. */
  mudados: SelectionItem[]
  /** Índice, em `walls`, de cada parede que mudou. */
  paredes: number[]
  /** Índice, em `drawings`, de cada desenho que mudou. */
  desenhos: number[]
  /** A posição de antes de cada item que mudou: o fantasma. */
  antigos: GhostStroke[]
  algumTorto: boolean
}

type Ponto = { readonly x: number; readonly y: number }

const inicioDa = (s: { x1: number; y1: number }): Ponto => ({ x: s.x1, y: s.y1 })
const fimDa = (s: { x2: number; y2: number }): Ponto => ({ x: s.x2, y: s.y2 })

function ultimo<T>(lista: readonly T[]): T | undefined {
  return lista[lista.length - 1]
}

function segmentoReto(s: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return jaEstaReta(inicioDa(s), fimDa(s))
}

function mesmoSegmento(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2
}

function caminhoReto(pontos: readonly DrawingPoint[]): boolean {
  return pontos.every((p, i) => i === 0 || jaEstaReta(pontos[i - 1], p))
}

function copiaDosPontos(pontos: readonly DrawingPoint[]): GhostStroke {
  return pontos.map((p) => ({ x: p.x, y: p.y }))
}

/**
 * As paredes de antes e de depois, posição a posição. `false` = a mudança não
 * é de endireitar: o endireitar não cria, não apaga, não reordena, não toca
 * parede de Sala, e deixa reta toda parede que muda.
 */
function varrerParedes(antes: readonly Wall[], depois: readonly Wall[], v: Varredura): boolean {
  if (antes === depois) return true
  if (antes.length !== depois.length) return false
  for (let i = 0; i < depois.length; i++) {
    const velha = antes[i]
    const nova = depois[i]
    if (velha === nova) continue
    if (velha.id !== nova.id || velha.regionId !== undefined || nova.regionId !== undefined) return false
    if (mesmoSegmento(velha, nova) || !segmentoReto(nova)) return false
    if (!segmentoReto(velha)) v.algumTorto = true
    v.mudados.push({ kind: 'wall', id: nova.id })
    v.paredes.push(i)
    v.antigos.push([inicioDa(velha), fimDa(velha)])
  }
  return true
}

/** Os desenhos, do mesmo jeito: só Linha e Caminho endireitam, e sem trocar de tipo. */
function varrerDesenhos(antes: readonly Drawing[], depois: readonly Drawing[], v: Varredura): boolean {
  if (antes === depois) return true
  if (antes.length !== depois.length) return false
  for (let i = 0; i < depois.length; i++) {
    const velho = antes[i]
    const novo = depois[i]
    if (velho === novo) continue
    if (velho.id !== novo.id) return false
    if (velho.kind === 'line' && novo.kind === 'line') {
      if (mesmoSegmento(velho, novo) || !segmentoReto(novo)) return false
      if (!segmentoReto(velho)) v.algumTorto = true
      v.antigos.push([inicioDa(velho), fimDa(velho)])
    } else if (velho.kind === 'path' && novo.kind === 'path') {
      if (velho.points.length !== novo.points.length || !caminhoReto(novo.points)) return false
      if (!caminhoReto(velho.points)) v.algumTorto = true
      v.antigos.push(copiaDosPontos(velho.points))
    } else {
      return false
    }
    v.mudados.push({ kind: 'drawing', id: novo.id })
    v.desenhos.push(i)
  }
  return true
}

const perto = (a: number, b: number): boolean => Math.abs(a - b) <= FOLGA_DA_PROVA

function segmentoPerto(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return perto(a.x1, b.x1) && perto(a.y1, b.y1) && perto(a.x2, b.x2) && perto(a.y2, b.y2)
}

function desenhoPerto(a: Drawing, b: Drawing): boolean {
  if (a.kind === 'line' && b.kind === 'line') return segmentoPerto(a, b)
  if (a.kind !== 'path' || b.kind !== 'path' || a.points.length !== b.points.length) return false
  return a.points.every((p, i) => perto(p.x, b.points[i].x) && perto(p.y, b.points[i].y))
}

/**
 * A prova: o endireitar refeito sobre o mapa de antes, só com os itens que
 * mudaram, muda exatamente esses itens, para a mesma geometria. Cada item
 * endireita sozinho (os encostos saem do mapa de antes, não da seleção), então
 * refazer com eles dá o que o endireitar da seleção inteira deu — e custa só
 * o que mudou, não a seleção inteira.
 */
function provaDoEndireitar(antes: MapData, depois: MapData, v: Varredura): boolean {
  const refeito = endireitarNoMapa(antes, v.mudados)
  if (refeito.alterados !== v.mudados.length) return false
  // Mesmas posições nas listas: o endireitar troca item por item (`map`), sem criar nem reordenar.
  return (
    v.paredes.every((i) => segmentoPerto(refeito.map.walls[i], depois.walls[i])) &&
    v.desenhos.every((i) => desenhoPerto(refeito.map.drawings[i], depois.drawings[i]))
  )
}

/**
 * A store passou de `antes` a `depois` por um endireitar? Devolve a posição de
 * antes de cada item endireitado (o fantasma), ou `null` quando o passo é
 * outra coisa — inclusive desfazer e refazer: o fantasma é do gesto, não do
 * histórico.
 *
 * Roda a cada mudança da store: tudo antes da prova é comparação de
 * referência ou uma passada pelas listas que mudaram. Uma pequena perda,
 * aceita: a parede com porta em que nenhum pedaço estava torto sozinho (a
 * torção é só da emenda, abaixo de meio pixel) endireita sem fantasma — o
 * movimento, aí, nem se vê.
 */
export function tracosDoEndireitar(antes: PassoDaStore, depois: PassoDaStore): GhostStroke[] | null {
  if (depois.map === antes.map || depois.past === antes.past) return null
  // O passo novo de desfazer guarda o mapa que estava na tela: é o `withHistory`.
  // O fim de arrasto guarda o mapa de antes do arrasto, e o desfazer tira do `past`.
  if (ultimo(depois.past) !== antes.map) return null
  // Refazer também empurra o mapa da tela, mas o mapa novo é o que estava no `future`.
  if (antes.future.length > 0 && ultimo(antes.future) === depois.map) return null
  if (depois.selection !== antes.selection || depois.selection.length === 0) return null
  const v: Varredura = { mudados: [], paredes: [], desenhos: [], antigos: [], algumTorto: false }
  if (!varrerParedes(antes.map.walls, depois.map.walls, v)) return null
  if (!varrerDesenhos(antes.map.drawings, depois.map.drawings, v)) return null
  if (v.mudados.length === 0 || !v.algumTorto) return null
  return provaDoEndireitar(antes.map, depois.map, v) ? v.antigos : null
}

// ─────────────────────────────────────────────────────────────
// O fantasma na tela
// ─────────────────────────────────────────────────────────────

/**
 * Opacidade do fantasma `ms` depois de endireitar: de
 * `ENDIREITAR_FANTASMA_ALPHA` a 0 em `ENDIREITAR_FANTASMA_MS`. É o
 * complemento do ease-out cúbico (a mesma curva das fichas e da câmera): cai
 * rápido logo depois do Alt e assenta no fim. Relógio que volta conta como 0;
 * NaN encerra.
 */
export function alphaDoFantasma(ms: number): number {
  if (!(ms < ENDIREITAR_FANTASMA_MS)) return 0
  const t = Math.max(0, ms) / ENDIREITAR_FANTASMA_MS
  return ENDIREITAR_FANTASMA_ALPHA * (1 - t) ** 3
}

export interface FantasmaDoEndireitarOpcoes {
  /** Graphics próprio, num grupo de render próprio: o alpha de cada quadro não refaz os lotes do mapa. */
  graphics: Graphics
  /** O relógio de quadros do Pixi: o fantasma só se inscreve enquanto apaga. */
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** `prefers-reduced-motion`, lido a cada endireitar — a pessoa pode mudar com o app aberto. */
  movimentoReduzido: () => boolean
  escalaDaCamera: () => number
  resolucao: () => number
  /** Agora, em ms. Padrão `performance.now()`. */
  agora?: () => number
  /** Quantos traços estão na tela: N ao aparecer, 0 ao sumir (o `data-` do contêiner, para o e2e). */
  aoMudar?: (tracos: number) => void
}

export interface FantasmaDoEndireitar {
  /** Mostra a posição de antes e começa a apagar. Outro endireitar no meio troca o fantasma e recomeça. */
  mostrar: (tracos: readonly GhostStroke[]) => void
  /** Some na hora: desmonte do canvas, movimento reduzido. Sem fantasma, nada. */
  parar: () => void
  emCurso: () => boolean
}

export function criarFantasmaDoEndireitar(opcoes: FantasmaDoEndireitarOpcoes): FantasmaDoEndireitar {
  const { graphics, ticker } = opcoes
  const agora = opcoes.agora ?? (() => performance.now())
  /** Quando o fantasma de agora nasceu; `null` = nenhum na tela. */
  let nasceuEm: number | null = null

  function parar(): void {
    if (nasceuEm === null) return
    nasceuEm = null
    ticker.remove(quadro)
    graphics.clear()
    opcoes.aoMudar?.(0)
  }

  function quadro(): void {
    if (nasceuEm === null) return
    const ms = agora() - nasceuEm
    if (!(ms < ENDIREITAR_FANTASMA_MS)) {
      parar()
      return
    }
    // Só o alpha muda a cada quadro: no grupo de render próprio, isso não refaz geometria.
    graphics.alpha = alphaDoFantasma(ms)
  }

  function mostrar(tracos: readonly GhostStroke[]): void {
    if (opcoes.movimentoReduzido()) {
      parar()
      return
    }
    if (tracos.length === 0) return
    drawStraightenGhost(graphics, tracos, opcoes.escalaDaCamera(), opcoes.resolucao())
    graphics.alpha = ENDIREITAR_FANTASMA_ALPHA
    if (nasceuEm === null) ticker.add(quadro)
    nasceuEm = agora()
    opcoes.aoMudar?.(tracos.length)
  }

  return { mostrar, parar, emCurso: () => nasceuEm !== null }
}
