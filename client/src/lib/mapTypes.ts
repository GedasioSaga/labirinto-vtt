/**
 * Catálogo dos tipos de mapa oferecidos em "Criar Mapas". Dado puro, sem JSX —
 * `MapTypePicker` mapeia isto para `MenuCard`, então testar o catálogo não
 * precisa de `@testing-library/react` (não instalado neste projeto).
 *
 * Nomes em inglês de propósito ("Dungeon Map", não "Mapa de Masmorra") — é a
 * convenção travada para os três tipos; a linha de apoio e o resto da
 * interface seguem em português.
 */
import { FEATURES, type FeatureFlags } from './features'

export interface MapTypeDef {
  id: 'dungeon' | 'isometric' | 'world'
  name: string
  description: string
  available: boolean
  badge?: string
}

export const MAP_TYPES: MapTypeDef[] = [
  {
    id: 'dungeon',
    name: 'Dungeon Map',
    description: 'Planta em grade, paredes, portas e tokens',
    available: true,
  },
  {
    id: 'isometric',
    name: 'Isometric Tactical Map',
    description: 'Vista isométrica com elevação',
    available: false,
    badge: 'Em breve',
  },
  {
    id: 'world',
    name: 'World Map',
    description: 'Região, cidade e rota de viagem',
    available: false,
    badge: 'Em breve',
  },
]

/**
 * Tipos que o seletor mostra. `MAP_TYPES` fica intacto (o catálogo é o
 * contrato); sem `otherMapTypes` só o Dungeon Map aparece.
 */
export function visibleMapTypes(flags: Readonly<FeatureFlags> = FEATURES): MapTypeDef[] {
  return flags.otherMapTypes ? MAP_TYPES : MAP_TYPES.filter((type) => type.id === 'dungeon')
}
