import type { DoorState } from '../types/map'

/**
 * Porta aberta E trancada não existe: trancada vence e a porta fecha. É a
 * regra de TRANCAR (`mapFactory.setDoorLocked`) e a da CARGA de um mapa salvo
 * antes da regra (`mapFile`), cuja porta o host já tratava como fechada
 * (`isDoorPassable`). O caminho inverso, abrir uma trancada, destranca e mora
 * em `mapFactory.setWallDoor`.
 */
export function closeIfLocked(door: DoorState): DoorState {
  return door.open && door.locked ? { ...door, open: false } : door
}
