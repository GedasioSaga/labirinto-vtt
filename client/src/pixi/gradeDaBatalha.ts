import { BufferImageSource, Container, Graphics, Texture, TilingSprite } from 'pixi.js'
import type { GridSettings, MapData } from '../types/map'
import { drawHexGrid } from './drawHexGrid'
import type { Viewport } from './grid'
import { computeVisibleHexCenters } from './hexGrid'
import { criarPortaoDaVista } from './vistaCoberta'

/**
 * MODO BATALHA (fatia B5 de docs/planos/modo-batalha-2026-10-24.md): a grade
 * de batalha, por cima do mapa e dos telhados e abaixo das fichas, marcas e
 * HUD (decisão 2), no editor (`PixiCanvas.tsx`) e no jogador (`PlayerView.tsx`).
 * Só aparece com a batalha ligada na cena e nunca em mapa triangular
 * (decisão 7).
 *
 * CAMPO DE BATALHA (protótipo aprovado em 19/11/2026,
 * docs/design/campo-de-batalha/prototipo.html): a grade deixa de ser uma tela
 * branca por cima do chão. É o TOM ESCURO DO PRÓPRIO CHÃO (cinza em
 * `multiply`: escurece o chão que está embaixo sem trazer cor nova), em
 * cruzes nos cantos das casas. A linha inteira só aparece onde se conta casa,
 * dentro do alcance de movimento (`marcasDaBatalha.ts`). Com o zoom afastado
 * (menos de `CASA_MINIMA_PX` por casa) a cruz fica de 5 em 5 casas, e some
 * quando nem assim cabe.
 *
 * A cruz é uma textura de uma casa repetida (`TilingSprite`): o custo não
 * cresce com o número de casas à vista (num mapa grande afastado, um `Graphics`
 * com uma cruz por casa passava de 30 mil traços). A textura só é refeita
 * quando o tamanho da casa na tela muda de pixel; o pan não mexe nela.
 *
 * Hex: linha fina no mesmo tom escuro, desenhada só no pedaço à vista com uma
 * tela de folga para cada lado (`vistaCoberta.ts`), como a moldura da F8.
 */

/** Abaixo disto (px de tela por casa) a cruz fica de 5 em 5 casas. */
export const CASA_MINIMA_PX = 16
/** De quantas em quantas casas fica a cruz com o zoom afastado. */
export const CASAS_POR_CRUZ_LONGE = 5
/** O cinza que escurece o chão em `multiply` (0,35 de luz) e quanto dele entra. */
const TOM_DA_CRUZ = 0.35
const FORCA_DA_CRUZ = 0.6
/** Traço da cruz e meio braço, em px de tela; o braço acompanha a casa até estes limites. */
const TRACO_DA_CRUZ_PX = 1.5
const BRACO_MINIMO_PX = 2.5
const BRACO_MAXIMO_PX = 5
const BRACO_DA_CASA = 0.075
/** Teto da textura (px físicos de um lado): casa enorme no zoom máximo não vira textura gigante. */
const TEXTURA_MAXIMA_PX = 512

/** Hex: a linha no mesmo cinza escuro do chão. */
const ESTILO_DO_HEX: GridSettings = { color: '#5a5a5a', opacity: 0.45, lineWidth: 1, lineStyle: 'solid' }

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

/** De quantas em quantas casas vai a cruz neste zoom; `null` = nenhuma (nem de 5 em 5 cabe). */
export function casasPorCruz(casaNaTelaPx: number): number | null {
  if (!(casaNaTelaPx > 0)) return null
  if (casaNaTelaPx >= CASA_MINIMA_PX) return 1
  return casaNaTelaPx * CASAS_POR_CRUZ_LONGE >= CASA_MINIMA_PX ? CASAS_POR_CRUZ_LONGE : null
}

export interface GradeDaBatalha {
  /** O container da faixa `gradeDaBatalha` (lib/camadas/ordem.ts). */
  readonly camada: Container
  /** A batalha e a grade do mapa (cada redesenho do mapa). Sem mudança, não desenha. */
  definir(ligada: boolean, map: MapaDaGrade): void
  /** A câmera (cada pan e zoom). `null` = esconder (exportar imagem). Dentro da folga, não desenha. */
  ajustarAVista(vista: Viewport | null, escala: number, resolucao: number): void
  /** Quantas vezes a grade foi refeita (a textura da cruz ou o traço do hex): o teste e a medida leem. */
  desenhos(): number
}

/** Cobertura (0..1) do pixel `[p, p+1)` por um intervalo `[a, b)`. */
function cobertura(p: number, a: number, b: number): number {
  return Math.max(0, Math.min(p + 1, b) - Math.max(p, a))
}

/**
 * A textura de uma "célula da cruz": `lado` px físicos, a cruz no centro
 * (quem usa desloca meia célula para ela cair no canto da casa). Pixels já em
 * alfa pré-multiplicado, com a borda suavizada pela cobertura do pixel: sem
 * canvas (o teste roda em jsdom, sem 2D).
 */
