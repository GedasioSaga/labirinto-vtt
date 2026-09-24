import type { DoorState, MapData, Pin, Wall } from '../types/map'

/**
 * ALAVANCA — regras puras, compartilhadas pelo host (validar o "Puxar" do
 * jogador), pelo painel do mestre (ligar e acionar) e pelo disco. Sem DOM,
 * sem store.
 *
 * A alavanca guarda só QUAL porta ela move (`Pin.portaLigada`), nunca o estado:
 * o estado é o da própria porta, e quem aciona inverte `door.open`. Assim a
 * porta aberta à mão pelo mestre e a aberta pela alavanca são a mesma porta.
 * Porta trancada não se move pela alavanca — trancada é decisão do mestre, e
 * a colisão (`lib/collision.ts`) nem deixaria passar uma porta aberta e trancada.
 */

/** Parede com porta, com o `door` já estreitado para não nulo. */
export type DoorWall = Wall & { door: DoorState }

function hasDoor(wall: Wall): wall is DoorWall {
  return wall.door !== null
}

/** A porta que a alavanca move, com o estado de agora. `null` = pino que não é alavanca, solta ou de porta apagada. */
export function linkedDoorOf(map: Pick<MapData, 'walls'>, pin: Pin): DoorWall | null {
  if (pin.kind !== 'alavanca' || pin.portaLigada === undefined) return null
  const wall = map.walls.find((w) => w.id === pin.portaLigada)
  return wall !== undefined && hasDoor(wall) ? wall : null
}

/**
 * O mestre aciona a alavanca `pinId` pelo painel: a porta ligada troca de
 * aberta para fechada (ou o contrário). Porta trancada, alavanca solta ou pino
 * inexistente devolvem o MESMO mapa — nada muda, nada vai para o desfazer.
 */
export function pullLever(map: MapData, pinId: string): MapData {
  const pin = map.pins.find((p) => p.id === pinId)
  const wall = pin === undefined ? null : linkedDoorOf(map, pin)
  if (wall === null || wall.door.locked) return map
  // Sem `mapFactory.setWallDoor` de propósito: `mapFile` importa este módulo
  // e `mapFactory` importa `mapFile` — o ciclo. A normalização de lá
  // (aberta + trancada) não se aplica: porta trancada já saiu acima.
  const door: DoorState = { ...wall.door, open: !wall.door.open }
  return { ...map, walls: map.walls.map((w) => (w.id === wall.id ? { ...w, door } : w)) }
}

/**
 * Leitura do disco: só texto não vazio vale. O resto (número, objeto, texto
 * vazio de arquivo editado à mão) volta AUSENTE — a alavanca abre solta, em
 * vez de apontar para uma porta que não existe.
 */
export function readPinLeverDoor(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Nome base de cada porta na lista "Abre a porta". */
export const LEVER_UNNAMED_DOOR = 'Porta'

export interface LeverDoorOption {
  id: string
  label: string
}

/**
 * As portas do mapa, na ordem dele, como a lista "Abre a porta" as mostra:
 * "Porta 2 · Cripta" quando a porta é da parede de uma Sala com nome, e só
 * "Porta 2" no resto. O número é a posição entre as portas: porta não tem
 * nome próprio, e a sala sozinha não separa duas portas da mesma sala.
 */
export function leverDoorOptions(map: Pick<MapData, 'walls' | 'regions'>): LeverDoorOption[] {
  const roomNames = new Map<string, string>()
  for (const region of map.regions) {
    const name = region.room?.name.trim() ?? ''
    if (name !== '') roomNames.set(region.id, name)
  }
  return map.walls.filter(hasDoor).map((wall, index) => {
    const base = `${LEVER_UNNAMED_DOOR} ${index + 1}`
    const room = wall.regionId === undefined ? undefined : roomNames.get(wall.regionId)
    return { id: wall.id, label: room === undefined ? base : `${base} · ${room}` }
  })
}
