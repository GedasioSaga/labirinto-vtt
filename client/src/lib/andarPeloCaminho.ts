import type { Point } from '../pixi/world'

/**
 * ANDAR PELO CAMINHO — o passo de quem anda sozinho no mapa (a rotina andando
 * e a patrulha andando, pelo `caminhamento/andarilho.ts`), da mesma forma para
 * os dois. Só o PASSO: o caminho vem do motor (`caminhamento/busca.ts`). A
 * busca em grade que morava aqui (`trajetoAte`, sobre `lib/caminhoEmGrade.ts`)
 * foi aposentada na F1 de CAMINHOS (23/10/2026): não tinha mais quem chamasse.
 * Sem caminho, a ficha NÃO pula: o agendador a deixa onde está e tenta de novo
 * em `TENTAR_DE_NOVO_MS` — abriu a porta, ela segue.
 *
 * Puro: sem store, sem DOM.
 */

/** Sem caminho até o destino (porta fechada, sala sem saída): de quanto em quanto ela procura de novo. */
export const TENTAR_DE_NOVO_MS = 1000

/**
 * Um passo de `aqui` pelo `trajeto`, de `passo` px. Para EM cada canto em vez
 * de dobrá-lo no mesmo tique: o jogador desliza em linha reta de um ponto ao
 * outro, e um passo que dobrasse a quina o faria ver a ficha atravessar a
 * ponta da parede. Sem arredondar: o destino guarda o x/y cru da ficha (22,5 no
 * centro de uma casa de 45 px, irracional na grade hexagonal), e a chegada é
 * por igualdade exata.
 */
export function andarPeloTrajeto<T extends Point>(aqui: Point, trajeto: readonly T[], passo: number): { para: Point; resta: readonly T[] } {
  const alvo = trajeto[0]
  if (alvo === undefined) return { para: aqui, resta: trajeto }
  const dist = Math.hypot(alvo.x - aqui.x, alvo.y - aqui.y)
  if (dist <= passo) return { para: { x: alvo.x, y: alvo.y }, resta: trajeto.slice(1) }
  const k = passo / dist
  return { para: { x: aqui.x + (alvo.x - aqui.x) * k, y: aqui.y + (alvo.y - aqui.y) * k }, resta: trajeto }
}
