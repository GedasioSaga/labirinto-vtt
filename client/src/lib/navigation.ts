import type { Screen } from '../types/screen'

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

export function parentScreen(screen: Screen): Screen {
  return SCREEN_PARENT[screen]
}
