import { Container, Graphics } from 'pixi.js'
import type { GridSettings, MapData } from '../types/map'
import { computeAlignedGridLines } from '../lib/gridAlign'
import { drawGrid } from './drawGrid'
import { drawHexGrid } from './drawHexGrid'
import type { Viewport } from './grid'
import { computeVisibleHexCenters } from './hexGrid'
import { pixelGrid } from './pixelAlign'
import { criarPortaoDaVista } from './vistaCoberta'

/**
 * MODO BATALHA (fatia B5 de docs/planos/modo-batalha-2026-10-24.md): a grade
 * de batalha, por cima do mapa e dos telhados e abaixo das fichas, marcas e
 * HUD (decisão 2), no editor (`PixiCanvas.tsx`) e no jogador (`PlayerView.tsx`).
 * Só aparece com a batalha ligada na cena e nunca em mapa triangular
 * (decisão 7).
 *
 * Barata como a moldura da F8 (`vistaCoberta.ts`): desenha só o pedaço do mapa
 * à vista, com uma tela de folga para cada lado; o pan dentro da folga não
 * mexe no `Graphics` (nem refaz o lote do mundo). Zoom, resolução e grade do
 * mapa entram na chave e redesenham.
 */

/** Traço claro fino sobre um halo escuro mais largo: lê no chão claro, no telhado e na névoa escura. */
const LINHA_PX = 1
const HALO_PX = 3
const ESTILO_DA_LINHA: GridSettings = { color: '#ffffff', opacity: 0.6, lineWidth: LINHA_PX, lineStyle: 'solid' }
const ESTILO_DO_HALO: GridSettings = { color: '#000000', opacity: 0.35, lineWidth: HALO_PX, lineStyle: 'solid' }

export const ROTULO_DA_GRADE_DA_BATALHA = 'gradeDaBatalha'

export type MapaDaGrade = Pick<MapData, 'width' | 'height' | 'grid' | 'gridShape' | 'gridOffset'>

/** Decisão 7: batalha em quadrado e hex; triangular não tem grade de batalha. */
export function batalhaCabeNaGrade(shape: MapData['gridShape']): boolean {
  return shape !== 'triangle'
}

/** O pedaço do mapa dentro de `vista`; `null` = nenhum pedaço do mapa à vista. */
export function recorteNoMapa(vista: Viewport, map: MapaDaGrade): Viewport | null {
  const left = Math.max(0, vista.left)
  const top = Math.max(0, vista.top)
  const right = Math.min(map.width * map.grid, vista.right)
  const bottom = Math.min(map.height * map.grid, vista.bottom)
  return right > left && bottom > top ? { left, top, right, bottom } : null
}

export interface GradeDaBatalha {
  /** O container da faixa `gradeDaBatalha` (lib/camadas/ordem.ts). */
  readonly camada: Container
  /** A batalha e a grade do mapa (cada redesenho do mapa). Sem mudança, não desenha. */
  definir(ligada: boolean, map: MapaDaGrade): void
  /** A câmera (cada pan e zoom). `null` = esconder (exportar imagem). Dentro da folga, não desenha. */
  ajustarAVista(vista: Viewport | null, escala: number, resolucao: number): void
  /** Quantas vezes o `Graphics` foi refeito: o teste e a medida leem. */
  desenhos(): number
}

function desenhar(halo: Graphics, linha: Graphics, map: MapaDaGrade, recorte: Viewport, escala: number, resolucao: number): void {
  if (map.gridShape === 'hex') {
    const centros = computeVisibleHexCenters(map.grid, recorte)
    // A grade hex desenha em px de mundo: a largura em px de tela vira mundo pela escala.
    drawHexGrid(halo, centros, map.grid, { ...ESTILO_DO_HALO, lineWidth: HALO_PX / escala })
    drawHexGrid(linha, centros, map.grid, { ...ESTILO_DA_LINHA, lineWidth: LINHA_PX / escala })
    return
  }
  // Só as linhas dentro do mapa: as alinhadas passam um quadrado de cada lado da vista.
  const linhas = computeAlignedGridLines(map.grid, map.gridOffset ?? { x: 0, y: 0 }, recorte).filter((l) =>
    l.axis === 'x' ? l.position >= recorte.left && l.position <= recorte.right : l.position >= recorte.top && l.position <= recorte.bottom,
  )
  drawGrid(halo, linhas, recorte, ESTILO_DO_HALO, pixelGrid(escala, resolucao, HALO_PX))
  drawGrid(linha, linhas, recorte, ESTILO_DA_LINHA, pixelGrid(escala, resolucao, LINHA_PX))
}

export function criarGradeDaBatalha(): GradeDaBatalha {
  const camada = new Container()
  camada.label = ROTULO_DA_GRADE_DA_BATALHA
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  const halo = new Graphics()
  const linha = new Graphics()
  camada.addChild(halo, linha)
  camada.visible = false
  const portao = criarPortaoDaVista()
  let ligada = false
  let mapa: MapaDaGrade | null = null
  let vista: Viewport | null = null
  let escala = 1
  let resolucao = 1
  let desenhos = 0

  const apagar = () => {
    portao.esquecer()
    // Limpar o vazio marcaria o Graphics como mudado e o Pixi refaria o lote do mundo (F8).
    if (halo.context.instructions.length > 0) halo.clear()
    if (linha.context.instructions.length > 0) linha.clear()
    camada.visible = false
  }

  const atualizar = () => {
    if (!ligada || mapa === null || vista === null || mapa.grid <= 0 || !batalhaCabeNaGrade(mapa.gridShape)) {
      apagar()
      return
    }
    camada.visible = true
    const offset = mapa.gridOffset ?? { x: 0, y: 0 }
    const chave = `${escala}|${resolucao}|${mapa.width}|${mapa.height}|${mapa.grid}|${mapa.gridShape}|${offset.x},${offset.y}`
    const coberta = portao.precisa(chave, vista)
    if (coberta === null) return
    desenhos += 1
    const recorte = recorteNoMapa(coberta, mapa)
    if (recorte === null) {
      if (halo.context.instructions.length > 0) halo.clear()
      if (linha.context.instructions.length > 0) linha.clear()
      return
    }
    desenhar(halo, linha, mapa, recorte, escala, resolucao)
  }

  return {
    camada,
    definir(novaLigada, novoMapa) {
      const mesmoMapa =
        mapa !== null &&
        mapa.width === novoMapa.width &&
        mapa.height === novoMapa.height &&
        mapa.grid === novoMapa.grid &&
        mapa.gridShape === novoMapa.gridShape &&
        (mapa.gridOffset?.x ?? 0) === (novoMapa.gridOffset?.x ?? 0) &&
        (mapa.gridOffset?.y ?? 0) === (novoMapa.gridOffset?.y ?? 0)
      if (novaLigada === ligada && mesmoMapa) return
      ligada = novaLigada
      mapa = { width: novoMapa.width, height: novoMapa.height, grid: novoMapa.grid, gridShape: novoMapa.gridShape, gridOffset: novoMapa.gridOffset }
      atualizar()
    },
    ajustarAVista(novaVista, novaEscala, novaResolucao) {
      vista = novaVista
      escala = novaEscala
      resolucao = novaResolucao
      atualizar()
    },
    desenhos: () => desenhos,
  }
}
