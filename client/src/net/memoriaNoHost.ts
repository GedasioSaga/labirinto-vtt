/**
 * MEMÓRIA NO HOST: o que cada jogador e cada ficha lembram de uma cena
 * (explorado, portas vistas, planta), como a mesa a grava e a retoma, e a
 * chave por piso. Saiu de hostSession.ts sem mudar nada; quem lê e escreve a
 * memória continua lá (`memoryFor`, `recordTokenMemories`…).
 */
import type { DoorState, MapData, RegionPoint, Token } from '../types/map'
import { createExploration, decodeExploration, encodeExploration, mergeExploration, type Exploration, type ExploredWire } from '../lib/exploration'
import { emptyPlanMemory, type PlanMemory } from '../lib/fogFilter'
import { doorStateOf, savedDoorOf, type SavedSceneMemory } from '../lib/savedTable'

/**
 * O que uma FICHA lembra de um mapa (MEMÓRIA POR FICHA): células exploradas e
 * último estado visto de cada porta. `doorSeen` guarda quando (ordem do host,
 * `memorySeq`) cada porta foi vista: ao somar memórias, vale a vista mais nova.
 */
export interface SceneMemory {
  key: string
  /**
   * O mapa a que o explorado corresponde: é o que a mesa grava para retomar.
   * Com a mesma grade, redimensionar o mapa leva o explorado junto e troca isto.
   */
  dims: MemoryDims
  exp: Exploration
  doors: Map<string, DoorState>
  /**
   * Por id da parede: quando (`memorySeq`) a porta foi vista por último. A
   * tela da mesa junta a memória do grupo pela vista mais recente, e a MEMÓRIA
   * POR FICHA soma memórias do mesmo jeito.
   */
  doorSeen: Map<string, number>
  /**
   * FORA DO CHÃO (caça de 12/11/2026, N6): o Chão limitava a visão na última
   * vez que esta memória foi conferida (`esquecerForaDoChao`). Ausente = nunca
   * conferida (memória nova ou da mesa retomada). Quando a cena passa de
   * "Livre" para "Bloqueado", o que ela lembra fora do Chão é apagado.
   */
  chaoLimitava?: boolean
}

/**
 * O que um jogador lembra de um mapa: a memória de cena, a planta como ele a
 * viu e a visão do último snapshot.
 */
