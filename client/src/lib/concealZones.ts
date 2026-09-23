import type { ConcealZone, RegionPoint } from '../types/map'
import { pointInRing } from './floorContour'

/** Zona que contém o ponto. De trás para a frente: a desenhada por último fica por cima. */
export function findConcealZoneAt(zones: readonly ConcealZone[], point: RegionPoint): ConcealZone | null {
  for (let i = zones.length - 1; i >= 0; i--) {
    const zone = zones[i]
    if (zone.points.length >= 3 && pointInRing(point, zone.points)) return zone
  }
  return null
}

/** Texto do rótulo no editor: nome (ou o padrão) e o estado quando revelada. */
export function concealZoneLabel(zone: ConcealZone): string {
  const name = zone.name.trim() === '' ? 'Zona oculta' : zone.name.trim()
  return zone.revealed ? `${name} (revelada)` : name
}
