import type { Graphics } from 'pixi.js'
import type { Wall } from '../types/map'
import { SELECTION_COLOR } from './constants'

/**
 * Espessura nomeada da parede (Fase 6, pedido do usuário: "se eu quero
 * poligono finos ou medios ou gordos") — EIXO SEPARADO de `wall.wallKind`.
 * `wallKind` (interior/exterior) é classificação SEMÂNTICA (estrutural vs
 * divisória, herdada de uma fase anterior); `thickness` é preferência de
 * ESTILO por cima disso, ortogonal. Fundir os dois num único enum (ex.
 * 'ext-fina' | 'ext-grossa' | 'int-fina' | 'int-grossa') quebraria o campo já
 * persistido `wallKind` em todo mapa salvo e impediria exatamente o que o
 * usuário pediu: "externa fina" pra rua/construção artesanal, que hoje seria
 * uma contradição semântica se 'exterior' já significasse "grossa". Mantendo
 * os dois eixos, qualquer uma das 6 combinações é representável.
 * `undefined` === 'medium' — ver `WallWithStyle` abaixo (campo ainda não
 * existe em `types/map.ts`, CONTRATO no relatório do agente G1).
 */
export type WallThickness = 'thin' | 'medium' | 'thick'

/**
 * Ponta/canto reto ou arredondado (Fase 6, pedido literal: "essas paredes
 * tem a ponta redonda, quero a opcao de colocar reta ou redondo" +
 * "as linhas dos poligonos se eu quero eles arredondados ou retos"). Um
 * único eixo cobre os dois pedidos porque são a MESMA escolha visual em dois
 * contextos: numa parede solta (ou na ponta aberta de uma cadeia — ver
 * `groupWallsForPath` abaixo) vira o `cap` do stroke; num canto fechado
 * (Sala) vira o `join`. 'round' → cap 'round' + join 'round' (comportamento
 * hardcoded de antes desta fase). 'straight' → cap 'butt' + join 'miter'
 * (cantos de 90° ficam nítidos, sem sobra — ver `drawRegions.ts`, que já usa
 * miter como default do Pixi pra ângulo reto sem problema). `undefined` ===
 * 'round'.
 */
export type WallLineStyle = 'round' | 'straight'

/**
 * `Wall` (types/map.ts) ainda não tem `thickness`/`lineStyle` — são campos
 * novos desta fase e `types/map.ts` é arquivo de integrador, fora do meu
 * escopo de escrita (ver CONTRATO no relatório). Em vez de fazer `as` pra
 * "forçar" os campos em cima de `Wall`, esta extensão estrutural resolve o
 * mesmo problema sem calar o compilador: como os 2 campos são opcionais,
 * qualquer `Wall[]` de HOJE (sem eles) já satisfaz `WallWithStyle[]`
 * naturalmente — nenhum call site (PixiCanvas.tsx, drawDoors.test.ts) precisa
 * mudar pra continuar compilando. Assim que o integrador adicionar os 2
 * campos em `Wall`, este alias e os 2 tipos acima devem se mudar para
 * `types/map.ts` e este arquivo/`WallStyleControls.tsx` trocam o import.
 */
export type WallWithStyle = Wall & { thickness?: WallThickness; lineStyle?: WallLineStyle }

/**
 * Espessura base (kind × thickness='medium'), em px de MUNDO — reduzida em
 * ~60% em relação ao que era hardcoded antes desta fase (interior 2.5→1,
 * exterior 4→1.5). Pedido literal do usuário: "ta muito gordo tudo isso,
 * tente deixar tudo extremamente fino". Referência de proporção: `map.grid`
 * default é 64px (`lib/mapFile.ts:24`) — a parede exterior ia de 6.25% de uma
 * célula pra 2.34%. Este valor é o preset 'medium'; 'thin'/'thick' escalam a
 * partir dele via THICKNESS_RATIO abaixo.
 */
const KIND_BASE_WIDTH: Record<'interior' | 'exterior', number> = { interior: 1, exterior: 1.5 }

/** Cor por `wallKind` — inalterada desta fase (só a espessura mudou). */
const WALL_COLOR: Record<'interior' | 'exterior', number> = { interior: 0xa8a8a8, exterior: 0xe0e0e0 }

/**
 * Multiplicador do preset de espessura sobre `KIND_BASE_WIDTH` — mesma escala
 * 0.5/1/2 que `STAIR_SIZE_PRESET_RATIO` (`lib/stairs.ts`) já usa pra
 * pequena/média/grande, reaproveitada de propósito: mesmo vocabulário
 * "P/M/G" do usuário (N1), agora aplicado a espessura de parede em vez de
 * tamanho de lance de escada.
 */
const THICKNESS_RATIO: Record<WallThickness, number> = { thin: 0.5, medium: 1, thick: 2 }