export interface PlayerMemory extends SceneMemory {
  /**
   * Só o que a VISÃO dele marcou (sem "Revelar planta" nem planta conhecida).
   * É o que "Dar o que o grupo viu" repassa: a planta que o mestre revelou a
   * um jogador não pode vazar para o colega por esse caminho.
   */
  seen: Exploration
  /** A planta revelada (da cena ou por "Revelar planta para…") já foi marcada nesta memória. */
  planMarked: boolean
  /** Ids das marcas de jogador (bilhete no lugar) que ele já recebeu: só estas voltam pelo explorado. */
  marcas: Set<string>
  /**
   * Pinos que o jogador viu BARRADOS da última vez que os teve na visão. Na
   * névoa o pino sai com esta barra, não a de agora (`marcarTrancasParaJogador`).
   */
  pinosBarrados: Set<string>
  /** Visão enviada no último snapshot: é o que o jogador está vendo agora na tela. */
  vision: RegionPoint[][]
  /**
   * MODO BATALHA (regra de 27/10): paredes invisíveis em que a ficha dele
   * esbarrou neste mapa. Para ele deixam de ser invisíveis (entram no recorte
   * como parede comum); para os colegas, nada muda. Ausente = nenhuma.
   */
  paredesReveladas?: Set<string>
  /** Fichas de OUTROS jogadores no último snapshot (`partyTokens`): os colegas que ele vê agora. */
  party: string[]
  /** Zonas ocultas e tetos fechados do último snapshot: o que ele já sabe que está escondido. */
  covered: RegionPoint[][]
  /**
   * CLICAR PARA ANDAR: só as zonas ocultas do último snapshot (o `concealed`
   * que ele recebeu, sem os tetos): a mesma máscara do caminho que a tela dele
   * calcula. Ausente = nenhum snapshot ainda.
   */
  ocultas?: RegionPoint[][]
  /**
   * Veio da mesa guardada e ainda não foi conferida contra o mapa de hoje: no
   * primeiro uso, o que o mestre escondeu desde então sai da memória.
   */
  restored: boolean
  /**
   * CÔMODO LEMBRADO — ids dos cômodos (`RoomMeta.comodo`) que o jogador já viu
   * neste mapa. Mora junto do explorado de propósito: "Esconder planta" e o
   * mapa redimensionado esquecem os dois de uma vez.
   */
  seenRooms: Set<string>
  /**
   * LUGARES: o id desta memória que vai ao jogador (`snapshot.place`). Nasce
   * com a memória e morre com ela ("Esconder planta", teto de cenas, kick):
   * memória nova é lugar novo. É um contador DO JOGADOR, nunca o id nem o nome
   * da cena: o mesmo id em dois jogadores não diz que eles estão no mesmo lugar.
   */
  place: string
  /**
   * A última versão VISTA de cada item da planta (`lib/fogFilter.ts`). Fora da
   * visão, o explorado mostra esta — o que o mestre mudou longe do jogador só
   * chega quando ele volta a ver o lugar. Só o snapshot a atualiza.
   */
  plan: PlanMemory
  /** O explorado que seguiu no último snapshot desta cena. `null` = nenhum ainda. */
  sentExplored: Pick<ExploredWire, 'bits' | 'rings'> | null
  /**
   * As fichas do último snapshot desta cena, COMO ELE AS RECEBEU (máscara do
   * nome, vulto sem nome). É daqui que sai o nome da ficha no sinal e no laser
   * de outro jogador: o que não está aqui, ele não pode ler.
   */
  tokens: readonly Token[]
  /**
   * DENTRO DA SALA SECRETA — salas secretas deste mapa em que a ficha dele já
   * esteve (`occupiedSecretRooms` do recorte). Abrem só para ele, também depois
   * que ele sai. Vive na memória da cena: "Esconder planta", mapa novo e o kick
   * esquecem junto com o explorado.
   */
  secretRooms: Set<string>
  /**
   * SALA SECRETA NA MEMÓRIA (caça de 12/11/2026, N3): as salas secretas
   * FECHADAS para ele no último recorte desta cena, com o polígono de então
   * (`PlayerMapView.closedSecretRooms`). A memória marca por cima delas como
   * chão vazio; no recorte em que uma deixa de estar fechada (a ficha entrou,
   * o mestre desmarcou "secreta" ou apagou a sala), o lugar dela é apagado da
   * memória antes de marcar, para ele não "lembrar" um interior que nunca viu.
   * Ausente = nenhum recorte ainda (memória nova, ou da mesa gravada por uma
   * versão sem o campo): toda sala secreta aberta no primeiro recorte conta
   * como recém-aberta. Vai para a mesa gravada (`SavedSceneMemory`, só no
   * arquivo do mestre) e volta na retomada (`restoredMemoryOf`).
   */
  secretasFechadas?: Map<string, RegionPoint[]>
}

export type MemoryDims = Pick<MapData, 'id' | 'width' | 'height' | 'grid'>

/**
 * Põe `memory` como a cena mais recente de `byScene` e esquece as mais
 * antigas acima de `max`.
 */
export function touchScene<T>(byScene: Map<string, T>, mapId: string, memory: T, max: number): void {
  // Apagar e regravar põe a cena no fim da ordem: é a mais recente agora.
  byScene.delete(mapId)
  byScene.set(mapId, memory)
  for (const oldest of byScene.keys()) {
    if (byScene.size <= max) break
    byScene.delete(oldest)
  }
}

/** Grava a porta vista agora, no instante `seq`. */
export function rememberDoor(memory: SceneMemory, doorId: string, door: DoorState, seq: number): void {
  memory.doors.set(doorId, { ...door })
  memory.doorSeen.set(doorId, seq)
}

/**
 * MEMÓRIA POR FICHA — soma em `target` o que `source` lembra: células (menos
 * as que tocam `forbidden`) e portas, cada porta com a vista mais nova das
 * duas. O estado lembrado de uma porta não põe a porta no pacote: quem decide
 * se ela sai é o recorte (célula explorada ao lado, fora de zona e de sala
 * secreta), igual à porta que o jogador lembra por si.
 */
export function inheritMemory(target: SceneMemory, source: SceneMemory, forbidden: readonly RegionPoint[][]): void {
  mergeExploration(target.exp, source.exp, forbidden)
  for (const [doorId, door] of source.doors) {
    const seenAt = source.doorSeen.get(doorId) ?? 0
    if ((target.doorSeen.get(doorId) ?? -1) >= seenAt) continue
    rememberDoor(target, doorId, door, seenAt)
  }
}

export function memoryKey(map: MemoryDims): string {
  return `${map.id}|${map.width}|${map.height}|${map.grid}`
}

/** MapData.width/height estão em células; o explorado mede px de mundo (mesma unidade da visão). */
export function worldSizeOf(map: MemoryDims): { width: number; height: number; grid: number } {
  return { width: map.width * map.grid, height: map.height * map.grid, grid: map.grid }
}

