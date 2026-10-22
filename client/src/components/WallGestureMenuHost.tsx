import { useMapStore } from '../stores/mapStore'
import type { MenuDaParede } from '../pixi/wallGesture'
import { ComSaida, type ComSaidaFilho } from './grimorio/ComSaida'
import { WallGestureMenu } from './WallGestureMenu'

/**
 * O menu da parede ligado à store, aberto quando há `menu`. Fechado, ele ainda
 * sai em 120 ms com o que mostrava (`ComSaida`), como os menus da porta e do token.
 */
export function WallGestureMenuHost({ menu, onClose }: { menu: MenuDaParede | null; onClose: () => void }) {
  return (
    <ComSaida>
      {menu !== null && (
        // `key`: outro ponto (ou outra parede) remonta o menu ali, em vez de levar o que está saindo.
        <MenuDaParedeLigado key={`${menu.wallId}-${menu.x}-${menu.y}`} menu={menu} onClose={onClose} />
      )}
    </ComSaida>
  )
}

/**
 * "Abrir vão aqui" abre o vão no ponto do clique direito, "Desabar parede"
 * derruba a parede clicada — as duas pela store (`abrirVaoAqui`/`desabarParede`),
 * dos dois lados e com um Ctrl+Z só.
 */
function MenuDaParedeLigado({ menu, onClose, saindo }: { menu: MenuDaParede; onClose: () => void } & ComSaidaFilho) {
  return (
    <WallGestureMenu
      x={menu.x}
      y={menu.y}
      limite={menu.limite}
      onClose={onClose}
      saindo={saindo}
      onAbrirVao={() => useMapStore.getState().abrirVaoAqui(menu.wallId, menu.ponto)}
      onDesabar={() => useMapStore.getState().desabarParede(menu.wallId)}
    />
  )
}