/**
 * Realce de seleção: multiplicativo sobre a largura já resolvida (kind ×
 * thickness), com PISO absoluto. Sem o piso, uma parede 'thin' selecionada
 * (1 × 0.5 × 1.6 = 0.8px) ficaria mais FINA que uma parede 'thick' comum não
 * selecionada (1.5 × 2 = 3px), invertendo a hierarquia visual
 * "selecionado = destaque" que a UI promete em todo o resto do app.
 */
const SELECTION_WIDTH_MULTIPLIER = 1.6
const MIN_SELECTED_WIDTH = 2

interface WallVisualStyle {
  width: number
  color: number
  cap: 'round' | 'butt'
  join: 'round' | 'miter'
}

function capJoinFor(lineStyle: WallLineStyle): Pick<WallVisualStyle, 'cap' | 'join'> {
  return lineStyle === 'straight' ? { cap: 'butt', join: 'miter' } : { cap: 'round', join: 'round' }
}

/** Resolve os 3 eixos (`wallKind`/`thickness`/`lineStyle`, todos com default
 *  por `undefined`) mais seleção num estilo visual concreto — única função
 *  que sabe a fórmula, tanto pro caso "1 parede = 1 stroke" quanto pro caso
 *  "N paredes = 1 path" (`drawRun` abaixo usa o resultado do primeiro membro
 *  do grupo, garantido idêntico aos demais por `sameStyle` em
 *  `groupWallsForPath`). */
function resolveWallStyle(wall: WallWithStyle, isSelected: boolean): WallVisualStyle {
  const kind = wall.wallKind ?? 'exterior'
  const thickness = wall.thickness ?? 'medium'
  const lineStyle = wall.lineStyle ?? 'round'
  const baseWidth = KIND_BASE_WIDTH[kind] * THICKNESS_RATIO[thickness]
  const width = isSelected ? Math.max(baseWidth * SELECTION_WIDTH_MULTIPLIER, MIN_SELECTED_WIDTH) : baseWidth
  const color = isSelected ? SELECTION_COLOR : WALL_COLOR[kind]
  return { width, color, ...capJoinFor(lineStyle) }
}

function sameStyle(a: WallVisualStyle, b: WallVisualStyle): boolean {
  return a.width === b.width && a.color === b.color && a.cap === b.cap && a.join === b.join
}

/** Parede vinculada a uma Região com o índice de aresta já resolvido (não
 *  `undefined`) — narrowing explícito via type guard, pra nunca precisar de
 *  `as number` ao ler `regionEdgeIndex` depois de agrupar por `regionId`. */
type RegionEdgeWall = WallWithStyle & { regionId: string; regionEdgeIndex: number }

function hasRegionEdge(wall: WallWithStyle): wall is RegionEdgeWall {
  return wall.regionId !== undefined && wall.regionEdgeIndex !== undefined
}

interface WallRun {
  walls: WallWithStyle[]
  style: WallVisualStyle
}

/**
 * Agrupa paredes em "runs" — sequências que vão virar UM path com UM
 * `stroke()`, em vez de um `stroke()` por parede. Corrige o bug B1
 * (`docs/DOSSIE-FEEDBACK-F4.md`, "bug1 canto-aberto") pela via geometricamente
 * correta que o dossiê descreveu como opção 2: paredes da MESMA Região,
 * ordenadas por `regionEdgeIndex`, formam um path contínuo — o canto fecha
 * pelo *line join* do Pixi, não pelo `cap` de cada ponta (o hack da Fase 4).
 *
 * Uma "run" quebra em dois casos, ambos obrigatórios pra não regredir nada:
 *  1. `regionEdgeIndex` não é consecutivo (aresta apagada no meio — invariante
 *     documentada em `types/map.ts`, `Wall.regionEdgeIndex`: "o conjunto em
 *     uso é um SUBCONJUNTO de 0..n-1, nunca presumido completo"). Sem isso,
 *     duas paredes que NÃO são vizinhas geometricamente ganhariam um
 *     `lineTo` ligando os dois pontos errados.
 *  2. Estilo diferente entre paredes vizinhas (kind/thickness/lineStyle
 *     distintos, OU só uma das duas está selecionada) — Pixi só aceita UM
 *     `width`/`color`/`cap`/`join` por `stroke()`; sem essa quebra, editar o
 *     estilo de 1 parede de uma Sala de 4 mudaria a aparência das outras 3
 *     (ou pior, o Pixi aplicaria o estilo errado a alguma delas).
 *
 * Paredes soltas (sem `regionId`+`regionEdgeIndex`) e runs de 1 parede só
 * (por quebra de estilo, ou vizinho apagado) continuam se comportando como
 * "parede solta, cap independente" — mesmo fallback que já existia antes
 * desta fase, agora também alcançável a partir de uma Região com estilo misto.
 */
