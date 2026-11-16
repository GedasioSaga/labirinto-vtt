/**
 * UMA MÃO SÓ (Fase 4, 15/11/2026): o pino, a zona oculta, a água (e a lava) e
 * o risco do Barranco entram na seleção comum (`SelectionKind` 'pin', 'zone',
 * 'agua' e 'barranco'), ao lado do carimbo da Fase 2. Aqui mora a parte pura
 * desses quatro: quem o laço alcança, a caixa de cada um, mover, apagar e o
 * que a Borracha geral acha debaixo do ponto. Sem Pixi nem store.
 *
 * A água e o risco do Barranco não têm camada por item: a água mora em Chão
 * (`lib/camadas/ordem.ts`, faixa `aguaDoMapa`) e o barranco em Terreno. O
 * olho e o cadeado dessas camadas valem para eles. A zona oculta não mora em
 * camada nenhuma (é do mestre, sempre à vista no editor).
 *
 * Nenhum campo novo no arquivo: o mapa salvo antes abre e salva igual.
 */
import type { Agua, BarrancoDoMapa, CamadaId, ConcealZone, MapData, Pin, RegionPoint, RiscoDeBarranco } from '../types/map'
import type { Selection } from '../types/tools'
import { moverForma } from './agua/bolinhas'
import { aguaNoPonto, caixaDaAgua } from './agua/forma'
import { comAguas } from './agua/dados'
import { comBarranco, escalaDoBarranco, geosDoBarranco, riscoPerto } from './barranco'
import { contextoDeCamadas, type CamposDeCamadas } from './camadas/consulta'
import { carimboNoPonto } from './carimbos'
import { pisoDe } from './pisos'
import { REVEAL_BRUSH_CELL } from './revealBrushCell'

/** A camada em que toda água mora (a água não escolhe camada). */
export const CAMADA_DA_AGUA: CamadaId = 'chao'
/** A camada em que todo risco do Barranco mora. */
export const CAMADA_DO_BARRANCO: CamadaId = 'terreno'

/** O mestre vê a camada e ela está destravada: o laço, o clique e a borracha alcançam o que mora nela. */
export function camadaMexivel(map: CamposDeCamadas, camada: CamadaId): boolean {
  const camadas = contextoDeCamadas(map)
  return camadas.mestreVe(camada) && !camadas.travada(camada)
}

/** Os riscos do Barranco do piso `piso`, na ordem do mapa. */
export function riscosDoPiso(barranco: BarrancoDoMapa | undefined, piso: number): RiscoDeBarranco[] {
  return barranco === undefined ? [] : barranco.riscos.filter((risco) => pisoDe(risco) === piso)
}

/** A caixa da água em px de mundo, no formato das caixas da seleção. */
export function caixaDaAguaNaSelecao(agua: Agua, grid: number): { minX: number; minY: number; maxX: number; maxY: number } {
  const c = caixaDaAgua(agua, grid)
  return { minX: c.x0, minY: c.y0, maxX: c.x1, maxY: c.y1 }
}

