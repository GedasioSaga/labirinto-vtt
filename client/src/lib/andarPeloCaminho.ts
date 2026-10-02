import type { Point } from '../pixi/world'
import type { MapData } from '../types/map'
import { acharCaminho } from './caminhoEmGrade'
import { isTokenPathClear } from './collision'

/**
 * ANDAR PELO CAMINHO — o passo de quem anda sozinho no mapa (a rotina andando
 * e a patrulha andando), da mesma forma para os dois. O trecho até o destino
 * sai do caminho em grade (`lib/caminhoEmGrade.ts`): contorna parede, passa por
 * porta aberta, nunca atravessa parede nem porta fechada. É calculado uma vez
 * por trecho e guardado no estado do agendador; se o próximo canto deixa de
 * ser alcançável (porta fechou no caminho, o mestre mudou a ficha de lugar),
 * recalcula. Sem caminho, a ficha NÃO pula: o agendador a deixa onde está e
 * tenta de novo em `TENTAR_DE_NOVO_MS` — abriu a porta, ela segue.
 *
 * Puro: sem store, sem DOM.
 */

/** Sem caminho até o destino (porta fechada, sala sem saída): de quanto em quanto ela procura de novo. */
export const TENTAR_DE_NOVO_MS = 1000

/**
 * Os cantos que faltam até `destino` (o último é ele): o trajeto guardado, se
 * ainda leva lá e o próximo canto continua alcançável daqui; senão, um caminho
 * novo. Já no destino: `[]`. `null`: sem caminho agora.
 */
export function trajetoAte(aqui: Point, destino: Point, guardado: readonly Point[] | undefined, map: Pick<MapData, 'walls' | 'grid' | 'width' | 'height'>): readonly Point[] | null {
  const ultimo = guardado?.[guardado.length - 1]
  const proximo = guardado?.[0]
  const valeAinda =
    guardado !== undefined &&
    ultimo !== undefined &&
    proximo !== undefined &&
    ultimo.x === destino.x &&
    ultimo.y === destino.y &&
    isTokenPathClear(aqui, proximo, map.walls, map.grid)
  if (valeAinda) return guardado
  return acharCaminho(aqui, destino, map)?.slice(1) ?? null
}

/**
 * Um passo de `aqui` pelo `trajeto`, de `passo` px. Para EM cada canto em vez
 * de dobrá-lo no mesmo tique: o jogador desliza em linha reta de um ponto ao
 * outro, e um passo que dobrasse a quina o faria ver a ficha atravessar a
 * ponta da parede. Sem arredondar: o destino guarda o x/y cru da ficha (22,5 no
 * centro de uma casa de 45 px, irracional na grade hexagonal), e a chegada é
 * por igualdade exata.
 */
export function andarPeloTrajeto(aqui: Point, trajeto: readonly Point[], passo: number): { para: Point; resta: readonly Point[] } {
  const alvo = trajeto[0]
  if (alvo === undefined) return { para: aqui, resta: trajeto }
  const dist = Math.hypot(alvo.x - aqui.x, alvo.y - aqui.y)
  if (dist <= passo) return { para: { x: alvo.x, y: alvo.y }, resta: trajeto.slice(1) }
  const k = passo / dist
  return { para: { x: aqui.x + (alvo.x - aqui.x) * k, y: aqui.y + (alvo.y - aqui.y) * k }, resta: trajeto }
}
