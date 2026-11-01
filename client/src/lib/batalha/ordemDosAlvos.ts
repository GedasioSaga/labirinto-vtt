import { blocosEntre } from './blocos'

/**
 * C4 (lote de 01/11, item 8 do pedido): a ordem dos alvos na mira. Inimigos
 * primeiro, do mais perto ao mais longe; depois os aliados, também por
 * distância; você (quem age) por último. Dentro de cada grupo, quem caiu vai
 * para o fim; empate de distância, pelo nome.
 *
 * Puro: a tela passa os alvos (a forma de `AlvoNaMira`) e a distância de
 * cada um até quem age.
 */

/** O que a ordem lê de um alvo. `lado` "outro" = inimigo (NPC ou jogador de outra equipe). */
export interface AlvoParaOrdenar {
  tokenId: string
  nome: string
  lado: 'eu' | 'aliado' | 'outro'
  caiu?: boolean
}

const PESO_DO_LADO: Readonly<Record<AlvoParaOrdenar['lado'], number>> = { outro: 0, aliado: 1, eu: 2 }

/**
 * Os alvos na ordem da mira. `distancia` = blocos até quem age; `null` =
 * não se sabe (token fora do mapa), vai depois dos que têm distância. Não
 * muda a lista recebida.
 */
export function ordenarAlvosDaMira<T extends AlvoParaOrdenar>(alvos: readonly T[], distancia: (tokenId: string) => number | null): T[] {
  const medidos = alvos.map((alvo) => ({ alvo, blocos: distancia(alvo.tokenId) }))
  medidos.sort((a, b) => {
    const lado = PESO_DO_LADO[a.alvo.lado] - PESO_DO_LADO[b.alvo.lado]
    if (lado !== 0) return lado
    const caiu = Number(a.alvo.caiu === true) - Number(b.alvo.caiu === true)
    if (caiu !== 0) return caiu
    if (a.blocos !== b.blocos) {
      if (a.blocos === null) return 1
      if (b.blocos === null) return -1
      return a.blocos - b.blocos
    }
    return a.alvo.nome.localeCompare(b.alvo.nome, 'pt-BR') || a.alvo.tokenId.localeCompare(b.alvo.tokenId)
  })
  return medidos.map((medido) => medido.alvo)
}

/** Um ponto do mundo (px), como o token guarda. */
export interface PontoNoMapa {
  x: number
  y: number
}

/**
 * Blocos entre dois tokens, com a diagonal custando 1 (a mesma conta do
 * movimento, `blocosEntre`). `tamanhoDaCasa` = o lado da casa em px; torto
 * (0, negativo, não número) ou ponto ausente = `null`.
 */
export function blocosEntreTokens(a: PontoNoMapa | undefined, b: PontoNoMapa | undefined, tamanhoDaCasa: number): number | null {
  if (a === undefined || b === undefined || !Number.isFinite(tamanhoDaCasa) || tamanhoDaCasa <= 0) return null
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null
  const casa = (ponto: PontoNoMapa): { col: number; row: number } => ({ col: Math.floor(ponto.x / tamanhoDaCasa), row: Math.floor(ponto.y / tamanhoDaCasa) })
  return blocosEntre(casa(a), casa(b))
}