/** A caixa dos pontos (zona, risco). `null` sem pontos. */
export function caixaDosPontos(pontos: readonly RegionPoint[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (pontos.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pontos) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

// ─────────────────────────────────────────────────────────────
// Mover: cada um devolve a MESMA lista quando nada andou (o arrasto de item
// travado não gasta passo no Ctrl+Z, `moveAreaSelection` compara referência).
// ─────────────────────────────────────────────────────────────

/**
 * Os pinos de `ids` andam (dx, dy). O travado (`locked`) fica. `jaAndaram`: os
 * pinos que já andaram neste passo presos a uma ficha (`carryAttachedPins`),
 * para não somar o delta duas vezes.
 */
export function moverPinos(pins: Pin[], ids: ReadonlySet<string>, dx: number, dy: number, jaAndaram: ReadonlySet<string>): Pin[] {
  if ((dx === 0 && dy === 0) || ids.size === 0) return pins
  let mudou = false
  const depois = pins.map((pin) => {
    if (!ids.has(pin.id) || pin.locked === true || jaAndaram.has(pin.id)) return pin
    mudou = true
    return { ...pin, x: pin.x + dx, y: pin.y + dy }
  })
  return mudou ? depois : pins
}

/**
 * As células reveladas pelo pincel (`unveiledCells`, "col,row" de
 * `REVEAL_BRUSH_CELL` px) andam com a zona, de célula em célula: o pedaço
 * revelado continua no mesmo canto da zona. O passo é o quanto a CÉLULA do
 * primeiro ponto da zona mudou — o arrasto ao vivo anda de 3 em 3 px, e
 * arredondar cada passinho sozinho nunca sairia do lugar; pela célula do
 * ponto, a soma dos passinhos dá o caminho inteiro.
 */
function moverCelulas(celulas: readonly string[], referencia: RegionPoint, dx: number, dy: number): string[] {
  const dc = Math.floor((referencia.x + dx) / REVEAL_BRUSH_CELL) - Math.floor(referencia.x / REVEAL_BRUSH_CELL)
  const dr = Math.floor((referencia.y + dy) / REVEAL_BRUSH_CELL) - Math.floor(referencia.y / REVEAL_BRUSH_CELL)
  if (dc === 0 && dr === 0) return [...celulas]
  return celulas.flatMap((celula) => {
    const [col, row] = celula.split(',').map(Number)
    return Number.isFinite(col) && Number.isFinite(row) ? [`${col + dc},${row + dr}`] : []
  })
}

/** As zonas ocultas de `ids` andam (dx, dy), com o que o pincel já revelou nelas. */
export function moverZonas(zonas: ConcealZone[], ids: ReadonlySet<string>, dx: number, dy: number): ConcealZone[] {
  if ((dx === 0 && dy === 0) || ids.size === 0) return zonas
  let mudou = false
  const depois = zonas.map((zona) => {
    if (!ids.has(zona.id)) return zona
    mudou = true
    const pontos = moverForma(zona.points, dx, dy)
    const referencia = zona.points[0]
    if (zona.unveiledCells === undefined || referencia === undefined) return { ...zona, points: pontos }
    return { ...zona, points: pontos, unveiledCells: moverCelulas(zona.unveiledCells, referencia, dx, dy) }
  })
  return mudou ? depois : zonas
}

/** As águas de `ids` andam inteiras (dx, dy): o contorno ou o traço e a areia pintada em volta. */
export function moverAguas(aguas: Agua[], ids: ReadonlySet<string>, dx: number, dy: number): Agua[] {
  if ((dx === 0 && dy === 0) || ids.size === 0) return aguas
  let mudou = false
  const depois = aguas.map((agua) => {
    if (!ids.has(agua.id)) return agua
    mudou = true
    const pontos = moverForma(agua.pontos, dx, dy)
    if (agua.areia === undefined) return { ...agua, pontos }
    return { ...agua, pontos, areia: agua.areia.map((traco) => ({ ...traco, pontos: moverForma(traco.pontos, dx, dy) })) }
  })
  return mudou ? depois : aguas
}

/** Os riscos do Barranco de `ids` andam (dx, dy). A área alta e as rampas ficam (a rampa acha o barranco mais perto). */
export function moverRiscos(barranco: BarrancoDoMapa, ids: ReadonlySet<string>, dx: number, dy: number): BarrancoDoMapa {
  if ((dx === 0 && dy === 0) || ids.size === 0) return barranco
  let mudou = false
  const riscos = barranco.riscos.map((risco) => {
    if (!ids.has(risco.id)) return risco
    mudou = true
    return { ...risco, pontos: moverForma(risco.pontos, dx, dy) }
  })
  return mudou ? { ...barranco, riscos } : barranco
}

/**
 * O mapa sem estas águas e estes riscos do Barranco, num passo (o Delete e a
 * Borracha geral). O último risco apagado com o barranco vazio tira o campo
 * (`comBarranco`), e a última água também (`comAguas`). Nada saiu: o MESMO mapa.
 */
export function semItensDoTerreno(map: MapData, aguas: ReadonlySet<string>, riscos: ReadonlySet<string>): MapData {
  let next = map
  if (aguas.size > 0 && next.aguas !== undefined) {
    const ficam = next.aguas.filter((agua) => !aguas.has(agua.id))
    if (ficam.length !== next.aguas.length) next = comAguas(next, ficam)
  }
  if (riscos.size > 0 && next.barranco !== undefined) {
    const ficam = next.barranco.riscos.filter((risco) => !riscos.has(risco.id))
    if (ficam.length !== next.barranco.riscos.length) next = comBarranco(next, { ...next.barranco, riscos: ficam })
  }
  return next
}

// ─────────────────────────────────────────────────────────────
// A Borracha geral e o clique no Terreno
// ─────────────────────────────────────────────────────────────

/** O que a Borracha geral e o clique do Selecionar acham no Terreno: o carimbo, o risco do Barranco ou a água. */
export type AcertoNoTerreno = Selection & { kind: 'carimbo' | 'barranco' | 'agua' }

/**
 * O que está no Terreno debaixo do ponto, de cima para baixo como a tela
 * desenha: o carimbo, o risco do Barranco e, por último, a água (área grande,
 * não engole o resto). Só o que o mestre vê; `piso` filtra os riscos (o mapa
 * do piso não recorta o barranco). Devolve também a camada TRAVADA que
 * segura o primeiro achado: travada é barreira, não passa para o de baixo.
 */
export function terrenoNoPonto(
  map: MapData,
  piso: number,
  ponto: RegionPoint,
  comAgua: boolean,
): { acerto: AcertoNoTerreno; travada: CamadaId | null } | null {
  const camadas = contextoDeCamadas(map)
  const travadaDe = (camada: CamadaId): CamadaId | null => (camadas.travada(camada) ? camadas.camadaQueManda(camada) : null)
  const carimbo = carimboNoPonto(map.carimbos, ponto, (c) => camadas.mestreVe(camadas.camadaDe('carimbo', c)))
  if (carimbo !== null) {
    return { acerto: { kind: 'carimbo', id: carimbo.id }, travada: travadaDe(camadas.camadaDe('carimbo', carimbo)) }
  }
  if (map.barranco !== undefined && map.barranco.riscos.length > 0 && camadas.mestreVe(CAMADA_DO_BARRANCO)) {
    const id = riscoPerto(geosDoBarranco(map.barranco, piso, map.grid), ponto, 10 * escalaDoBarranco(map.grid))
    if (id !== null) return { acerto: { kind: 'barranco', id }, travada: travadaDe(CAMADA_DO_BARRANCO) }
  }
  if (comAgua && map.aguas !== undefined && map.aguas.length > 0 && camadas.mestreVe(CAMADA_DA_AGUA)) {
    const agua = aguaNoPonto(map.aguas, map.grid, ponto.x, ponto.y)
    if (agua !== null) return { acerto: { kind: 'agua', id: agua.id }, travada: travadaDe(CAMADA_DA_AGUA) }
  }
  return null
}
