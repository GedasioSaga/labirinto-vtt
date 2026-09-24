import { useMapStore } from '../stores/mapStore'
import type { MenuDaParede } from '../pixi/wallGesture'
import { WallGestureMenu } from './WallGestureMenu'

/**
 * O menu da parede ligado à store: "Abrir vão aqui" abre o vão no ponto do
 * clique direito, "Desabar parede" derruba a parede clicada — as duas pela
 * store (`abrirVaoAqui`/`desabarParede`), dos dois lados e com um Ctrl+Z só.
 */
export function WallGestureMenuHost({ menu, onClose }: { menu: MenuDaParede; onClose: () => void }) {
  return (
    <WallGestureMenu
      x={menu.x}
      y={menu.y}
      limite={menu.limite}
      onClose={onClose}
      onAbrirVao={() => useMapStore.getState().abrirVaoAqui(menu.wallId, menu.ponto)}
      onDesabar={() => useMapStore.getState().desabarParede(menu.wallId)}
    />
  )
}
