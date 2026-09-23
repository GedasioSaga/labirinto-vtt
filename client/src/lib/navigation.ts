import type { Screen } from '../types/screen'
import { FEATURES, type FeatureFlags } from './features'

/**
 * Pai de cada tela na hierarquia de navegação (menu → submenu → formulário).
 * `menu` é ponto fixo — `parentScreen('menu')` devolve `'menu'`, então voltar
 * no topo da hierarquia não "explode" nem precisa de caso especial no chamador.
 */
export const SCREEN_PARENT: Record<Screen, Screen> = {
  menu: 'menu',
  'map-type': 'menu',
  'new-dungeon': 'map-type',
  'load-map': 'menu',
  options: 'menu',
  editor: 'menu',
}

/**
 * Sem `otherMapTypes` o seletor de tipo é pulado ("Criar Mapas" abre o
 * formulário direto), então voltar do formulário leva ao menu, e não a uma
 * tela que o usuário nunca viu.
 */
export function parentScreen(screen: Screen, flags: Readonly<FeatureFlags> = FEATURES): Screen {
  if (screen === 'new-dungeon' && !flags.otherMapTypes) return 'menu'
  return SCREEN_PARENT[screen]
}

/** Tela que "Criar Mapas" abre: o seletor de tipo, ou direto o formulário do Dungeon Map. */
export function createMapScreen(flags: Readonly<FeatureFlags> = FEATURES): Screen {
  return flags.otherMapTypes ? 'map-type' : 'new-dungeon'
}
