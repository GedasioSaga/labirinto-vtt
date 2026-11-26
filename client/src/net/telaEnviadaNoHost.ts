/**
 * TELA ENVIADA: a última tela de cada conexão (`SentView`), as entradas do
 * último recorte de cada jogador (`ViewInputs`) e as comparações que decidem
 * se o broadcast refaz o recorte, manda `patch` ou a tela inteira. Saiu de
 * hostSession.ts sem mudar nada.
 */
import type { DoorState, MapData, Wall } from '../types/map'
import { encodeExploration, type Exploration, type ExploredWire, type MemoryRing } from '../lib/exploration'
import type { PlanMemory } from '../lib/fogFilter'
import { cacheDoRecorte } from '../lib/cacheDoRecorte'
import type { CabineDeTransporte } from '../lib/cabine'
import { mesmasFormasVisiveis, type FormasVisiveis } from '../lib/mudarFicha'
import { mesmasPastilhas, type PastilhasDasFichas } from '../lib/condicoes/pastilhas'
import { ehConstrucao } from '../lib/mobilia/construcoes'
import type { HostMessage } from './protocol'
import type { PlayerViewContent } from './viewPatch'
import type { PlayerMemory } from './memoriaNoHost'

/**
 * Com o que o último recorte de um jogador foi feito. Igual no broadcast
 * seguinte = o recorte sairia igual: o host não refiltra nem reenvia. Os mapas
 * são comparados por REFERÊNCIA — as stores do mestre (mapStore e o cache da
 * aventura) nunca editam um `MapData` no lugar, então mapa que mudou é outro
 * objeto. `epoch` cobre o que é da sessão e vale para todos ("Quem vê").
 */
export interface ViewInputs {
  map: MapData
  /** Mapas das OUTRAS cenas onde ele tem ficha (a lista "minhas fichas em outras cenas"). */
  elsewhere: MapData[]
  owned: string
  radius: number
  epoch: number
  /**
   * CABINE DE TRANSPORTE: as cabines da aventura (por referência) e as que
   * outro jogador ocupa, vistas por ele. Mudam o "aqui/longe/ocupada" da
   * parada no recorte sem mudar o mapa.
   */
  cabines: readonly CabineDeTransporte[] | undefined
  ocupadas: string
  /**
   * MUDAR FICHA: a imagem da forma de cada token da cena (`formasDoMapa`). Vem
   * da ficha de personagem, não do mapa: trocar a imagem do cartão muda o
   * recorte sem o mapa mudar. Comparada por conteúdo (`mesmasFormasVisiveis`).
   */
  formas: FormasVisiveis | undefined
  /**
   * CONDIÇÕES NA FICHA (E4a): as pastilhas de cada token cuja ficha de
   * personagem tem condição (`pastilhasDoMapa`). Vêm da ficha, não do mapa: pôr
   * condição muda o recorte sem o mapa mudar. Comparadas por conteúdo (`mesmasPastilhas`).
   */
  pastilhas: PastilhasDasFichas | undefined
}

export function sameViewInputs(a: ViewInputs, b: ViewInputs): boolean {
  return (
    a.map === b.map &&
    a.owned === b.owned &&
    a.radius === b.radius &&
    a.epoch === b.epoch &&
    a.cabines === b.cabines &&
    a.ocupadas === b.ocupadas &&
    mesmasFormasVisiveis(a.formas, b.formas) &&
    mesmasPastilhas(a.pastilhas, b.pastilhas) &&
    a.elsewhere.length === b.elsewhere.length &&
    a.elsewhere.every((map, i) => map === b.elsewhere[i])
  )
}

/** O explorado `exp` continua igual aos bits e contornos guardados antes de uma soma no lugar. */
export function sameExploration(exp: Exploration, bitsBefore: Uint8Array, ringsBefore: readonly MemoryRing[]): boolean {
  return (
    exp.bits.length === bitsBefore.length &&
    exp.bits.every((byte, i) => byte === bitsBefore[i]) &&
    exp.rings.length === ringsBefore.length &&
    exp.rings.every((ring, i) => ring === ringsBefore[i])
  )
}

/**
 * A última tela que uma CONEXÃO recebeu, e de quais entradas ela saiu. É o que
 * deixa o broadcast mandar só o que mudou: o mapa da cena (referência — o
 * `mapStore` e o cache da aventura trocam o objeto a cada edição, nunca o
 * alteram no lugar), o raio, a posse e a memória do jogador.
 */