function groupWallsForPath(walls: WallWithStyle[], selectedWallId: string | null): WallRun[] {
  const byRegion = new Map<string, RegionEdgeWall[]>()
  const runs: WallRun[] = []

  for (const wall of walls) {
    if (hasRegionEdge(wall)) {
      const list = byRegion.get(wall.regionId) ?? []
      list.push(wall)
      byRegion.set(wall.regionId, list)
    } else {
      runs.push({ walls: [wall], style: resolveWallStyle(wall, wall.id === selectedWallId) })
    }
  }

  for (const group of byRegion.values()) {
    const sorted = [...group].sort((a, b) => a.regionEdgeIndex - b.regionEdgeIndex)

    let currentRun: WallWithStyle[] = []
    let currentStyle: WallVisualStyle | null = null
    let previousIndex: number | null = null

    const flush = () => {
      if (currentRun.length > 0 && currentStyle) {
        runs.push({ walls: currentRun, style: currentStyle })
      }
    }

    for (const wall of sorted) {
      const style = resolveWallStyle(wall, wall.id === selectedWallId)
      const contiguous = previousIndex !== null && wall.regionEdgeIndex === previousIndex + 1
      const styleMatches = currentStyle !== null && sameStyle(style, currentStyle)
      if (contiguous && styleMatches) {
        currentRun.push(wall)
      } else {
        flush()
        currentRun = [wall]
        currentStyle = style
      }
      previousIndex = wall.regionEdgeIndex
    }
    flush()
  }

  return runs
}

const CLOSE_EPSILON = 1e-6

/** Uma run fecha (vira loop, `closePath()`) quando a última parede termina
 *  exatamente onde a primeira começa — checagem GEOMÉTRICA (coordenadas),
 *  não de índice: `drawWalls` só recebe `Wall[]`, nunca o `Region.points`
 *  original, então não há como saber `n` (o total de arestas da região) pra
 *  comparar contra `regionEdgeIndex`. Exigir `length >= 3` evita fechar um
 *  "polígono" degenerado de 2 lados (impossível fisicamente, mas a checagem
 *  de coordenada sozinha não bastaria pra descartar). */
function isClosedRun(run: WallWithStyle[]): boolean {
  if (run.length < 3) return false
  const first = run[0]
  const last = run[run.length - 1]
  return Math.abs(last.x2 - first.x1) < CLOSE_EPSILON && Math.abs(last.y2 - first.y1) < CLOSE_EPSILON
}

/** Desenha uma run inteira como UM path (`moveTo` + `lineTo` em sequência) e
 *  UM `stroke()` — mesmo padrão de `drawRegions.ts` (`createRegionsRenderer`,
 *  `draw`). Run de 1 parede só cai no mesmo código: `rest` fica vazio,
 *  `isClosedRun` é `false` (comprimento < 3), resultado idêntico a antes
 *  desta fase (1 `moveTo`+`lineTo`+`stroke`, sem `closePath`). */
function drawRun(graphics: Graphics, run: WallWithStyle[], style: WallVisualStyle): void {
  const [first, ...rest] = run
  graphics.moveTo(first.x1, first.y1).lineTo(first.x2, first.y2)
  for (const wall of rest) {
    graphics.lineTo(wall.x2, wall.y2)
  }
  if (isClosedRun(run)) {
    graphics.closePath()
  }
  graphics.stroke({ width: style.width, color: style.color, cap: style.cap, join: style.join })
}

/**
 * Desenha a LINHA da parede — largura/cor/ponta por `wallKind`/`thickness`/
 * `lineStyle`, com ou sem porta. `pixi/drawDoors.ts` desenha por cima o que
 * distingue visualmente uma parede-com-porta (ombreira + folha/barras, por
 * `door.kind`/`locked`).
 *
 * `cameraScale` (F6, "espessura constante em pixel de TELA"): OPCIONAL,
 * default 1 (sem efeito — comportamento idêntico a antes desta fase quando
 * omitido, nenhum call site existente precisa mudar). Quando o integrador
 * passar `camera.scale` (ver CONTRATO no relatório), a largura final vira
 * `width / cameraScale` — como `wallsGraphics` é filho de `world`
 * (`PixiCanvas.tsx`, `world.scale.set(camera.scale)`), dividir aqui cancela
 * essa multiplicação e a parede fica com a MESMA espessura em px de tela em
 * qualquer zoom, em vez de crescer/encolher junto com o mundo. IMPORTANTE
 * (ver relatório): isso só fica correto ao vivo durante um gesto de zoom se
 * o integrador também redesenhar (`redrawShapes`) no handler de wheel — hoje
 * `onWheel` só atualiza `world.scale`, sem chamar `redrawShapes` — então
 * ligar o parâmetro sem esse segundo passo deixaria a espessura "presa" na
 * escala do último redraw disparado por edição, não da escala atual.
 */
export function drawWalls(graphics: Graphics, walls: WallWithStyle[], selectedWallId: string | null = null, cameraScale = 1): void {
  graphics.clear()
  const runs = groupWallsForPath(walls, selectedWallId)
  for (const { walls: run, style } of runs) {
    const scaledStyle: WallVisualStyle = cameraScale === 1 ? style : { ...style, width: style.width / cameraScale }
    drawRun(graphics, run, scaledStyle)
  }
}
