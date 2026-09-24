import { paredeDoGesto } from '../lib/abrirVao'
import type { useMapStore } from '../stores/mapStore'
import type { Point } from './world'

/**
 * O CLIQUE DIREITO SOBRE A PAREDE no canvas do mestre — a fiação entre o
 * evento do navegador e o menu "Abrir vão aqui / Desabar parede"
 * (WallGestureMenu). Fora do PixiCanvas para ter teste: o PixiCanvas só
 * liga o ouvinte (`ligarMenuDaParede`) e pergunta ao `pointerdown` se o botão
 * direito é deste gesto (`botaoDireitoEhDaParede`).
 */

/** Folga do clique direito sobre a parede, em px de TELA: a linha é fina e o
 *  alvo não pode encolher com o zoom. Quem usa divide pela escala da câmera. */
export const WALL_GESTURE_HIT_TOLERANCE = 12

/** Botão direito do mouse em `PointerEvent.button`/`MouseEvent.button`. */
const BOTAO_DIREITO = 2

/** O que o gesto lê da store — o mínimo, para o teste montar sem a store inteira. */
export type EstadoDoGesto = Pick<ReturnType<typeof useMapStore.getState>, 'activeTool' | 'floorShapeKind' | 'map'>

/** O menu aberto: `ponto` em px de MUNDO (onde o vão abre); `x`/`y` e `limite` em px do contêiner. */
export interface MenuDaParede {
  wallId: string
  ponto: Point
  x: number
  y: number
  limite: { width: number; height: number }
}

/** No pincel de blocos o botão direito APAGA (decisão do usuário, 15/09/2026): o gesto da parede fica de fora. */
function pincelDeBlocos(estado: EstadoDoGesto): boolean {
  return estado.activeTool === 'floor' && estado.floorShapeKind === 'blocos'
}

/**
 * `pointerdown` do botão direito EM CIMA de parede é do menu da parede
 * (`contextmenu`): não pode começar, por baixo, um traço, uma seleção ou um
 * arrasto. `true` = o `pointerdown` deve sair sem fazer nada.
 */
export function botaoDireitoEhDaParede(estado: EstadoDoGesto, botao: number, pontoNoMundo: Point, escala: number): boolean {
  if (botao !== BOTAO_DIREITO || pincelDeBlocos(estado)) return false
  return paredeDoGesto(estado.map, pontoNoMundo, WALL_GESTURE_HIT_TOLERANCE / escala) !== null
}

interface DependenciasDoMenu {
  estado: () => EstadoDoGesto
  /** Px do contêiner → px de mundo, com a câmera do momento do clique. */
  paraMundo: (x: number, y: number) => Point
  escala: () => number
  abrir: (menu: MenuDaParede) => void
}

/**
 * Liga o `contextmenu` do contêiner do mapa. Devolve quem desliga.
 *
 * - Pincel de blocos: some o menu do navegador (o botão direito apaga).
 * - Em cima de parede, em qualquer outra ferramenta: abre o menu da parede no
 *   ponto do clique — o mestre não troca de ferramenta nem vai ao painel.
 * - Fora de parede: o clique direito continua sendo o do navegador.
 */
export function ligarMenuDaParede(el: HTMLElement, deps: DependenciasDoMenu): () => void {
  const onContextMenu = (event: MouseEvent) => {
    const estado = deps.estado()
    if (pincelDeBlocos(estado)) {
      event.preventDefault()
      return
    }
    const caixa = el.getBoundingClientRect()
    const naTela = { x: event.clientX - caixa.left, y: event.clientY - caixa.top }
    const ponto = deps.paraMundo(naTela.x, naTela.y)
    const parede = paredeDoGesto(estado.map, ponto, WALL_GESTURE_HIT_TOLERANCE / deps.escala())
    if (parede === null) return
    event.preventDefault()
    deps.abrir({ wallId: parede.id, ponto, x: naTela.x, y: naTela.y, limite: { width: caixa.width, height: caixa.height } })
  }
  el.addEventListener('contextmenu', onContextMenu)
  return () => el.removeEventListener('contextmenu', onContextMenu)
}