export interface SentView {
  playerId: string
  /** Mapa da cena de onde a tela saiu; `null` = a espera (sem cena). */
  map: MapData | null
  radius: number
  ownershipRev: number
  memory: PlayerMemory | undefined
  /** CABINE DE TRANSPORTE: as mesmas entradas de `ViewInputs.cabines`/`ocupadas`. */
  cabines: readonly CabineDeTransporte[] | undefined
  ocupadas: string
  /** O que a conexão tem na tela; `null` = a espera. É de onde sai o próximo `patch`. */
  view: PlayerViewContent | null
  /**
   * Os campos do snapshot que o `patch` NÃO leva (batalha, perigo,
   * portas por atravessar…), em JSON; `null` = a espera. Mudou algum: vai o
   * snapshot inteiro, senão o jogador ficaria com o de antes.
   */
  extras: string | null
  /** `rev` da última tela que a conexão recebeu: a `base` do próximo `patch`. */
  rev: number
  /**
   * Caracteres do JSON da última tela INTEIRA que a conexão recebeu (0 = não
   * medida: espera, ou conexão que não aplica `patch`). Decide se vale
   * mandar `patch` (`PATCH_MIN_SNAPSHOT_LENGTH`).
   */
  snapshotLength: number
  /**
   * O último recálculo, com estas MESMAS entradas, repetiu a tela e deixou a
   * memória como estava: recalcular de novo daria o mesmo, e o recorte pode
   * ser pulado. O primeiro recálculo depois de uma mudança nunca é estável — a
   * marcação do explorado pode mostrar mais no seguinte.
   */
  stable: boolean
  /**
   * As entradas de `lastViews` (`ViewInputs`: `viewEpoch` do "Quem vê", da
   * espera e do kick, mapas das outras cenas onde ele tem ficha); `null` = a
   * espera. Sem elas, o atalho do `stable` pularia o que só sobe o epoch.
   */
  inputs: ViewInputs | null
  /** Vez da iniciativa, hora do relógio e fator de visão, em JSON: entram na tela sem mudar o mapa. */
  session: string
}

export type SnapshotMessage = Extract<HostMessage, { type: 'snapshot' }>

/** O que sai na tela do jogador, sem o `rev` (que muda a cada broadcast). */
export function contentOf(msg: SnapshotMessage): PlayerViewContent {
  // Caça 12/11 (O2): as portas por atravessar mudam a cada passo na cidade; nos extras, cada passo ia inteiro (~300 kB).
  // QUEDA DO ALCANCE (peça D das sombras): os olhares mudam a cada passo, como a visão; vão no patch junto dela.
  const tela: PlayerViewContent = { map: msg.map, vision: msg.vision, explored: msg.explored, ownTokens: msg.ownTokens, concealed: msg.concealed, porAtravessar: msg.porAtravessar ?? [], olhares: msg.olhares ?? [] }
  // CEGUEIRA: as ondas andam com quem é sentido, a cada passo; vão no patch como os olhares. Sem onda, a tela é a de antes.
  if (msg.ondas !== undefined) tela.ondas = msg.ondas
  // TERRENO ALTO: no patch, não nos extras — o passo de uma ficha do piso de baixo ia como a tela inteira, com as fotos.
  if (msg.alto !== undefined) tela.alto = msg.alto
  // MODO BATALHA (análise 18/11, 2.2): o caminho andado muda a cada passo em batalha; nos extras, cada passo ia como a tela inteira.
  if (msg.caminhos !== undefined) tela.caminhos = msg.caminhos
  return tela
}

/**
 * O resto do snapshot (fora `contentOf`, `type` e `rev`), em JSON: batalha,
 * perigo, andares, relógio… O `patch` não leva nada disto — o jogador mantém
 * o que já tinha —, então mudou, vai inteiro. As portas por atravessar vão no patch (`contentOf`).
 */
export function extrasOf(msg: SnapshotMessage): string {
  const rest: Partial<SnapshotMessage> = { ...msg }
  delete rest.type
  delete rest.rev
  delete rest.map
  delete rest.vision
  delete rest.explored
  delete rest.ownTokens
  delete rest.concealed
  delete rest.porAtravessar
  delete rest.olhares
  delete rest.ondas
  delete rest.alto
  delete rest.caminhos
  return JSON.stringify(rest)
}

/** Mesmas entradas, item a item (a planta lembrada guarda o objeto do mapa, não cópia). */
export function samePlan(a: PlanMemory, b: PlanMemory): boolean {
  const keys = ['walls', 'floor', 'regions', 'drawings', 'markers', 'lines', 'stairs', 'pins'] as const // chaves de PlanMemory, conferidas pelo tsc
  return keys.every((key) => {
    const left: ReadonlyMap<string, unknown> = a[key]
    const right: ReadonlyMap<string, unknown> = b[key]
    if (left.size !== right.size) return false
    for (const [id, item] of left) if (right.get(id) !== item) return false
    return true
  }) && sameConstrucoes(a.construcoes, b.construcoes)
}

/** CONSTRUÇÕES lembradas (12/11/2026, campo opcional da planta): ausente conta como vazio. */
function sameConstrucoes(a: PlanMemory['construcoes'], b: PlanMemory['construcoes']): boolean {
  const left = a ?? new Map()
  const right = b ?? new Map()
  if (left.size !== right.size) return false
  for (const [id, item] of left) if (right.get(id) !== item) return false
  return true
}

