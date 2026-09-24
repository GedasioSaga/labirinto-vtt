import type { SceneFloor } from '../types/map'

/**
 * MAPA POR ANDARES — cenas de uma aventura marcadas como andares do mesmo
 * prédio (minimapa de Resident Evil: 1F, 2F, B1). O mestre dá o nome do
 * prédio (que junta as cenas e nunca vai ao jogador) e o rótulo do andar (o
 * que o jogador lê na aba). O rótulo é curto e sem símbolo DE PROPÓSITO: é o
 * único texto do mestre que viaja nesta feature, e não pode virar canal para
 * o nome da cena.
 */

/** Teto do rótulo do andar: "B12", "RF", "10F". */
export const FLOOR_LABEL_MAX_LENGTH = 4
/** Teto do nome do prédio: é só do mestre, mas mora no arquivo. */
export const FLOOR_BUILDING_MAX_LENGTH = 60

const FLOOR_LABEL_SHAPE = /^[A-Z0-9]+$/

/** Rótulo limpo (maiúsculo, sem espaço) ou `null` quando não é rótulo de andar. */
export function cleanFloorLabel(raw: string): string | null {
  const label = raw.replace(/\s+/g, '').toUpperCase()
  if (label.length === 0 || label.length > FLOOR_LABEL_MAX_LENGTH) return null
  return FLOOR_LABEL_SHAPE.test(label) ? label : null
}

function cleanBuildingName(raw: string): string | null {
  const name = raw.trim().slice(0, FLOOR_BUILDING_MAX_LENGTH)
  return name.length > 0 ? name : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Leitura segura do disco (arquivo editado à mão, mapa de outra versão):
 * prédio sem nome ou rótulo que não é rótulo de andar voltam AUSENTES — a
 * cena abre comum, nunca como andar de um prédio inventado.
 */
export function readSceneFloor(raw: unknown): SceneFloor | undefined {
  if (!isRecord(raw)) return undefined
  const { predio, rotulo } = raw
  if (typeof predio !== 'string' || typeof rotulo !== 'string') return undefined
  const building = cleanBuildingName(predio)
  const label = cleanFloorLabel(rotulo)
  return building === null || label === null ? undefined : { predio: building, rotulo: label }
}

/** Chave de comparação do prédio: sem maiúsculas e sem espaços, como o nome do jogador. */
function buildingKey(predio: string): string {
  return predio.toLowerCase().replace(/\s+/g, '')
}

export function sameBuilding(a: SceneFloor, b: SceneFloor): boolean {
  return buildingKey(a.predio) === buildingKey(b.predio)
}

const BASEMENT = /^B(\d+)$/
const ABOVE_GROUND = /^(\d+)F$/
/** Rótulo fora do padrão (RF, M, T) vai depois dos andares numerados, em ordem alfabética. */
const UNNUMBERED_LEVEL = Number.MAX_SAFE_INTEGER

function floorLevel(label: string): number {
  const basement = BASEMENT.exec(label)
  if (basement !== null) return -Number(basement[1])
  const above = ABOVE_GROUND.exec(label)
  return above === null ? UNNUMBERED_LEVEL : Number(above[1])
}

/** Ordem das abas: do subsolo mais fundo ao andar mais alto, o resto no fim. */
export function sortFloorLabels(labels: readonly string[]): string[] {
  return [...labels].sort((a, b) => floorLevel(a) - floorLevel(b) || a.localeCompare(b))
}