export function dimsOf(map: MapData): MemoryDims {
  return { id: map.id, width: map.width, height: map.height, grid: map.grid }
}

/** Explorado vazio do tamanho do mapa. */
export function blankExploration(map: MemoryDims): Exploration {
  return createExploration(worldSizeOf(map))
}

/** A memória como a mesa a grava: o fio do explorado e as portas vistas. */
export function savedSceneOf(memory: PlayerMemory): SavedSceneMemory {
  const { id, width, height, grid } = memory.dims
  return {
    mapId: id,
    width,
    height,
    grid,
    explored: encodeExploration(memory.exp),
    doors: [...memory.doors].map(([wallId, door]) => savedDoorOf(wallId, door)),
    // SALA SECRETA (N3): as fechadas do último recorte vão junto, para a retomada saber quais o explorado lembra como chão.
    ...(memory.secretasFechadas === undefined ? {} : { secretasFechadas: [...memory.secretasFechadas].map(([id, points]) => ({ id, points })) }),
  }
}

/**
 * A memória guardada de volta, ou `null` quando o fio está torto ou não tem o
 * tamanho que o mapa gravado daria hoje (bitset de outro tamanho leria células erradas).
 */
export function restoredMemoryOf(scene: SavedSceneMemory): Omit<PlayerMemory, 'place'> | null {
  const dims: MemoryDims = { id: scene.mapId, width: scene.width, height: scene.height, grid: scene.grid }
  const exp = decodeExploration(scene.explored)
  const blank = blankExploration(dims)
  if (exp === null || exp.cell !== blank.cell || exp.cols !== blank.cols || exp.rows !== blank.rows) return null
  const doors = new Map<string, DoorState>(scene.doors.map((door) => [door.wallId, doorStateOf(door)]))
  // Cômodo lembrado não é gravado na mesa: volta a ser lembrado quando for visto de novo.
  return {
    key: memoryKey(dims),
    dims,
    exp,
    seen: blankExploration(dims),
    planMarked: false,
    doors,
    doorSeen: new Map(),
    marcas: new Set(),
    // A barra lembrada não vai para a mesa: é estado da sessão, e a sessão nova começa sem barra.
    pinosBarrados: new Set(),
    vision: [],
    party: [],
    covered: [],
    restored: true,
    seenRooms: new Set(),
    plan: emptyPlanMemory(),
    sentExplored: null,
    tokens: [],
    secretRooms: new Set(),
    // SALA SECRETA (N3): as que estavam fechadas quando a mesa foi gravada. A que o mestre desmarcou ou apagou
    // nesse meio-tempo tem o lugar apagado no primeiro recorte (`esquecerSalasQueAbriram`): nasce preta, não
    // lembrada. Mesa de antes (sem o campo): ausente, e toda sala aberta conta como recém-aberta.
    ...(scene.secretasFechadas === undefined ? {} : { secretasFechadas: new Map(scene.secretasFechadas.map((sala) => [sala.id, sala.points])) }),
  }
}

/** Separa o id do mapa do piso na chave de memória: não aparece em id gerado pelo app. */
const PISO_NA_CHAVE = '#piso:'

/**
 * PISOS NA MESMA CENA — a memória de cada piso é outra (explorado e portas
 * lembradas): o térreo explorado não pode abrir o 1º piso, que ocupa o mesmo
 * lugar do plano. O térreo usa a chave de sempre (`map.id`), então a memória de
 * quem já jogava num mapa sem pisos continua valendo.
 */
export function sceneMemoryId(map: MapData, piso: number): string {
  return piso === 0 ? map.id : `${map.id}${PISO_NA_CHAVE}${piso}`
}

/** O id do mapa de uma chave de memória (`sceneMemoryId`): a de qualquer piso volta ao mesmo mapa. */
export function mapIdOfMemory(memoryId: string): string {
  const cut = memoryId.indexOf(PISO_NA_CHAVE)
  return cut === -1 ? memoryId : memoryId.slice(0, cut)
}

/** A chave é de um piso fora do térreo? (a mesa guardada só grava o térreo). */
export function isUpperFloorMemory(memoryId: string): boolean {
  return memoryId.includes(PISO_NA_CHAVE)
}

/** "Esconder planta" da cena: a memória de TODOS os pisos dela. */
export function forgetSceneMemories(byScene: Map<string, unknown> | undefined, mapId: string): void {
  if (byScene === undefined) return
  for (const key of [...byScene.keys()]) {
    if (key === mapId || key.startsWith(`${mapId}${PISO_NA_CHAVE}`)) byScene.delete(key)
  }
}