/**
 * O explorado ganhou célula que o recorte anterior não tinha (`before`):
 * mesa retomada, memória por ficha, mapa de papel, planta revelada, "Dar o que
 * o grupo viu". Sem recorte anterior, qualquer célula conta.
 */
export function explorationGrewSince(exp: Exploration, before: Uint8Array | undefined): boolean {
  const bits = exp.bits
  if (before === undefined || before.length !== bits.length) return bits.some((byte) => byte !== 0)
  for (let i = 0; i < bits.length; i += 1) if ((bits[i] & ~before[i]) !== 0) return true
  return false
}

/**
 * A memória da planta de um recorte feito sem ela (`explorationGrewSince`): a
 * versão do mestre de cada item que saiu ao jogador. Peça recortada (zona,
 * cone) tem outro id e fica de fora, como em `planOfWholeMap`.
 */
/** A cópia "revelada" de cada parede invisível: a mesma a cada recorte, para a planta lembrada não mudar à toa. */
const paredeRevelada = new WeakMap<Wall, Wall>()
/** O mapa com as paredes reveladas, por mapa e por conjunto: o mesmo objeto enquanto nada muda. */
const mapaRevelado = new WeakMap<MapData, Map<string, MapData>>()

/**
 * MODO BATALHA (regra de 27/10, esbarrar REVELA): o mapa como o recorte DESTE
 * jogador o lê — as paredes invisíveis em que ele esbarrou viram parede comum.
 * Sem nenhuma, o próprio mapa.
 */
export function comParedesReveladas(map: MapData, reveladas: ReadonlySet<string> | undefined): MapData {
  if (reveladas === undefined || reveladas.size === 0) return map
  const chave = [...reveladas].sort().join('\u0000')
  const porConjunto = mapaRevelado.get(map) ?? new Map<string, MapData>()
  const pronto = porConjunto.get(chave)
  if (pronto !== undefined) return pronto
  let mudou = false
  const walls = map.walls.map((w) => {
    if (w.hidden !== true || !reveladas.has(w.id)) return w
    mudou = true
    const copia = paredeRevelada.get(w) ?? { ...w, hidden: false }
    paredeRevelada.set(w, copia)
    return copia
  })
  const mapa = mudou ? { ...map, walls } : map
  porConjunto.set(chave, mapa)
  mapaRevelado.set(map, porConjunto)
  return mapa
}

export function planOfSent(map: MapData, sent: MapData): PlanMemory {
  const keep = <T extends { id: string }>(all: readonly T[], out: readonly { id: string }[]): Map<string, T> => {
    const ids = new Set(out.map((item) => item.id))
    return new Map(all.filter((item) => ids.has(item.id)).map((item) => [item.id, item]))
  }
  return {
    walls: keep(map.walls, sent.walls),
    floor: keep(map.floor, sent.floor),
    regions: keep(map.regions, sent.regions),
    drawings: keep(map.drawings, sent.drawings),
    markers: keep(map.markers, sent.markers),
    lines: keep(map.lines, sent.lines),
    stairs: keep(map.stairs, sent.stairs),
    pins: keep(map.pins ?? [], sent.pins ?? []),
    // CONSTRUÇÕES (12/11/2026): a que saiu no recorte fica lembrada, como o telhado.
    construcoes: keep(map.props.filter((p) => ehConstrucao(p.mobilia)), sent.props),
  }
}

export function doorsKey(doors: ReadonlyMap<string, DoorState>): string {
  return JSON.stringify([...doors])
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false
  return true
}

/** O último explorado codificado de cada memória: o que ele era (cópia dos bits) e o que saiu. */
const lastEncoded = new WeakMap<Exploration, { cell: number; cols: number; rows: number; bits: Uint8Array; rings: MemoryRing[]; ringCount: number; wire: ExploredWire }>()

/**
 * `encodeExploration` que devolve o MESMO objeto quando o explorado não mudou
 * desde a última vez (os bits iguais, byte a byte, e os anéis: a lista só
 * cresce por `push` ou é trocada inteira). No mapa 200x200 eram ~107 KB de
 * base64 refeitos a cada passo do NPC que o mestre arrasta; e o mesmo objeto
 * faz o patch resolver o explorado por identidade.
 */
export function encodeExplorationKept(exp: Exploration): ExploredWire {
  if (!cacheDoRecorte.ligado) return encodeExploration(exp)
  const kept = lastEncoded.get(exp)
  if (
    kept !== undefined &&
    kept.cell === exp.cell &&
    kept.cols === exp.cols &&
    kept.rows === exp.rows &&
    kept.rings === exp.rings &&
    kept.ringCount === exp.rings.length &&
    sameBytes(kept.bits, exp.bits)
  ) {
    return kept.wire
  }
  const wire = encodeExploration(exp)
  lastEncoded.set(exp, { cell: exp.cell, cols: exp.cols, rows: exp.rows, bits: exp.bits.slice(), rings: exp.rings, ringCount: exp.rings.length, wire })
  return wire
}