function texturaDaCruz(lado: number, braco: number, traco: number): Texture {
  const dados = new Uint8Array(lado * lado * 4)
  const meio = lado / 2
  for (let y = 0; y < lado; y += 1) {
    const naHorizontal = cobertura(y, meio - traco / 2, meio + traco / 2)
    const naVertical = cobertura(y, meio - braco, meio + braco)
    if (naHorizontal === 0 && naVertical === 0) continue
    for (let x = 0; x < lado; x += 1) {
      const h = naHorizontal * cobertura(x, meio - braco, meio + braco)
      const v = naVertical * cobertura(x, meio - traco / 2, meio + traco / 2)
      const a = Math.max(h, v) * FORCA_DA_CRUZ
      if (a === 0) continue
      const i = (y * lado + x) * 4
      const luz = Math.round(TOM_DA_CRUZ * a * 255)
      dados[i] = luz
      dados[i + 1] = luz
      dados[i + 2] = luz
      dados[i + 3] = Math.round(a * 255)
    }
  }
  const source = new BufferImageSource({ resource: dados, width: lado, height: lado, alphaMode: 'premultiplied-alpha', scaleMode: 'linear' })
  return new Texture({ source })
}

export function criarGradeDaBatalha(): GradeDaBatalha {
  const camada = new Container()
  camada.label = ROTULO_DA_GRADE_DA_BATALHA
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  const cruzes = new TilingSprite({ texture: Texture.EMPTY, width: 0, height: 0 })
  cruzes.blendMode = 'multiply'
  cruzes.visible = false
  const hex = new Graphics()
  hex.blendMode = 'multiply'
  camada.addChild(cruzes, hex)
  camada.visible = false
  const portao = criarPortaoDaVista()
  let ligada = false
  let mapa: MapaDaGrade | null = null
  let vista: Viewport | null = null
  let escala = 1
  let resolucao = 1
  let desenhos = 0
  /** A chave da textura da cruz em uso (lado, braço, traço); `null` = nenhuma. */
  let chaveDaCruz: string | null = null
  let geometriaDaCruz: string | null = null

  const soltarCruz = () => {
    geometriaDaCruz = null
    if (cruzes.texture !== Texture.EMPTY) {
      const velha = cruzes.texture
      cruzes.texture = Texture.EMPTY
      velha.destroy(true)
    }
    chaveDaCruz = null
    cruzes.visible = false
  }

  const apagarHex = () => {
    portao.esquecer()
    // Limpar o vazio marcaria o Graphics como mudado e o Pixi refaria o lote do mundo (F8).
    if (hex.context.instructions.length > 0) hex.clear()
  }

  const apagar = () => {
    apagarHex()
    soltarCruz()
    camada.visible = false
  }

  /** As cruzes do quadrado: só o tamanho da casa na tela mexe na textura; o resto é posição. */
  const atualizarCruzes = (m: MapaDaGrade) => {
    apagarHex()
    const casaNaTela = m.grid * escala
    const passo = casasPorCruz(casaNaTela)
    if (passo === null) {
      soltarCruz()
      return
    }
    const ladoNaTela = casaNaTela * passo
    const fisico = Math.max(1, resolucao)
    const lado = Math.max(8, Math.min(TEXTURA_MAXIMA_PX, Math.round(ladoNaTela * fisico)))
    // A cruz é desenhada em px físicos da textura, que a repetição estica até `ladoNaTela * fisico`.
    const esticar = lado / (ladoNaTela * fisico)
    const braco = Math.min(BRACO_MAXIMO_PX, Math.max(BRACO_MINIMO_PX, casaNaTela * BRACO_DA_CASA)) * fisico * esticar
    const traco = TRACO_DA_CRUZ_PX * fisico * esticar
    const chave = `${lado}|${braco.toFixed(2)}|${traco.toFixed(2)}`
    if (chave !== chaveDaCruz) {
      soltarCruz()
      cruzes.texture = texturaDaCruz(lado, braco, traco)
      chaveDaCruz = chave
      desenhos += 1
    }
    const offset = m.gridOffset ?? { x: 0, y: 0 }
    const celula = m.grid * passo
    // O pan chama isto a cada quadro: sem mudança, nada é escrito (mexer no sprite refaria o lote do mundo).
    const geometria = `${chave}|${m.width}|${m.height}|${m.grid}|${passo}|${offset.x},${offset.y}`
    if (geometria !== geometriaDaCruz) {
      geometriaDaCruz = geometria
      cruzes.width = m.width * m.grid
      cruzes.height = m.height * m.grid
      cruzes.tileScale.set(celula / lado)
      // Meia célula para trás: a cruz do centro da textura cai no canto da casa.
      cruzes.tilePosition.set(offset.x - celula / 2, offset.y - celula / 2)
    }
    cruzes.visible = true
  }

  const atualizarHex = (m: MapaDaGrade) => {
    soltarCruz()
    if (vista === null) return
    const chave = `${escala}|${resolucao}|${m.width}|${m.height}|${m.grid}`
    const coberta = portao.precisa(chave, vista)
    if (coberta === null) return
    desenhos += 1
    const recorte = recorteNoMapa(coberta, m)
    if (recorte === null) {
      if (hex.context.instructions.length > 0) hex.clear()
      return
    }
    // A grade hex desenha em px de mundo: a largura em px de tela vira mundo pela escala.
    drawHexGrid(hex, computeVisibleHexCenters(m.grid, recorte), m.grid, { ...ESTILO_DO_HEX, lineWidth: ESTILO_DO_HEX.lineWidth / escala })
  }

  const atualizar = () => {
    if (!ligada || mapa === null || vista === null || mapa.grid <= 0 || !batalhaCabeNaGrade(mapa.gridShape)) {
      apagar()
      return
    }
    camada.visible = true
    if (mapa.gridShape === 'hex') atualizarHex(mapa)
    else atualizarCruzes(mapa)
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
