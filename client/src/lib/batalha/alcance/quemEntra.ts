/**
 * ALCANCE: QUEM ENTRA NAS CASAS ACESAS (plano docs/design/habilidades/ALCANCE.md §4 e §5). A
 * mesma conta na mira (quem vem marcado) e no host (quem pode ser marcado sem a confirmação do
 * "Fora do alcance, usar mesmo assim?"): a ficha entra se QUALQUER casa dela está acesa, e as
 * casas vêm de `casasDoAlcance` / `casasDaExplosao`, com a parede cortando pela regra da visão.
 * Quem está atrás de uma parede, mesmo dentro da explosão, não entra.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

import type { Segment } from '../../linhaDeVisao'
import { DIRECOES, distanciaEntreFichas, type Casa, type Direcao, type PegadaNaGrade } from '../area'
import { casasDaExplosao, casasDoAlcance } from './casas'
import { usaDirecao, type FormaDoAlcance } from './forma'

/** O mapa como a conta das casas o lê: os obstáculos de visão do piso, as casas da grade e o tamanho da casa. */
export interface MapaDoAlcance {
  segmentos: readonly Segment[]
  colunas: number
  linhas: number
  grade: number
}

/** A mesa sem grade conhecida (a Arena, o Testar sem mapa): sem parede e sem borda; só a distância conta. */
export const MAPA_SEM_PAREDES: MapaDoAlcance = { segmentos: [], colunas: Number.MAX_SAFE_INTEGER, linhas: Number.MAX_SAFE_INTEGER, grade: 1 }

/** Quem a área pega: só os do outro lado, só os do lado de quem usa, ou todos. */
export type QuemEntraNaForma = 'inimigos' | 'aliados' | 'todos'

/** Uma ficha que pode entrar: a ficha inteira na grade e se é do outro lado. */
export interface CandidatoNaForma {
  tokenId: string
  ficha: PegadaNaGrade
  inimigo: boolean
}

function chaveDaCasa(casa: Casa): string {
  return `${casa.col},${casa.row}`
}

/** As casas acesas, para perguntar "esta ficha pisa numa delas?". */
export function conjuntoDasCasas(casas: readonly Casa[]): ReadonlySet<string> {
  return new Set(casas.map(chaveDaCasa))
}

/**
 * As casas que a ficha inteira ocupa na grade (a pegada de `pegadaDaFicha`). Um lugar só para "onde
 * a ficha está": a conferência do alcance (`fichaNasCasas`) e a casa vermelha do chão (`casasPisadas`).
 */
export function casasDaFicha(ficha: PegadaNaGrade): Casa[] {
  const casas: Casa[] = []
  for (let row = ficha.row; row < ficha.row + ficha.tamanho; row += 1) {
    for (let col = ficha.col; col < ficha.col + ficha.tamanho; col += 1) casas.push({ col, row })
  }
  return casas
}

/** A ficha inteira pisa em alguma casa acesa (o token grande com um pé dentro entra). */
export function fichaNasCasas(acesas: ReadonlySet<string>, ficha: PegadaNaGrade): boolean {
  return casasDaFicha(ficha).some((casa) => acesas.has(chaveDaCasa(casa)))
}

/**
 * As casas acesas onde pisa alguma das fichas, na ordem de `casas`. A casa vermelha do chão
 * (pedido do dono, 27/11/2026: "quando os quadrados azuis acertarem um inimigo deixe o quadrado
 * vermelho"): pela mesma pegada de `fichaNasCasas`, então a casa fica vermelha exatamente quando a
 * conferência do alcance diz que a ficha está dentro.
 */
export function casasPisadas(casas: readonly Casa[], fichas: readonly PegadaNaGrade[]): Casa[] {
  if (fichas.length === 0 || casas.length === 0) return []
  const pisadas = conjuntoDasCasas(fichas.flatMap(casasDaFicha))
  return casas.filter((casa) => pisadas.has(chaveDaCasa(casa)))
}

/** As fichas que entram nas casas acesas, na ordem dos candidatos, pelo lado que a área pega. */
export function fichasNaForma(casas: readonly Casa[], candidatos: readonly CandidatoNaForma[], quem: QuemEntraNaForma): string[] {
  const acesas = conjuntoDasCasas(casas)
  return candidatos.filter((candidato) => (quem === 'todos' || candidato.inimigo === (quem === 'inimigos')) && fichaNasCasas(acesas, candidato.ficha)).map((candidato) => candidato.tokenId)
}

/**
 * As casas acesas da forma de quem usa. `direcao` `null` = o pedido não diz o lado (o de antes, a
 * tabela à mão sem frente): a forma que olha para um lado acende os quatro lados juntos.
 * `acendeQuemUsa`: as casas da ficha de quem usa também acendem (a ajuda que o pega, como no chão),
 * e por isso ele entra em `fichasNaForma` como qualquer ficha do lado dele.
 */
export function casasDaFormaDeQuemUsa(forma: FormaDoAlcance, quemUsa: PegadaNaGrade, direcao: Direcao | null, mapa: MapaDoAlcance, acendeQuemUsa = false): Casa[] {
  if (direcao !== null || !usaDirecao(forma)) return casasDoAlcance({ forma, quemUsa, direcao: direcao ?? 'norte', acendeQuemUsa, ...mapa })
  const vistas = new Set<string>()
  const todas: Casa[] = []
  for (const lado of DIRECOES) {
    for (const casa of casasDoAlcance({ forma, quemUsa, direcao: lado, acendeQuemUsa, ...mapa })) {
      const chave = chaveDaCasa(casa)
      if (vistas.has(chave)) continue
      vistas.add(chave)
      todas.push(casa)
    }
  }
  return todas
}

/** O que a conferência do alcance lê do golpe pedido. */
export interface GolpeNoAlcance {
  /** A forma que vale agora (já com as condições de quem usa). */
  forma: FormaDoAlcance
  quemUsa: PegadaNaGrade
  quemUsaTokenId: string
  direcao: Direcao | null
  mapa: MapaDoAlcance
  /** O centro da área longe: a casa (`ponto`) ou a ficha (`ficha`); `null` = não escolhido. */
  centro: PegadaNaGrade | null
  /** As fichas marcadas (sem posição na grade, fica de fora da conta). */
  alvos: readonly { tokenId: string; ficha: PegadaNaGrade }[]
}

/**
 * Onde o golpe sai das casas acesas: `'centro'` = o centro da área longe; um tokenId = a primeira
 * ficha marcada fora; `null` = tudo dentro. Quem usa marcado em si mesmo não é medido aqui (a regra
 * de quem pode ser alvo é outra), exceto na explosão, que o pega se ele está nela à vista do centro.
 */
export function foraDasCasas(golpe: GolpeNoAlcance): string | 'centro' | null {
  const { forma, quemUsa, quemUsaTokenId, direcao, mapa, centro } = golpe
  const longe = forma.tipo === 'ponto' || forma.tipo === 'ficha'
  const acesas = conjuntoDasCasas(casasDaFormaDeQuemUsa(forma, quemUsa, direcao, mapa))
  if (longe && centro !== null) {
    // A granada aos pés de quem usa vale (a casa dele não acende, mas o centro colado nele é dele).
    if (distanciaEntreFichas(quemUsa, centro) > 0 && !fichaNasCasas(acesas, centro)) return 'centro'
    const explosao = conjuntoDasCasas(casasDaExplosao({ forma, centro, ...mapa }))
    return golpe.alvos.find((alvo) => !fichaNasCasas(explosao, alvo.ficha))?.tokenId ?? null
  }
  // Sem centro (o pedido de antes): cada alvo marcado é medido como o centro seria.
  return golpe.alvos.find((alvo) => alvo.tokenId !== quemUsaTokenId && !fichaNasCasas(acesas, alvo.ficha))?.tokenId ?? null
}
